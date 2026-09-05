import type { RoomStatePayload, RoomTransport, TransportStatus } from './transport'

/**
 * Polling fallback transport. Used standalone in early development, and as the automatic
 * fallback inside CompositeTransport when the realtime channel is unavailable.
 *
 * Uses ETag conditional requests so a poll that finds no change costs almost nothing.
 */
export class PollingTransport implements RoomTransport {
  private _status: TransportStatus = 'connecting'
  private statusListeners = new Set<(s: TransportStatus) => void>()
  private timer: ReturnType<typeof setInterval> | null = null
  private etag: string | null = null

  constructor(private intervalMs = 2000) {}

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
    let cancelled = false

    const poll = async () => {
      try {
        const res = await fetch(`/api/rooms/${roomId}`, {
          headers: this.etag ? { 'If-None-Match': this.etag } : {},
          cache: 'no-store',
        })
        if (cancelled) return
        if (res.status === 304) {
          this.setStatus('live')
          return
        }
        if (res.status === 404) {
          // The room genuinely doesn't exist (e.g. a mistyped join code) — this will never
          // resolve itself, so stop polling rather than retrying forever.
          this.setStatus('not-found')
          cancelled = true
          if (this.timer) clearInterval(this.timer)
          return
        }
        if (!res.ok) {
          this.setStatus('degraded')
          return
        }
        this.etag = res.headers.get('ETag')
        const state = (await res.json()) as RoomStatePayload
        this.setStatus('live')
        onState(state)
      } catch {
        if (!cancelled) this.setStatus('offline')
      }
    }

    void poll()
    this.timer = setInterval(poll, this.intervalMs)

    return () => {
      cancelled = true
      if (this.timer) clearInterval(this.timer)
      this.timer = null
    }
  }
}
