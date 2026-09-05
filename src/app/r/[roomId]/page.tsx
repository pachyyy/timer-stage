'use client'

import { use, useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { useRoom } from '@/hooks/use-room'
import { TimerDisplay } from '@/components/timer-display'
import { ConnectionBadge } from '@/components/connection-badge'

/**
 * Fullscreen output screen — the confidence monitor on stage. Read-only: it only ever displays
 * derived state, never asks the operator to do anything, and (thanks to the derived-state model
 * in src/lib/timer/model.ts) keeps counting correctly through a network blip.
 */
export default function ViewerPage({ params }: { params: Promise<{ roomId: string }> }) {
  const { roomId } = use(params)
  const searchParams = useSearchParams()
  const token = searchParams.get('t') ?? ''
  const { state, status, activeTimer, syncedNow } = useRoom(roomId, token)
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

  const requestFullscreen = () => {
    document.documentElement.requestFullscreen?.().catch(() => {})
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
      className="flex min-h-screen flex-col items-center justify-center gap-4 bg-black"
      onClick={requestFullscreen}
    >
      <div className="fixed top-4 right-4">
        <ConnectionBadge status={status} />
      </div>

      {activeTimer ? (
        <>
          <div className="text-lg text-white/50">{activeTimer.name}</div>
          <TimerDisplay
            runState={{
              status: state.status,
              startedAtMs: state.startedAtMs,
              elapsedBeforeMs: state.elapsedBeforeMs,
            }}
            durationMs={activeTimer.durationMs}
            wrapUpMs={activeTimer.wrapUpMs}
            syncedNow={syncedNow}
          />
        </>
      ) : (
        <div className="text-2xl text-white/40">No timer selected</div>
      )}

      {wakeLockError && (
        <div className="fixed bottom-4 left-4 text-xs text-white/30">
          Screen may sleep — wake lock unavailable
        </div>
      )}
    </div>
  )
}
