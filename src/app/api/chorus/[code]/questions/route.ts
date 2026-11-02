import { count, eq } from 'drizzle-orm'
import { NextRequest, NextResponse } from 'next/server'
import { getTranslations } from 'next-intl/server'
import { resolveChorusAccess } from '@/lib/auth/session-guard'
import { generateId } from '@/lib/auth/tokens'
import { db } from '@/lib/db/client'
import { chorusQuestions } from '@/lib/db/schema'
import { listQuestions, loadChorusControlPayload } from '@/lib/db/chorus-state'
import { bumpPublishRespond, guardEditable } from '@/lib/chorus/server'
import { MAX_QUESTIONS, normalizePrompt } from '@/lib/chorus/model'
import { isPermutation } from '@/lib/timer/reorder'

export const dynamic = 'force-dynamic'

/** The controller's full snapshot (state + every question). What the control page refetches
 * whenever the public state's version moves, so another operator's edits show up too. */
export async function GET(req: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params
  const access = await resolveChorusAccess(code, req.nextUrl.searchParams.get('token'))
  if (access === 'none') return NextResponse.json({ error: 'session not found' }, { status: 404 })
  if (access !== 'controller') return NextResponse.json({ error: 'forbidden' }, { status: 403 })

  const payload = await loadChorusControlPayload(code)
  if (!payload) return NextResponse.json({ error: 'session not found' }, { status: 404 })
  return NextResponse.json(payload, { headers: { 'Cache-Control': 'no-store' } })
}

/** Appends a question. Allowed while draft or live — adding one mid-show is a normal thing to do;
 * an ended session is read-only. */
export async function POST(req: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params
  const body = await req.json().catch(() => null)
  if (!body) return NextResponse.json({ error: 'invalid body' }, { status: 400 })

  const guard = await guardEditable(code, body.token ?? null)
  if (guard) return guard

  const prompt = normalizePrompt(body.prompt)
  if (!prompt) return NextResponse.json({ error: 'prompt is required' }, { status: 400 })

  const [existing] = await db.select({ n: count() }).from(chorusQuestions).where(eq(chorusQuestions.sessionId, code))
  const position = existing?.n ?? 0
  if (position >= MAX_QUESTIONS) {
    const t = await getTranslations('chorusApi')
    return NextResponse.json({ error: t('tooManyQuestions', { max: MAX_QUESTIONS }) }, { status: 400 })
  }

  await db.insert(chorusQuestions).values({ id: generateId(), sessionId: code, position, prompt, createdAt: Date.now() })
  return bumpPublishRespond(code, { status: 201 })
}

/** Bulk drag-reorder, same contract as PATCH /api/rooms/[roomId]/timers: `order` must be an exact
 * permutation of the session's question ids, written in one batch with one version bump. */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params
  const body = await req.json().catch(() => null)
  if (!body || !Array.isArray(body.order) || !body.order.every((id: unknown) => typeof id === 'string')) {
    return NextResponse.json({ error: 'invalid body' }, { status: 400 })
  }

  const guard = await guardEditable(code, body.token ?? null)
  if (guard) return guard

  const order = body.order as string[]
  const existingIds = (await listQuestions(code)).map((q) => q.id)
  if (!isPermutation(order, existingIds)) {
    return NextResponse.json({ error: 'order must match the session’s existing questions' }, { status: 400 })
  }

  if (order.length > 0) {
    const writes = order.map((id, position) =>
      db.update(chorusQuestions).set({ position }).where(eq(chorusQuestions.id, id)),
    )
    await db.batch(writes as unknown as [(typeof writes)[number], ...(typeof writes)[number][]])
  }
  return bumpPublishRespond(code)
}
