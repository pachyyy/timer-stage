'use client'

import { useEffect, useRef, useState } from 'react'
import { fireAlert, ALERT_FLASH_DURATION_MS } from '@/lib/alert'

type ParticipantRole = 'viewer' | 'controller'

/**
 * Fires the same vibrate+flash cue a controller message gets, but for the moment a viewer's own
 * role flips from 'viewer' to 'controller' — otherwise being promoted only showed a quiet banner,
 * unlike an actual message, and was easy to miss if you weren't looking right at the corner.
 *
 * Only alerts on a genuine transition observed after mount: the first role value seen — whether
 * that's 'viewer' or an already-promoted 'controller' resumed from localStorage — seeds silently,
 * so reloading a page that was already promoted doesn't re-fire.
 */
export function useRoleAlert(role: ParticipantRole | null) {
  const [flashing, setFlashing] = useState(false)
  const lastRoleRef = useRef<ParticipantRole | null>(null)
  const seenRef = useRef(false)

  useEffect(() => {
    const previous = lastRoleRef.current
    lastRoleRef.current = role

    if (!seenRef.current) {
      seenRef.current = true
      return
    }
    if (previous === 'controller' || role !== 'controller') return

    fireAlert(setFlashing)
    const timeout = setTimeout(() => setFlashing(false), ALERT_FLASH_DURATION_MS)
    return () => clearTimeout(timeout)
  }, [role])

  return flashing
}
