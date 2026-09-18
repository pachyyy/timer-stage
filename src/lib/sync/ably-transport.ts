import * as Ably from 'ably'
import type { RoomStatePayload, RoomTransport, TransportStatus } from './transport'

/**
 * Ably-backed transport. The API key never reaches the browser: the client authenticates via
 * `authUrl` against /api/ably/auth, which issues a token scoped to `room:{roomId}` — subscribe
 * capability only for viewers, publish+subscribe for the controller (see that route).
 *
 * The Ably client is created lazily on the first `subscribe()` call because Ably needs the
 * roomId up front (it's part of the auth request), and `RoomTransport.subscribe` is where the
 * roomId first becomes known.
 *
 * Swapping this for Pusher or Supabase Realtime means writing one file that implements
 * RoomTransport; nothing else in the app depends on Ably's API shape.
 */
export class AblyTransport implements RoomTransport {
  private client: Ably.Realtime | null = null
  private _status: TransportStatus = 'connecting'
  private statusListeners = new Set<(s: TransportStatus) => void>()

  constructor(
    private clientId: string,
    private roomToken: string,
  ) {}

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
    const client = new Ably.Realtime({
      authUrl: '/api/ably/auth',
      authParams: { roomId, token: this.roomToken, clientId: this.clientId },
      clientId: this.clientId,
    })
    this.client = client

    client.connection.on((stateChange) => {
      switch (stateChange.current) {
        case 'connected':
          this.setStatus('live')
          break
        case 'connecting':
        case 'disconnected':
          this.setStatus('connecting')
          break
        case 'suspended':
        case 'failed':
        case 'closed':
          this.setStatus('offline')
          break
      }
    })

    const channel = client.channels.get(`room:${roomId}`)
    const handler = (message: Ably.Message) => {
      onState(message.data as RoomStatePayload)
    }
    // subscribe() implicitly attaches and returns a promise that REJECTS if the client is
    // close()'d before the attach finishes (e.g. a fast unmount — React Strict Mode's dev-only
    // mount→cleanup→remount reliably triggers this on a fresh page). Nothing here needs to await
    // attachment, and real connection problems are already surfaced via the connection.on(...)
    // status listener above, so an unhandled rejection here would only ever be noise.
    channel.subscribe('state', handler).catch(() => {})

    return () => {
      channel.unsubscribe('state', handler)
      client.close()
      if (this.client === client) this.client = null
    }
  }
}
