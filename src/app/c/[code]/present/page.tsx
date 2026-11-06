'use client'

import { use, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { QRCodeSVG } from 'qrcode.react'
import { useChorus, useChorusAnswers, useChorusFeed } from '@/hooks/use-chorus'
import { useStageScreen } from '@/hooks/use-stage-screen'
import { ConnectionBadge } from '@/components/connection-badge'
import { ChorusAnswerWall } from '@/components/chorus-answer-wall'
import { useOrigin } from '@/components/chorus-share-card'
import { formatChorusCode } from '@/lib/chorus/model'
import { CHORUS_KEY_MESSAGE, CHORUS_NAV_KEYS, type ChorusKeyMessage } from '@/lib/chorus/presenter-keys'

/**
 * The separate presenter window — what goes on the projector. Read-only: it follows the session's
 * public state like every phone does, and polls the answers feed with the presenter token from its
 * own URL, so it works equally as a popup dragged to a second screen or opened on a separate
 * projector computer. Clicking anywhere goes fullscreen.
 *
 * Presenter clickers send keys to whichever window has focus, which during a show is usually this
 * one — so nav keys are forwarded (postMessage) to the control window that opened it, which owns
 * the actual Next/Previous calls and the controller credential.
 */
export default function ChorusPresenterPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = use(params)
  const token = useSearchParams().get('t') ?? ''
  const { state, status } = useChorus(code)
  const currentQuestionId = state?.status === 'live' ? (state.currentQuestion?.id ?? null) : null
  const { answers, forbidden } = useChorusAnswers(code, token, currentQuestionId, currentQuestionId !== null)
  // Q&A: the presenter never lists the audience's questions, only the highlighted one, but it polls
  // the feed (visible questions only) for that question's live vote count and the waiting total.
  const qnaLive = state?.mode === 'qna' && state.status === 'live'
  const feed = useChorusFeed(code, { token, intervalMs: 2000, enabled: qnaLive })
  const highlight = state?.mode === 'qna' ? state.highlight : null
  const highlightVotes = highlight ? (feed.questions.find((q) => q.id === highlight.id)?.votes ?? 0) : 0
  const { wakeLockError, requestFullscreen } = useStageScreen()
  const origin = useOrigin()
  const t = useTranslations('chorusPresenter')
  const tChorus = useTranslations('chorus')
  const tConnection = useTranslations('connectionBadge')
  const tScreen = useTranslations('screen')
  const tQna = useTranslations('chorusQnaPresenter')

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (!(CHORUS_NAV_KEYS as readonly string[]).includes(e.key)) return
      if (!window.opener) return
      e.preventDefault()
      const message: ChorusKeyMessage = { type: CHORUS_KEY_MESSAGE, code, key: e.key }
      window.opener.postMessage(message, window.location.origin)
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [code])

  const audienceUrl = origin ? `${origin}/c/${code}` : ''
  const shortUrl = origin ? `${origin.replace(/^https?:\/\//, '')}/c` : ''

  const surface = 'flex min-h-screen flex-col bg-neutral-950 text-white select-none'

  if (status === 'not-found') {
    return <div className={`${surface} items-center justify-center text-2xl text-white/60`}>{tConnection('notFound')}</div>
  }
  if (!state) {
    return <div className={`${surface} items-center justify-center text-white/60`}>{tConnection('connecting')}</div>
  }

  return (
    <div className={surface} onClick={requestFullscreen}>
      <div className="fixed top-4 right-4 z-10 opacity-60">
        <ConnectionBadge status={status} />
      </div>

      {state.status === 'draft' && (
        <div className="flex flex-1 flex-col items-center justify-center gap-8 px-8 text-center">
          <h1 className="text-[clamp(1.75rem,3.5vw,3.5rem)] font-semibold">{state.name}</h1>
          <div className="aspect-square h-[42vh] rounded-2xl bg-white p-[2vh]">
            {audienceUrl && <QRCodeSVG value={audienceUrl} size={512} marginSize={0} style={{ width: '100%', height: '100%' }} />}
          </div>
          <div className="flex flex-col items-center gap-2">
            <p className="text-[clamp(1.25rem,2.2vw,2.25rem)] text-white/70">
              {t('joinAt', { url: shortUrl })} {t('enterCode')}
            </p>
            <p className="font-mono text-[clamp(3rem,8vw,8rem)] leading-none font-bold tracking-[0.15em] tabular-nums">
              {formatChorusCode(code)}
            </p>
          </div>
          <p className="text-lg text-white/40">{t('startingSoon')}</p>
        </div>
      )}

      {state.mode === 'qna' && state.status === 'live' && highlight && (
        <div className="flex flex-1 flex-col items-center justify-center gap-[4vh] px-[6vw] py-[6vh] text-center">
          <span className="rounded-full bg-white/10 px-5 py-1.5 text-[clamp(0.875rem,1.4vw,1.5rem)] text-white/60">
            {tQna('votes', { count: highlightVotes })}
          </span>
          <h1
            className="leading-tight font-semibold break-words"
            style={{ fontSize: `calc(clamp(2rem, 5.2vw, 6.5rem) * ${state.answerFontPercent / 100})` }}
          >
            {highlight.text}
          </h1>
        </div>
      )}

      {state.mode === 'qna' && state.status === 'live' && !highlight && (
        <div className="flex flex-1 flex-col items-center justify-center gap-8 px-8 text-center">
          <h1 className="text-[clamp(2rem,4.5vw,4.5rem)] font-semibold">{tQna('askTitle')}</h1>
          <div className="aspect-square h-[38vh] rounded-2xl bg-white p-[2vh]">
            {audienceUrl && <QRCodeSVG value={audienceUrl} size={512} marginSize={0} style={{ width: '100%', height: '100%' }} />}
          </div>
          <div className="flex flex-col items-center gap-2">
            <p className="text-[clamp(1.25rem,2.2vw,2.25rem)] text-white/70">
              {t('joinAt', { url: shortUrl })} {t('enterCode')}
            </p>
            <p className="font-mono text-[clamp(3rem,7vw,7rem)] leading-none font-bold tracking-[0.15em] tabular-nums">
              {formatChorusCode(code)}
            </p>
          </div>
          {feed.questions.length > 0 && (
            <p className="text-[clamp(1rem,1.6vw,1.5rem)] text-white/40">
              {tQna('waiting', { count: feed.questions.length })}
            </p>
          )}
        </div>
      )}

      {state.mode === 'answers' && state.status === 'live' && state.currentQuestion && (
        <div className="flex flex-1 flex-col gap-8 overflow-hidden px-[4vw] pt-[5vh] pb-[3vh]">
          <div className="flex flex-col gap-2 pr-[12rem]">
            <span className="text-[clamp(0.875rem,1.2vw,1.25rem)] text-white/50">
              {tChorus('questionOf', { current: state.currentIndex + 1, total: state.questionCount })}
            </span>
            <h1 className="text-[clamp(1.75rem,3.6vw,4rem)] leading-tight font-semibold break-words">
              {state.currentQuestion.prompt}
            </h1>
          </div>
          <div className="min-h-0 flex-1 overflow-hidden">
            {answers.length === 0 ? (
              <p className="pt-[10vh] text-center text-[clamp(1rem,1.8vw,1.75rem)] text-white/30">{t('noAnswers')}</p>
            ) : (
              <ChorusAnswerWall answers={answers} fontPercent={state.answerFontPercent} />
            )}
          </div>
        </div>
      )}

      {state.status === 'live' && !(state.mode === 'qna' && !highlight) && (
        <div className="fixed right-6 bottom-6 flex items-center gap-3 rounded-xl bg-black/70 p-3">
          <div className="rounded-md bg-white p-1.5">
            {audienceUrl && <QRCodeSVG value={audienceUrl} size={88} marginSize={0} />}
          </div>
          <div className="flex flex-col">
            <span className="text-sm text-white/60">{shortUrl}</span>
            <span className="font-mono text-3xl font-bold tracking-widest tabular-nums">{formatChorusCode(code)}</span>
          </div>
        </div>
      )}

      {(state.status === 'ended' || (state.mode === 'answers' && state.status === 'live' && !state.currentQuestion)) && (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center">
          <h1 className="text-[clamp(2.5rem,6vw,6rem)] font-semibold">{t('thanksTitle')}</h1>
          <p className="text-[clamp(1rem,2vw,2rem)] text-white/50">{t('thanksDesc')}</p>
        </div>
      )}

      {forbidden && <div className="fixed bottom-4 left-4 text-sm text-amber-400">{t('invalidLink')}</div>}
      {wakeLockError && !forbidden && (
        <div className="fixed bottom-4 left-4 text-xs opacity-30">{tScreen('wakeLockWarning')}</div>
      )}
    </div>
  )
}
