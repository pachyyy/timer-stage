'use client'

import { useEffect, useState } from 'react'
import type { RoomStatePayload, RoomTransport, TransportStatus } from '@/lib/sync/transport'

/**
 * Subscribes to a room's state via the given transport and exposes the latest payload plus
 * connection status. Enforces the version guard here, once, so every consumer benefits:
 * a payload with `version <= current` is silently dropped. This is what makes it safe for a
 * realtime message and a polling fallback to both call into the same state, and what prevents a
 * delayed/out-of-order message from resurrecting stale state on stage.
 *
 * The version counter lives as a plain closure variable inside the effect (not a ref) — the
 * effect already re-runs whenever `roomId`/`transport` change, which naturally gives every fresh
 * subscription its own counter starting at -1. One tradeoff: `state` itself isn't nulled out on
 * a roomId change, so briefly-stale data could show until the new room's first payload arrives.
 * Fine for v1 — nothing in this app navigates between two different rooms without a full page
 * load, which remounts this hook entirely anyway.
 */
export function useRoomState(roomId: string, transport: RoomTransport) {
  const [state, setState] = useState<RoomStatePayload | null>(null)
  const [status, setStatus] = useState<TransportStatus>(transport.status)

  useEffect(() => {
    let lastVersion = -1

    // onStatusChange pushes the current status immediately on subscribe (like a BehaviorSubject),
    // so there's no separate synchronous setState call needed here — everything flows through
    // the callback, which is the sanctioned "subscribe to an external system" effect pattern.
    const unsubState = transport.onStatusChange(setStatus)

    const unsubscribe = transport.subscribe(roomId, (payload) => {
      if (payload.version <= lastVersion) return
      lastVersion = payload.version
      setState(payload)
    })

    return () => {
      unsubscribe()
      unsubState()
    }
  }, [roomId, transport])

  return { state, status }
}
