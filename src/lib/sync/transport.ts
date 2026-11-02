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
  /** Optional absolute wall-clock start this segment is scheduled for. Informational only — it
   * drives the ahead/behind-schedule readout, never an automatic start. */
  scheduledStartMs: number | null
  /** When true, this segment auto-selects and auto-starts whatever segment is next by position
   * the moment its own countdown reaches 0:00 while running — see schema.ts's doc comment. */
  linkToNext: boolean
}

export interface RoomStatePayload {
  /** Monotonic version, bumped on every mutation. Clients MUST discard version <= current —
   * this is what prevents a delayed/out-of-order message from resurrecting stale state and
   * un-starting a live timer on stage. */
  version: number
  /** The event/room name, set at creation. There's no rename feature yet, so this is static for
   * the room's lifetime — included so the controller can show it next to "Controller" in the
   * header without a separate fetch. */
  name: string
  /** The signed-in account that owns this room, or null for an anonymous room. Drives the
   * "Save this room to your account" claim prompt — see src/app/api/rooms/[roomId]/claim. */
  ownerUserId: string | null
  activeTimerId: string | null
  status: 'stopped' | 'running' | 'paused'
  startedAtMs: number | null
  elapsedBeforeMs: number
  blackout: boolean
  /** Controller-to-viewer cue text; null when there's nothing to show. */
  message: string | null
  /** Server clock. Viewers alert only when this *increases*, which is what distinguishes a genuinely
   * new message from the same one arriving again via a poll or a reconnect resync. */
  messageSentAtMs: number | null
  /** Absolute expiry, or null for "until cleared". Viewers derive the hide from their own synced
   * clock rather than waiting for a server-sent expiry event. */
  messageExpiresAtMs: number | null
  /** The open run's id, or null when no show is in progress. Drives whether "End show" is enabled
   * and whether run-state transitions get logged at all — see src/lib/db/run-log.ts. */
  currentRunId: string | null
  timers: TimerRow[]
  updatedAtMs: number
}

export type TransportStatus = 'connecting' | 'live' | 'degraded' | 'offline' | 'not-found'

/** Anything a transport carries: a snapshot with the monotonic version every consumer guards on. */
export interface Versioned {
  version: number
}

/**
 * Generic over the payload so a second kind of synced screen (Chorus — see src/lib/chorus/) rides
 * the exact same Ably-with-polling-fallback machinery instead of a fork of it. `RoomTransport` is
 * the original room-flavoured name, kept so nothing room-side had to change.
 */
export interface SyncTransport<T extends Versioned> {
  /** Subscribe to state updates for one room/session id. Returns an unsubscribe function. */
  subscribe(id: string, onState: (state: T) => void): () => void
  readonly status: TransportStatus
  onStatusChange(cb: (status: TransportStatus) => void): () => void
}

export type RoomTransport = SyncTransport<RoomStatePayload>

/**
 * Where one kind of synced state lives: the snapshot URL polling hits, the realtime channel name,
 * and the `kind` /api/ably/auth uses to pick which access check to run. Every implementation takes
 * one of these, defaulting to the room one.
 */
export interface ChannelSpec {
  pollPath(id: string): string
  channelName(id: string): string
  authKind: 'room' | 'chorus'
}

export const ROOM_CHANNEL: ChannelSpec = {
  pollPath: (roomId) => `/api/rooms/${roomId}`,
  channelName: (roomId) => `room:${roomId}`,
  authKind: 'room',
}

export const CHORUS_CHANNEL: ChannelSpec = {
  pollPath: (code) => `/api/chorus/${code}`,
  channelName: (code) => `chorus:${code}`,
  authKind: 'chorus',
}
