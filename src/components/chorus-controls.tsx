'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { AArrowDown, AArrowUp, ChevronLeft, ChevronRight, Play, Square } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/confirm-dialog'
import { chorusActions } from '@/lib/api/chorus-actions'
import { FONT_MAX_PERCENT, FONT_MIN_PERCENT, FONT_STEP_PERCENT } from '@/lib/chorus/model'
import type { ChorusControlPayload, ChorusStatePayload, ChorusStatus } from '@/lib/chorus/types'

export function ChorusStatusBadge({ status }: { status: ChorusStatus }) {
  const t = useTranslations('chorus')
  const label = status === 'live' ? t('statusLive') : status === 'ended' ? t('statusEnded') : t('statusDraft')
  return (
    <Badge variant={status === 'live' ? 'default' : 'secondary'} className="w-fit">
      {status === 'live' && <span className="mr-1 size-1.5 animate-pulse rounded-full bg-current" />}
      {label}
    </Badge>
  )
}

/**
 * The presentation transport: Present / Previous / Next / End plus the presenter window's answer
 * size. Shared by the Chorus control page and the room control page's Chorus card, so the two can
 * never disagree about what's allowed when. `token` may be the session's own controller token or
 * a linked room's — the server accepts either (see checkChorusAccess).
 */
export function ChorusControls({
  state,
  token,
  onPayload,
  compact = false,
}: {
  state: ChorusStatePayload
  token: string
  onPayload: (payload: ChorusControlPayload) => void
  compact?: boolean
}) {
  const t = useTranslations('chorusControls')
  const tChorus = useTranslations('chorus')
  const [error, setError] = useState<string | null>(null)
  const [confirmEnd, setConfirmEnd] = useState(false)
  const [busy, setBusy] = useState(false)

  const run = (fn: () => Promise<ChorusControlPayload>) => {
    setError(null)
    setBusy(true)
    fn()
      .then(onPayload)
      .catch((err) => setError(err instanceof Error ? err.message : t('failed')))
      .finally(() => setBusy(false))
  }

  const { code, status, currentIndex, questionCount } = state
  const isLive = status === 'live'

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <ChorusStatusBadge status={status} />
        {isLive && currentIndex >= 0 && (
          <span className="text-sm text-muted-foreground">
            {tChorus('questionOf', { current: currentIndex + 1, total: questionCount })}
          </span>
        )}
      </div>

      {isLive && state.currentQuestion && (
        <p className={compact ? 'text-base font-medium' : 'text-xl font-semibold'}>{state.currentQuestion.prompt}</p>
      )}
      {status === 'draft' && (
        <p className="text-sm text-muted-foreground">{questionCount === 0 ? t('noQuestionsHint') : t('draftHint')}</p>
      )}
      {status === 'ended' && <p className="text-sm text-muted-foreground">{t('endedHint')}</p>}

      <div className="flex flex-wrap items-center gap-2">
        {status === 'draft' && (
          <Button onClick={() => run(() => chorusActions.present(code, token))} disabled={busy || questionCount === 0}>
            <Play className="size-4" /> {t('present')}
          </Button>
        )}
        {isLive && (
          <>
            <Button
              variant="outline"
              onClick={() => run(() => chorusActions.prev(code, token))}
              disabled={busy || currentIndex <= 0}
            >
              <ChevronLeft className="size-4" /> {t('prev')}
            </Button>
            <Button
              onClick={() => run(() => chorusActions.next(code, token))}
              disabled={busy || currentIndex >= questionCount - 1}
            >
              {t('next')} <ChevronRight className="size-4" />
            </Button>
            <Button variant="destructive" onClick={() => setConfirmEnd(true)} disabled={busy} className="ml-auto">
              <Square className="size-3.5" /> {t('end')}
            </Button>
          </>
        )}
      </div>

      {status !== 'ended' && (
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">{t('fontLabel')}</span>
          <Button
            variant="outline"
            size="icon"
            aria-label={t('smaller')}
            onClick={() => run(() => chorusActions.font(code, token, -FONT_STEP_PERCENT))}
            disabled={busy || state.answerFontPercent <= FONT_MIN_PERCENT}
          >
            <AArrowDown className="size-4" />
          </Button>
          <span className="w-12 text-center text-sm tabular-nums">{state.answerFontPercent}%</span>
          <Button
            variant="outline"
            size="icon"
            aria-label={t('larger')}
            onClick={() => run(() => chorusActions.font(code, token, FONT_STEP_PERCENT))}
            disabled={busy || state.answerFontPercent >= FONT_MAX_PERCENT}
          >
            <AArrowUp className="size-4" />
          </Button>
        </div>
      )}

      {isLive && !compact && <p className="text-xs text-muted-foreground">{t('keysHint')}</p>}
      {error && <p className="text-sm text-destructive">{error}</p>}

      <ConfirmDialog
        open={confirmEnd}
        title={t('endTitle')}
        description={t('endDesc')}
        confirmLabel={t('endConfirm')}
        onConfirm={() => {
          setConfirmEnd(false)
          run(() => chorusActions.end(code, token))
        }}
        onCancel={() => setConfirmEnd(false)}
      />
    </div>
  )
}
