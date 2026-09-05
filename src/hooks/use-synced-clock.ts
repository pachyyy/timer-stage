'use client'

import { useEffect, useState } from 'react'
import { SyncedClock } from '@/lib/sync/clock'

const RESYNC_INTERVAL_MS = 5 * 60 * 1000

/**
 * Owns a single SyncedClock for the component tree, re-syncing periodically, on tab-focus, and
 * exposes `syncedNow()` for any consumer that needs the current best estimate of server time.
 * The clock instance is created once via a lazy useState initializer (not a ref) — refs must not
 * be read or written during render.
 */
export function useSyncedClock() {
  const [clock] = useState(() => new SyncedClock())
  const [isSynced, setIsSynced] = useState(false)

  useEffect(() => {
    let cancelled = false

    const doResync = () => {
      clock
        .resync()
        .then(() => {
          if (!cancelled) setIsSynced(true)
        })
        .catch(() => {
          // leave isSynced as-is; we'll retry on the next interval/focus event
        })
    }

    doResync()
    const interval = setInterval(doResync, RESYNC_INTERVAL_MS)

    const onVisible = () => {
      if (document.visibilityState === 'visible') doResync()
    }
    document.addEventListener('visibilitychange', onVisible)

    return () => {
      cancelled = true
      clearInterval(interval)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [clock])

  return {
    isSynced,
    syncedNow: () => clock.now(),
    resync: () => clock.resync(),
  }
}
