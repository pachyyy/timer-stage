import { eq } from 'drizzle-orm'
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { db } from '@/lib/db/client'
import { rooms } from '@/lib/db/schema'

export const dynamic = 'force-dynamic'

/**
 * Archive/unarchive a room — the only thing that changes whether it counts toward the owner's
 * plan's active-room cap (see rooms.archivedAt's doc comment in schema.ts, and
 * countActiveOwnedRooms in src/lib/db/room-limits.ts). Purely a bookkeeping flag: an archived
 * room's agenda, history, and viewer link all keep working exactly as before.
 *
 * Deliberately gated on account ownership specifically (`session.user.id === room.ownerUserId`),
 * not `resolveRoomAccess`'s broader 'controller' check — anyone holding the room's controllerToken
 * can run the show, but only the account that owns it should be able to change what counts
 * against that account's plan. An anonymous (ownerless) room can never be archived through this
 * route, which is fine: it was never counted against any cap in the first place.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ roomId: string }> }) {
  const { roomId } = await params
  const body = await req.json().catch(() => ({}))
  const archived = body?.archived !== false // default true — the common case is "archive this"

  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'sign in required' }, { status: 401 })

  const [room] = await db.select().from(rooms).where(eq(rooms.id, roomId)).limit(1)
  if (!room) return NextResponse.json({ error: 'room not found' }, { status: 404 })
  if (room.ownerUserId !== session.user.id) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  const now = Date.now()
  await db
    .update(rooms)
    .set({ archivedAt: archived ? now : null, updatedAt: now })
    .where(eq(rooms.id, roomId))

  return NextResponse.json({ roomId, archivedAt: archived ? now : null })
}
