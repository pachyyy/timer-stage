import type { CoalescedAdjustment, RunEventRecord } from './types'

export interface AdjustmentEntry {
  atMs: number
  timerId: string
  timerName: string
  deltaMs: number
}

/** Pulls just the 'adjust' events out of a run's full event stream, in the shape
 * `coalesceAdjustments` wants. Shared by the run-detail API route and the xlsx export. */
export function extractAdjustmentEntries(events: RunEventRecord[]): AdjustmentEntry[] {
  return events
    .filter((e) => e.type === 'adjust' && e.timerId !== null && e.deltaMs !== null)
    .map((e) => ({ atMs: e.atMs, timerId: e.timerId!, timerName: e.timerName ?? 'Untitled', deltaMs: e.deltaMs! }))
}

/**
 * Merges consecutive same-segment, same-direction adjustments into one line — this is what turns
 * two "+1 min" clicks into "Opening Remarks: +2 min (2 × +1 min)" instead of two separate rows.
 *
 * Merge rule (time order): entries merge when they share `timerId`, share the sign of `deltaMs`,
 * and the gap since the previous entry is <= `gapMs`. A different segment, a sign flip, or an
 * exceeded gap starts a new group. `gapMs` defaults to Infinity — "consecutive" means adjacent in
 * the adjustment stream, not bounded by a time window, unless the caller asks for one.
 */
export function coalesceAdjustments(
  entries: AdjustmentEntry[],
  opts?: { gapMs?: number },
): CoalescedAdjustment[] {
  const gapMs = opts?.gapMs ?? Infinity
  const sorted = [...entries].sort((a, b) => a.atMs - b.atMs)

  type Group = CoalescedAdjustment & { steps: number[] }
  const groups: Group[] = []
  let current: Group | null = null

  for (const entry of sorted) {
    const sign = Math.sign(entry.deltaMs)
    const sameGroup =
      current !== null &&
      current.timerId === entry.timerId &&
      Math.sign(current.steps[current.steps.length - 1]) === sign &&
      entry.atMs - current.lastAtMs <= gapMs

    if (sameGroup && current) {
      current.totalMs += entry.deltaMs
      current.count += 1
      current.lastAtMs = entry.atMs
      current.steps.push(entry.deltaMs)
    } else {
      if (current) groups.push(current)
      current = {
        timerId: entry.timerId,
        timerName: entry.timerName,
        totalMs: entry.deltaMs,
        count: 1,
        stepMs: entry.deltaMs,
        firstAtMs: entry.atMs,
        lastAtMs: entry.atMs,
        steps: [entry.deltaMs],
      }
    }
  }
  if (current) groups.push(current)

  return groups.map(({ steps, ...group }: Group) => ({
    ...group,
    stepMs: steps.every((s: number) => s === steps[0]) ? steps[0] : null,
  }))
}

/** "+2 min", "-1 min", "+1:30" — whole minutes render without seconds, otherwise m:ss. */
export function formatSignedMinutes(ms: number): string {
  const sign = ms < 0 ? '-' : '+'
  const abs = Math.abs(ms)
  const totalSeconds = Math.round(abs / 1000)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  if (seconds === 0) return `${sign}${minutes} min`
  return `${sign}${minutes}:${String(seconds).padStart(2, '0')}`
}

/** "Opening Remarks: +2 min (2 × +1 min)" or, when the merged steps weren't uniform,
 * "Opening Remarks: +3 min (2 changes)". */
export function formatAdjustmentLabel(a: CoalescedAdjustment): string {
  const total = formatSignedMinutes(a.totalMs)
  if (a.count === 1) return `${a.timerName}: ${total}`
  if (a.stepMs !== null) {
    return `${a.timerName}: ${total} (${a.count} × ${formatSignedMinutes(a.stepMs)})`
  }
  return `${a.timerName}: ${total} (${a.count} changes)`
}
