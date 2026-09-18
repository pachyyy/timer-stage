'use client'

import { useEffect, useRef } from 'react'
import { useTimerTick } from './use-timer-tick'
import type { RunState } from '@/lib/timer/model'

/**
 * Fires `onZeroCrossing` once, the instant the active segment's countdown reaches 0:00 while
 * running and it's linked to the next segment (`linkToNext` — see schema.ts). A second,
 * independent consumer of `useTimerTick`'s `onFrame`, same pattern `ControllerPanel` already uses
 * for its own phase-color side effect — this one just has no DOM node to write to, so the tick's
 * returned ref is discarded.
 */
export function useAutoAdvance(opts: {
  runState: RunState
  durationMs: number
  syncedNow: () => number
  isRunning: boolean
  activeTimerId: string | null
  linkToNext: boolean
  onZeroCrossing: () => void
}) {
  const { runState, durationMs, syncedNow, isRunning, activeTimerId, linkToNext, onZeroCrossing } = opts
  const firedForRef = useRef<string | null>(null)
  const onZeroCrossingRef = useRef(onZeroCrossing)

  useEffect(() => {
    onZeroCrossingRef.current = onZeroCrossing
  })

  // Reset the once-per-activation guard whenever the active segment changes, so a chain of
  // linked segments (1→2→3, all linked) each get their own zero-crossing fire in turn.
  useEffect(() => {
    firedForRef.current = null
  }, [activeTimerId])

  useTimerTick(runState, durationMs, syncedNow, {
    onFrame: (remaining) => {
      if (!isRunning || !linkToNext || !activeTimerId) return
      if (remaining > 0) return
      if (firedForRef.current === activeTimerId) return
      firedForRef.current = activeTimerId
      onZeroCrossingRef.current()
    },
  })
}
