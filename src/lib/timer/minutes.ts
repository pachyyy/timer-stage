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
