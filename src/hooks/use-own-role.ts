'use client'

import { useEffect, useRef, useState } from 'react'

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
 *
 * A 404 is ambiguous on its own — it's the expected, permanent result for the room's own
 * controllerToken (never a participant to begin with), but it's also what a promoted
 * participant's token looks like once the admin deletes them outright. `everTrackedRef`
 * disambiguates: only a 404 that arrives *after* a real role was already observed is treated as
 * "removed" (reported as 'viewer', reusing the same demoted-controller screen/redirect ControlPage
 * already has) — a token that has never once resolved just stays null, as before.
 */
export function useOwnRole(roomId: string, token: string) {
  const [role, setRole] = useState<'viewer' | 'controller' | null>(null)
  const everTrackedRef = useRef(false)

  useEffect(() => {
    if (!token) return
    let cancelled = false
    everTrackedRef.current = false

    const poll = async () => {
      try {
        const res = await fetch(
          `/api/rooms/${roomId}/participants/me?sessionToken=${encodeURIComponent(token)}`,
          { cache: 'no-store' },
        )
        if (cancelled) return
        if (!res.ok) {
          setRole(everTrackedRef.current ? 'viewer' : null)
          return
        }
        everTrackedRef.current = true
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
