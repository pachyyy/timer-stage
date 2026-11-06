import { NextRequest, NextResponse } from 'next/server'
import { getTranslations } from 'next-intl/server'
import { getChorusSession } from '@/lib/db/chorus'
import { getPresentationRow } from '@/lib/db/chorus-state'
import { castVote, countRecentVotes, getQuestion, removeVote } from '@/lib/db/chorus-qna'
import { checkVoteRateLimit, IP_WINDOW_MS } from '@/lib/chorus/rate-limit'
import { parseDeviceKey } from '@/lib/chorus/server'

export const dynamic = 'force-dynamic'

type Params = { params: Promise<{ code: string; questionId: string }> }

/** Shared checks: a live Q&A session and a visible question. Returns an error response, or null. */
async function guardVoting(code: string, questionId: string): Promise<NextResponse | null> {
  const t = await getTranslations('chorusApi')
  const session = await getChorusSession(code)
  const row = await getPresentationRow(code)
  if (!session || session.mode !== 'qna' || !row) {
    return NextResponse.json({ error: 'session not found' }, { status: 404 })
  }
  if (row.status !== 'live') return NextResponse.json({ error: t('qnaClosed') }, { status: 409 })
  const question = await getQuestion(code, questionId)
  if (!question || question.hiddenAt !== null) {
    return NextResponse.json({ error: 'question not found' }, { status: 404 })
  }
  return null
}

/** Casts the device's vote. Anonymous (the code is the only credential) and idempotent. */
export async function POST(req: NextRequest, { params }: Params) {
  const { code, questionId } = await params
  const body = await req.json().catch(() => null)
  const deviceKey = parseDeviceKey(body?.deviceKey)
  if (!deviceKey) return NextResponse.json({ error: 'invalid body' }, { status: 400 })

  const blocked = await guardVoting(code, questionId)
  if (blocked) return blocked

  const nowMs = Date.now()
  const verdict = checkVoteRateLimit(await countRecentVotes(code, deviceKey, nowMs - IP_WINDOW_MS))
  if (!verdict.ok) {
    const t = await getTranslations('chorusApi')
    const seconds = Math.max(1, Math.ceil(verdict.retryAfterMs / 1000))
    return NextResponse.json(
      { error: t('tooFast', { seconds }), retryAfterMs: verdict.retryAfterMs },
      { status: 429, headers: { 'Retry-After': String(seconds) } },
    )
  }

  await castVote({ code, questionId, deviceKey, nowMs })
  return NextResponse.json({ ok: true })
}

/** Removes the device's vote. The device key travels in the query string, since DELETE has no body. */
export async function DELETE(req: NextRequest, { params }: Params) {
  const { code, questionId } = await params
  const deviceKey = parseDeviceKey(req.nextUrl.searchParams.get('device'))
  if (!deviceKey) return NextResponse.json({ error: 'invalid body' }, { status: 400 })

  const blocked = await guardVoting(code, questionId)
  if (blocked) return blocked

  await removeVote({ code, questionId, deviceKey })
  return NextResponse.json({ ok: true })
}
