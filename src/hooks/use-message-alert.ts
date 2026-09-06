'use client'

import { useEffect, useRef, useState } from 'react'
import type { RoomStatePayload } from '@/lib/sync/transport'

const FLASH_DURATION_MS = 1200
const VIBRATE_PATTERN = [120, 60, 120]

/**
 * Android only. iOS Safari has never implemented the Vibration API and the call is a silent no-op
 * there, so the visual flash is what actually reaches every viewer — vibration is a bonus, not the
 * mechanism. Chrome also ignores it until the page has had at least one user interaction, which the
 * viewer's tap-to-fullscreen handler generally satisfies.
 *
 * Routed through a helper (rather than calling the setter directly in the effect body) to match the
 * idiom used in use-participant.ts for the same lint rule.
 */
function fireAlert(onFlash: (on: boolean) => void) {
  if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
    navigator.vibrate(VIBRATE_PATTERN)
  }
  onFlash(true)
}

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
    const timeout = setTimeout(() => setFlashing(false), FLASH_DURATION_MS)
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
