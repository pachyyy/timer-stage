'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { Eye, EyeOff } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { chorusActions } from '@/lib/api/chorus-actions'
import type { ChorusAnswerRow } from '@/lib/chorus/types'

/**
 * The operator's answer list with a per-answer Hide/Show toggle. Hiding never deletes: it only
 * keeps that answer off the presenter window. Optimistic, then `onChanged` refetches the feed so
 * the operator's own list matches what the presenter now shows.
 */
export function ChorusAnswersPanel({
  code,
  token,
  answers,
  onChanged,
  maxHeightClass = 'max-h-[28rem]',
}: {
  code: string
  token: string
  answers: ChorusAnswerRow[]
  onChanged: () => void
  maxHeightClass?: string
}) {
  const t = useTranslations('chorusControl')
  // Overrides `hidden` between the click and the refetch landing, so the toggle feels instant.
  const [pending, setPending] = useState<Record<string, boolean>>({})

  const toggle = (answer: ChorusAnswerRow, hidden: boolean) => {
    setPending((p) => ({ ...p, [answer.id]: hidden }))
    chorusActions
      .setAnswerHidden(code, token, answer.id, hidden)
      .then(onChanged)
      .catch(() => {})
      .finally(() =>
        setPending((p) => {
          const next = { ...p }
          delete next[answer.id]
          return next
        }),
      )
  }

  if (answers.length === 0) return <p className="text-sm text-muted-foreground">{t('noAnswersYet')}</p>

  return (
    <ul className={cn('flex flex-col gap-2 overflow-y-auto pr-1', maxHeightClass)}>
      {answers.map((answer) => {
        const hidden = pending[answer.id] ?? answer.hidden
        return (
          <li
            key={answer.id}
            className={cn('flex items-start gap-2 rounded-md border px-3 py-2 text-sm', hidden && 'bg-muted/50 text-muted-foreground')}
          >
            <span className={cn('flex-1 break-words whitespace-pre-wrap', hidden && 'line-through')}>{answer.text}</span>
            {hidden && (
              <Badge variant="outline" className="shrink-0 text-xs font-normal">
                {t('hiddenBadge')}
              </Badge>
            )}
            <Button
              variant="ghost"
              size="sm"
              className="shrink-0"
              onClick={() => toggle(answer, !hidden)}
              aria-label={hidden ? t('unhide') : t('hide')}
            >
              {hidden ? <Eye className="size-3.5" /> : <EyeOff className="size-3.5" />}
              {hidden ? t('unhide') : t('hide')}
            </Button>
          </li>
        )
      })}
    </ul>
  )
}
