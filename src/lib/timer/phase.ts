export type TimerPhase = 'normal' | 'wrapup' | 'overtime'

/** Shared by the fullscreen viewer and the controller readout so both agree on when a timer
 * enters wrap-up (approaching zero) or overtime (past zero). */
export function phaseFor(remainingMs: number, wrapUpMs: number): TimerPhase {
  if (remainingMs < 0) return 'overtime'
  if (remainingMs <= wrapUpMs) return 'wrapup'
  return 'normal'
}
