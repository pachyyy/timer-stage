import type { RoomStatePayload, RoomTransport, TransportStatus } from './transport'
import { PollingTransport } from './polling-transport'

/**
 * Prefers the realtime transport (Ably) but falls back to polling whenever it's not connected,
 * and always fetches one authoritative snapshot on (re)connect to close any gap that opened
 * while degraded. The version guard (see useRoomState) makes it safe for both sources to call
 * `onState` — a stale payload from either side is simply dropped.
 */
export class CompositeTransport implements RoomTransport {
  private polling: PollingTransport
  private _status: TransportStatus = 'connecting'
  private statusListeners = new Set<(s: TransportStatus) => void>()
  private pollingUnsub: (() => void) | null = null
  private realtimeUnsub: (() => void) | null = null

  constructor(
    private realtime: RoomTransport,
    pollIntervalMs = 4000,
  ) {
    this.polling = new PollingTransport(pollIntervalMs)
  }

  get status() {
    return this._status
  }

  private setStatus(s: TransportStatus) {
    if (this._status === s) return
    this._status = s
    for (const cb of this.statusListeners) cb(s)
  }

  onStatusChange(cb: (status: TransportStatus) => void) {
    this.statusListeners.add(cb)
    cb(this._status) // push the current value immediately, like a BehaviorSubject
    return () => this.statusListeners.delete(cb)
  }

  subscribe(roomId: string, onState: (state: RoomStatePayload) => void): () => void {
    let realtimeLive = false

    const stopRealtimeStatusWatch = this.realtime.onStatusChange((s) => {
      realtimeLive = s === 'live'
      if (realtimeLive) {
        this.setStatus('live')
        // realtime just became available (or reconnected) — stop the fallback poller, but
        // first let one more poll resolve so we don't miss whatever happened while degraded.
        this.pollingUnsub?.()
        this.pollingUnsub = null
      } else {
        this.setStatus('degraded')
        if (!this.pollingUnsub) {
          this.pollingUnsub = this.polling.subscribe(roomId, onState)
        }
      }
    })

    this.realtimeUnsub = this.realtime.subscribe(roomId, onState)

    // Kick off degraded-mode polling immediately in case realtime never connects.
    if (!realtimeLive && !this.pollingUnsub) {
      this.pollingUnsub = this.polling.subscribe(roomId, onState)
    }

    return () => {
      stopRealtimeStatusWatch()
      this.realtimeUnsub?.()
      this.pollingUnsub?.()
      this.realtimeUnsub = null
      this.pollingUnsub = null
    }
  }
}
