import { and, eq } from 'drizzle-orm'
import { NextRequest, NextResponse } from 'next/server'
import { resolveChorusAccess } from '@/lib/auth/session-guard'
import { db } from '@/lib/db/client'
import { chorusAnswers } from '@/lib/db/schema'
import { bumpAnswersVersion } from '@/lib/db/chorus-state'

export const dynamic = 'force-dynamic'

/**
 * Hides or unhides one answer. Controller-only. Never deletes: a hidden answer only stops showing
 * on the presenter window, and stays in the results. Allowed after End too — moderating the record
 * afterwards is still useful, and it doesn't change the presentation itself.
 */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ code: string; answerId: string }> }) {
  const { code, answerId } = await params
  const body = await req.json().catch(() => null)
  if (!body || typeof body.hidden !== 'boolean') return NextResponse.json({ error: 'invalid body' }, { status: 400 })

  const access = await resolveChorusAccess(code, body.token ?? null)
  if (access !== 'controller') return NextResponse.json({ error: 'forbidden' }, { status: 403 })

  const result = await db
    .update(chorusAnswers)
    .set({ hiddenAt: body.hidden ? Date.now() : null })
    .where(and(eq(chorusAnswers.id, answerId), eq(chorusAnswers.sessionId, code)))
  if ((result.rowsAffected ?? 0) === 0) return NextResponse.json({ error: 'answer not found' }, { status: 404 })

  await bumpAnswersVersion(code)
  return NextResponse.json({ ok: true })
}
