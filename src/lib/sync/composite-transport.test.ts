import { afterEach, describe, expect, it, vi } from 'vitest'
import { CompositeTransport } from './composite-transport'
import type { SyncTransport, TransportStatus, Versioned } from './transport'

/** A realtime transport whose status the test drives by hand, and which never delivers state. */
class FakeRealtime implements SyncTransport<Versioned> {
  status: TransportStatus = 'connecting'
  private listeners = new Set<(s: TransportStatus) => void>()
  onStatusChange(cb: (s: TransportStatus) => void) {
    this.listeners.add(cb)
    cb(this.status)
    return () => this.listeners.delete(cb)
  }
  subscribe() {
    return () => {}
  }
  set(s: TransportStatus) {
    this.status = s
    for (const cb of this.listeners) cb(s)
  }
}

const flush = () => new Promise((r) => setTimeout(r, 0))

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('CompositeTransport', () => {
  it('fetches a snapshot when realtime goes live, even if the first poll was cancelled', async () => {
    let version = 7
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ version }), { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)

    const realtime = new FakeRealtime()
    const onState = vi.fn()
    const unsub = new CompositeTransport(realtime, 60_000).subscribe('ROOM1', onState)

    // Realtime wins the race before the fallback poller's first response is handled.
    realtime.set('live')
    await flush()
    expect(onState).toHaveBeenCalledWith({ version: 7 })

    // A reconnect resyncs again.
    version = 8
    realtime.set('connecting')
    realtime.set('live')
    await flush()
    expect(onState).toHaveBeenLastCalledWith({ version: 8 })

    unsub()
  })

  it('drops a snapshot that arrives after unsubscribe', async () => {
    let resolve!: (r: Response) => void
    vi.stubGlobal('fetch', vi.fn(() => new Promise<Response>((r) => (resolve = r))))

    const realtime = new FakeRealtime()
    const onState = vi.fn()
    const unsub = new CompositeTransport(realtime, 60_000).subscribe('ROOM1', onState)
    realtime.set('live')
    unsub()
    resolve(new Response(JSON.stringify({ version: 1 }), { status: 200 }))
    await flush()
    expect(onState).not.toHaveBeenCalled()
  })
})
