import { eq, asc, sql } from 'drizzle-orm'
import { db } from './client'
import { roomState, timers } from './schema'
import type { RoomStatePayload, TimerRow } from '@/lib/sync/transport'
import * as TimerModel from '@/lib/timer/model'
import type { RunState } from '@/lib/timer/model'
import { closeRun, ensureOpenRun, logEvent, type RunEventDraft } from './run-log'

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
    scheduledStartMs: t.scheduledStartMs,
  }))

  return {
    version: state.version,
    activeTimerId: state.activeTimerId,
    status: state.status,
    startedAtMs: state.startedAtMs,
    elapsedBeforeMs: state.elapsedBeforeMs,
    blackout: state.blackout,
    message: state.message,
    messageSentAtMs: state.messageSentAtMs,
    messageExpiresAtMs: state.messageExpiresAtMs,
    currentRunId: state.currentRunId,
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
 *
 * The optional `event` a caller's `mutate` closure returns describes the transition's INTENT
 * (e.g. 'start' vs 'resume' both produce `status: 'running'`, so only the closure — which sees
 * the pre-transition status — can tell them apart). This function fills in everything the closure
 * can't know: the pre-transition active segment (`current.activeTimerId`, not the closure's own
 * `currentActiveTimerId` param confusingly-but-deliberately named the same — see 'select' below),
 * its planned duration/schedule, and its elapsed at this instant. A 'start' with no run open yet
 * lazily opens one; a 'run_end' closes it. Events with no open run (agenda navigation before any
 * 'start' ever happened) are silently dropped — see src/lib/db/run-log.ts.
 */
export async function mutateRunState(
  roomId: string,
  mutate: (current: RunState, nowMs: number, currentActiveTimerId: string | null) => Partial<{
    runState: RunState
    activeTimerId: string | null
    blackout: boolean
    /** `text: null` clears. `expiresAtMs` is a *duration-derived absolute* the caller computes from
     * the `nowMs` handed to it, so the expiry instant is anchored to the server clock too. */
    message: { text: string | null; expiresAtMs: number | null }
    event: RunEventDraft
  }>,
): Promise<RoomStatePayload | null> {
  const nowMs = Date.now()
  const [current] = await db.select().from(roomState).where(eq(roomState.roomId, roomId))
  if (!current) return null

  const patch = mutate(toRunState(current), nowMs, current.activeTimerId)
  const nextRun = patch.runState ?? toRunState(current)

  // Sending stamps messageSentAtMs with the server's own clock (that increment is what triggers the
  // viewer's vibrate/flash); clearing wipes all three fields together.
  const messagePatch = patch.message
    ? {
        message: patch.message.text,
        messageSentAtMs: patch.message.text === null ? null : nowMs,
        messageExpiresAtMs: patch.message.text === null ? null : patch.message.expiresAtMs,
      }
    : {}

  // Run bookkeeping happens BEFORE the main write so `nextCurrentRunId` can ride along in the same
  // UPDATE as the version bump — see bumpVersion's doc comment on why every client-visible change
  // needs to land in one atomic statement, not a separate one that could get lost.
  let runIdForLog: string | null = current.currentRunId
  let nextCurrentRunId: string | null | undefined
  if (patch.event?.type === 'start' && !current.currentRunId) {
    runIdForLog = await ensureOpenRun(roomId, nowMs)
    nextCurrentRunId = runIdForLog
  } else if (patch.event?.type === 'run_end' && current.currentRunId) {
    await closeRun(current.currentRunId, nowMs, false)
    nextCurrentRunId = null
  }

  await db
    .update(roomState)
    .set({
      version: current.version + 1,
      status: nextRun.status,
      startedAtMs: nextRun.startedAtMs,
      elapsedBeforeMs: nextRun.elapsedBeforeMs,
      activeTimerId: patch.activeTimerId !== undefined ? patch.activeTimerId : current.activeTimerId,
      blackout: patch.blackout !== undefined ? patch.blackout : current.blackout,
      ...(nextCurrentRunId !== undefined ? { currentRunId: nextCurrentRunId } : {}),
      ...messagePatch,
      updatedAt: nowMs,
    })
    .where(eq(roomState.roomId, roomId))

  const payload = await loadRoomStatePayload(roomId)

  // Agenda rows don't change from any run-state action, so looking the pre-transition active
  // segment up in the just-loaded (post-mutation) payload is safe and avoids a third query.
  if (patch.event && runIdForLog) {
    const activeTimer = payload?.timers.find((t) => t.id === current.activeTimerId) ?? null
    await logEvent(runIdForLog, {
      atMs: nowMs,
      type: patch.event.type,
      timerId: current.activeTimerId,
      toTimerId: patch.event.toTimerId ?? null,
      timerName: activeTimer?.name ?? null,
      plannedDurationMs: activeTimer?.durationMs ?? null,
      scheduledStartMs: activeTimer?.scheduledStartMs ?? null,
      elapsedMs: TimerModel.elapsedMs(toRunState(current), nowMs),
      deltaMs: patch.event.deltaMs ?? null,
      note: patch.event.note ?? null,
    })
  }

  return payload
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
