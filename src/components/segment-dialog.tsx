'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { toMinSec, parseDurationInput } from '@/lib/timer/minutes'
import type { TimerRow } from '@/lib/sync/transport'
import type { TimerPatch } from '@/lib/api/room-actions'

/** Converts an epoch ms into the local-time string `<input type="datetime-local">` expects. */
function toDatetimeLocalValue(ms: number): string {
  const d = new Date(ms)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

/**
 * Edit dialog for one agenda segment — name, duration, optional scheduled start, speaker, notes,
 * and the wrap-up warning threshold. `timer` seeds the draft state via lazy `useState`
 * initializers rather than an effect — the caller is responsible for mounting a fresh instance
 * per segment (`key={editingTimer?.id}` at the call site) so opening a different row for editing
 * gets its own initial state instead of stale fields bleeding over from the previous one.
 */
export function SegmentDialog({
  open,
  timer,
  onSave,
  onCancel,
}: {
  open: boolean
  timer: TimerRow | null
  onSave: (patch: TimerPatch) => void
  onCancel: () => void
}) {
  const initialDuration = timer ? toMinSec(timer.durationMs) : { minutes: 5, seconds: 0 }
  const [name, setName] = useState(timer?.name ?? '')
  const [minutes, setMinutes] = useState(String(initialDuration.minutes))
  const [seconds, setSeconds] = useState(String(initialDuration.seconds))
  const [scheduledStart, setScheduledStart] = useState(
    timer?.scheduledStartMs ? toDatetimeLocalValue(timer.scheduledStartMs) : '',
  )
  const [speaker, setSpeaker] = useState(timer?.speaker ?? '')
  const [notes, setNotes] = useState(timer?.notes ?? '')
  const [wrapUpMinutes, setWrapUpMinutes] = useState(
    timer ? String(Math.round(timer.wrapUpMs / 60_000)) : '1',
  )

  const handleSave = () => {
    const scheduledStartMs = scheduledStart ? new Date(scheduledStart).getTime() : null
    onSave({
      name: name.trim() || 'Untitled',
      durationMs: parseDurationInput(minutes, seconds),
      scheduledStartMs: scheduledStartMs && Number.isFinite(scheduledStartMs) ? scheduledStartMs : null,
      speaker: speaker.trim() || null,
      notes: notes.trim() || null,
      wrapUpMs: Math.max(0, parseInt(wrapUpMinutes, 10) || 0) * 60_000,
    })
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onCancel()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit segment</DialogTitle>
          <DialogDescription>Changes apply the moment you save — everyone watching sees them.</DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="segment-name">Name</Label>
            <Input id="segment-name" value={name} onChange={(e) => setName(e.target.value)} />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label>Duration</Label>
            <div className="flex items-center gap-2">
              <Input
                type="number"
                min={0}
                value={minutes}
                onChange={(e) => setMinutes(e.target.value)}
                onFocus={(e) => e.currentTarget.select()}
                className="w-20"
                aria-label="Minutes"
              />
              <span className="text-sm text-muted-foreground">min</span>
              <Input
                type="number"
                min={0}
                max={59}
                value={seconds}
                onChange={(e) => setSeconds(e.target.value)}
                onFocus={(e) => e.currentTarget.select()}
                className="w-20"
                aria-label="Seconds"
              />
              <span className="text-sm text-muted-foreground">sec</span>
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="segment-scheduled">Scheduled start (optional)</Label>
            <div className="flex items-center gap-2">
              <Input
                id="segment-scheduled"
                type="datetime-local"
                value={scheduledStart}
                onChange={(e) => setScheduledStart(e.target.value)}
                className="flex-1"
              />
              {scheduledStart && (
                <Button type="button" variant="outline" size="sm" onClick={() => setScheduledStart('')}>
                  Clear
                </Button>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              Informational only — used to show how far ahead or behind schedule the show is running.
              Nothing starts automatically.
            </p>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="segment-speaker">Speaker</Label>
            <Input
              id="segment-speaker"
              value={speaker}
              onChange={(e) => setSpeaker(e.target.value)}
              placeholder="Optional"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="segment-notes">Notes</Label>
            <Input
              id="segment-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Optional — visible to the operator only"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="segment-wrapup">Wrap-up warning</Label>
            <div className="flex items-center gap-2">
              <Input
                id="segment-wrapup"
                type="number"
                min={0}
                value={wrapUpMinutes}
                onChange={(e) => setWrapUpMinutes(e.target.value)}
                onFocus={(e) => e.currentTarget.select()}
                className="w-20"
              />
              <span className="text-sm text-muted-foreground">min before the end</span>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button onClick={handleSave}>Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
