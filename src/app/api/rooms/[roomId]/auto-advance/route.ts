import { eq, asc } from 'drizzle-orm'
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db/client'
import { roomState, timers } from '@/lib/db/schema'
import { mutateRunState, TimerModel } from '@/lib/db/room-state'
import { publishRoomState } from '@/lib/sync/publish'

export const dynamic = 'force-dynamic'

/**
 * Public, unauthenticated "nudge" for the `linkToNext` agenda feature: any connected client —
 * controller OR a plain viewer screen — can call this to check whether the room's active segment
 * is linked and has reached 0:00, and advance it if so. Deliberately takes no input beyond the
 * roomId in the URL: every precondition is derived and re-verified from the room's own SERVER
 * state (never a client-supplied timestamp or target id), so a caller can never influence WHERE
 * this advances to, only report "it might be time to check" — safe to expose with no auth, same
 * trust level as viewing.
 *
 * This exists alongside the controller's own faster, local zero-crossing detector
 * (src/hooks/use-auto-advance.ts, driven by requestAnimationFrame) rather than replacing it:
 * that one is near-instant but only runs while the controller tab is open and foregrounded
 * (rAF throttles/pauses when backgrounded). This route is the backstop every room-connected
 * screen polls periodically (src/hooks/use-auto-advance-ping.ts), so the show keeps advancing
 * even if the operator has switched to another app — a viewer screen (the on-stage monitor)
 * almost always stays open for the whole show.
 *
 * Safe to call redundantly from many clients/tabs at once: each mutateRunState closure below
 * re-checks its own precondition against the row it's actually handed at write time, so a caller
 * that loses a race to another one simply no-ops instead of double-advancing. The cheap
 * early-return checks above them mean a routine "nothing to do" poll never touches
 * mutateRunState at all, so it never bumps `version` or broadcasts when nothing changed.
 */
export async function POST(_req: NextRequest, { params }: { params: Promise<{ roomId: string }> }) {
  const { roomId } = await params

  const [state] = await db.select().from(roomState).where(eq(roomState.roomId, roomId))
  if (!state || state.status !== 'running' || !state.activeTimerId) {
    return NextResponse.json({ advanced: false })
  }

  const roomTimers = await db.select().from(timers).where(eq(timers.roomId, roomId)).orderBy(asc(timers.position))
  const idx = roomTimers.findIndex((t) => t.id === state.activeTimerId)
  const activeTimer = idx >= 0 ? roomTimers[idx] : null
  const nextTimer = idx >= 0 ? roomTimers[idx + 1] : undefined
  if (!activeTimer?.linkToNext || !nextTimer) {
    return NextResponse.json({ advanced: false })
  }

  const currentRunState = { status: state.status, startedAtMs: state.startedAtMs, elapsedBeforeMs: state.elapsedBeforeMs }
  if (TimerModel.remainingMs(currentRunState, activeTimer.durationMs, Date.now()) > 0) {
    return NextResponse.json({ advanced: false })
  }

  const fromTimerId = activeTimer.id
  const toTimerId = nextTimer.id
  const fromDurationMs = activeTimer.durationMs

  // Same select-then-start pair a manual click (or the controller's own local detector) produces
  // — see report.ts's handling of a 'select' immediately followed by a 'start'/'resume'. Each
  // closure re-verifies against `currentActiveTimerId`/`current`, the values mutateRunState reads
  // fresh from the DB right before writing — not the possibly-stale `state`/`activeTimer` read
  // above — which is what makes this safe under concurrent callers.
  const selectPayload = await mutateRunState(roomId, (current, nowMs, currentActiveTimerId) => {
    if (current.status !== 'running' || currentActiveTimerId !== fromTimerId) return {}
    if (TimerModel.remainingMs(current, fromDurationMs, nowMs) > 0) return {}
    return { runState: TimerModel.reset(), activeTimerId: toTimerId, event: { type: 'select' as const, toTimerId } }
  })
  if (!selectPayload || selectPayload.activeTimerId !== toTimerId) {
    return NextResponse.json({ advanced: false })
  }

  const startPayload = await mutateRunState(roomId, (current, nowMs, currentActiveTimerId) => {
    if (currentActiveTimerId !== toTimerId || current.status === 'running') return {}
    return {
      runState: TimerModel.start(current, nowMs),
      event: { type: current.status === 'paused' ? ('resume' as const) : ('start' as const) },
    }
  })

  const payload = startPayload ?? selectPayload
  await publishRoomState(roomId, payload)
  return NextResponse.json({ advanced: true, ...payload })
}
