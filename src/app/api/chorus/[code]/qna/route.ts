import { NextRequest, NextResponse } from 'next/server'
import { getTranslations } from 'next-intl/server'
import { resolveChorusAccess } from '@/lib/auth/session-guard'
import { getChorusSession } from '@/lib/db/chorus'
import { getFeedVersion, getPresentationRow } from '@/lib/db/chorus-state'
import { listFeed, readQnaRateInputs, submitQuestion } from '@/lib/db/chorus-qna'
import { normalizeAsked } from '@/lib/chorus/qna'
import { checkAnswerRateLimit, IP_WINDOW_MS, QNA_QUESTION_COOLDOWN_MS } from '@/lib/chorus/rate-limit'
import { hashClientIp, parseDeviceKey } from '@/lib/chorus/server'
import type { QnaFeedPayload } from '@/lib/chorus/types'

export const dynamic = 'force-dynamic'

/**
 * The Q&A feed: every audience question with its vote count. Unlike the answers feed this one is
 * PUBLIC, because the audience votes from it. It never rides the broadcast channel: phones poll it
 * with an ETag on `feedVersion`, so an unchanged poll is one cheap row read. Visibility:
 *  - audience / presenter: visible questions only; an audience device also gets which it voted for.
 *  - controller: hidden questions too (so they can be un-hidden).
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params
  const token = req.nextUrl.searchParams.get('token')
  const deviceKey = parseDeviceKey(req.nextUrl.searchParams.get('device'))

  const session = await getChorusSession(code)
  if (!session || session.mode !== 'qna') return NextResponse.json({ error: 'session not found' }, { status: 404 })

  // A phone sends no token, so skip the account/token lookup entirely: this is polled by the whole
  // audience every few seconds, and an anonymous request can only ever be the audience anyway.
  const access = token ? await resolveChorusAccess(code, token) : 'audience'
  const isController = access === 'controller'
  // Only a plain audience device gets a personalized "mine"; staff screens never vote.
  const device = access === 'audience' ? deviceKey : null

  const feedVersion = (await getFeedVersion(code)) ?? 0
  const etag = `"f${feedVersion}-${access}-${device ?? ''}"`
  if (req.headers.get('if-none-match') === etag) {
    return new NextResponse(null, { status: 304, headers: { ETag: etag } })
  }

  const feed = await listFeed(code, { includeHidden: isController, deviceKey: device })
  const payload: QnaFeedPayload = { feedVersion, ...feed }
  return NextResponse.json(payload, { headers: { ETag: etag, 'Cache-Control': 'no-store' } })
}

/**
 * An anonymous audience question. No credential: knowing the code is enough. Only while the session
 * is live and the host hasn't paused intake; a phone that raced a pause gets a clear 409.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params
  const body = await req.json().catch(() => null)
  const t = await getTranslations('chorusApi')

  const text = normalizeAsked(body?.text)
  if (!text) return NextResponse.json({ error: t('invalidQuestion') }, { status: 400 })
  const deviceKey = parseDeviceKey(body?.deviceKey)
  if (!deviceKey) return NextResponse.json({ error: 'invalid body' }, { status: 400 })

  const session = await getChorusSession(code)
  const row = await getPresentationRow(code)
  if (!session || session.mode !== 'qna' || !row) {
    return NextResponse.json({ error: 'session not found' }, { status: 404 })
  }
  if (row.status !== 'live') return NextResponse.json({ error: t('qnaClosed') }, { status: 409 })
  if (!row.intakeOpen) return NextResponse.json({ error: t('qnaPaused') }, { status: 409 })

  const nowMs = Date.now()
  const ipHash = hashClientIp(req, code)
  const limits = await readQnaRateInputs(code, deviceKey, ipHash, nowMs - IP_WINDOW_MS)
  const verdict = checkAnswerRateLimit({ nowMs, ...limits, cooldownMs: QNA_QUESTION_COOLDOWN_MS })
  if (!verdict.ok) {
    const seconds = Math.max(1, Math.ceil(verdict.retryAfterMs / 1000))
    return NextResponse.json(
      { error: t('tooFast', { seconds }), retryAfterMs: verdict.retryAfterMs },
      { status: 429, headers: { 'Retry-After': String(seconds) } },
    )
  }

  const id = await submitQuestion({ code, text, deviceKey, ipHash, nowMs })
  return NextResponse.json({ ok: true, id }, { status: 201 })
}
