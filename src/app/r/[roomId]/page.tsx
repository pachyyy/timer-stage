'use client'

import { use, useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import Image from 'next/image'
import { useTranslations } from 'next-intl'
import { useRoom } from '@/hooks/use-room'
import { useAutoAdvancePing } from '@/hooks/use-auto-advance-ping'
import { useParticipant } from '@/hooks/use-participant'
import { useMessageAlert } from '@/hooks/use-message-alert'
import { useRoleAlert } from '@/hooks/use-role-alert'
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
  const { state, status, activeTimer, syncedNow, applyPayload } = useRoom(roomId, token)
  const { session, role, checkedStorage, removed, join } = useParticipant(roomId)
  const { message, flashing } = useMessageAlert(state, syncedNow)
  const promotionFlashing = useRoleAlert(role)
  const [wakeLockError, setWakeLockError] = useState(false)
  // Handed to TimerDisplay so the final-minute blink can invert the background from inside the same
  // animation-frame loop that drives the digits.
  const surfaceRef = useRef<HTMLDivElement | null>(null)
  const t = useTranslations('viewer')
  const tConnection = useTranslations('connectionBadge')
  const tCommon = useTranslations('common')

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

  // Backstop for the `linkToNext` agenda feature — see use-auto-advance-ping.ts's doc comment.
  // A viewer screen (this one) is often the most reliable place for this to keep running, since
  // it's usually the on-stage monitor left open for the whole show even when the controller isn't.
  useAutoAdvancePing({ roomId, isRunning: state?.status === 'running', applyPayload })

  const requestFullscreen = () => {
    document.documentElement.requestFullscreen?.().catch(() => {})
  }

  if (status === 'not-found') {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-2 bg-black px-4 text-center">
        <h1 className="text-xl font-semibold text-white">{tConnection('notFound')}</h1>
        <p className="text-sm text-white/50">{t('notFoundDesc')}</p>
      </div>
    )
  }

  // Wait for the localStorage check before deciding whether to show the gate, so an already-
  // joined viewer doesn't see it flash on every load.
  if (!checkedStorage) return <div className="min-h-screen bg-black" />

  if (!session) {
    return <JoinGate onJoin={join} removed={removed} />
  }

  if (!state) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-black text-white/60">
        {tConnection('connecting')}
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

      <Image src="/cue.svg" alt="" width={28} height={28} unoptimized className="fixed top-4 left-4 rounded-md opacity-60" />

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
          className={`fixed top-14 left-4 rounded-full px-3 py-1 text-xs font-medium text-black transition-colors duration-200 ${
            promotionFlashing ? 'bg-white ring-4 ring-emerald-400' : 'bg-emerald-500 hover:bg-emerald-400'
          }`}
        >
          {t('promotedBanner')}
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
        <div className="text-2xl opacity-40">{tCommon('noTimerSelected')}</div>
      )}

      {wakeLockError && (
        <div className="fixed bottom-4 left-4 text-xs opacity-30">{t('wakeLockWarning')}</div>
      )}
    </div>
  )
}
