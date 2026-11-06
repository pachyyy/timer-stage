import { NextRequest, NextResponse } from 'next/server'
import { resolveChorusAccess } from '@/lib/auth/session-guard'
import { getChorusSession } from '@/lib/db/chorus'
import { loadChorusControlPayload } from '@/lib/db/chorus-state'
import { getQuestion, setQuestionFlags } from '@/lib/db/chorus-qna'
import { publishChorusState } from '@/lib/sync/publish'
import type { ChorusControlPayload } from '@/lib/chorus/types'

export const dynamic = 'force-dynamic'

/**
 * The host's moderation of one audience question: hide / unhide, mark answered / unanswered.
 * Controller-only. Never deletes. Allowed after End too (tidying the record doesn't change the
 * presentation). Hiding the question on screen also clears the highlight, which changes the public
 * state, so that case is broadcast; the response is always the fresh control payload.
 */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ code: string; questionId: string }> }) {
  const { code, questionId } = await params
  const body = await req.json().catch(() => null)
  const hidden = typeof body?.hidden === 'boolean' ? body.hidden : undefined
  const answered = typeof body?.answered === 'boolean' ? body.answered : undefined
  if (hidden === undefined && answered === undefined) {
    return NextResponse.json({ error: 'invalid body' }, { status: 400 })
  }

  const access = await resolveChorusAccess(code, body.token ?? null)
  if (access !== 'controller') return NextResponse.json({ error: 'forbidden' }, { status: 403 })

  const session = await getChorusSession(code)
  if (!session || session.mode !== 'qna') return NextResponse.json({ error: 'session not found' }, { status: 404 })
  if (!(await getQuestion(code, questionId))) return NextResponse.json({ error: 'question not found' }, { status: 404 })

  const { highlightCleared } = await setQuestionFlags({ code, questionId, hidden, answered, nowMs: Date.now() })

  const payload = await loadChorusControlPayload(code)
  if (!payload) return NextResponse.json({ error: 'session not found' }, { status: 404 })
  if (highlightCleared) await publishChorusState(code, payload.state)
  return NextResponse.json(payload satisfies ChorusControlPayload)
}
