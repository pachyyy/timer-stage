/**
 * Transport abstraction for room state fan-out. The whole point of this interface is that the
 * *rest of the app* never knows or cares whether updates arrive via Ably, polling, or anything
 * else — it only sees `RoomStatePayload` snapshots and a connection status.
 *
 * Payload volume is tiny by design (see src/lib/timer/model.ts): a full two-hour show is on the
 * order of tens of messages, because we broadcast state transitions, not per-second ticks. That's
 * what keeps a hosted pub/sub free tier comfortable here.
 */

export type TimerType = 'countdown'

export interface TimerRow {
  id: string
  position: number
  name: string
  speaker: string | null
  notes: string | null
  type: TimerType
  durationMs: number
  wrapUpMs: number
}

export interface RoomStatePayload {
  /** Monotonic version, bumped on every mutation. Clients MUST discard version <= current —
   * this is what prevents a delayed/out-of-order message from resurrecting stale state and
   * un-starting a live timer on stage. */
  version: number
  activeTimerId: string | null
  status: 'stopped' | 'running' | 'paused'
  startedAtMs: number | null
  elapsedBeforeMs: number
  blackout: boolean
  timers: TimerRow[]
  updatedAtMs: number
}

export type TransportStatus = 'connecting' | 'live' | 'degraded' | 'offline' | 'not-found'

export interface RoomTransport {
  /** Subscribe to state updates for a room. Returns an unsubscribe function. */
  subscribe(roomId: string, onState: (state: RoomStatePayload) => void): () => void
  readonly status: TransportStatus
  onStatusChange(cb: (status: TransportStatus) => void): () => void
}
