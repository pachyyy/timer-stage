import { and, desc, eq, isNotNull, sql } from 'drizzle-orm'
import { db } from './client'
import { rooms, runs, roomState } from './schema'

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

export interface LiveRoomSummary {
  roomId: string
  name: string
  status: 'stopped' | 'running' | 'paused'
}

/** Every room a signed-in user owns that currently has an open run — i.e. a show in progress
 * they can jump back into. `currentRunId` (not `status`) is the signal: a run stays open across
 * a mid-show 'reset' or a between-segments pause, so `status` alone would miss those. */
export async function listLiveOwnedRooms(userId: string): Promise<LiveRoomSummary[]> {
  const rows = await db
    .select({ roomId: rooms.id, name: rooms.name, status: roomState.status })
    .from(rooms)
    .innerJoin(roomState, eq(roomState.roomId, rooms.id))
    .where(and(eq(rooms.ownerUserId, userId), isNotNull(roomState.currentRunId)))
    .orderBy(desc(rooms.createdAt))

  return rows
}
