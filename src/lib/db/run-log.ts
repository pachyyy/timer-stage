import { and, desc, eq, isNull, sql } from 'drizzle-orm'
import { db } from './client'
import { roomState, rooms, runEvents, runs, timers } from './schema'
import { generateId } from '@/lib/auth/tokens'
import { shouldRolloverRun } from '@/lib/history/rollover'
import type { RunEventType } from '@/lib/history/types'
import type { AgendaSnapshotTimer, RunEventRecord, RunRecord, RunSummary } from '@/lib/history/types'

/** What `mutateRunState`'s closure hands back for a transition worth logging. `timerId` (the
 * segment active BEFORE this transition) is filled in by the caller, not the closure — the
 * closure only knows intent, not the pre-transition state. */
export interface RunEventDraft {
  type: RunEventType
  /** 'select' only — the incoming segment. */
  toTimerId?: string
  deltaMs?: number
  note?: string
}

/**
 * Opens a run for the room if none is open, rolling over a stale one first (see
 * src/lib/history/rollover.ts). Returns the open run's id. The conditional update on
 * `currentRunId IS NULL` means two near-simultaneous opens can't both "win" — the loser's freshly
 * inserted run row is deleted since nothing references it yet.
 */
export async function ensureOpenRun(roomId: string, nowMs: number): Promise<string> {
  const [state] = await db.select().from(roomState).where(eq(roomState.roomId, roomId))
  if (state?.currentRunId) {
    const [lastEvent] = await db
      .select({ atMs: runEvents.atMs })
      .from(runEvents)
      .where(eq(runEvents.runId, state.currentRunId))
      .orderBy(desc(runEvents.seq))
      .limit(1)
    if (!shouldRolloverRun(lastEvent?.atMs ?? null, nowMs)) return state.currentRunId
    await closeRun(state.currentRunId, lastEvent?.atMs ?? nowMs, true)
  }

  const [room] = await db.select({ name: rooms.name }).from(rooms).where(eq(rooms.id, roomId))
  const [{ maxSeq }] = await db
    .select({ maxSeq: sql<number>`coalesce(max(${runs.seq}), 0)` })
    .from(runs)
    .where(eq(runs.roomId, roomId))

  const id = generateId()
  await db.insert(runs).values({
    id,
    roomId,
    seq: maxSeq + 1,
    label: room?.name ?? 'Untitled event',
    startedAtMs: nowMs,
    endedAtMs: null,
    abandoned: false,
  })

  const claim = await db
    .update(roomState)
    .set({ currentRunId: id })
    .where(and(eq(roomState.roomId, roomId), isNull(roomState.currentRunId)))
  if (claim.rowsAffected === 0) {
    // Someone else opened one first between our read and this write — drop ours, use theirs.
    await db.delete(runs).where(eq(runs.id, id))
    const [after] = await db.select({ currentRunId: roomState.currentRunId }).from(roomState).where(eq(roomState.roomId, roomId))
    return after!.currentRunId!
  }
  return id
}

export async function closeRun(runId: string, endedAtMs: number, abandoned = false): Promise<void> {
  await db.update(runs).set({ endedAtMs, abandoned }).where(eq(runs.id, runId))
}

/**
 * Appends one event to the log. Never throws into the caller — a dropped log entry degrades a
 * report; it must never take down a live Start/Pause on stage. Callers should still `await` this
 * (not fire-and-forget) so the write is ordered before the HTTP response, just tolerate failure.
 */
export async function logEvent(
  runId: string,
  event: {
    atMs: number
    type: RunEventType
    timerId: string | null
    toTimerId?: string | null
    timerName?: string | null
    plannedDurationMs?: number | null
    scheduledStartMs?: number | null
    elapsedMs?: number | null
    deltaMs?: number | null
    note?: string | null
  },
): Promise<void> {
  try {
    await db.insert(runEvents).values({
      runId,
      atMs: event.atMs,
      type: event.type,
      timerId: event.timerId,
      toTimerId: event.toTimerId ?? null,
      timerName: event.timerName ?? null,
      plannedDurationMs: event.plannedDurationMs ?? null,
      scheduledStartMs: event.scheduledStartMs ?? null,
      elapsedMs: event.elapsedMs ?? null,
      deltaMs: event.deltaMs ?? null,
      note: event.note ?? null,
    })
  } catch (err) {
    console.error('run-log: failed to write event (non-fatal)', err)
  }
}

export async function listRuns(roomId: string, limit = 50): Promise<RunSummary[]> {
  const rows = await db
    .select()
    .from(runs)
    .where(eq(runs.roomId, roomId))
    .orderBy(desc(runs.startedAtMs))
    .limit(limit)

  const summaries: RunSummary[] = []
  for (const row of rows) {
    const [lastEvent] = await db
      .select({ atMs: runEvents.atMs })
      .from(runEvents)
      .where(eq(runEvents.runId, row.id))
      .orderBy(desc(runEvents.seq))
      .limit(1)
    const [{ segmentCount }] = await db
      .select({ segmentCount: sql<number>`count(distinct ${runEvents.timerId})` })
      .from(runEvents)
      .where(eq(runEvents.runId, row.id))
    const endedAtMs = row.endedAtMs ?? lastEvent?.atMs ?? row.startedAtMs
    summaries.push({
      run: toRunRecord(row),
      durationMs: Math.max(0, endedAtMs - row.startedAtMs),
      segmentCount,
      overrunMs: 0, // filled in by callers that need it via buildRunReport; kept 0 here to avoid N report builds per list
    })
  }
  return summaries
}

export async function loadRun(
  roomId: string,
  runId: string,
): Promise<{ run: RunRecord; events: RunEventRecord[]; agenda: AgendaSnapshotTimer[] } | null> {
  const [row] = await db.select().from(runs).where(and(eq(runs.id, runId), eq(runs.roomId, roomId)))
  if (!row) return null

  const eventRows = await db.select().from(runEvents).where(eq(runEvents.runId, runId)).orderBy(runEvents.seq)
  const timerRows = await db.select().from(timers).where(eq(timers.roomId, roomId))

  return {
    run: toRunRecord(row),
    events: eventRows.map((e) => ({
      seq: e.seq,
      atMs: e.atMs,
      type: e.type as RunEventType,
      timerId: e.timerId,
      toTimerId: e.toTimerId,
      timerName: e.timerName,
      plannedDurationMs: e.plannedDurationMs,
      scheduledStartMs: e.scheduledStartMs,
      elapsedMs: e.elapsedMs,
      deltaMs: e.deltaMs,
      note: e.note,
    })),
    agenda: timerRows.map((t) => ({
      id: t.id,
      name: t.name,
      position: t.position,
      durationMs: t.durationMs,
      scheduledStartMs: t.scheduledStartMs,
    })),
  }
}

function toRunRecord(row: typeof runs.$inferSelect): RunRecord {
  return {
    id: row.id,
    roomId: row.roomId,
    seq: row.seq,
    label: row.label,
    startedAtMs: row.startedAtMs,
    endedAtMs: row.endedAtMs,
    abandoned: row.abandoned,
  }
}
