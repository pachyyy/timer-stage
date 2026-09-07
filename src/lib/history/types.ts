/**
 * Pure types for the run-history/report layer. Deliberately import nothing from `@/lib/db` —
 * these are consumed by `report.ts`/`adjustments.ts`, which vitest loads directly (node
 * environment, no DB), and by both the API routes and the export workbook builder.
 */

export type RunEventType =
  | 'start'
  | 'resume'
  | 'pause'
  | 'reset'
  | 'select'
  | 'adjust'
  | 'blackout_on'
  | 'blackout_off'
  | 'message'
  | 'run_end'

export interface RunEventRecord {
  seq: number
  atMs: number
  type: RunEventType
  /** The segment active at this instant — see the schema comment on run_events.timerId for why
   * this is the OUTGOING segment on a 'select'. */
  timerId: string | null
  toTimerId: string | null
  timerName: string | null
  plannedDurationMs: number | null
  scheduledStartMs: number | null
  elapsedMs: number | null
  deltaMs: number | null
  note: string | null
}

export interface RunRecord {
  id: string
  roomId: string
  seq: number
  label: string
  startedAtMs: number
  endedAtMs: number | null
  abandoned: boolean
}

export interface RunSummary {
  run: RunRecord
  /** Wall-clock span actually covered — endedAtMs falls back to the last event's atMs when the
   * run is still open (a live preview) so a list view always has a duration to show. */
  durationMs: number
  segmentCount: number
  overrunMs: number
}

export interface AgendaSnapshotTimer {
  id: string
  name: string
  position: number
  durationMs: number
  scheduledStartMs: number | null
}

export interface SegmentReport {
  timerId: string
  /** Snapshot at run time — survives a later rename or delete. */
  name: string
  /** From the current agenda; null if the segment was deleted since this run. */
  position: number | null
  plannedMs: number
  adjustmentsMs: number
  adjustedPlannedMs: number
  actualMs: number
  /** actualMs - adjustedPlannedMs. Positive = overran the plan as adjusted on the night. */
  diffMs: number
  /** actualMs - plannedMs. Shows the cost of the adjustments themselves. */
  rawDiffMs: number
  startedAtMs: number | null
  endedAtMs: number | null
  scheduledStartMs: number | null
  /** startedAtMs - scheduledStartMs, when both are known. */
  startDriftMs: number | null
  resetCount: number
  /** True when this segment is in the agenda but has no start event in this run. */
  neverRan: boolean
}

export interface RunReport {
  run: RunRecord
  segments: SegmentReport[]
  totals: {
    plannedMs: number
    adjustmentsMs: number
    actualMs: number
    diffMs: number
  }
  /** True when the run has no endedAtMs and this report closed it at the last event instead. */
  incomplete: boolean
}

export interface CoalescedAdjustment {
  timerId: string
  timerName: string
  /** Signed sum of every merged delta. */
  totalMs: number
  /** Number of individual adjust events merged into this line. */
  count: number
  /** The per-click magnitude when every merged event was the same size; null when mixed. */
  stepMs: number | null
  firstAtMs: number
  lastAtMs: number
}
