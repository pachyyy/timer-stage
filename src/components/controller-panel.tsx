'use client'

import { useRef } from 'react'
import { useTimerTick } from '@/hooks/use-timer-tick'
import type { RunState } from '@/lib/timer/model'
import { phaseFor, type TimerPhase } from '@/lib/timer/phase'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { Pause, Play, RotateCcw, Minus, Plus } from 'lucide-react'

const PHASE_CLASS: Record<TimerPhase, string> = {
  normal: 'text-foreground',
  wrapup: 'text-amber-600 dark:text-amber-400',
  overtime: 'text-destructive',
}

export function ControllerPanel({
  timerName,
  runState,
  durationMs,
  wrapUpMs,
  syncedNow,
  isRunning,
  blackout,
  onStart,
  onPause,
  onReset,
  onAdjust,
  onBlackoutChange,
}: {
  timerName: string | null
  runState: RunState
  durationMs: number
  wrapUpMs: number
  syncedNow: () => number
  isRunning: boolean
  blackout: boolean
  onStart: () => void
  onPause: () => void
  onReset: () => void
  onAdjust: (deltaMs: number) => void
  onBlackoutChange: (v: boolean) => void
}) {
  const wrapperRef = useRef<HTMLDivElement | null>(null)
  const lastPhaseRef = useRef<TimerPhase | null>(null)

  const elementRef = useTimerTick<HTMLDivElement>(runState, durationMs, syncedNow, {
    onFrame: (remaining) => {
      const phase = phaseFor(remaining, wrapUpMs)
      if (phase !== lastPhaseRef.current) {
        lastPhaseRef.current = phase
        const el = wrapperRef.current
        if (el) el.className = `font-mono text-6xl font-semibold tabular-nums transition-colors ${PHASE_CLASS[phase]}`
      }
    },
  })

  return (
    <div className="flex flex-col gap-4 rounded-xl border p-5">
      <div className="text-sm text-muted-foreground">{timerName ?? 'No timer selected'}</div>

      <div
        ref={(node) => {
          wrapperRef.current = node
          elementRef.current = node
        }}
        className={`font-mono text-6xl font-semibold tabular-nums ${PHASE_CLASS.normal}`}
      />

      <div className="flex flex-wrap items-center gap-2">
        <Button size="lg" onClick={isRunning ? onPause : onStart} disabled={!timerName}>
          {isRunning ? <Pause className="size-4" /> : <Play className="size-4" />}
          {isRunning ? 'Pause' : 'Start'}
        </Button>
        <Button variant="outline" size="lg" onClick={onReset} disabled={!timerName}>
          <RotateCcw className="size-4" />
          Reset
        </Button>
        <div className="mx-1 h-6 w-px bg-border" />
        <Button variant="outline" size="sm" onClick={() => onAdjust(-60_000)} disabled={!timerName}>
          <Minus className="size-4" /> 1 min
        </Button>
        <Button variant="outline" size="sm" onClick={() => onAdjust(60_000)} disabled={!timerName}>
          <Plus className="size-4" /> 1 min
        </Button>
      </div>

      <div className="flex items-center gap-2 pt-2">
        <Switch id="blackout" checked={blackout} onCheckedChange={onBlackoutChange} />
        <Label htmlFor="blackout">Blackout viewer screen</Label>
      </div>

      <p className="text-xs text-muted-foreground">
        Tip: press <kbd className="rounded border px-1">Space</kbd> to start/pause.
      </p>
    </div>
  )
}
