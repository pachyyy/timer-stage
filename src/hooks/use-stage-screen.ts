'use client'

import { useCallback, useEffect, useState } from 'react'

/**
 * What every big-screen page needs (the room's viewer screen, Chorus's presenter window): keep the
 * display awake for the whole show, and go fullscreen on a click — browsers only allow
 * requestFullscreen from a user gesture, so it can't just happen on load.
 */
export function useStageScreen() {
  const [wakeLockError, setWakeLockError] = useState(false)

  useEffect(() => {
    let lock: WakeLockSentinel | null = null
    if ('wakeLock' in navigator) {
      navigator.wakeLock
        .request('screen')
        .then((l) => {
          lock = l
        })
        .catch(() => setWakeLockError(true))
    }
    return () => {
      lock?.release().catch(() => {})
    }
  }, [])

  const requestFullscreen = useCallback(() => {
    document.documentElement.requestFullscreen?.().catch(() => {})
  }, [])

  return { wakeLockError, requestFullscreen }
}
