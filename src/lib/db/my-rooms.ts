import { desc, eq, sql } from 'drizzle-orm'
import { db } from './client'
import { rooms, runs } from './schema'

export interface OwnedRoomSummary {
  roomId: string
  name: string
  createdAt: number
  runCount: number
  lastRunAtMs: number | null
}

/** Every room a signed-in user owns, newest first — the raw material for /my-rooms. Purely
 * account-scoped: no token involved, since ownership itself is the credential here. */
export async function listOwnedRooms(userId: string): Promise<OwnedRoomSummary[]> {
  const owned = await db.select().from(rooms).where(eq(rooms.ownerUserId, userId)).orderBy(desc(rooms.createdAt))

  const summaries: OwnedRoomSummary[] = []
  for (const room of owned) {
    const [stats] = await db
      .select({
        runCount: sql<number>`count(*)`,
        lastRunAtMs: sql<number | null>`max(${runs.startedAtMs})`,
      })
      .from(runs)
      .where(eq(runs.roomId, room.id))
    summaries.push({
      roomId: room.id,
      name: room.name,
      createdAt: room.createdAt,
      runCount: stats?.runCount ?? 0,
      lastRunAtMs: stats?.lastRunAtMs ?? null,
    })
  }
  return summaries
}
