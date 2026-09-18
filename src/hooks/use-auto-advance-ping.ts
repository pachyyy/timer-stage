'use client'

import { useEffect, useRef } from 'react'
import type { RoomStatePayload } from '@/lib/sync/transport'

const BASE_INTERVAL_MS = 3000
// Spreads simultaneous viewers/controllers of the same room across the interval instead of all
// polling in lockstep — reduces (doesn't need to eliminate; the server-side route is safe under
// concurrent callers, see its doc comment) how often multiple clients race the same advance.
const JITTER_MS = 1000

/**
 * Backstop for the `linkToNext` agenda feature: periodically pings the public, unauthenticated
 * `/auto-advance` route (src/app/api/rooms/[roomId]/auto-advance/route.ts), which itself checks
 * (against server state, not anything this hook sends) whether the active segment is linked and
 * overdue, and advances it if so. Meant to be mounted from EVERY room-connected screen — both the
 * control page and the viewer page — so the show keeps advancing even when the controller isn't
 * open: a viewer screen (the on-stage monitor) almost always stays open for the whole show, even
 * while the operator has switched to another app on their own device.
 *
 * Only polls while a segment is actually running — nothing to check otherwise. Coarser and later
 * than the controller's own local rAF-based detector (src/hooks/use-auto-advance.ts) by design;
 * this is the "eventually, from any open screen" path, not the fast path.
 */
export function useAutoAdvancePing(opts: {
  roomId: string
  isRunning: boolean
  applyPayload: (payload: RoomStatePayload) => void
}) {
  const { roomId, isRunning, applyPayload } = opts
  const applyPayloadRef = useRef(applyPayload)

  useEffect(() => {
    applyPayloadRef.current = applyPayload
  })

  useEffect(() => {
    if (!isRunning) return

    let cancelled = false
    let timeoutId: ReturnType<typeof setTimeout>

    const ping = async () => {
      try {
        const res = await fetch(`/api/rooms/${roomId}/auto-advance`, { method: 'POST' })
        const data = await res.json().catch(() => null)
        if (!cancelled && data?.advanced) applyPayloadRef.current(data as RoomStatePayload)
      } catch {
        // Best-effort — the next tick (or the controller's own faster detector) will catch up.
      }
      if (!cancelled) schedule()
    }

    const schedule = () => {
      timeoutId = setTimeout(ping, BASE_INTERVAL_MS + Math.random() * JITTER_MS)
    }

    schedule()
    return () => {
      cancelled = true
      clearTimeout(timeoutId)
    }
  }, [roomId, isRunning])
}
