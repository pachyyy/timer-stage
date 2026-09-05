'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { RoomStatePayload, RoomTransport, TransportStatus } from '@/lib/sync/transport'

/**
 * Subscribes to a room's state via the given transport and exposes the latest payload plus
 * connection status. Enforces the version guard here, once, so every consumer benefits:
 * a payload with `version <= current` is silently dropped. This is what makes it safe for a
 * realtime message and a polling fallback to both call into the same state, and what prevents a
 * delayed/out-of-order message from resurrecting stale state on stage.
 *
 * Also returns `applyPayload`, for a caller that already has a fresh payload in hand (e.g. the
 * controller's own action call just resolved) to apply it immediately rather than waiting for
 * the next poll/broadcast to deliver the very same thing a few seconds later — see ControlPage,
 * where this is what makes the controller's own Pause/Adjust/etc. feel instant while everyone
 * else still finds out through the normal sync path.
 *
 * One tradeoff: `state` itself isn't nulled out on a roomId change, so briefly-stale data could
 * show until the new room's first payload arrives. Fine for v1 — nothing in this app navigates
 * between two different rooms without a full page load, which remounts this hook entirely anyway.
 */
export function useRoomState(roomId: string, transport: RoomTransport) {
  const [state, setState] = useState<RoomStatePayload | null>(null)
  const [status, setStatus] = useState<TransportStatus>(transport.status)
  const versionRef = useRef(-1)

  const applyPayload = useCallback((payload: RoomStatePayload) => {
    if (payload.version <= versionRef.current) return
    versionRef.current = payload.version
    setState(payload)
  }, [])

  useEffect(() => {
    versionRef.current = -1 // fresh subscription (new roomId/transport) — reset the guard

    // onStatusChange pushes the current status immediately on subscribe (like a BehaviorSubject),
    // so there's no separate synchronous setState call needed here — everything flows through
    // the callback, which is the sanctioned "subscribe to an external system" effect pattern.
    const unsubState = transport.onStatusChange(setStatus)
    const unsubscribe = transport.subscribe(roomId, applyPayload)

    return () => {
      unsubscribe()
      unsubState()
    }
  }, [roomId, transport, applyPayload])

  return { state, status, applyPayload }
}
