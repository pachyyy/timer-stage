'use client'

import { useEffect, useMemo, useState } from 'react'
import { createRoomTransport } from '@/lib/sync/create-transport'
import { useRoomState } from './use-room-state'
import { useSyncedClock } from './use-synced-clock'

/**
 * Combines the transport, the version-guarded state subscription, and the synced clock into the
 * one hook every page (viewer, controller) actually needs.
 */
export function useRoom(roomId: string, token: string) {
  // Browser-only id (Web Crypto), distinct from the Node `crypto` helpers in lib/auth/tokens.ts
  // which must never be imported into client bundles. Created once via a lazy useState
  // initializer, not a ref — refs must not be read during render.
  const [clientId] = useState(() => crypto.randomUUID())

  const transport = useMemo(() => createRoomTransport(clientId, token), [clientId, token])
  const { state, status, applyPayload } = useRoomState(roomId, transport)
  const { isSynced, syncedNow, resync } = useSyncedClock()

  // Re-sync the clock whenever the transport comes back live, closing any drift that
  // accumulated while degraded/offline.
  useEffect(() => {
    if (status === 'live') resync()
  }, [status, resync])

  const activeTimer = state?.timers.find((t) => t.id === state.activeTimerId) ?? null

  return { state, status, isSynced, syncedNow, activeTimer, applyPayload }
}
