'use client'

import { useEffect, useRef } from 'react'
import type { RunState } from '@/lib/timer/model'
import { useTimerTick } from '@/hooks/use-timer-tick'
import { phaseFor, type TimerPhase } from '@/lib/timer/phase'

const PHASE_CLASS: Record<TimerPhase, string> = {
  normal: 'text-white',
  wrapup: 'text-amber-400',
  overtime: 'text-red-500',
}

/**
 * Fullscreen countdown readout. Ticks at animation-frame rate via useTimerTick without causing a
 * React re-render every frame — only the phase-driven color class touches React state, and only
 * when the phase actually changes (a handful of times per timer, not every frame).
 */
export function TimerDisplay({
  runState,
  durationMs,
  wrapUpMs,
  syncedNow,
}: {
  runState: RunState
  durationMs: number
  wrapUpMs: number
  syncedNow: () => number
}) {
  const wrapperRef = useRef<HTMLDivElement | null>(null)
  const lastPhaseRef = useRef<TimerPhase | null>(null)

  const elementRef = useTimerTick(runState, durationMs, syncedNow, {
    onFrame: (remaining) => {
      const phase = phaseFor(remaining, wrapUpMs)
      if (phase !== lastPhaseRef.current) {
        lastPhaseRef.current = phase
        const el = wrapperRef.current
        if (el) {
          el.className = `font-mono tabular-nums leading-none transition-colors duration-300 ${PHASE_CLASS[phase]}`
        }
      }
    },
  })

  // Ensure the class is set on mount too (before the first frame callback fires).
  useEffect(() => {
    if (wrapperRef.current && !lastPhaseRef.current) {
      wrapperRef.current.className = `font-mono tabular-nums leading-none transition-colors duration-300 ${PHASE_CLASS.normal}`
    }
  }, [])

  return (
    <div
      ref={(node) => {
        wrapperRef.current = node
        elementRef.current = node
      }}
      className="font-mono tabular-nums leading-none text-white"
      style={{ fontSize: 'clamp(3rem, 18vw, 16rem)' }}
    />
  )
}
