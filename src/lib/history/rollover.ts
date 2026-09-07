/**
 * If an operator never clicks "End show", the next day's rehearsal would otherwise append to
 * last week's run. Called on every 'start' that would open a run: when the previous run's last
 * event is older than STALE_RUN_MS, that run is closed (marked abandoned) instead of reused.
 */
export const STALE_RUN_MS = 12 * 60 * 60 * 1000

export function shouldRolloverRun(lastEventAtMs: number | null, nowMs: number): boolean {
  if (lastEventAtMs === null) return false
  return nowMs - lastEventAtMs > STALE_RUN_MS
}
