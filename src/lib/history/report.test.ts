import { describe, expect, it } from 'vitest'
import { buildRunReport } from './report'
import type { AgendaSnapshotTimer, RunEventRecord, RunRecord } from './types'

let seqCounter = 0
const ev = (over: Partial<RunEventRecord> & Pick<RunEventRecord, 'type' | 'atMs'>): RunEventRecord => ({
  seq: seqCounter++,
  timerId: null,
  toTimerId: null,
  timerName: null,
  plannedDurationMs: null,
  scheduledStartMs: null,
  elapsedMs: null,
  deltaMs: null,
  note: null,
  ...over,
})

const run = (over: Partial<RunRecord> = {}): RunRecord => ({
  id: 'run1',
  roomId: 'room1',
  seq: 1,
  label: 'Test Show',
  startedAtMs: 0,
  endedAtMs: null,
  abandoned: false,
  ...over,
})

const agenda = (timers: Partial<AgendaSnapshotTimer>[]): AgendaSnapshotTimer[] =>
  timers.map((t, i) => ({
    id: `t${i + 1}`,
    name: `Segment ${i + 1}`,
    position: i,
    durationMs: 5 * 60_000,
    scheduledStartMs: null,
    ...t,
  }))

describe('buildRunReport', () => {
  it('accumulates a clean start -> pause -> resume -> run_end segment', () => {
    const events = [
      ev({ type: 'start', atMs: 0, timerId: 't1', timerName: 'Opening', plannedDurationMs: 300_000 }),
      ev({ type: 'pause', atMs: 100_000, timerId: 't1' }),
      ev({ type: 'resume', atMs: 150_000, timerId: 't1' }),
      ev({ type: 'run_end', atMs: 200_000, timerId: 't1' }),
    ]
    const report = buildRunReport({
      run: run({ endedAtMs: 200_000 }),
      events,
      agenda: agenda([{ id: 't1', name: 'Opening', durationMs: 300_000 }]),
    })
    const seg = report.segments.find((s) => s.timerId === 't1')!
    // live 0-100s + 150-200s = 150s
    expect(seg.actualMs).toBe(150_000)
    expect(seg.plannedMs).toBe(300_000)
    expect(seg.neverRan).toBe(false)
    expect(seg.startedAtMs).toBe(0)
    expect(seg.endedAtMs).toBe(200_000)
  })

  it('closes the OUTGOING segment on select and attributes nothing to the incoming one yet', () => {
    const events = [
      ev({ type: 'start', atMs: 0, timerId: 't1', timerName: 'Opening', plannedDurationMs: 300_000 }),
      ev({ type: 'select', atMs: 60_000, timerId: 't1', toTimerId: 't2' }),
    ]
    const report = buildRunReport({
      run: run({ endedAtMs: 60_000 }),
      events,
      agenda: agenda([{ id: 't1' }, { id: 't2', name: 'Keynote' }]),
    })
    const outgoing = report.segments.find((s) => s.timerId === 't1')!
    const incoming = report.segments.find((s) => s.timerId === 't2')!
    expect(outgoing.actualMs).toBe(60_000)
    expect(outgoing.endedAtMs).toBe(60_000)
    expect(incoming.actualMs).toBe(0)
    expect(incoming.neverRan).toBe(true)
  })

  it('does not let a mid-run duration edit change plannedMs — the first start wins', () => {
    const events = [
      ev({ type: 'start', atMs: 0, timerId: 't1', timerName: 'Opening', plannedDurationMs: 300_000 }),
      ev({ type: 'pause', atMs: 10_000, timerId: 't1' }),
      // Duration edited to 10 min mid-run, then resumed — plannedMs must stay 300_000.
      ev({ type: 'resume', atMs: 20_000, timerId: 't1', plannedDurationMs: 600_000 }),
      ev({ type: 'run_end', atMs: 30_000, timerId: 't1' }),
    ]
    const report = buildRunReport({
      run: run({ endedAtMs: 30_000 }),
      events,
      agenda: agenda([{ id: 't1' }]),
    })
    expect(report.segments[0].plannedMs).toBe(300_000)
  })

  it('feeds adjust events into adjustedPlannedMs, and diff/rawDiff differ by exactly the adjustment', () => {
    const events = [
      ev({ type: 'start', atMs: 0, timerId: 't1', timerName: 'Opening', plannedDurationMs: 300_000 }),
      ev({ type: 'adjust', atMs: 10_000, timerId: 't1', timerName: 'Opening', deltaMs: 60_000 }),
      ev({ type: 'adjust', atMs: 20_000, timerId: 't1', timerName: 'Opening', deltaMs: 60_000 }),
      ev({ type: 'run_end', atMs: 400_000, timerId: 't1' }),
    ]
    const report = buildRunReport({
      run: run({ endedAtMs: 400_000 }),
      events,
      agenda: agenda([{ id: 't1' }]),
    })
    const seg = report.segments[0]
    expect(seg.adjustmentsMs).toBe(120_000)
    expect(seg.adjustedPlannedMs).toBe(420_000)
    expect(seg.actualMs).toBe(400_000)
    expect(seg.diffMs - seg.rawDiffMs).toBe(-seg.adjustmentsMs)
  })

  it('increments resetCount on a mid-segment reset without zeroing accumulated actualMs', () => {
    const events = [
      ev({ type: 'start', atMs: 0, timerId: 't1', timerName: 'Opening', plannedDurationMs: 300_000 }),
      ev({ type: 'reset', atMs: 50_000, timerId: 't1' }),
      ev({ type: 'start', atMs: 50_000, timerId: 't1' }),
      ev({ type: 'run_end', atMs: 100_000, timerId: 't1' }),
    ]
    const report = buildRunReport({
      run: run({ endedAtMs: 100_000 }),
      events,
      agenda: agenda([{ id: 't1' }]),
    })
    const seg = report.segments[0]
    expect(seg.resetCount).toBe(1)
    expect(seg.actualMs).toBe(100_000) // 0-50s + 50-100s, reset doesn't erase prior wall-clock time
  })

  it('closes a segment ended mid-run by run_end at the run_end timestamp, not later', () => {
    const events = [
      ev({ type: 'start', atMs: 0, timerId: 't1', timerName: 'Opening', plannedDurationMs: 300_000 }),
      ev({ type: 'run_end', atMs: 42_000, timerId: 't1' }),
    ]
    const report = buildRunReport({
      run: run({ endedAtMs: 42_000 }),
      events,
      agenda: agenda([{ id: 't1' }]),
    })
    expect(report.segments[0].endedAtMs).toBe(42_000)
    expect(report.segments[0].actualMs).toBe(42_000)
  })

  it('marks a run with no endedAtMs as incomplete and closes open segments at the last event', () => {
    const events = [ev({ type: 'start', atMs: 0, timerId: 't1', timerName: 'Opening', plannedDurationMs: 300_000 })]
    const report = buildRunReport({
      run: run({ endedAtMs: null }),
      events,
      agenda: agenda([{ id: 't1' }]),
    })
    expect(report.incomplete).toBe(true)
    expect(report.segments[0].actualMs).toBe(0) // closed at the last (only) event's own timestamp
  })

  it('emits neverRan: true with zero actual for an agenda segment with no events', () => {
    const events = [ev({ type: 'start', atMs: 0, timerId: 't1', timerName: 'Opening', plannedDurationMs: 300_000 })]
    const report = buildRunReport({
      run: run({ endedAtMs: 10_000 }),
      events,
      agenda: agenda([{ id: 't1' }, { id: 't2', name: 'Never Ran', durationMs: 120_000 }]),
    })
    const neverRan = report.segments.find((s) => s.timerId === 't2')!
    expect(neverRan.neverRan).toBe(true)
    expect(neverRan.actualMs).toBe(0)
    expect(neverRan.plannedMs).toBe(120_000) // falls back to the agenda's configured duration
  })

  it('keeps a run/deleted segment in the report with position: null', () => {
    const events = [
      ev({ type: 'start', atMs: 0, timerId: 'ghost', timerName: 'Deleted Segment', plannedDurationMs: 60_000 }),
      ev({ type: 'run_end', atMs: 30_000, timerId: 'ghost' }),
    ]
    const report = buildRunReport({ run: run({ endedAtMs: 30_000 }), events, agenda: agenda([]) })
    expect(report.segments).toHaveLength(1)
    expect(report.segments[0]).toMatchObject({ timerId: 'ghost', position: null, name: 'Deleted Segment' })
  })
})
