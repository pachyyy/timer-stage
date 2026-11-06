'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { chorusActions, ActionError, type CreatedChorus } from '@/lib/api/chorus-actions'
import { setChorusTokens } from '@/lib/auth/local-tokens'
import { MAX_PROMPT_LENGTH, MAX_QUESTIONS } from '@/lib/chorus/model'
import type { ChorusMode } from '@/lib/chorus/types'

/**
 * Mode, title and (for 'answers' mode) the prompt list of a new Chorus session. Shared by the dashboard's Create tab and the
 * room control page's "New session" dialog, which passes `linkRoomId`/`roomToken` so the session
 * is created already linked. Caches the new tokens before handing the result to `onCreated`.
 */
export function ChorusCreateForm({
  linkRoomId,
  roomToken,
  onCreated,
}: {
  linkRoomId?: string
  roomToken?: string
  onCreated: (created: CreatedChorus) => void
}) {
  const t = useTranslations('chorusCreate')
  const tCommon = useTranslations('common')
  const [mode, setMode] = useState<ChorusMode>('answers')
  const [name, setName] = useState('')
  const [questions, setQuestions] = useState<string[]>([''])
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // 402 = out of Chorus credits — checked by status, never by the (translated) message text.
  const [quotaBlocked, setQuotaBlocked] = useState(false)

  const update = (i: number, value: string) => setQuestions((prev) => prev.map((q, idx) => (idx === i ? value : q)))

  const create = async () => {
    setCreating(true)
    setError(null)
    setQuotaBlocked(false)
    try {
      const created = await chorusActions.create({
        name,
        mode,
        questions: mode === 'answers' ? questions.map((q) => q.trim()).filter(Boolean) : [],
        ...(linkRoomId ? { linkRoomId, roomToken } : {}),
      })
      setChorusTokens(created.code, created)
      onCreated(created)
    } catch (err) {
      if (err instanceof ActionError) setQuotaBlocked(err.status === 402)
      setError(err instanceof Error ? err.message : t('failed'))
      setCreating(false)
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-1.5">
        <Label id="chorus-mode-label">{t('modeLabel')}</Label>
        <div role="radiogroup" aria-labelledby="chorus-mode-label" className="grid gap-2 sm:grid-cols-2">
          {(
            [
              { value: 'answers', label: t('modeAnswers'), desc: t('modeAnswersDesc') },
              { value: 'qna', label: t('modeQna'), desc: t('modeQnaDesc') },
            ] as const
          ).map((option) => (
            <button
              key={option.value}
              type="button"
              role="radio"
              aria-checked={mode === option.value}
              onClick={() => setMode(option.value)}
              className={`flex flex-col gap-0.5 rounded-lg border px-3 py-2 text-left transition-colors ${
                mode === option.value ? 'border-primary bg-primary/5' : 'hover:bg-muted/50'
              }`}
            >
              <span className="text-sm font-medium">{option.label}</span>
              <span className="text-xs text-muted-foreground">{option.desc}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="chorus-name">{t('titleLabel')}</Label>
        <Input
          id="chorus-name"
          placeholder={t('titlePlaceholder')}
          value={name}
          maxLength={200}
          onChange={(e) => setName(e.target.value)}
        />
      </div>

      <Separator />

      {mode === 'qna' && <p className="text-sm text-muted-foreground">{t('qnaHint')}</p>}

      {mode === 'answers' && (
        <div className="flex flex-col gap-3">
        <Label>{t('questionsLabel')}</Label>
        {questions.map((question, i) => (
          <div key={i} className="flex items-center gap-2">
            <span className="w-5 text-right text-sm text-muted-foreground tabular-nums">{i + 1}.</span>
            <Input
              placeholder={t('questionPlaceholder')}
              value={question}
              maxLength={MAX_PROMPT_LENGTH}
              onChange={(e) => update(i, e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && question.trim() && i === questions.length - 1 && questions.length < MAX_QUESTIONS) {
                  setQuestions((prev) => [...prev, ''])
                }
              }}
              className="flex-1"
            />
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setQuestions((prev) => prev.filter((_, idx) => idx !== i))}
              disabled={questions.length <= 1}
              aria-label={t('removeQuestion')}
            >
              <Trash2 className="size-4" />
            </Button>
          </div>
        ))}
        <Button
          variant="outline"
          size="sm"
          onClick={() => setQuestions((prev) => [...prev, ''])}
          disabled={questions.length >= MAX_QUESTIONS}
          className="self-start"
        >
          <Plus className="size-4" /> {t('addQuestion')}
        </Button>
        <p className="text-xs text-muted-foreground">{t('hint')}</p>
        </div>
      )}

      {error && (
        <p className="text-sm text-destructive">
          {error}
          {quotaBlocked && (
            <>
              {' '}
              <Link href="/pricing" className="font-medium underline underline-offset-2">
                {tCommon('buyMore')}
              </Link>
            </>
          )}
        </p>
      )}

      <Button onClick={create} disabled={creating} size="lg">
        {creating ? t('creating') : t('create')}
      </Button>
    </div>
  )
}
