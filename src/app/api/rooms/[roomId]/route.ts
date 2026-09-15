import { eq } from 'drizzle-orm'
import { NextRequest, NextResponse } from 'next/server'
import { resolveRoomAccess } from '@/lib/auth/session-guard'
import { db } from '@/lib/db/client'
import { rooms } from '@/lib/db/schema'
import { bumpVersion, loadRoomStatePayload } from '@/lib/db/room-state'
import { publishRoomState } from '@/lib/sync/publish'

export const dynamic = 'force-dynamic'

/**
 * Snapshot endpoint — used by the polling transport and as the authoritative resync fetched on
 * every realtime (re)connect. ETag makes a poll that finds nothing changed nearly free.
 *
 * No token required: viewing is meant to work by room code alone (like a meeting ID), so this
 * is intentionally open to anyone who knows the roomId. Write access is still strictly gated —
 * see /actions and /timers, which require checkRoomAccess to resolve to 'controller'.
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ roomId: string }> }) {
  const { roomId } = await params
  const payload = await loadRoomStatePayload(roomId)
  if (!payload) {
    return NextResponse.json({ error: 'room not found' }, { status: 404 })
  }

  const etag = `"v${payload.version}"`
  if (req.headers.get('if-none-match') === etag) {
    return new NextResponse(null, { status: 304, headers: { ETag: etag } })
  }

  return NextResponse.json(payload, { headers: { ETag: etag, 'Cache-Control': 'no-store' } })
}

/** Renames the room. Controller-only; re-broadcasts so every open viewer/controller picks up the
 * new name immediately instead of on their next resync. */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ roomId: string }> }) {
  const { roomId } = await params
  const body = await req.json().catch(() => null)
  const name = typeof body?.name === 'string' ? body.name.trim() : ''
  if (!name) return NextResponse.json({ error: 'Name is required' }, { status: 400 })
  if (name.length > 200) return NextResponse.json({ error: 'Name is too long' }, { status: 400 })

  const access = await resolveRoomAccess(roomId, body.token)
  if (access !== 'controller') return NextResponse.json({ error: 'forbidden' }, { status: 403 })

  await db.update(rooms).set({ name, updatedAt: Date.now() }).where(eq(rooms.id, roomId))

  await bumpVersion(roomId)
  const payload = await loadRoomStatePayload(roomId)
  if (payload) await publishRoomState(roomId, payload)

  return NextResponse.json(payload)
}
