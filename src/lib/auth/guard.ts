import { eq } from 'drizzle-orm'
import { db } from '@/lib/db/client'
import { rooms } from '@/lib/db/schema'

export type RoomAccess = 'controller' | 'viewer' | 'none'

/**
 * Every mutating API route must call this and reject on anything but 'controller'. The token
 * comes from a query param or header set by the client from its localStorage-cached value — it
 * is never trusted client-side as an "am I in control" flag.
 */
export async function checkRoomAccess(roomId: string, token: string | null): Promise<RoomAccess> {
  if (!token) return 'none'
  const [room] = await db.select().from(rooms).where(eq(rooms.id, roomId))
  if (!room) return 'none'
  if (token === room.controllerToken) return 'controller'
  if (token === room.viewerToken) return 'viewer'
  return 'none'
}
