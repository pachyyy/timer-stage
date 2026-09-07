import { eq } from 'drizzle-orm'
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { db } from '@/lib/db/client'
import { rooms } from '@/lib/db/schema'

export const dynamic = 'force-dynamic'

/**
 * Links an existing anonymous room to the signed-in account. Requires the room's OWN
 * controllerToken specifically — not a promoted participant's sessionToken, even though that also
 * resolves to 'controller' elsewhere — because a co-controller granted temporary access to run a
 * show must never be able to take permanent ownership of someone else's room. This is the one
 * route in the app that checks `token === room.controllerToken` directly rather than going
 * through checkRoomAccess/resolveRoomAccess, precisely because it needs that narrower check.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ roomId: string }> }) {
  const { roomId } = await params
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'sign in required' }, { status: 401 })

  const body = await req.json().catch(() => null)
  const token = typeof body?.token === 'string' ? body.token : null
  if (!token) return NextResponse.json({ error: 'invalid body' }, { status: 400 })

  const [room] = await db.select().from(rooms).where(eq(rooms.id, roomId))
  if (!room) return NextResponse.json({ error: 'room not found' }, { status: 404 })
  if (token !== room.controllerToken) return NextResponse.json({ error: 'forbidden' }, { status: 403 })

  if (room.ownerUserId && room.ownerUserId !== session.user.id) {
    return NextResponse.json({ error: 'already claimed by another account' }, { status: 409 })
  }
  if (room.ownerUserId === session.user.id) {
    return NextResponse.json({ ok: true, alreadyClaimed: true })
  }

  await db
    .update(rooms)
    .set({ ownerUserId: session.user.id, updatedAt: Date.now() })
    .where(eq(rooms.id, roomId))

  return NextResponse.json({ ok: true, alreadyClaimed: false })
}
