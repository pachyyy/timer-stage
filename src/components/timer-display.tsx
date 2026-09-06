'use client'

import { useEffect, useRef, type RefObject } from 'react'
import { formatDuration, type RunState } from '@/lib/timer/model'
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
 * A pure CSS clamp() can't see how many characters are actually on screen, so a fixed vw-based
 * size that looks right for "5:00" cuts off "-1:23:45" on a narrow phone — same font-size, longer
 * string, wider box. Sizing is instead measured against the container in JS: render the digits at
 * REFERENCE_FONT_PX, read their natural (unclamped) width, then scale that reference size by
 * however much headroom the container actually has, bounded by MIN/MAX so it never gets
 * unreadably tiny or absurdly huge. This shrinks long/negative strings to fit AND grows short ones
 * to fill the space, on any screen size, without hand-picked breakpoints.
 */
const REFERENCE_FONT_PX = 112 // 7rem
const MIN_FONT_PX = 40 // 2.5rem — absolute floor so overtime on a narrow phone stays readable
const MAX_FONT_PX = 256 // 16rem — absolute ceiling, unchanged from the previous static cap
const CONTAINER_WIDTH_MARGIN = 0.92 // leave ~8% breathing room on each side

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
  const lastFitTextRef = useRef<string | null>(null)
  const reducedMotionRef = useRef(false)

  useEffect(() => {
    reducedMotionRef.current = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  }, [])

  // Renders at REFERENCE_FONT_PX to read the digits' true unclamped width, then scales that
  // reference size by how much room the container actually has. A forced layout read
  // (scrollWidth), so this only runs when the string's length could have changed or the
  // container was resized — never per animation frame.
  const fitToContainer = () => {
    const el = wrapperRef.current
    if (!el) return
    const availableWidth = (surfaceRef?.current?.clientWidth ?? window.innerWidth) * CONTAINER_WIDTH_MARGIN
    el.style.fontSize = `${REFERENCE_FONT_PX}px`
    const naturalWidth = el.scrollWidth
    if (naturalWidth === 0) return
    const fitted = REFERENCE_FONT_PX * (availableWidth / naturalWidth)
    el.style.fontSize = `${Math.min(MAX_FONT_PX, Math.max(MIN_FONT_PX, fitted))}px`
  }

  useEffect(() => {
    fitToContainer()
    window.addEventListener('resize', fitToContainer)
    return () => window.removeEventListener('resize', fitToContainer)
    // fitToContainer reads current refs each call; it doesn't need to be a dependency itself.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const elementRef = useTimerTick(runState, durationMs, syncedNow, {
    onFrame: (remaining) => {
      const text = formatDuration(remaining)
      if (text !== lastFitTextRef.current) {
        lastFitTextRef.current = text
        fitToContainer()
      }

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
      // Pre-JS/first-paint fallback only — fitToContainer overrides this on mount and whenever the
      // digit count or container width changes. clamp() still keeps this reasonable if JS is
      // somehow disabled, but that's belt-and-suspenders, not the real sizing mechanism anymore.
      style={{ fontSize: 'clamp(7rem, 18vw, 16rem)' }}
    />
  )
}
