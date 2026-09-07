import { eq } from 'drizzle-orm'
import { db } from '@/lib/db/client'
import { rooms, participants } from '@/lib/db/schema'

export type RoomAccess = 'controller' | 'viewer' | 'none'

/**
 * Every mutating API route must call this and reject on anything but 'controller'.
 *
 * Three independent credential types resolve to 'controller':
 *  - the room's own controllerToken (the original, permanent admin credential)
 *  - a participant's sessionToken, once an admin has promoted that participant's role
 *    (see /api/rooms/[roomId]/participants/[participantId]/role) — this is what lets control be
 *    granted to a specific joined person without minting a second room-wide secret, and lets it
 *    be revoked later by simply flipping that participant's role back.
 *  - `userId` matching the room's `ownerUserId` — a signed-in account that created or claimed
 *    this room controls it from ANY device, with no token needed at all. `userId` is a plain
 *    optional parameter (not resolved in here) so this function stays framework-decoupled; callers
 *    resolve it via `resolveRoomAccess` in session-guard.ts, which wraps this with `auth()`.
 *
 * Viewing (read-only) no longer requires a token at all — knowing the room code is enough, like
 * a meeting ID or game PIN; the room's viewerToken field is kept only for backward compatibility
 * with any already-shared `?t=` links. Callers that only need to confirm the room *exists* can
 * pass `null` and treat anything but 'none' (i.e. ignore the distinction) accordingly.
 */
export async function checkRoomAccess(
  roomId: string,
  token: string | null,
  userId?: string | null,
): Promise<RoomAccess> {
  const [room] = await db.select().from(rooms).where(eq(rooms.id, roomId))
  if (!room) return 'none'

  if (userId && room.ownerUserId === userId) return 'controller'

  if (token) {
    if (token === room.controllerToken) return 'controller'
    if (token === room.viewerToken) return 'viewer'

    const [participant] = await db
      .select()
      .from(participants)
      .where(eq(participants.sessionToken, token))
    if (participant && participant.roomId === roomId && participant.role === 'controller') {
      return 'controller'
    }
  }

  return 'viewer'
}
