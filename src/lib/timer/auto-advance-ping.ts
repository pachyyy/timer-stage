import { remainingMs, type RunState } from './model'

interface PingAgendaRow {
  id: string
  durationMs: number
  linkToNext: boolean
}

/**
 * How long a screen should wait before its first `/auto-advance` ping, or `null` if a ping could
 * never advance anything right now. Mirrors the auto-advance route's own early returns (running,
 * the active segment is linked, and there is a next segment), so a screen stays silent for the
 * whole of an unlinked segment and only starts pinging once a linked one has actually reached
 * zero. The server still re-checks everything; this only decides when asking is worthwhile.
 */
export function autoAdvancePingDelayMs(
  runState: RunState,
  activeTimerId: string | null,
  timers: readonly PingAgendaRow[],
  nowMs: number,
): number | null {
  if (runState.status !== 'running' || !activeTimerId) return null
  const idx = timers.findIndex((t) => t.id === activeTimerId)
  if (idx < 0 || idx === timers.length - 1) return null
  const active = timers[idx]
  if (!active.linkToNext) return null
  return Math.max(0, remainingMs(runState, active.durationMs, nowMs))
}
