'use client'

import { cn } from '@/lib/utils'
import { formatDuration } from '@/lib/timer/model'
import type { TimerRow } from '@/lib/sync/transport'
import { Trash2 } from 'lucide-react'

export function AgendaList({
  timers,
  activeTimerId,
  onSelect,
  onDelete,
}: {
  timers: TimerRow[]
  activeTimerId: string | null
  onSelect: (timerId: string) => void
  onDelete: (timerId: string) => void
}) {
  if (timers.length === 0) {
    return <p className="text-sm text-muted-foreground">No timers yet — add one below.</p>
  }

  return (
    <ol className="flex flex-col gap-1">
      {timers.map((timer, i) => (
        <li key={timer.id}>
          <button
            onClick={() => onSelect(timer.id)}
            className={cn(
              'flex w-full items-center justify-between gap-3 rounded-md border px-3 py-2 text-left text-sm transition-colors',
              timer.id === activeTimerId
                ? 'border-primary bg-accent'
                : 'border-transparent hover:bg-accent/50',
            )}
          >
            <span className="flex min-w-0 items-center gap-2">
              <span className="text-muted-foreground tabular-nums">{i + 1}.</span>
              <span className="truncate">{timer.name}</span>
            </span>
            <span className="flex shrink-0 items-center gap-3">
              <span className="tabular-nums text-muted-foreground">{formatDuration(timer.durationMs)}</span>
              <Trash2
                className="size-3.5 text-muted-foreground hover:text-destructive"
                onClick={(e) => {
                  e.stopPropagation()
                  onDelete(timer.id)
                }}
              />
            </span>
          </button>
        </li>
      ))}
    </ol>
  )
}
