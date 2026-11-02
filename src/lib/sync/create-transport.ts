import { CHORUS_CHANNEL, type RoomTransport, type SyncTransport } from './transport'
import type { ChorusStatePayload } from '@/lib/chorus/types'
import { PollingTransport } from './polling-transport'
import { AblyTransport } from './ably-transport'
import { CompositeTransport } from './composite-transport'

/**
 * Single place that decides which transport a page gets. Ably is only wired in once
 * NEXT_PUBLIC_REALTIME_ENABLED is set (i.e. once ABLY_API_KEY is configured server-side) — until
 * then every page runs on polling alone, which is a fully correct (if slightly higher-latency)
 * mode on its own, per src/lib/timer/model.ts's derived-state design.
 */
export function createRoomTransport(clientId: string, roomToken: string): RoomTransport {
  const realtimeEnabled = process.env.NEXT_PUBLIC_REALTIME_ENABLED === 'true'
  if (!realtimeEnabled) return new PollingTransport()
  return new CompositeTransport(new AblyTransport(clientId, roomToken))
}

/** Same decision, for a Chorus session's public state. No token: every Chorus screen subscribes
 * with the same subscribe-only capability (see /api/ably/auth). */
export function createChorusTransport(clientId: string): SyncTransport<ChorusStatePayload> {
  const realtimeEnabled = process.env.NEXT_PUBLIC_REALTIME_ENABLED === 'true'
  if (!realtimeEnabled) return new PollingTransport<ChorusStatePayload>(2000, CHORUS_CHANNEL)
  return new CompositeTransport<ChorusStatePayload>(
    new AblyTransport<ChorusStatePayload>(clientId, '', CHORUS_CHANNEL),
    4000,
    CHORUS_CHANNEL,
  )
}
