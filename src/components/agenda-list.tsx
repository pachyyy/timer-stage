'use client'

import { Fragment } from 'react'
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import { restrictToVerticalAxis } from '@dnd-kit/modifiers'
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { useTranslations } from 'next-intl'
import { cn } from '@/lib/utils'
import { formatDuration } from '@/lib/timer/model'
import type { TimerRow } from '@/lib/sync/transport'
import { Button } from '@/components/ui/button'
import { GripVertical, Pencil, Trash2, Link2 } from 'lucide-react'
import { applyReorder } from '@/lib/timer/reorder'

function formatScheduledTime(ms: number): string {
  return new Date(ms).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
}

function AgendaRow({
  timer,
  index,
  isActive,
  onSelect,
  onEdit,
  onDelete,
}: {
  timer: TimerRow
  index: number
  isActive: boolean
  onSelect: () => void
  onEdit: () => void
  onDelete: () => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: timer.id,
  })
  const t = useTranslations('agendaList')

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(
        'flex items-center gap-1 rounded-md border transition-colors',
        isActive ? 'border-primary bg-accent' : 'border-transparent hover:bg-accent/50',
        isDragging && 'relative z-10 opacity-90 shadow-md',
      )}
    >
      <button
        {...attributes}
        {...listeners}
        type="button"
        aria-label={t('dragHandle')}
        className="flex h-9 w-6 shrink-0 touch-none cursor-grab items-center justify-center text-muted-foreground/50 hover:text-muted-foreground active:cursor-grabbing"
      >
        <GripVertical className="size-4" />
      </button>

      <button
        onClick={onSelect}
        className="flex min-w-0 flex-1 items-center justify-between gap-3 rounded-md px-1 py-2 text-left text-sm"
      >
        <span className="flex min-w-0 items-center gap-2">
          <span className="text-muted-foreground tabular-nums">{index + 1}.</span>
          <span className="truncate">{timer.name}</span>
        </span>
        <span className="flex shrink-0 items-center gap-3 tabular-nums text-muted-foreground">
          {timer.scheduledStartMs && <span>{formatScheduledTime(timer.scheduledStartMs)}</span>}
          <span>{formatDuration(timer.durationMs)}</span>
        </span>
      </button>

      <Button variant="ghost" size="icon" aria-label={t('editSegment')} onClick={onEdit}>
        <Pencil className="size-3.5 text-muted-foreground" />
      </Button>
      <Button variant="ghost" size="icon" aria-label={t('deleteSegment')} onClick={onDelete}>
        <Trash2 className="size-3.5 text-muted-foreground hover:text-destructive" />
      </Button>
    </li>
  )
}

/** Rendered between row `i` and row `i+1` — never after the last row, since there's nothing for
 * it to link to. Kept out of dnd-kit's SortableContext `items` array below; it isn't a draggable
 * item. `linked` reflects the PRECEDING segment's own `linkToNext` flag (the link is that
 * segment's attribute, not a fixed pair — see schema.ts's doc comment), and toggling calls back
 * with that same segment's id. */
function AgendaLinkToggle({ linked, onToggle }: { linked: boolean; onToggle: () => void }) {
  const t = useTranslations('agendaList')
  return (
    <li className="flex items-center pl-7">
      <button
        type="button"
        onClick={onToggle}
        aria-pressed={linked}
        aria-label={linked ? t('unlinkFromNext') : t('linkToNext')}
        className={cn(
          'flex items-center gap-1 rounded px-1.5 py-0.5 text-xs text-muted-foreground hover:text-foreground',
          linked && 'text-primary',
        )}
      >
        <Link2 className="size-3" />
        {linked ? t('linkedLabel') : t('linkLabel')}
      </button>
    </li>
  )
}

export function AgendaList({
  timers,
  activeTimerId,
  onSelect,
  onEdit,
  onDelete,
  onReorder,
  onToggleLink,
}: {
  timers: TimerRow[]
  activeTimerId: string | null
  onSelect: (timerId: string) => void
  onEdit: (timerId: string) => void
  onDelete: (timerId: string) => void
  /** Fired once, on drop, with the full new top-to-bottom order of timer ids. */
  onReorder: (order: string[]) => void
  /** `timerId` is the PRECEDING segment in the pair — see AgendaLinkToggle. */
  onToggleLink: (timerId: string, linkToNext: boolean) => void
}) {
  // A small movement threshold on pointer/touch keeps a plain tap-to-select on the row working —
  // only the drag handle has listeners at all, but the threshold also avoids the handle itself
  // registering a drag from a simple press-and-release.
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )
  const t = useTranslations('agendaList')

  if (timers.length === 0) {
    return <p className="text-sm text-muted-foreground">{t('empty')}</p>
  }

  const ids = timers.map((t) => t.id)

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const fromIndex = ids.indexOf(String(active.id))
    const toIndex = ids.indexOf(String(over.id))
    if (fromIndex === -1 || toIndex === -1) return
    onReorder(applyReorder(ids, fromIndex, toIndex))
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      modifiers={[restrictToVerticalAxis]}
      onDragEnd={handleDragEnd}
    >
      <SortableContext items={ids} strategy={verticalListSortingStrategy}>
        <ol className="flex flex-col gap-1">
          {timers.map((timer, i) => (
            <Fragment key={timer.id}>
              <AgendaRow
                timer={timer}
                index={i}
                isActive={timer.id === activeTimerId}
                onSelect={() => onSelect(timer.id)}
                onEdit={() => onEdit(timer.id)}
                onDelete={() => onDelete(timer.id)}
              />
              {i < timers.length - 1 && (
                <AgendaLinkToggle
                  linked={timer.linkToNext}
                  onToggle={() => onToggleLink(timer.id, !timer.linkToNext)}
                />
              )}
            </Fragment>
          ))}
        </ol>
      </SortableContext>
    </DndContext>
  )
}
