'use client'

import { useEffect, useRef } from 'react'
import type { RunState } from '@/lib/timer/model'
import { formatDuration, remainingMs } from '@/lib/timer/model'

/**
 * Drives the on-screen countdown at animation-frame rate WITHOUT triggering 60 React renders per
 * second: the formatted string is written straight to the DOM via a ref, and React only
 * re-renders when the *formatted string itself* changes (i.e. roughly once a second). The
 * progress bar (if present) is also written directly, via `onFrame`.
 */
export function useTimerTick<T extends HTMLElement = HTMLElement>(
  runState: RunState,
  durationMs: number,
  syncedNow: () => number,
  opts?: { onFrame?: (remaining: number) => void },
) {
  const elementRef = useRef<T | null>(null)
  const lastTextRef = useRef<string>('')
  const onFrameRef = useRef(opts?.onFrame)

  // Keep the ref pointed at the latest callback without re-subscribing the tick loop below.
  // Written in an effect (not during render) — refs must not be mutated during render.
  useEffect(() => {
    onFrameRef.current = opts?.onFrame
  })

  useEffect(() => {
    let raf = 0

    const tick = () => {
      const remaining = remainingMs(runState, durationMs, syncedNow())
      const text = formatDuration(remaining)
      if (text !== lastTextRef.current) {
        lastTextRef.current = text
        if (elementRef.current) elementRef.current.textContent = text
      }
      onFrameRef.current?.(remaining)
      raf = requestAnimationFrame(tick)
    }

    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [runState, durationMs, syncedNow])

  return elementRef
}
