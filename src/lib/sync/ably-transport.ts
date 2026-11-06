import * as Ably from 'ably'
import { ROOM_CHANNEL, type ChannelSpec, type SyncTransport, type TransportStatus, type Versioned } from './transport'

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
export class AblyTransport<T extends Versioned> implements SyncTransport<T> {
  private client: Ably.Realtime | null = null
  private _status: TransportStatus = 'connecting'
  private statusListeners = new Set<(s: TransportStatus) => void>()

  constructor(
    private clientId: string,
    private roomToken: string,
    private spec: ChannelSpec = ROOM_CHANNEL,
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

  subscribe(id: string, onState: (state: T) => void): () => void {
    const client = new Ably.Realtime({
      authUrl: '/api/ably/auth',
      authParams: { kind: this.spec.authKind, roomId: id, token: this.roomToken, clientId: this.clientId },
      clientId: this.clientId,
    })
    this.client = client

    const channel = client.channels.get(this.spec.channelName(id))

    // 'live' means connected AND the channel is attached, not just connected: CompositeTransport
    // fetches its resync snapshot the moment this goes live, and taking it before the channel is
    // attached would leave a window where a change is in neither the snapshot nor the channel.
    // A closed client (a previous subscribe, e.g. React Strict Mode's mount→cleanup→remount) still
    // emits a final 'closed' — it must not overwrite the status of the client that replaced it.
    const isCurrent = () => this.client === client

    const reportLiveIfReady = () => {
      if (isCurrent() && client.connection.state === 'connected' && channel.state === 'attached') this.setStatus('live')
    }

    client.connection.on((stateChange) => {
      if (!isCurrent()) return
      switch (stateChange.current) {
        case 'connected':
          reportLiveIfReady()
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

    channel.on((stateChange) => {
      if (!isCurrent()) return
      if (stateChange.current === 'attached') reportLiveIfReady()
      // Back to 'connecting' so CompositeTransport falls back to polling until it re-attaches.
      else if (stateChange.current === 'suspended' || stateChange.current === 'failed') this.setStatus('connecting')
    })

    const handler = (message: Ably.Message) => {
      onState(message.data as T)
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
