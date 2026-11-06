'use client'

import { useMemo, useState } from 'react'
import { useTranslations } from 'next-intl'
import { Check, Eye, EyeOff, Monitor, MonitorOff, RotateCcw, ThumbsUp } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { chorusActions } from '@/lib/api/chorus-actions'
import { groupQuestions } from '@/lib/chorus/qna'
import type { ChorusControlPayload, ChorusStatus, QnaQuestionRow } from '@/lib/chorus/types'

/**
 * The operator's ranked list of audience questions (most votes, then newest). Per question:
 * put it on the big screen (Highlight) or take it off, mark it Answered, or Hide it. Hiding and
 * answering never delete anything. The presenter window shows only the highlighted question, so
 * this list, which also shows every other question, is the only place the host sees them.
 */
export function ChorusQnaPanel({
  code,
  token,
  status,
  questions,
  highlightId,
  onPayload,
  onChanged,
  maxHeightClass = 'max-h-[32rem]',
}: {
  code: string
  token: string
  status: ChorusStatus
  questions: QnaQuestionRow[]
  highlightId: string | null
  onPayload: (payload: ChorusControlPayload) => void
  /** Refetch the feed (a flag changed, so the ETag moved). */
  onChanged: () => void
  maxHeightClass?: string
}) {
  const t = useTranslations('chorusQnaControl')
  const groups = useMemo(() => groupQuestions(questions), [questions])
  const [busyId, setBusyId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const ended = status === 'ended'
  const live = status === 'live'

  const run = (id: string, fn: () => Promise<ChorusControlPayload>) => {
    setError(null)
    setBusyId(id)
    fn()
      .then(onPayload)
      .then(onChanged)
      .catch((err) => setError(err instanceof Error ? err.message : t('failed')))
      .finally(() => setBusyId(null))
  }

  const row = (q: QnaQuestionRow) => {
    const onScreen = highlightId === q.id
    const busy = busyId === q.id
    return (
      <li
        key={q.id}
        className={cn(
          'flex flex-col gap-2 rounded-md border px-3 py-2 text-sm',
          q.hidden && 'bg-muted/50 text-muted-foreground',
          onScreen && 'border-primary bg-primary/5',
        )}
      >
        <div className="flex items-start gap-2">
          <span className={cn('flex-1 break-words whitespace-pre-wrap', q.hidden && 'line-through')}>{q.text}</span>
          <span className="flex shrink-0 items-center gap-1 text-xs text-muted-foreground tabular-nums" aria-label={t('votes', { count: q.votes })}>
            <ThumbsUp className="size-3.5" /> {q.votes}
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          {onScreen && <Badge className="font-normal">{t('onScreen')}</Badge>}
          {q.answered && (
            <Badge variant="secondary" className="font-normal">
              {t('answeredBadge')}
            </Badge>
          )}
          <span className="ml-auto flex flex-wrap items-center gap-1">
            {!q.hidden && live && (
              <Button
                variant={onScreen ? 'outline' : 'default'}
                size="sm"
                disabled={busy}
                onClick={() =>
                  run(q.id, () => (onScreen ? chorusActions.unhighlight(code, token) : chorusActions.highlight(code, token, q.id)))
                }
              >
                {onScreen ? <MonitorOff className="size-3.5" /> : <Monitor className="size-3.5" />}
                {onScreen ? t('unhighlight') : t('highlight')}
              </Button>
            )}
            {!q.hidden && (
              <Button
                variant="ghost"
                size="sm"
                disabled={busy}
                onClick={() => run(q.id, () => chorusActions.setQuestionFlags(code, token, q.id, { answered: !q.answered }))}
              >
                {q.answered ? <RotateCcw className="size-3.5" /> : <Check className="size-3.5" />}
                {q.answered ? t('markOpen') : t('markAnswered')}
              </Button>
            )}
            <Button
              variant="ghost"
              size="sm"
              disabled={busy}
              onClick={() => run(q.id, () => chorusActions.setQuestionFlags(code, token, q.id, { hidden: !q.hidden }))}
            >
              {q.hidden ? <Eye className="size-3.5" /> : <EyeOff className="size-3.5" />}
              {q.hidden ? t('unhide') : t('hide')}
            </Button>
          </span>
        </div>
      </li>
    )
  }

  if (questions.length === 0) {
    return <p className="text-sm text-muted-foreground">{status === 'draft' ? t('emptyDraft') : t('empty')}</p>
  }

  return (
    <div className="flex flex-col gap-3">
      {groups.open.length > 0 ? (
        <ul className={cn('flex flex-col gap-2 overflow-y-auto pr-1', maxHeightClass)}>{groups.open.map(row)}</ul>
      ) : (
        <p className="text-sm text-muted-foreground">{t('noOpen')}</p>
      )}
      {groups.answered.length > 0 && (
        <details open={ended} className="flex flex-col gap-2">
          <summary className="cursor-pointer text-sm font-medium">{t('answeredSection', { count: groups.answered.length })}</summary>
          <ul className="mt-2 flex flex-col gap-2">{groups.answered.map(row)}</ul>
        </details>
      )}
      {groups.hidden.length > 0 && (
        <details open={ended} className="flex flex-col gap-2">
          <summary className="cursor-pointer text-sm font-medium">{t('hiddenSection', { count: groups.hidden.length })}</summary>
          <ul className="mt-2 flex flex-col gap-2">{groups.hidden.map(row)}</ul>
        </details>
      )}
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  )
}
