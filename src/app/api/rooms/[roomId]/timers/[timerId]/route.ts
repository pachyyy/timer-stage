import { and, eq } from 'drizzle-orm'
import { NextRequest, NextResponse } from 'next/server'
import { checkRoomAccess } from '@/lib/auth/guard'
import { db } from '@/lib/db/client'
import { timers, roomState } from '@/lib/db/schema'
import { loadRoomStatePayload } from '@/lib/db/room-state'
import { publishRoomState } from '@/lib/sync/publish'

export const dynamic = 'force-dynamic'

async function requireController(roomId: string, token: unknown) {
  return checkRoomAccess(roomId, typeof token === 'string' ? token : null)
}

async function rebroadcast(roomId: string) {
  const payload = await loadRoomStatePayload(roomId)
  if (payload) await publishRoomState(roomId, payload)
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ roomId: string; timerId: string }> },
) {
  const { roomId, timerId } = await params
  const body = await req.json().catch(() => null)
  if (!body) return NextResponse.json({ error: 'invalid body' }, { status: 400 })
  if ((await requireController(roomId, body.token)) !== 'controller') {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  const patch: Partial<typeof timers.$inferInsert> = {}
  if (typeof body.name === 'string') patch.name = body.name
  if (typeof body.speaker === 'string' || body.speaker === null) patch.speaker = body.speaker
  if (typeof body.notes === 'string' || body.notes === null) patch.notes = body.notes
  if (Number.isFinite(body.durationMs)) patch.durationMs = body.durationMs
  if (Number.isFinite(body.wrapUpMs)) patch.wrapUpMs = body.wrapUpMs
  if (Number.isFinite(body.position)) patch.position = body.position

  await db
    .update(timers)
    .set(patch)
    .where(and(eq(timers.id, timerId), eq(timers.roomId, roomId)))

  await rebroadcast(roomId)
  return NextResponse.json({ ok: true })
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ roomId: string; timerId: string }> },
) {
  const { roomId, timerId } = await params
  const body = await req.json().catch(() => ({}))
  if ((await requireController(roomId, body.token)) !== 'controller') {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  await db.delete(timers).where(and(eq(timers.id, timerId), eq(timers.roomId, roomId)))

  // If the deleted timer was active, clear it so the controller/viewer don't reference a ghost.
  const [state] = await db.select().from(roomState).where(eq(roomState.roomId, roomId))
  if (state?.activeTimerId === timerId) {
    await db
      .update(roomState)
      .set({ activeTimerId: null, status: 'stopped', startedAtMs: null, elapsedBeforeMs: 0, version: state.version + 1 })
      .where(eq(roomState.roomId, roomId))
  }

  await rebroadcast(roomId)
  return NextResponse.json({ ok: true })
}
