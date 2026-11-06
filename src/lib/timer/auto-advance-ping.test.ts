import { describe, expect, it } from 'vitest'
import { autoAdvancePingDelayMs } from './auto-advance-ping'

const running = { status: 'running' as const, startedAtMs: 1_000, elapsedBeforeMs: 0 }
const agenda = [
  { id: 'a', durationMs: 10_000, linkToNext: true },
  { id: 'b', durationMs: 10_000, linkToNext: false },
  { id: 'c', durationMs: 10_000, linkToNext: true },
]

describe('autoAdvancePingDelayMs', () => {
  it('waits until a linked segment reaches zero', () => {
    expect(autoAdvancePingDelayMs(running, 'a', agenda, 4_000)).toBe(7_000)
  })

  it('pings immediately once a linked segment is overdue', () => {
    expect(autoAdvancePingDelayMs(running, 'a', agenda, 20_000)).toBe(0)
  })

  it('never pings for an unlinked segment', () => {
    expect(autoAdvancePingDelayMs(running, 'b', agenda, 20_000)).toBeNull()
  })

  it('never pings for a linked last segment (nothing to advance to)', () => {
    expect(autoAdvancePingDelayMs(running, 'c', agenda, 20_000)).toBeNull()
  })

  it('never pings when not running or nothing is active', () => {
    expect(autoAdvancePingDelayMs({ ...running, status: 'paused' }, 'a', agenda, 20_000)).toBeNull()
    expect(autoAdvancePingDelayMs(running, null, agenda, 20_000)).toBeNull()
    expect(autoAdvancePingDelayMs(running, 'missing', agenda, 20_000)).toBeNull()
  })
})
