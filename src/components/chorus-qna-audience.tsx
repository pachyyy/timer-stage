'use client'

import { useMemo, useState } from 'react'
import { useTranslations } from 'next-intl'
import { Check, ThumbsUp } from 'lucide-react'
import { useChorusFeed } from '@/hooks/use-chorus'
import { ActionError, qnaAudience } from '@/lib/api/chorus-actions'
import { getDeviceKey, getOwnQuestionIds, rememberOwnQuestion } from '@/lib/chorus/device'
import { MAX_ASKED_LENGTH } from '@/lib/chorus/model'
import { rankQuestions, sortRecent } from '@/lib/chorus/qna'
import type { ChorusStatePayload, QnaQuestionRow } from '@/lib/chorus/types'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'

/** Slow on purpose: a few hundred phones polling, and the vote you just cast already shows instantly. */
const FEED_POLL_MS = 5000

type SortMode = 'popular' | 'recent'

/**
 * The phone's Q&A screen: ask a question, see everyone's, and vote. Tapping a card never votes: it
 * opens a small confirm sheet with a Vote button, so a stray tap while scrolling can't count.
 * The list isn't re-sorted while that sheet is open, so cards don't jump around under a thumb.
 */
export function ChorusQnaAudience({ code, state }: { code: string; state: ChorusStatePayload }) {
  const t = useTranslations('chorusQnaAudience')
  const [deviceKey] = useState(() => getDeviceKey())
  const [ownIds, setOwnIds] = useState(() => new Set(getOwnQuestionIds(code)))
  const feed = useChorusFeed(code, { deviceKey, intervalMs: FEED_POLL_MS })
  const [sort, setSort] = useState<SortMode>('popular')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [frozenOrder, setFrozenOrder] = useState<string[] | null>(null)
  const [voteError, setVoteError] = useState<string | null>(null)

  const mine = useMemo(() => new Set(feed.mine), [feed.mine])
  const highlightedId = state.highlight?.id ?? null

  // Open questions first (ranked or newest), then the answered ones, dimmed at the bottom.
  const ordered = useMemo(() => {
    const sorter = sort === 'popular' ? rankQuestions : sortRecent
    const open = sorter(feed.questions.filter((q) => !q.answered))
    const answered = sorter(feed.questions.filter((q) => q.answered))
    const list = [...open, ...answered]
    if (!frozenOrder) return list
    // While the sheet is open keep the order it opened with; questions that arrived since go last.
    const rank = new Map(frozenOrder.map((id, i) => [id, i]))
    return [...list].sort((a, b) => (rank.get(a.id) ?? Infinity) - (rank.get(b.id) ?? Infinity))
  }, [feed.questions, sort, frozenOrder])

  const selected = feed.questions.find((q) => q.id === selectedId) ?? null

  const openSheet = (id: string) => {
    setVoteError(null)
    setFrozenOrder(ordered.map((q) => q.id))
    setSelectedId(id)
  }
  const closeSheet = () => {
    setSelectedId(null)
    setFrozenOrder(null)
  }

  const toggleVote = async (question: QnaQuestionRow) => {
    const hasVoted = mine.has(question.id)
    // Optimistic: the count and the highlight move now; a failure rolls back to the server's truth.
    feed.update((cur) => ({
      ...cur,
      questions: cur.questions.map((q) => (q.id === question.id ? { ...q, votes: Math.max(0, q.votes + (hasVoted ? -1 : 1)) } : q)),
      mine: hasVoted ? cur.mine.filter((id) => id !== question.id) : [...cur.mine, question.id],
    }))
    closeSheet()
    try {
      await (hasVoted ? qnaAudience.unvote(code, question.id, deviceKey) : qnaAudience.vote(code, question.id, deviceKey))
    } catch (err) {
      setVoteError(err instanceof ActionError ? err.message : t('voteFailed'))
    }
    feed.refresh()
  }

  return (
    <div className="flex flex-col gap-6 pb-6">
      <AskBox
        code={code}
        deviceKey={deviceKey}
        intakeOpen={state.intakeOpen}
        onAsked={(id) => {
          rememberOwnQuestion(code, id)
          setOwnIds((cur) => new Set(cur).add(id))
          feed.refresh()
        }}
      />

      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold">{t('listTitle')}</h2>
          <Tabs value={sort} onValueChange={(v) => setSort(v as SortMode)}>
            <TabsList className="bg-white/10">
              <TabsTrigger value="popular" className="text-white/70 data-[state=active]:bg-white/20 data-[state=active]:text-white">
                {t('tabPopular')}
              </TabsTrigger>
              <TabsTrigger value="recent" className="text-white/70 data-[state=active]:bg-white/20 data-[state=active]:text-white">
                {t('tabRecent')}
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        {voteError && <p className="text-sm text-amber-400">{voteError}</p>}

        {feed.loaded && ordered.length === 0 ? (
          <p className="rounded-xl border border-dashed border-white/15 px-4 py-8 text-center text-sm text-white/50">{t('empty')}</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {ordered.map((q) => (
              <li key={q.id}>
                <button
                  type="button"
                  onClick={() => openSheet(q.id)}
                  className={`flex w-full items-start gap-3 rounded-xl border px-4 py-3 text-left transition-colors ${
                    mine.has(q.id) ? 'border-emerald-400/50 bg-emerald-400/10' : 'border-white/10 bg-white/5 hover:bg-white/10'
                  } ${q.answered ? 'opacity-60' : ''}`}
                >
                  <span className="flex min-w-0 flex-1 flex-col gap-2">
                    <span className="text-base break-words">{q.text}</span>
                    {(highlightedId === q.id || ownIds.has(q.id) || q.answered) && (
                      <span className="flex flex-wrap gap-1.5 text-xs">
                        {highlightedId === q.id && <Badge tone="live">{t('badgeOnScreen')}</Badge>}
                        {q.answered && <Badge>{t('badgeAnswered')}</Badge>}
                        {ownIds.has(q.id) && <Badge>{t('badgeYours')}</Badge>}
                      </span>
                    )}
                  </span>
                  <span
                    className={`flex shrink-0 items-center gap-1.5 text-sm tabular-nums ${
                      mine.has(q.id) ? 'text-emerald-300' : 'text-white/60'
                    }`}
                    aria-label={t('votes', { count: q.votes })}
                  >
                    <ThumbsUp className="size-4" /> {q.votes}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <Dialog open={selected !== null} onOpenChange={(open) => !open && closeSheet()}>
        <DialogContent
          showCloseButton={false}
          className="top-auto bottom-4 translate-y-0 border-white/10 bg-neutral-900 text-white sm:max-w-sm"
        >
          {selected && (
            <>
              <DialogHeader>
                <DialogTitle className="text-base leading-snug font-medium break-words">{selected.text}</DialogTitle>
                <DialogDescription className="text-white/50">
                  {t('votes', { count: selected.votes })} · {t('sheetHint')}
                </DialogDescription>
              </DialogHeader>
              <div className="flex flex-col gap-2">
                <Button size="lg" onClick={() => toggleVote(selected)} variant={mine.has(selected.id) ? 'secondary' : 'default'}>
                  {mine.has(selected.id) ? t('sheetRemove') : t('sheetVote')}
                </Button>
                <Button variant="ghost" className="text-white/70 hover:bg-white/10 hover:text-white" onClick={closeSheet}>
                  {t('sheetCancel')}
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

function Badge({ children, tone }: { children: React.ReactNode; tone?: 'live' }) {
  return (
    <span
      className={`rounded-full px-2 py-0.5 ${tone === 'live' ? 'bg-emerald-400/20 text-emerald-300' : 'bg-white/10 text-white/60'}`}
    >
      {children}
    </span>
  )
}

function AskBox({
  code,
  deviceKey,
  intakeOpen,
  onAsked,
}: {
  code: string
  deviceKey: string
  intakeOpen: boolean
  onAsked: (id: string) => void
}) {
  const t = useTranslations('chorusQnaAudience')
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
      const { id } = await qnaAudience.ask(code, trimmed, deviceKey)
      setText('')
      setSentCount((n) => n + 1)
      onAsked(id)
    } catch (err) {
      // 409 (paused / closed) and 429 (cooldown) carry a message meant for the person.
      setError(err instanceof ActionError ? err.message : t('failed'))
    } finally {
      setSending(false)
    }
  }

  return (
    <section className="flex flex-col gap-3">
      <h1 className="text-2xl leading-tight font-semibold">{t('askTitle')}</h1>
      <Textarea
        value={text}
        maxLength={MAX_ASKED_LENGTH}
        onChange={(e) => setText(e.target.value)}
        placeholder={intakeOpen ? t('askPlaceholder') : t('paused')}
        disabled={!intakeOpen}
        rows={3}
        className="border-white/20 bg-white/5 text-base text-white placeholder:text-white/40"
      />
      <div className="flex items-center justify-between text-xs text-white/40">
        <span>{t('anonymous')}</span>
        <span className="tabular-nums">{t('charsLeft', { count: MAX_ASKED_LENGTH - text.length })}</span>
      </div>
      <Button size="lg" onClick={send} disabled={!intakeOpen || !text.trim() || sending}>
        {sending ? t('sending') : t('send')}
      </Button>
      {!intakeOpen && <p className="text-center text-sm text-amber-400">{t('paused')}</p>}
      {sentCount > 0 && !error && (
        <p className="flex items-center justify-center gap-1.5 text-sm text-emerald-400">
          <Check className="size-4" /> {t('sent')}
        </p>
      )}
      {error && <p className="text-center text-sm text-amber-400">{error}</p>}
    </section>
  )
}
