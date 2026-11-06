'use client'

import { useEffect, useRef } from 'react'
import { autoAdvancePingDelayMs } from '@/lib/timer/auto-advance-ping'
import type { RoomStatePayload } from '@/lib/sync/transport'

const BASE_INTERVAL_MS = 3000
// Spreads simultaneous viewers/controllers of the same room across the interval instead of all
// polling in lockstep — reduces (doesn't need to eliminate; the server-side route is safe under
// concurrent callers, see its doc comment) how often multiple clients race the same advance.
const JITTER_MS = 1000

/**
 * Backstop for the `linkToNext` agenda feature: pings the public, unauthenticated `/auto-advance`
 * route (src/app/api/rooms/[roomId]/auto-advance/route.ts), which itself checks (against server
 * state, not anything this hook sends) whether the active segment is linked and overdue, and
 * advances it if so. Meant to be mounted from EVERY room-connected screen — both the control page
 * and the viewer page — so the show keeps advancing even when the controller isn't open: a viewer
 * screen (the on-stage monitor) almost always stays open for the whole show, even while the
 * operator has switched to another app on their own device.
 *
 * Silent until a ping could actually do something: nothing is sent for an unlinked segment, and
 * for a linked one the first ping is scheduled for the moment it reaches zero (see
 * autoAdvancePingDelayMs). From then on it repeats every few seconds until the state changes,
 * which is either the advance itself or an operator action, and both re-run this effect. Coarser
 * and later than the controller's own local rAF-based detector (src/hooks/use-auto-advance.ts) by
 * design; this is the "eventually, from any open screen" path, not the fast path.
 */
export function useAutoAdvancePing(opts: {
  roomId: string
  state: RoomStatePayload | null
  syncedNow: () => number
  applyPayload: (payload: RoomStatePayload) => void
}) {
  const { roomId, state, syncedNow, applyPayload } = opts
  const applyPayloadRef = useRef(applyPayload)
  const syncedNowRef = useRef(syncedNow)

  useEffect(() => {
    applyPayloadRef.current = applyPayload
    syncedNowRef.current = syncedNow
  })

  const status = state?.status ?? 'stopped'
  const startedAtMs = state?.startedAtMs ?? null
  const elapsedBeforeMs = state?.elapsedBeforeMs ?? 0
  const activeTimerId = state?.activeTimerId ?? null
  const timers = state?.timers

  useEffect(() => {
    const delay = autoAdvancePingDelayMs(
      { status, startedAtMs, elapsedBeforeMs },
      activeTimerId,
      timers ?? [],
      syncedNowRef.current(),
    )
    if (delay === null) return

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
      if (!cancelled) schedule(BASE_INTERVAL_MS)
    }

    const schedule = (baseMs: number) => {
      timeoutId = setTimeout(ping, baseMs + Math.random() * JITTER_MS)
    }

    schedule(delay)
    return () => {
      cancelled = true
      clearTimeout(timeoutId)
    }
  }, [roomId, status, startedAtMs, elapsedBeforeMs, activeTimerId, timers])
}
