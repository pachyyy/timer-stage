'use client'

import { useEffect, useRef, useState } from 'react'
import type { RoomStatePayload } from '@/lib/sync/transport'
import { fireAlert, ALERT_FLASH_DURATION_MS } from '@/lib/alert'

function setExpiredTo(onExpired: (value: boolean) => void, value: boolean) {
  onExpired(value)
}

/**
 * Surfaces the room's current controller message, and tells the viewer when to alert about a new
 * one.
 *
 * Expiry is derived rather than pushed: the server stores an absolute instant and this schedules a
 * single timeout for it against the synced clock, so every viewer drops the banner on the same tick
 * without the server having to broadcast anything a second time.
 */
export function useMessageAlert(state: RoomStatePayload | null, syncedNow: () => number) {
  const [flashing, setFlashing] = useState(false)
  const [expired, setExpired] = useState(false)
  const lastSeenSentAtRef = useRef<number | null>(null)
  const syncedNowRef = useRef(syncedNow)

  // useSyncedClock returns a fresh closure every render, so it can't go in a dependency array —
  // same ref-swap approach use-timer-tick takes with its onFrame callback.
  useEffect(() => {
    syncedNowRef.current = syncedNow
  })

  const text = state?.message ?? null
  const sentAtMs = state?.messageSentAtMs ?? null
  const expiresAtMs = state?.messageExpiresAtMs ?? null

  useEffect(() => {
    if (sentAtMs === null) {
      lastSeenSentAtRef.current = null
      return
    }
    const previous = lastSeenSentAtRef.current
    lastSeenSentAtRef.current = sentAtMs
    // The first payload after mount seeds the ref silently — reloading mid-message must not buzz,
    // and neither should the resync snapshot that arrives on every reconnect.
    if (previous === null || sentAtMs <= previous) return

    fireAlert(setFlashing)
    const timeout = setTimeout(() => setFlashing(false), ALERT_FLASH_DURATION_MS)
    return () => clearTimeout(timeout)
  }, [sentAtMs])

  useEffect(() => {
    if (text === null || expiresAtMs === null) {
      setExpiredTo(setExpired, false)
      return
    }
    const delay = expiresAtMs - syncedNowRef.current()
    if (delay <= 0) {
      setExpiredTo(setExpired, true)
      return
    }
    setExpiredTo(setExpired, false)
    const timeout = setTimeout(() => setExpired(true), delay)
    return () => clearTimeout(timeout)
  }, [text, expiresAtMs, sentAtMs])

  return { message: expired ? null : text, flashing }
}
