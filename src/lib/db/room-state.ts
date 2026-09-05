import { eq, asc, sql } from 'drizzle-orm'
import { db } from './client'
import { roomState, timers } from './schema'
import type { RoomStatePayload, TimerRow } from '@/lib/sync/transport'
import * as TimerModel from '@/lib/timer/model'
import type { RunState } from '@/lib/timer/model'

/** Load the full broadcast-shaped payload for a room: run state + version + agenda. */
export async function loadRoomStatePayload(roomId: string): Promise<RoomStatePayload | null> {
  const [state] = await db.select().from(roomState).where(eq(roomState.roomId, roomId))
  if (!state) return null

  const timerRows = await db
    .select()
    .from(timers)
    .where(eq(timers.roomId, roomId))
    .orderBy(asc(timers.position))

  const timerPayload: TimerRow[] = timerRows.map((t) => ({
    id: t.id,
    position: t.position,
    name: t.name,
    speaker: t.speaker,
    notes: t.notes,
    type: t.type,
    durationMs: t.durationMs,
    wrapUpMs: t.wrapUpMs,
  }))

  return {
    version: state.version,
    activeTimerId: state.activeTimerId,
    status: state.status,
    startedAtMs: state.startedAtMs,
    elapsedBeforeMs: state.elapsedBeforeMs,
    blackout: state.blackout,
    timers: timerPayload,
    updatedAtMs: state.updatedAt,
  }
}

function toRunState(row: { status: RunState['status']; startedAtMs: number | null; elapsedBeforeMs: number }): RunState {
  return { status: row.status, startedAtMs: row.startedAtMs, elapsedBeforeMs: row.elapsedBeforeMs }
}

/**
 * Apply a run-state transition atomically: read current state, compute the next RunState with a
 * pure function from src/lib/timer/model.ts using the SERVER's own `Date.now()` (never a
 * client-supplied timestamp — a device with a skewed clock must never be able to corrupt the
 * room for everyone), bump `version`, and persist. Returns the new payload for broadcasting.
 */
export async function mutateRunState(
  roomId: string,
  mutate: (current: RunState, nowMs: number, currentActiveTimerId: string | null) => Partial<{
    runState: RunState
    activeTimerId: string | null
    blackout: boolean
  }>,
): Promise<RoomStatePayload | null> {
  const nowMs = Date.now()
  const [current] = await db.select().from(roomState).where(eq(roomState.roomId, roomId))
  if (!current) return null

  const patch = mutate(toRunState(current), nowMs, current.activeTimerId)
  const nextRun = patch.runState ?? toRunState(current)

  await db
    .update(roomState)
    .set({
      version: current.version + 1,
      status: nextRun.status,
      startedAtMs: nextRun.startedAtMs,
      elapsedBeforeMs: nextRun.elapsedBeforeMs,
      activeTimerId: patch.activeTimerId !== undefined ? patch.activeTimerId : current.activeTimerId,
      blackout: patch.blackout !== undefined ? patch.blackout : current.blackout,
      updatedAt: nowMs,
    })
    .where(eq(roomState.roomId, roomId))

  return loadRoomStatePayload(roomId)
}

/**
 * Bump `version` (and `updatedAt`) with no other change — for agenda mutations (add/edit/delete
 * timer), which don't touch run state but still need every connected client to notice. Without
 * this, a client whose cached version is already >= the room's stored version would silently
 * drop the next payload under the version guard, even though the *agenda* actually changed —
 * not just delayed, invisible until some unrelated action happened to bump the version later.
 * Uses a raw SQL increment (not read-then-write) so two concurrent agenda edits can't lose one
 * one's version bump to the other.
 */
export async function bumpVersion(roomId: string): Promise<void> {
  await db
    .update(roomState)
    .set({ version: sql`${roomState.version} + 1`, updatedAt: Date.now() })
    .where(eq(roomState.roomId, roomId))
}

export { TimerModel }
