import { eq } from 'drizzle-orm'
import { db } from '@/lib/db/client'
import { chorusSessions } from '@/lib/db/schema'
import { checkRoomAccess } from './guard'

export type ChorusAccess = 'controller' | 'presenter' | 'audience' | 'none'

/**
 * Chorus's counterpart to checkRoomAccess, same framework-decoupled shape (callers resolve
 * `userId` via resolveChorusAccess in session-guard.ts). Every controller-gated Chorus route
 * rejects anything but 'controller'; the answers feed also admits 'presenter'.
 *
 * 'controller' comes from the session's own controllerToken, the owning account, OR controller
 * access to the timer room it's linked to — the token passed in is checked against that room too,
 * so the room's operator (and anyone promoted on it) runs the linked session from the room's
 * control page without ever holding a Chorus token. Unlinking revokes that on the next request,
 * same as a participant demotion does for rooms.
 *
 * 'audience' needs nothing at all: like a room, knowing the code is enough to answer.
 */
export async function checkChorusAccess(
  code: string,
  token: string | null,
  userId?: string | null,
): Promise<ChorusAccess> {
  const [session] = await db.select().from(chorusSessions).where(eq(chorusSessions.id, code))
  if (!session) return 'none'

  if (userId && session.ownerUserId === userId) return 'controller'
  if (token && token === session.controllerToken) return 'controller'

  if (session.linkedRoomId) {
    const roomAccess = await checkRoomAccess(session.linkedRoomId, token, userId)
    if (roomAccess === 'controller') return 'controller'
  }

  if (token && token === session.presenterToken) return 'presenter'
  return 'audience'
}
