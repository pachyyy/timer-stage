import { count, desc, eq } from 'drizzle-orm'
import { db } from './client'
import { participants, roomState, runEvents, runs, users } from './schema'
import { shouldRolloverRun } from '@/lib/history/rollover'

/**
 * The raw queries the entitlements gate (src/lib/entitlements/gate.ts) needs, kept here rather
 * than inline in the gate — this file is what touches the DB, the gate is what turns a count (or
 * a quota balance, see quota.ts) into an allow/deny decision. Nothing here knows what a "plan" or
 * a "credit" is.
 */

export async function countParticipants(roomId: string): Promise<number> {
  const [row] = await db.select({ n: count() }).from(participants).where(eq(participants.roomId, roomId))
  return row?.n ?? 0
}

/**
 * True while a run is currently open AND not stale — resuming/restarting within it is always
 * fine, whatever the room's single-use status (see canStartRun in gate.ts). Staleness (same
 * STALE_RUN_MS threshold as ensureOpenRun's own rollover) has to be checked here too, not just at
 * the moment a NEW run is opened: ensureOpenRun only ever runs when `currentRunId` is null, so a
 * room whose operator simply never clicks "End show" would otherwise keep `currentRunId` set
 * forever, and this function would keep saying "still open" no matter how much real time passed —
 * letting a single paid room credit be reused indefinitely for unrelated future events just by
 * never formally ending the show. Treating a stale-but-technically-open run as closed here is
 * what actually enforces the one-event-per-room quota model.
 */
export async function hasOpenRun(roomId: string): Promise<boolean> {
  const [row] = await db.select({ currentRunId: roomState.currentRunId }).from(roomState).where(eq(roomState.roomId, roomId)).limit(1)
  if (!row?.currentRunId) return false

  const [lastEvent] = await db
    .select({ atMs: runEvents.atMs })
    .from(runEvents)
    .where(eq(runEvents.runId, row.currentRunId))
    .orderBy(desc(runEvents.seq))
    .limit(1)
  return !shouldRolloverRun(lastEvent?.atMs ?? null, Date.now())
}

/** True if this room has EVER had a run (open or closed) — the signal canStartRun uses to tell
 * "this room's first run" (always allowed) from "this room already had its one event" (blocked
 * for a quota-governed room once that run has closed). */
export async function hasAnyRun(roomId: string): Promise<boolean> {
  const [row] = await db.select({ n: count() }).from(runs).where(eq(runs.roomId, roomId))
  return (row?.n ?? 0) > 0
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
