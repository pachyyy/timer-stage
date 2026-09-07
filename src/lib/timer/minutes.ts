/**
 * Parses a minutes-input field's raw text into a valid whole-minute count (>= 1), falling back
 * when the field is empty or not a number. Used at submit time, not on every keystroke — the
 * input itself is left as free-form text while typing (see the two call sites) so clearing the
 * field to type a fresh value doesn't get clobbered back to a default mid-edit.
 */
export function parseMinutesInput(raw: string, fallback = 5): number {
  const parsed = parseInt(raw, 10)
  if (!Number.isFinite(parsed) || parsed < 1) return fallback
  return parsed
}

/**
 * Parses separate minutes/seconds text fields (as used by the segment edit dialog) into a total
 * duration in ms. Same free-form-string-until-submit pattern as parseMinutesInput above — each
 * field is clamped to >= 0 individually, and the pair is rejected (falls back) only if the total
 * comes out to zero, since a 0:00 segment can't be timed.
 */
export function parseDurationInput(rawMinutes: string, rawSeconds: string, fallbackMs = 5 * 60_000): number {
  const minutes = parseInt(rawMinutes, 10)
  const seconds = parseInt(rawSeconds, 10)
  const safeMinutes = Number.isFinite(minutes) && minutes >= 0 ? minutes : 0
  const safeSeconds = Number.isFinite(seconds) && seconds >= 0 ? seconds : 0
  const totalMs = (safeMinutes * 60 + safeSeconds) * 1000
  return totalMs > 0 ? totalMs : fallbackMs
}

/** Splits a duration in ms back into whole minutes/seconds for populating those two fields. */
export function toMinSec(durationMs: number): { minutes: number; seconds: number } {
  const totalSeconds = Math.max(0, Math.round(durationMs / 1000))
  return { minutes: Math.floor(totalSeconds / 60), seconds: totalSeconds % 60 }
}
