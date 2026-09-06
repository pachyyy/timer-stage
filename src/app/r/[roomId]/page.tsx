'use client'

import { use, useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { useRoom } from '@/hooks/use-room'
import { useParticipant } from '@/hooks/use-participant'
import { useMessageAlert } from '@/hooks/use-message-alert'
import { TimerDisplay } from '@/components/timer-display'
import { ConnectionBadge } from '@/components/connection-badge'
import { JoinGate } from '@/components/join-gate'

/**
 * Fullscreen output screen — the confidence monitor on stage. Read-only: it only ever displays
 * derived state, never asks the operator to do anything, and (thanks to the derived-state model
 * in src/lib/timer/model.ts) keeps counting correctly through a network blip.
 *
 * Every viewer — whether they arrived via a direct link or the homepage's "join with code" flow —
 * passes through the same name gate here once, then it's remembered (see useParticipant).
 */
export default function ViewerPage({ params }: { params: Promise<{ roomId: string }> }) {
  const { roomId } = use(params)
  const searchParams = useSearchParams()
  const token = searchParams.get('t') ?? ''
  const { state, status, activeTimer, syncedNow } = useRoom(roomId, token)
  const { session, role, checkedStorage, join } = useParticipant(roomId)
  const { message, flashing } = useMessageAlert(state, syncedNow)
  const [wakeLockError, setWakeLockError] = useState(false)
  // Handed to TimerDisplay so the final-minute blink can invert the background from inside the same
  // animation-frame loop that drives the digits.
  const surfaceRef = useRef<HTMLDivElement | null>(null)

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

  const requestFullscreen = () => {
    document.documentElement.requestFullscreen?.().catch(() => {})
  }

  if (status === 'not-found') {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-2 bg-black px-4 text-center">
        <h1 className="text-xl font-semibold text-white">Room not found</h1>
        <p className="text-sm text-white/50">Double-check the code or link and try again.</p>
      </div>
    )
  }

  // Wait for the localStorage check before deciding whether to show the gate, so an already-
  // joined viewer doesn't see it flash on every load.
  if (!checkedStorage) return <div className="min-h-screen bg-black" />

  if (!session) {
    return <JoinGate onJoin={join} />
  }

  if (!state) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-black text-white/60">
        Connecting…
      </div>
    )
  }

  if (state.blackout) {
    return <div className="min-h-screen bg-black" onClick={requestFullscreen} />
  }

  return (
    <div
      ref={surfaceRef}
      className="flex min-h-screen flex-col items-center justify-center gap-4 bg-black text-white"
      onClick={requestFullscreen}
    >
      <div className="fixed top-4 right-4">
        <ConnectionBadge status={status} />
      </div>

      {message && (
        <div
          className={`fixed inset-x-0 top-14 z-10 mx-auto max-w-3xl rounded-lg px-6 py-4 text-center text-2xl font-semibold text-black transition-colors duration-200 ${
            flashing ? 'bg-white ring-4 ring-white' : 'bg-amber-400'
          }`}
        >
          {message}
        </div>
      )}

      {role === 'controller' && (
        <a
          href={`/r/${roomId}/control?t=${encodeURIComponent(session.sessionToken)}`}
          className="fixed top-4 left-4 rounded-full bg-emerald-500 px-3 py-1 text-xs font-medium text-black hover:bg-emerald-400"
        >
          You&apos;ve been made a controller — open panel
        </a>
      )}

      {activeTimer ? (
        <>
          {/* Colour is inherited from the surface so the final-minute blink inverts it too. */}
          <div className="text-lg opacity-50">{activeTimer.name}</div>
          <TimerDisplay
            runState={{
              status: state.status,
              startedAtMs: state.startedAtMs,
              elapsedBeforeMs: state.elapsedBeforeMs,
            }}
            durationMs={activeTimer.durationMs}
            wrapUpMs={activeTimer.wrapUpMs}
            syncedNow={syncedNow}
            surfaceRef={surfaceRef}
          />
        </>
      ) : (
        <div className="text-2xl opacity-40">No timer selected</div>
      )}

      {wakeLockError && (
        <div className="fixed bottom-4 left-4 text-xs opacity-30">
          Screen may sleep — wake lock unavailable
        </div>
      )}
    </div>
  )
}
