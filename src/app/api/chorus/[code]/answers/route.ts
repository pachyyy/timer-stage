import { NextRequest, NextResponse } from 'next/server'
import { getTranslations } from 'next-intl/server'
import { resolveChorusAccess } from '@/lib/auth/session-guard'
import { generateId } from '@/lib/auth/tokens'
import { db } from '@/lib/db/client'
import { chorusAnswers } from '@/lib/db/schema'
import { bumpAnswersVersion, getAnswersVersion, getPresentationRow } from '@/lib/db/chorus-state'
import { countAnswersByQuestion, listAnswers, readRateLimitInputs } from '@/lib/db/chorus'
import { hashClientIp } from '@/lib/chorus/server'
import { normalizeAnswer } from '@/lib/chorus/model'
import { checkAnswerRateLimit, IP_WINDOW_MS } from '@/lib/chorus/rate-limit'
import type { ChorusAnswersPayload } from '@/lib/chorus/types'

export const dynamic = 'force-dynamic'

/**
 * The answers feed, for the presenter window and the control page only — answers never go over the
 * broadcast channel (see bumpAnswersVersion), so these one or two screens poll this with an ETag on
 * `answersVersion`, which makes an unchanged poll nearly free. The presenter gets visible answers
 * for one question; the controller also gets hidden ones, per-question counts, and (with no
 * `questionId`) every question at once for the results view.
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params
  const token = req.nextUrl.searchParams.get('token')
  const questionId = req.nextUrl.searchParams.get('questionId')

  const access = await resolveChorusAccess(code, token)
  if (access === 'none') return NextResponse.json({ error: 'session not found' }, { status: 404 })
  if (access !== 'controller' && access !== 'presenter') {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }
  const isController = access === 'controller'
  if (!isController && !questionId) return NextResponse.json({ error: 'questionId required' }, { status: 400 })

  const answersVersion = (await getAnswersVersion(code)) ?? 0
  const etag = `"a${answersVersion}-${questionId ?? 'all'}-${access}"`
  if (req.headers.get('if-none-match') === etag) {
    return new NextResponse(null, { status: 304, headers: { ETag: etag } })
  }

  const payload: ChorusAnswersPayload = {
    answersVersion,
    answers: await listAnswers(code, questionId, isController),
    counts: isController ? await countAnswersByQuestion(code) : {},
  }
  return NextResponse.json(payload, { headers: { ETag: etag, 'Cache-Control': 'no-store' } })
}

/**
 * An anonymous audience answer. No credential at all — knowing the code is enough, like joining a
 * room. Only accepted for the question currently on screen while the session is live, so a phone
 * that missed a Next can't post into the wrong question; it gets a 409 and refetches state.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params
  const body = await req.json().catch(() => null)
  const t = await getTranslations('chorusApi')

  const text = normalizeAnswer(body?.text)
  if (!text) return NextResponse.json({ error: t('invalidAnswer') }, { status: 400 })
  const deviceKey = typeof body?.deviceKey === 'string' ? body.deviceKey : ''
  if (deviceKey.length < 8 || deviceKey.length > 64) {
    return NextResponse.json({ error: 'invalid body' }, { status: 400 })
  }

  const row = await getPresentationRow(code)
  if (!row) return NextResponse.json({ error: 'session not found' }, { status: 404 })
  if (row.status !== 'live' || !row.currentQuestionId || body.questionId !== row.currentQuestionId) {
    return NextResponse.json({ error: t('questionClosed') }, { status: 409 })
  }

  const nowMs = Date.now()
  const ipHash = hashClientIp(req, code)
  const limits = await readRateLimitInputs(code, deviceKey, ipHash, nowMs - IP_WINDOW_MS)
  const verdict = checkAnswerRateLimit({ nowMs, ...limits })
  if (!verdict.ok) {
    const seconds = Math.max(1, Math.ceil(verdict.retryAfterMs / 1000))
    return NextResponse.json(
      { error: t('tooFast', { seconds }), retryAfterMs: verdict.retryAfterMs },
      { status: 429, headers: { 'Retry-After': String(seconds) } },
    )
  }

  await db.insert(chorusAnswers).values({
    id: generateId(),
    sessionId: code,
    questionId: row.currentQuestionId,
    text,
    createdAtMs: nowMs,
    deviceKey,
    ipHash,
  })
  await bumpAnswersVersion(code)
  return NextResponse.json({ ok: true }, { status: 201 })
}
