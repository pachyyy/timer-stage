'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { AArrowDown, AArrowUp, MonitorOff, Pause, Play, Square } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/confirm-dialog'
import { ChorusStatusBadge } from '@/components/chorus-controls'
import { chorusActions } from '@/lib/api/chorus-actions'
import { FONT_MAX_PERCENT, FONT_MIN_PERCENT, FONT_STEP_PERCENT } from '@/lib/chorus/model'
import type { ChorusControlPayload, ChorusStatePayload } from '@/lib/chorus/types'

/**
 * The Q&A transport: Start / End, pause new questions, take the highlighted question off the
 * screen, and the presenter window's text size. The counterpart of ChorusControls for 'qna'
 * sessions; shared by the Chorus control page and the room control page's Chorus card. `token` may
 * be the session's own controller token or a linked room's (see checkChorusAccess).
 */
export function ChorusQnaControls({
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
  const t = useTranslations('chorusQnaControls')
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

  const { code, status } = state
  const isLive = status === 'live'

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <ChorusStatusBadge status={status} />
        {isLive && !state.intakeOpen && <Badge variant="outline">{t('pausedBadge')}</Badge>}
      </div>

      {isLive && (
        <div className="flex flex-col gap-2">
          {state.highlight ? (
            <>
              <span className="text-xs tracking-wide text-muted-foreground uppercase">{t('onScreen')}</span>
              <p className={compact ? 'text-base font-medium' : 'text-xl font-semibold'}>{state.highlight.text}</p>
              <Button
                variant="outline"
                size="sm"
                className="w-fit"
                onClick={() => run(() => chorusActions.unhighlight(code, token))}
                disabled={busy}
              >
                <MonitorOff className="size-3.5" /> {t('removeFromScreen')}
              </Button>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">{t('nothingOnScreen')}</p>
          )}
        </div>
      )}
      {status === 'draft' && <p className="text-sm text-muted-foreground">{t('draftHint')}</p>}
      {status === 'ended' && <p className="text-sm text-muted-foreground">{t('endedHint')}</p>}

      <div className="flex flex-wrap items-center gap-2">
        {status === 'draft' && (
          <Button onClick={() => run(() => chorusActions.present(code, token))} disabled={busy}>
            <Play className="size-4" /> {t('start')}
          </Button>
        )}
        {isLive && (
          <>
            <Button
              variant="outline"
              onClick={() => run(() => chorusActions.setIntake(code, token, !state.intakeOpen))}
              disabled={busy}
            >
              {state.intakeOpen ? <Pause className="size-4" /> : <Play className="size-4" />}
              {state.intakeOpen ? t('pauseIntake') : t('resumeIntake')}
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
