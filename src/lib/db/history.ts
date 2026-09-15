import { desc, eq, sql } from 'drizzle-orm'
import { db } from './client'
import { rooms, runEvents, runs } from './schema'

export interface OwnedRunSummary {
  roomId: string
  roomName: string
  runId: string
  seq: number
  startedAtMs: number
  durationMs: number
  segmentCount: number
  abandoned: boolean
}

/** Every run across every room the signed-in user owns, newest first — the raw material for the
 * cross-room /history page, as distinct from /my-rooms (room management, not run history). Mirrors
 * listRuns' per-row event queries (see run-log.ts) rather than one big join, so a live/open run's
 * duration still falls back to its last event the same way. */
export async function listOwnedRuns(userId: string, limit = 50): Promise<OwnedRunSummary[]> {
  const rows = await db
    .select({
      roomId: runs.roomId,
      roomName: rooms.name,
      runId: runs.id,
      seq: runs.seq,
      startedAtMs: runs.startedAtMs,
      endedAtMs: runs.endedAtMs,
      abandoned: runs.abandoned,
    })
    .from(runs)
    .innerJoin(rooms, eq(rooms.id, runs.roomId))
    .where(eq(rooms.ownerUserId, userId))
    .orderBy(desc(runs.startedAtMs))
    .limit(limit)

  const summaries: OwnedRunSummary[] = []
  for (const row of rows) {
    const [lastEvent] = await db
      .select({ atMs: runEvents.atMs })
      .from(runEvents)
      .where(eq(runEvents.runId, row.runId))
      .orderBy(desc(runEvents.seq))
      .limit(1)
    const [{ segmentCount }] = await db
      .select({ segmentCount: sql<number>`count(distinct ${runEvents.timerId})` })
      .from(runEvents)
      .where(eq(runEvents.runId, row.runId))
    const endedAtMs = row.endedAtMs ?? lastEvent?.atMs ?? row.startedAtMs
    summaries.push({
      roomId: row.roomId,
      roomName: row.roomName,
      runId: row.runId,
      seq: row.seq,
      startedAtMs: row.startedAtMs,
      durationMs: Math.max(0, endedAtMs - row.startedAtMs),
      segmentCount,
      abandoned: row.abandoned,
    })
  }
  return summaries
}
