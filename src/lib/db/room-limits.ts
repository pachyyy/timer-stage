import { and, count, eq, isNull } from 'drizzle-orm'
import { db } from './client'
import { participants, rooms, users } from './schema'

/**
 * The three raw queries the entitlements gate (src/lib/entitlements/gate.ts) needs, kept here
 * rather than inline in the gate — this file is what touches the DB, the gate is what turns a
 * count into an allow/deny decision. Nothing here knows what a "plan" is.
 */

/** "Active" is defined here: not archived. See rooms.archivedAt's doc comment in schema.ts. */
export async function countActiveOwnedRooms(ownerUserId: string): Promise<number> {
  const [row] = await db
    .select({ n: count() })
    .from(rooms)
    .where(and(eq(rooms.ownerUserId, ownerUserId), isNull(rooms.archivedAt)))
  return row?.n ?? 0
}

export async function countParticipants(roomId: string): Promise<number> {
  const [row] = await db.select({ n: count() }).from(participants).where(eq(participants.roomId, roomId))
  return row?.n ?? 0
}

/**
 * The entitlements system resolves a plan by EMAIL (see docs/ARCHITECTURE.md §5/§6), but a room
 * only stores its owner's `userId`. This is the one join between the two: null in, null out for
 * an anonymous room, so every gate function can treat "no owner" and "owner has no email" (should
 * never happen, but Auth.js's User.email is nullable) identically — no identity to resolve, fall
 * back to the anonymous/default entitlement.
 */
export async function getOwnerEmail(ownerUserId: string | null): Promise<string | null> {
  if (!ownerUserId) return null
  const [row] = await db.select({ email: users.email }).from(users).where(eq(users.id, ownerUserId)).limit(1)
  return row?.email ?? null
}
