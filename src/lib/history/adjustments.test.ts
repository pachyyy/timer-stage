import { describe, expect, it } from 'vitest'
import { coalesceAdjustments, formatAdjustmentLabel, formatSignedMinutes, type AdjustmentEntry } from './adjustments'

const entry = (over: Partial<AdjustmentEntry>): AdjustmentEntry => ({
  atMs: 0,
  timerId: 't1',
  timerName: 'Opening Remarks',
  deltaMs: 60_000,
  ...over,
})

describe('coalesceAdjustments', () => {
  it('returns nothing for an empty stream', () => {
    expect(coalesceAdjustments([])).toEqual([])
  })

  it('emits a single-entry group as-is', () => {
    const groups = coalesceAdjustments([entry({ atMs: 1000 })])
    expect(groups).toEqual([
      { timerId: 't1', timerName: 'Opening Remarks', totalMs: 60_000, count: 1, stepMs: 60_000, firstAtMs: 1000, lastAtMs: 1000 },
    ])
  })

  it('merges two same-direction, same-segment adjustments — the +1/+1 spec example', () => {
    const groups = coalesceAdjustments([entry({ atMs: 1000 }), entry({ atMs: 2000 })])
    expect(groups).toHaveLength(1)
    expect(groups[0]).toMatchObject({ totalMs: 120_000, count: 2, stepMs: 60_000 })
  })

  it('splits on a sign flip instead of merging', () => {
    const groups = coalesceAdjustments([
      entry({ atMs: 1000, deltaMs: 60_000 }),
      entry({ atMs: 2000, deltaMs: -60_000 }),
    ])
    expect(groups).toHaveLength(2)
    expect(groups[0].totalMs).toBe(60_000)
    expect(groups[1].totalMs).toBe(-60_000)
  })

  it('splits on a different segment', () => {
    const groups = coalesceAdjustments([
      entry({ atMs: 1000, timerId: 't1' }),
      entry({ atMs: 2000, timerId: 't2', timerName: 'Keynote' }),
    ])
    expect(groups).toHaveLength(2)
  })

  it('keeps stepMs when magnitudes are non-uniform, marks it null and counts changes', () => {
    const groups = coalesceAdjustments([
      entry({ atMs: 1000, deltaMs: 60_000 }),
      entry({ atMs: 2000, deltaMs: 30_000 }),
    ])
    expect(groups).toHaveLength(1)
    expect(groups[0]).toMatchObject({ totalMs: 90_000, count: 2, stepMs: null })
  })

  it('splits a distant pair when gapMs is set', () => {
    const groups = coalesceAdjustments(
      [entry({ atMs: 0 }), entry({ atMs: 10 * 60_000 })],
      { gapMs: 60_000 },
    )
    expect(groups).toHaveLength(2)
  })

  it('sorts out-of-order input by time before grouping', () => {
    const groups = coalesceAdjustments([entry({ atMs: 2000 }), entry({ atMs: 1000 })])
    expect(groups).toHaveLength(1)
    expect(groups[0]).toMatchObject({ firstAtMs: 1000, lastAtMs: 2000 })
  })
})

describe('formatSignedMinutes', () => {
  it('formats a positive whole minute', () => {
    expect(formatSignedMinutes(120_000)).toBe('+2 min')
  })

  it('formats a negative whole minute', () => {
    expect(formatSignedMinutes(-60_000)).toBe('-1 min')
  })

  it('formats a non-whole-minute duration as m:ss', () => {
    expect(formatSignedMinutes(90_000)).toBe('+1:30')
  })
})

describe('formatAdjustmentLabel', () => {
  it('labels a uniform-step group with the spec example', () => {
    const [group] = coalesceAdjustments([entry({ atMs: 0 }), entry({ atMs: 1000 })])
    expect(formatAdjustmentLabel(group)).toBe('Opening Remarks: +2 min (2 × +1 min)')
  })

  it('labels a single adjustment without a click count', () => {
    const [group] = coalesceAdjustments([entry({ atMs: 0 })])
    expect(formatAdjustmentLabel(group)).toBe('Opening Remarks: +1 min')
  })

  it('labels a non-uniform group by change count', () => {
    const [group] = coalesceAdjustments([
      entry({ atMs: 0, deltaMs: 60_000 }),
      entry({ atMs: 1000, deltaMs: 30_000 }),
    ])
    expect(formatAdjustmentLabel(group)).toBe('Opening Remarks: +1:30 (2 changes)')
  })
})
