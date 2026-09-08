import { eq, asc } from 'drizzle-orm'
import { NextRequest, NextResponse } from 'next/server'
import { resolveRoomAccess } from '@/lib/auth/session-guard'
import { db } from '@/lib/db/client'
import { rooms, timers } from '@/lib/db/schema'
import { generateId } from '@/lib/auth/tokens'
import { bumpVersion, loadRoomStatePayload } from '@/lib/db/room-state'
import { publishRoomState } from '@/lib/sync/publish'
import { isPermutation } from '@/lib/timer/reorder'
import { canAddSegments } from '@/lib/entitlements/gate'

export const dynamic = 'force-dynamic'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ roomId: string }> }) {
  const { roomId } = await params
  const rows = await db.select().from(timers).where(eq(timers.roomId, roomId)).orderBy(asc(timers.position))
  return NextResponse.json(rows)
}

/**
 * Append a timer to the agenda. Controller-only; bumps the room's version and re-broadcasts,
 * and returns the fresh payload so the caller can apply it to its own screen immediately instead
 * of waiting for the next poll/broadcast to deliver the same thing a few seconds later.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ roomId: string }> }) {
  const { roomId } = await params
  const body = await req.json().catch(() => null)
  if (!body) return NextResponse.json({ error: 'invalid body' }, { status: 400 })

  const access = await resolveRoomAccess(roomId, body.token)
  if (access !== 'controller') return NextResponse.json({ error: 'forbidden' }, { status: 403 })

  const existing = await db.select().from(timers).where(eq(timers.roomId, roomId))

  const [room] = await db.select({ ownerUserId: rooms.ownerUserId }).from(rooms).where(eq(rooms.id, roomId)).limit(1)
  const gate = await canAddSegments(room?.ownerUserId ?? null, existing.length, 1)
  if (!gate.allowed) {
    return NextResponse.json({ error: gate.reason ?? 'Plan limit reached' }, { status: 402 })
  }

  const id = generateId()

  await db.insert(timers).values({
    id,
    roomId,
    position: existing.length,
    name: typeof body.name === 'string' && body.name.trim() ? body.name.trim() : 'Untitled',
    speaker: body.speaker ?? null,
    notes: body.notes ?? null,
    type: 'countdown',
    durationMs: Number.isFinite(body.durationMs) ? body.durationMs : 5 * 60_000,
    wrapUpMs: Number.isFinite(body.wrapUpMs) ? body.wrapUpMs : 60_000,
  })

  await bumpVersion(roomId)
  const payload = await loadRoomStatePayload(roomId)
  if (payload) await publishRoomState(roomId, payload)

  return NextResponse.json({ id, ...payload }, { status: 201 })
}

/**
 * Bulk drag-reorder: `order` is the room's timer ids in their new top-to-bottom order. Deliberately
 * one round trip instead of N per-timer `position` PATCHes, which would be racy under a fast drag
 * and would bump `version` N times mid-gesture. Rejects anything that isn't an exact permutation of
 * the room's existing timer ids — the one place a malformed body could scramble a live agenda.
 */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ roomId: string }> }) {
  const { roomId } = await params
  const body = await req.json().catch(() => null)
  if (!body || !Array.isArray(body.order)) {
    return NextResponse.json({ error: 'invalid body' }, { status: 400 })
  }

  const access = await resolveRoomAccess(roomId, body.token)
  if (access !== 'controller') return NextResponse.json({ error: 'forbidden' }, { status: 403 })

  const order: unknown[] = body.order
  if (!order.every((id) => typeof id === 'string')) {
    return NextResponse.json({ error: 'invalid body' }, { status: 400 })
  }

  const existing = await db.select({ id: timers.id }).from(timers).where(eq(timers.roomId, roomId))
  const existingIds = existing.map((t) => t.id)
  if (!isPermutation(order as string[], existingIds)) {
    return NextResponse.json({ error: 'order must match the room’s existing timers' }, { status: 400 })
  }

  // db.batch runs every statement in one round trip against libSQL, atomically — a plain
  // Promise.all of N separate updates could interleave with e.g. a concurrent delete and leave
  // duplicate positions if one write failed partway through. drizzle's batch() type wants a
  // statically-known tuple; we only have a dynamic-length array, hence the unknown cast.
  const writes = (order as string[]).map((id, position) =>
    db.update(timers).set({ position }).where(eq(timers.id, id)),
  )
  await db.batch(writes as unknown as [typeof writes[number], ...(typeof writes[number])[]])

  await bumpVersion(roomId)
  const payload = await loadRoomStatePayload(roomId)
  if (payload) await publishRoomState(roomId, payload)

  return NextResponse.json({ ok: true, ...payload })
}
