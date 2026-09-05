import { and, eq } from 'drizzle-orm'
import { NextRequest, NextResponse } from 'next/server'
import { checkRoomAccess } from '@/lib/auth/guard'
import { db } from '@/lib/db/client'
import { timers, roomState } from '@/lib/db/schema'
import { bumpVersion, loadRoomStatePayload } from '@/lib/db/room-state'
import { publishRoomState } from '@/lib/sync/publish'
import type { RoomStatePayload } from '@/lib/sync/transport'

export const dynamic = 'force-dynamic'

async function requireController(roomId: string, token: unknown) {
  return checkRoomAccess(roomId, typeof token === 'string' ? token : null)
}

/** Bumps version (so every connected client is guaranteed to notice — see bumpVersion's doc
 * comment), re-broadcasts, and returns the fresh payload so the caller can apply it to its own
 * screen immediately instead of waiting for the next poll/broadcast. */
async function rebroadcast(roomId: string): Promise<RoomStatePayload | null> {
  await bumpVersion(roomId)
  const payload = await loadRoomStatePayload(roomId)
  if (payload) await publishRoomState(roomId, payload)
  return payload
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

  const payload = await rebroadcast(roomId)
  return NextResponse.json({ ok: true, ...payload })
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
  // Version is bumped once, uniformly, by rebroadcast() below — not here — so this never
  // double-bumps.
  const [state] = await db.select().from(roomState).where(eq(roomState.roomId, roomId))
  if (state?.activeTimerId === timerId) {
    await db
      .update(roomState)
      .set({ activeTimerId: null, status: 'stopped', startedAtMs: null, elapsedBeforeMs: 0 })
      .where(eq(roomState.roomId, roomId))
  }

  const payload = await rebroadcast(roomId)
  return NextResponse.json({ ok: true, ...payload })
}
