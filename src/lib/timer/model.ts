/**
 * Pure timer state derivation and transitions. No I/O, no clock reads except via injected `nowMs`.
 *
 * The core idea: we never transmit "42 seconds left" over the wire. We transmit *anchor state*
 * (when did the current run segment start, how much elapsed time was already banked) and every
 * client derives the displayed number locally, at whatever frame rate it wants, using its own
 * clock-offset-corrected timestamp. This means:
 *  - a client that loses network keeps counting correctly (nothing to receive)
 *  - all clients agree exactly, because it's the same arithmetic over the same inputs
 *  - the realtime channel only ever carries state *transitions*, not ticks
 */

export type TimerStatus = 'stopped' | 'running' | 'paused'

export interface RunState {
  status: TimerStatus
  /** epoch ms the current running segment began; null when not running */
  startedAtMs: number | null
  /** elapsed ms accumulated from all previous running segments (before the current one) */
  elapsedBeforeMs: number
}

export const initialRunState: RunState = {
  status: 'stopped',
  startedAtMs: null,
  elapsedBeforeMs: 0,
}

/** Total elapsed time (ms) as of `nowMs`. Monotonically non-decreasing while running. */
export function elapsedMs(state: RunState, nowMs: number): number {
  if (state.status === 'running' && state.startedAtMs !== null) {
    return state.elapsedBeforeMs + Math.max(0, nowMs - state.startedAtMs)
  }
  return state.elapsedBeforeMs
}

/**
 * Remaining time (ms) as of `nowMs`. Negative means overtime — callers render this as an
 * overtime state, there is no special-casing needed here.
 */
export function remainingMs(state: RunState, durationMs: number, nowMs: number): number {
  return durationMs - elapsedMs(state, nowMs)
}

/** Start (or resume) the timer. No-op if already running. */
export function start(state: RunState, nowMs: number): RunState {
  if (state.status === 'running') return state
  return {
    status: 'running',
    startedAtMs: nowMs,
    elapsedBeforeMs: state.elapsedBeforeMs,
  }
}

/** Pause the timer, banking elapsed time. No-op if not running. */
export function pause(state: RunState, nowMs: number): RunState {
  if (state.status !== 'running' || state.startedAtMs === null) return state
  return {
    status: 'paused',
    startedAtMs: null,
    elapsedBeforeMs: elapsedMs(state, nowMs),
  }
}

/** Reset to zero elapsed, stopped. */
export function reset(): RunState {
  return { ...initialRunState }
}

/**
 * Adjust the banked elapsed time directly, e.g. for "+1 min" / "-1 min" controls that should
 * shift the remaining time without disturbing whether the timer is running.
 * `deltaMs` is subtracted from elapsed (so a positive delta = more time remaining).
 */
export function adjustElapsed(state: RunState, nowMs: number, deltaMs: number): RunState {
  const currentElapsed = elapsedMs(state, nowMs)
  const nextElapsed = Math.max(0, currentElapsed - deltaMs)
  if (state.status === 'running' && state.startedAtMs !== null) {
    return { ...state, elapsedBeforeMs: nextElapsed, startedAtMs: nowMs }
  }
  return { ...state, elapsedBeforeMs: nextElapsed }
}

/** Format ms as H:MM:SS or M:SS (negative values render as overtime with a leading minus). */
export function formatDuration(ms: number): string {
  const sign = ms < 0 ? '-' : ''
  const abs = Math.abs(Math.round(ms / 1000)) * 1000
  const totalSeconds = Math.floor(abs / 1000)
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60
  const pad = (n: number) => String(n).padStart(2, '0')
  if (hours > 0) return `${sign}${hours}:${pad(minutes)}:${pad(seconds)}`
  return `${sign}${minutes}:${pad(seconds)}`
}
