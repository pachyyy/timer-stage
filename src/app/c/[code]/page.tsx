'use client'

import { use, useEffect, useState, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { useTranslations } from 'next-intl'
import { Check } from 'lucide-react'
import { useChorus } from '@/hooks/use-chorus'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { ChorusQnaAudience } from '@/components/chorus-qna-audience'
import { ConnectionBadge } from '@/components/connection-badge'
import { getDeviceKey } from '@/lib/chorus/device'
import { MAX_ANSWER_LENGTH } from '@/lib/chorus/model'
import type { ChorusQuestionRef } from '@/lib/chorus/types'

/**
 * The audience's phone — where the QR code and the 6-digit code land. No sign-in and no name
 * prompt: answers are anonymous by design. The phone follows the presenter: a waiting screen
 * before Present, only the question currently on screen while live, a thank-you after End.
 */
export default function ChorusAudiencePage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = use(params)
  const router = useRouter()
  const { state, status } = useChorus(code)
  const t = useTranslations('chorusAudience')
  const tConnection = useTranslations('connectionBadge')
  const tQna = useTranslations('chorusQnaAudience')

  // An all-digit code that isn't a Chorus session might be a pre-Chorus timer room whose random
  // code happened to be all digits — those can't be minted any more (see generateRoomId), but any
  // that already exist still get routed here by the join box. Forward them on.
  useEffect(() => {
    if (status !== 'not-found') return
    fetch(`/api/rooms/${code}`, { cache: 'no-store' })
      .then((res) => {
        if (res.ok) router.replace(`/r/${code}`)
      })
      .catch(() => {})
  }, [status, code, router])

  // `top` = a scrolling list (Q&A) instead of a single centered message.
  const shell = (children: ReactNode, top = false) => (
    <main className="flex min-h-dvh flex-col bg-neutral-950 px-5 py-6 text-white">
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-2 text-sm text-white/60">
          <Image src="/clepsy.svg" alt="" width={22} height={22} unoptimized className="rounded-md" />
          {state?.name}
        </span>
        <ConnectionBadge status={status} />
      </div>
      <div className={`flex flex-1 flex-col ${top ? 'pt-6' : 'justify-center'}`}>{children}</div>
    </main>
  )

  if (status === 'not-found') {
    return shell(
      <div className="text-center">
        <h1 className="text-xl font-semibold">{t('notFoundTitle')}</h1>
        <p className="mt-2 text-sm text-white/50">{t('notFoundDesc')}</p>
      </div>,
    )
  }

  if (!state) return shell(<p className="text-center text-white/60">{tConnection('connecting')}</p>)

  // Q&A: the audience asks and votes instead of answering one question at a time.
  if (state.mode === 'qna') {
    if (state.status === 'live') return shell(<ChorusQnaAudience code={code} state={state} />, true)
    const ended = state.status === 'ended'
    return shell(
      <div className="text-center">
        <h1 className="text-2xl font-semibold">{ended ? tQna('endedTitle') : tQna('waitingTitle')}</h1>
        <p className="mt-2 text-white/60">{ended ? tQna('endedDesc') : tQna('waitingDesc')}</p>
        {!ended && <p className="mt-6 text-xs text-white/40">{tQna('anonymous')}</p>}
      </div>,
    )
  }

  if (state.status === 'draft') {
    return shell(
      <div className="text-center">
        <h1 className="text-2xl font-semibold">{t('waitingTitle')}</h1>
        <p className="mt-2 text-white/60">{t('waitingDesc')}</p>
        <p className="mt-6 text-xs text-white/40">{t('anonymous')}</p>
      </div>,
    )
  }

  if (state.status === 'ended' || !state.currentQuestion) {
    return shell(
      <div className="text-center">
        <h1 className="text-2xl font-semibold">{t('endedTitle')}</h1>
        <p className="mt-2 text-white/60">{t('endedDesc')}</p>
      </div>,
    )
  }

  // Keyed by question so the draft and "Sent" state reset the moment the presenter moves on.
  return shell(<AnswerForm key={state.currentQuestion.id} code={code} question={state.currentQuestion} />)
}

function AnswerForm({ code, question }: { code: string; question: ChorusQuestionRef }) {
  const t = useTranslations('chorusAudience')
  const [deviceKey] = useState(() => getDeviceKey())
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const [sentCount, setSentCount] = useState(0)
  const [error, setError] = useState<string | null>(null)

  const send = async () => {
    const trimmed = text.trim()
    if (!trimmed || sending) return
    setSending(true)
    setError(null)
    try {
      const res = await fetch(`/api/chorus/${code}/answers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ questionId: question.id, text: trimmed, deviceKey }),
      })
      if (!res.ok) {
        // 409 (question moved on) and 429 (cooldown) both come back with a message meant for the
        // person; a 409 also means fresh state is on its way through the normal sync path.
        const body = await res.json().catch(() => null)
        setError(typeof body?.error === 'string' ? body.error : t('failed'))
        return
      }
      setText('')
      setSentCount((n) => n + 1)
    } catch {
      setError(t('failed'))
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl leading-tight font-semibold break-words">{question.prompt}</h1>
      <Textarea
        value={text}
        maxLength={MAX_ANSWER_LENGTH}
        onChange={(e) => setText(e.target.value)}
        placeholder={t('placeholder')}
        rows={4}
        className="border-white/20 bg-white/5 text-base text-white placeholder:text-white/40"
      />
      <div className="flex items-center justify-between text-xs text-white/40">
        <span>{t('anonymous')}</span>
        <span className="tabular-nums">{t('charsLeft', { count: MAX_ANSWER_LENGTH - text.length })}</span>
      </div>
      <Button size="lg" onClick={send} disabled={!text.trim() || sending}>
        {sending ? t('sending') : t('send')}
      </Button>
      {sentCount > 0 && !error && (
        <p className="flex items-center justify-center gap-1.5 text-sm text-emerald-400">
          <Check className="size-4" /> {t('sent')}
        </p>
      )}
      {error && <p className="text-center text-sm text-amber-400">{error}</p>}
    </div>
  )
}
