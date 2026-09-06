'use client'

import { useEffect, useRef, type RefObject } from 'react'
import type { RunState } from '@/lib/timer/model'
import { useTimerTick } from '@/hooks/use-timer-tick'
import { phaseFor, blinkStep, type TimerPhase } from '@/lib/timer/phase'

const PHASE_CLASS: Record<TimerPhase, string> = {
  normal: 'text-white',
  wrapup: 'text-amber-400',
  overtime: 'text-red-500',
}

/** Digit colour per step of the final-minute cycle — inverted against the surface below so the
 * numerals stay readable on the white step. */
const BLINK_DIGIT_CLASS = ['text-white', 'text-white', 'text-black'] as const
/** black → red → white. Literal colours rather than Tailwind classes because these are written
 * straight onto the surface element's style, bypassing React. */
const BLINK_SURFACE_COLOR = ['#000000', '#dc2626', '#ffffff'] as const
const SURFACE_DEFAULT = '#000000'
/** Inherited text colour for the surface's other children (timer name, status notes) so they stay
 * legible on the white step instead of vanishing. */
const BLINK_SURFACE_TEXT = ['#ffffff', '#ffffff', '#000000'] as const
const SURFACE_TEXT_DEFAULT = '#ffffff'

const BASE_CLASS = 'font-mono tabular-nums leading-none'

/**
 * Fullscreen countdown readout. Ticks at animation-frame rate via useTimerTick without causing a
 * React re-render every frame — only the DOM is touched, and only when the phase or blink step
 * actually changes (a handful of times per timer, or once a second in the final minute).
 *
 * `surfaceRef` is the fullscreen element behind the digits. It's driven from this same frame loop
 * rather than from the viewer page so the background and the numerals invert together on one pass;
 * a second rAF loop up there would be both wasteful and liable to tear.
 */
export function TimerDisplay({
  runState,
  durationMs,
  wrapUpMs,
  syncedNow,
  surfaceRef,
}: {
  runState: RunState
  durationMs: number
  wrapUpMs: number
  syncedNow: () => number
  surfaceRef?: RefObject<HTMLElement | null>
}) {
  const wrapperRef = useRef<HTMLDivElement | null>(null)
  const lastKeyRef = useRef<string | null>(null)
  const reducedMotionRef = useRef(false)

  useEffect(() => {
    reducedMotionRef.current = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  }, [])

  const elementRef = useTimerTick(runState, durationMs, syncedNow, {
    onFrame: (remaining) => {
      const phase = phaseFor(remaining, wrapUpMs)
      // Anyone who's asked for reduced motion gets the steady phase colour instead of the flash.
      const step = reducedMotionRef.current ? null : blinkStep(remaining)
      const key = `${phase}:${step}`
      if (key === lastKeyRef.current) return
      lastKeyRef.current = key

      const el = wrapperRef.current
      if (el) {
        el.className =
          step === null
            ? `${BASE_CLASS} transition-colors duration-300 ${PHASE_CLASS[phase]}`
            : `${BASE_CLASS} ${BLINK_DIGIT_CLASS[step]}`
      }
      if (surfaceRef?.current) {
        surfaceRef.current.style.backgroundColor =
          step === null ? SURFACE_DEFAULT : BLINK_SURFACE_COLOR[step]
        surfaceRef.current.style.color =
          step === null ? SURFACE_TEXT_DEFAULT : BLINK_SURFACE_TEXT[step]
      }
    },
  })

  // Reset the surface on unmount so a blinking colour can't outlive the timer that set it.
  useEffect(() => {
    const surface = surfaceRef?.current
    return () => {
      if (surface) {
        surface.style.backgroundColor = SURFACE_DEFAULT
        surface.style.color = SURFACE_TEXT_DEFAULT
      }
    }
  }, [surfaceRef])

  return (
    <div
      ref={(node) => {
        wrapperRef.current = node
        elementRef.current = node
      }}
      className={`${BASE_CLASS} transition-colors duration-300 text-white`}
      style={{ fontSize: 'clamp(3rem, 18vw, 16rem)' }}
    />
  )
}
