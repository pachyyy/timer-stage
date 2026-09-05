'use client'

import { useEffect, useState } from 'react'

const POLL_INTERVAL_MS = 4000

/**
 * Polls whether `token` (whatever credential the controller page is currently using) still
 * resolves to a tracked participant, and if so, what role it currently has. Returns `null` when
 * the token isn't a tracked participant at all — the expected, harmless result for the room's
 * original controllerToken, which is never revocable through this mechanism.
 *
 * This is what makes a promoted participant's demotion take effect on their own control page
 * without them needing to do anything: once this flips to 'viewer', the page can react (disable
 * controls, send them back to the viewer screen) instead of leaving dead controls on screen.
 */
export function useOwnRole(roomId: string, token: string) {
  const [role, setRole] = useState<'viewer' | 'controller' | null>(null)

  useEffect(() => {
    if (!token) return
    let cancelled = false

    const poll = async () => {
      try {
        const res = await fetch(
          `/api/rooms/${roomId}/participants/me?sessionToken=${encodeURIComponent(token)}`,
          { cache: 'no-store' },
        )
        if (cancelled) return
        if (!res.ok) {
          setRole(null) // not a tracked participant (e.g. the room's own controllerToken)
          return
        }
        const data = (await res.json()) as { role: 'viewer' | 'controller' }
        setRole(data.role)
      } catch {
        // transient — leave the last-known role in place, next tick will retry
      }
    }

    void poll()
    const interval = setInterval(poll, POLL_INTERVAL_MS)
    return () => {
      cancelled = true
      clearInterval(interval)
    }
  }, [roomId, token])

  return role
}
