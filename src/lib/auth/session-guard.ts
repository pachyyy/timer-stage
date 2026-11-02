import { auth } from '@/auth'
import { checkRoomAccess, type RoomAccess } from './guard'
import { checkChorusAccess, type ChorusAccess } from './chorus-guard'

/**
 * Token-or-account gate: wraps checkRoomAccess with the current signed-in user's id (if any), so
 * an account that owns a room controls it from any device — with or without the token. Every
 * controller-gated route uses this instead of calling checkRoomAccess directly, so a signed-in
 * owner gets the same access everywhere, live-show actions included. Kept in its own file (not
 * folded into guard.ts) so guard.ts itself stays framework-decoupled and next-auth's `auth()`
 * (which reads the request's cookies) is the only thing that knows about sessions.
 */
export async function resolveRoomAccess(roomId: string, token: string | null): Promise<RoomAccess> {
  const session = await auth()
  return checkRoomAccess(roomId, token, session?.user?.id ?? null)
}

/** The same token-or-account wrapper, for Chorus sessions. */
export async function resolveChorusAccess(code: string, token: string | null): Promise<ChorusAccess> {
  const session = await auth()
  return checkChorusAccess(code, token, session?.user?.id ?? null)
}
