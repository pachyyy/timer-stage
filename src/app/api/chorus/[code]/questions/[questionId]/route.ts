import { and, eq } from 'drizzle-orm'
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db/client'
import { chorusQuestions } from '@/lib/db/schema'
import { getPresentationRow, listQuestions } from '@/lib/db/chorus-state'
import { bumpPublishRespond, guardEditable } from '@/lib/chorus/server'
import { afterDelete, normalizePrompt } from '@/lib/chorus/model'

export const dynamic = 'force-dynamic'

type Params = { params: Promise<{ code: string; questionId: string }> }

/** Edits a question's prompt. If it's the one on screen, the version bump carries the new text to
 * every phone and the presenter immediately. */
export async function PATCH(req: NextRequest, { params }: Params) {
  const { code, questionId } = await params
  const body = await req.json().catch(() => null)
  if (!body) return NextResponse.json({ error: 'invalid body' }, { status: 400 })

  const guard = await guardEditable(code, body.token ?? null)
  if (guard) return guard

  const prompt = normalizePrompt(body.prompt)
  if (!prompt) return NextResponse.json({ error: 'prompt is required' }, { status: 400 })

  const result = await db
    .update(chorusQuestions)
    .set({ prompt })
    .where(and(eq(chorusQuestions.id, questionId), eq(chorusQuestions.sessionId, code)))
  if ((result.rowsAffected ?? 0) === 0) return NextResponse.json({ error: 'question not found' }, { status: 404 })

  return bumpPublishRespond(code)
}

/**
 * Deletes a question — and, via the FK cascade, its answers (the confirm dialog says so). Deleting
 * the question currently on screen moves the presentation to the next one (see afterDelete) in the
 * same statement as the version bump. Remaining positions are compacted so the order stays 0..n-1.
 */
export async function DELETE(req: NextRequest, { params }: Params) {
  const { code, questionId } = await params
  const token = req.nextUrl.searchParams.get('token')

  const guard = await guardEditable(code, token)
  if (guard) return guard

  const before = await listQuestions(code)
  const beforeIds = before.map((q) => q.id)
  if (!beforeIds.includes(questionId)) return NextResponse.json({ error: 'question not found' }, { status: 404 })

  const row = await getPresentationRow(code)
  const nextCurrent = afterDelete(beforeIds, row?.currentQuestionId ?? null, questionId)

  await db.delete(chorusQuestions).where(eq(chorusQuestions.id, questionId))
  const remaining = beforeIds.filter((id) => id !== questionId)
  if (remaining.length > 0) {
    const writes = remaining.map((id, position) =>
      db.update(chorusQuestions).set({ position }).where(eq(chorusQuestions.id, id)),
    )
    await db.batch(writes as unknown as [(typeof writes)[number], ...(typeof writes)[number][]])
  }

  return bumpPublishRespond(code, { currentQuestionId: nextCurrent })
}
