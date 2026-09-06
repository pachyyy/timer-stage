export type TimerPhase = 'normal' | 'wrapup' | 'overtime'

/** Shared by the fullscreen viewer and the controller readout so both agree on when a timer
 * enters wrap-up (approaching zero) or overtime (past zero). */
export function phaseFor(remainingMs: number, wrapUpMs: number): TimerPhase {
  if (remainingMs < 0) return 'overtime'
  if (remainingMs <= wrapUpMs) return 'wrapup'
  return 'normal'
}

/**
 * How long before zero the screen starts its per-second colour cycle. Deliberately a fixed constant
 * rather than the timer's own `wrapUpMs`: that value is configurable per timer, so binding the blink
 * to it would strobe the screen for the entire wrap-up window (five minutes, if someone set it that
 * way). Wrap-up keeps its amber meaning; the blink owns only the true final minute.
 */
export const BLINK_WINDOW_MS = 60_000

/** Index into the 3-colour cycle, or null when the display should not be blinking at all. */
export type BlinkStep = 0 | 1 | 2 | null

/**
 * Which step of the black → red → white cycle the final minute is on, advancing once per second as
 * the count falls. Returns null outside the final minute and in overtime — overtime keeps the
 * existing solid-red treatment rather than strobing indefinitely on a timer left running.
 *
 * The second is derived with `Math.round`, matching formatDuration in ./model.ts, so the colour
 * flips on exactly the frame the digits change instead of drifting a frame away from them.
 */
export function blinkStep(remainingMs: number): BlinkStep {
  if (remainingMs < 0 || remainingMs > BLINK_WINDOW_MS) return null
  const second = Math.round(remainingMs / 1000)
  // Negated so the cycle advances as the count *descends*: 60s→black, 59s→red, 58s→white, 57s→black.
  return ((3 - (second % 3)) % 3) as BlinkStep
}
