'use client'

import { useCallback, useEffect, useState } from 'react'
import { getParticipantSession, setParticipantSession, type ParticipantSession } from '@/lib/auth/participant'

const ROLE_POLL_INTERVAL_MS = 4000

type ParticipantRole = 'viewer' | 'controller'

function readStoredSession(roomId: string, cb: (session: ParticipantSession | null) => void) {
  cb(getParticipantSession(roomId))
}

/**
 * Manages a viewer's participant identity for one room: resumes a cached session from
 * localStorage if present, otherwise exposes `join(name)` to create one. Once joined, polls the
 * participant's own current role so a promotion (or demotion) made from the controller's
 * participants panel takes effect here without a manual refresh.
 *
 * Not used for the room's original controllerToken flow — that credential lives in a different
 * table entirely and is never revocable through this mechanism, so there's nothing to poll for
 * that case (see the 404-means-"not a tracked participant" note on /api/rooms/[roomId]/participants/me).
 */
export function useParticipant(roomId: string) {
  const [session, setSession] = useState<ParticipantSession | null>(null)
  const [role, setRole] = useState<ParticipantRole | null>(null)
  const [checkedStorage, setCheckedStorage] = useState(false)

  // localStorage can only be read client-side (SSR has no access to it), so this has to happen
  // in an effect rather than a lazy useState initializer, to avoid a hydration mismatch. Routed
  // through a callback (rather than calling setSession/setCheckedStorage directly in the effect
  // body) — same "push the current value immediately" idiom used for transport status elsewhere
  // in this codebase.
  useEffect(() => {
    readStoredSession(roomId, (found) => {
      setSession(found)
      setCheckedStorage(true)
    })
  }, [roomId])

  useEffect(() => {
    if (!session) return
    let cancelled = false

    const poll = async () => {
      try {
        const res = await fetch(
          `/api/rooms/${roomId}/participants/me?sessionToken=${encodeURIComponent(session.sessionToken)}`,
          { cache: 'no-store' },
        )
        if (cancelled || !res.ok) return
        const data = (await res.json()) as { role: ParticipantRole }
        setRole(data.role)
      } catch {
        // transient — the next tick will retry
      }
    }

    void poll()
    const interval = setInterval(poll, ROLE_POLL_INTERVAL_MS)
    return () => {
      cancelled = true
      clearInterval(interval)
    }
  }, [roomId, session])

  const join = useCallback(
    async (name: string) => {
      const res = await fetch(`/api/rooms/${roomId}/participants`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      })
      if (!res.ok) throw new Error('Failed to join')
      const data = (await res.json()) as { participantId: string; sessionToken: string; name: string }
      const newSession: ParticipantSession = {
        participantId: data.participantId,
        sessionToken: data.sessionToken,
        name: data.name,
      }
      setParticipantSession(roomId, newSession)
      setSession(newSession)
      setRole('viewer')
    },
    [roomId],
  )

  return { session, role, checkedStorage, join }
}
