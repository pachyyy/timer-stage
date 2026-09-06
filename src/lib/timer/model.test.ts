import { describe, it, expect } from 'vitest'
import {
  initialRunState,
  start,
  pause,
  reset,
  adjustElapsed,
  elapsedMs,
  remainingMs,
  formatDuration,
} from './model'

describe('timer model', () => {
  it('stays at zero elapsed until started', () => {
    expect(elapsedMs(initialRunState, 10_000)).toBe(0)
  })

  it('accumulates elapsed time while running', () => {
    const running = start(initialRunState, 1000)
    expect(elapsedMs(running, 1000)).toBe(0)
    expect(elapsedMs(running, 4500)).toBe(3500)
  })

  it('pause/resume round-trip preserves elapsed time', () => {
    let s = start(initialRunState, 0)
    s = pause(s, 5000) // 5s elapsed, banked
    expect(elapsedMs(s, 999_999)).toBe(5000) // frozen while paused regardless of "now"

    s = start(s, 10_000) // resume
    expect(elapsedMs(s, 10_000)).toBe(5000)
    expect(elapsedMs(s, 13_000)).toBe(8000) // 5s banked + 3s more
  })

  it('pausing while already paused/stopped is a no-op', () => {
    const stopped = initialRunState
    expect(pause(stopped, 5000)).toEqual(stopped)
  })

  it('starting while already running is a no-op (does not reset the anchor)', () => {
    const running = start(initialRunState, 1000)
    const startedAgain = start(running, 5000)
    expect(startedAgain).toEqual(running)
  })

  it('reset clears both elapsed and running state', () => {
    let s = start(initialRunState, 0)
    s = pause(s, 5000)
    s = reset()
    expect(s.status).toBe('stopped')
    expect(s.elapsedBeforeMs).toBe(0)
    expect(s.startedAtMs).toBeNull()
  })

  it('remaining time goes negative in overtime with no special-casing', () => {
    const running = start(initialRunState, 0)
    const remaining = remainingMs(running, 5000, 8000)
    expect(remaining).toBe(-3000)
  })

  it('adjustElapsed shifts remaining time without disturbing running status', () => {
    let s = start(initialRunState, 0)
    // 10s in, add 1 minute back (i.e. reduce elapsed by 60s)
    s = adjustElapsed(s, 10_000, 60_000)
    expect(s.status).toBe('running')
    expect(elapsedMs(s, 10_000)).toBe(-50_000)
  })

  it('adjustElapsed can push elapsed negative, letting remaining exceed the original duration', () => {
    // An operator adding time to a segment that's barely started must be able to extend it past
    // its original length, not just top it back up to it — see the comment on adjustElapsed.
    let s = start(initialRunState, 0)
    s = adjustElapsed(s, 10_000, 60_000) // 10s in, +1 min
    expect(remainingMs(s, 5 * 60_000, 10_000)).toBe(5 * 60_000 + 50_000)
  })

  it('adjustElapsed on a paused timer updates the banked elapsed directly', () => {
    let s = start(initialRunState, 0)
    s = pause(s, 30_000) // 30s elapsed
    s = adjustElapsed(s, 30_000, 10_000) // subtract 10s of elapsed (add 10s remaining)
    expect(s.elapsedBeforeMs).toBe(20_000)
    expect(s.status).toBe('paused')
  })

  it('formats durations as M:SS and H:MM:SS, with a minus sign in overtime', () => {
    expect(formatDuration(65_000)).toBe('1:05')
    expect(formatDuration(3_661_000)).toBe('1:01:01')
    expect(formatDuration(-5_000)).toBe('-0:05')
    expect(formatDuration(0)).toBe('0:00')
  })
})
