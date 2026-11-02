'use client'

import { useState } from 'react'
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
import { SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { useTranslations } from 'next-intl'
import { Check, GripVertical, Pencil, Trash2, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { applyReorder } from '@/lib/timer/reorder'
import { MAX_PROMPT_LENGTH } from '@/lib/chorus/model'
import type { ChorusQuestionRef } from '@/lib/chorus/types'

function QuestionRow({
  question,
  index,
  isCurrent,
  editable,
  canGoto,
  answerCount,
  onGoto,
  onSave,
  onDelete,
}: {
  question: ChorusQuestionRef
  index: number
  isCurrent: boolean
  editable: boolean
  canGoto: boolean
  answerCount: number | undefined
  onGoto: () => void
  onSave: (prompt: string) => void
  onDelete: () => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: question.id,
    disabled: !editable,
  })
  const t = useTranslations('chorusControl')
  const tChorus = useTranslations('chorus')
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(question.prompt)

  const save = () => {
    const trimmed = draft.trim()
    if (trimmed && trimmed !== question.prompt) onSave(trimmed)
    setEditing(false)
  }

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(
        'flex items-center gap-1 rounded-md border transition-colors',
        isCurrent ? 'border-primary bg-accent' : 'border-transparent hover:bg-accent/50',
        isDragging && 'relative z-10 opacity-90 shadow-md',
      )}
    >
      {editable && (
        <button
          {...attributes}
          {...listeners}
          type="button"
          aria-label={t('dragHandle')}
          className="flex h-9 w-6 shrink-0 touch-none cursor-grab items-center justify-center text-muted-foreground/50 hover:text-muted-foreground active:cursor-grabbing"
        >
          <GripVertical className="size-4" />
        </button>
      )}

      {editing ? (
        <span className="flex min-w-0 flex-1 items-center gap-1 py-1 pl-1">
          <Input
            autoFocus
            value={draft}
            maxLength={MAX_PROMPT_LENGTH}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') save()
              if (e.key === 'Escape') setEditing(false)
            }}
            className="h-8 text-sm"
          />
          <Button variant="ghost" size="icon" className="size-8" onClick={save} aria-label={t('editQuestion')}>
            <Check className="size-3.5" />
          </Button>
          <Button variant="ghost" size="icon" className="size-8" onClick={() => setEditing(false)} aria-label={t('cancelRename')}>
            <X className="size-3.5" />
          </Button>
        </span>
      ) : (
        <button
          type="button"
          onClick={onGoto}
          disabled={!canGoto}
          title={canGoto ? t('goToQuestion') : undefined}
          className={cn(
            'flex min-w-0 flex-1 items-center justify-between gap-3 rounded-md py-2 text-left text-sm',
            editable ? 'px-1' : 'px-3',
            !canGoto && 'cursor-default',
          )}
        >
          <span className="flex min-w-0 items-start gap-2">
            <span className="text-muted-foreground tabular-nums">{index + 1}.</span>
            <span className="break-words">{question.prompt}</span>
          </span>
          <span className="flex shrink-0 items-center gap-2">
            {isCurrent && <Badge className="text-xs">{t('onScreen')}</Badge>}
            {answerCount !== undefined && (
              <span className="text-xs text-muted-foreground tabular-nums">{tChorus('answersCount', { count: answerCount })}</span>
            )}
          </span>
        </button>
      )}

      {editable && !editing && (
        <>
          <Button
            variant="ghost"
            size="icon"
            aria-label={t('editQuestion')}
            onClick={() => {
              setDraft(question.prompt)
              setEditing(true)
            }}
          >
            <Pencil className="size-3.5 text-muted-foreground" />
          </Button>
          <Button variant="ghost" size="icon" aria-label={t('deleteQuestion')} onClick={onDelete}>
            <Trash2 className="size-3.5 text-muted-foreground hover:text-destructive" />
          </Button>
        </>
      )}
    </li>
  )
}

/**
 * The session's question list — the same dnd-kit drag-handle pattern as the room agenda
 * (AgendaList), for the same reason: a row's primary click already means something (here, "put
 * this question on screen" while live), and the list is often operated from a tablet.
 */
export function ChorusQuestionList({
  questions,
  currentQuestionId,
  editable,
  canGoto,
  counts,
  onGoto,
  onSave,
  onDelete,
  onReorder,
}: {
  questions: ChorusQuestionRef[]
  currentQuestionId: string | null
  editable: boolean
  canGoto: boolean
  counts: Record<string, number>
  onGoto: (questionId: string) => void
  onSave: (questionId: string, prompt: string) => void
  onDelete: (question: ChorusQuestionRef) => void
  onReorder: (order: string[]) => void
}) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )
  const t = useTranslations('chorusControl')

  if (questions.length === 0) return <p className="text-sm text-muted-foreground">{t('noQuestions')}</p>

  const ids = questions.map((q) => q.id)
  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const fromIndex = ids.indexOf(String(active.id))
    const toIndex = ids.indexOf(String(over.id))
    if (fromIndex === -1 || toIndex === -1) return
    onReorder(applyReorder(ids, fromIndex, toIndex))
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} modifiers={[restrictToVerticalAxis]} onDragEnd={handleDragEnd}>
      <SortableContext items={ids} strategy={verticalListSortingStrategy}>
        <ol className="flex flex-col gap-1">
          {questions.map((question, i) => (
            <QuestionRow
              key={question.id}
              question={question}
              index={i}
              isCurrent={question.id === currentQuestionId}
              editable={editable}
              canGoto={canGoto && question.id !== currentQuestionId}
              answerCount={counts[question.id]}
              onGoto={() => onGoto(question.id)}
              onSave={(prompt) => onSave(question.id, prompt)}
              onDelete={() => onDelete(question)}
            />
          ))}
        </ol>
      </SortableContext>
    </DndContext>
  )
}
