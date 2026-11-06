'use client'

import { use, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import Image from 'next/image'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { Check, Pencil, Plus, Timer, X } from 'lucide-react'
import { useChorusAnswers, useChorusControl, useChorusFeed } from '@/hooks/use-chorus'
import { chorusActions } from '@/lib/api/chorus-actions'
import { getChorusTokens, setChorusTokens } from '@/lib/auth/local-tokens'
import { MAX_PROMPT_LENGTH, MAX_QUESTIONS } from '@/lib/chorus/model'
import { isChorusKeyMessage, navDirection } from '@/lib/chorus/presenter-keys'
import type { ChorusControlPayload, ChorusQuestionRef } from '@/lib/chorus/types'
import { ChorusControls } from '@/components/chorus-controls'
import { ChorusShareCard } from '@/components/chorus-share-card'
import { ChorusQuestionList } from '@/components/chorus-question-list'
import { ChorusAnswersPanel } from '@/components/chorus-answers-panel'
import { ChorusQnaControls } from '@/components/chorus-qna-controls'
import { ChorusQnaPanel } from '@/components/chorus-qna-panel'
import { ConfirmDialog } from '@/components/confirm-dialog'
import { ConnectionBadge } from '@/components/connection-badge'
import { LocaleSwitcher } from '@/components/locale-switcher'
import { AuthButtons } from '@/components/auth-buttons'
import { MissingToken } from '@/components/missing-token'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

/**
 * The Chorus operator's main window: present / navigate / end, the question list, live answers
 * with Hide, and the share panel that opens the separate presenter window. Like the room control
 * page, it's reachable signed-out via `?t=` (or with a linked room's token), so it sits outside the
 * (app) route group with its own header.
 */
export default function ChorusControlPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = use(params)
  const searchParams = useSearchParams()
  const t = useTranslations('chorusControl')
  const tChorus = useTranslations('chorus')
  const tCommon = useTranslations('common')
  const tControls = useTranslations('chorusControls')
  const tQna = useTranslations('chorusQnaControl')

  const token = useMemo(() => {
    const fromUrl = searchParams.get('t')
    if (fromUrl) {
      setChorusTokens(code, { controllerToken: fromUrl })
      return fromUrl
    }
    return getChorusTokens(code).controllerToken ?? ''
  }, [code, searchParams])

  const { state, status, questions, presenterToken, applyControl, forbidden } = useChorusControl(code, token)
  const live = state?.status === 'live'
  const ended = state?.status === 'ended'
  const currentQuestionId = live ? (state?.currentQuestion?.id ?? null) : null
  const isQna = state?.mode === 'qna'
  const answersFeed = useChorusAnswers(
    code,
    token,
    currentQuestionId,
    Boolean(state) && !isQna && state?.status !== 'draft',
  )
  // Q&A: the controller's feed includes hidden questions, so they can be un-hidden.
  const qnaFeed = useChorusFeed(code, { token, intervalMs: 2000, enabled: Boolean(token) && isQna })

  const [newPrompt, setNewPrompt] = useState('')
  const [addError, setAddError] = useState<string | null>(null)
  const [pendingDelete, setPendingDelete] = useState<ChorusQuestionRef | null>(null)
  // Same optimistic-drag-order idea as the room control page's pendingOrder.
  const [pendingOrder, setPendingOrder] = useState<string[] | null>(null)
  const [editingName, setEditingName] = useState(false)
  const [nameDraft, setNameDraft] = useState('')
  const [renameError, setRenameError] = useState<string | null>(null)

  const displayedQuestions = useMemo(() => {
    if (!pendingOrder) return questions
    const byId = new Map(questions.map((q) => [q.id, q]))
    return pendingOrder.map((id) => byId.get(id)).filter((q): q is ChorusQuestionRef => Boolean(q))
  }, [questions, pendingOrder])

  const apply = (promise: Promise<ChorusControlPayload>) => promise.then(applyControl).catch(() => {})

  // Arrow keys / a presentation clicker — pressed here, or in the presenter window (which
  // forwards them, see presenter-keys.ts) — move between questions while live.
  useEffect(() => {
    if (!live || isQna) return
    const go = (key: string) => {
      const dir = navDirection(key)
      if (!dir) return false
      const request = dir === 'next' ? chorusActions.next(code, token) : chorusActions.prev(code, token)
      request.then(applyControl).catch(() => {})
      return true
    }
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA') return
      if (go(e.key)) e.preventDefault()
    }
    const onMessage = (e: MessageEvent) => {
      if (e.origin !== window.location.origin || !isChorusKeyMessage(e.data, code)) return
      go(e.data.key)
    }
    window.addEventListener('keydown', onKey)
    window.addEventListener('message', onMessage)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('message', onMessage)
    }
  }, [live, isQna, code, token, applyControl])

  if (status === 'not-found') {
    return (
      <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center gap-2 px-4 text-center">
        <h1 className="text-xl font-semibold">{t('notFoundTitle')}</h1>
        <p className="text-sm text-muted-foreground">{t('notFoundDesc')}</p>
      </main>
    )
  }
  if (forbidden) return <MissingToken />

  const addQuestion = async () => {
    const prompt = newPrompt.trim()
    if (!prompt) return
    setAddError(null)
    try {
      applyControl(await chorusActions.addQuestion(code, token, prompt))
      setNewPrompt('')
    } catch (err) {
      setAddError(err instanceof Error ? err.message : tControls('failed'))
    }
  }

  const rename = async () => {
    const trimmed = nameDraft.trim()
    if (!trimmed) return
    setRenameError(null)
    try {
      applyControl(await chorusActions.rename(code, token, trimmed))
      setEditingName(false)
    } catch (err) {
      setRenameError(err instanceof Error ? err.message : t('failedRename'))
    }
  }

  const reorder = (order: string[]) => {
    setPendingOrder(order)
    chorusActions
      .reorderQuestions(code, token, order)
      .then(applyControl)
      .catch(() => {})
      .finally(() => setPendingOrder(null))
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-5xl flex-col gap-6 px-4 py-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <Link href="/" className="shrink-0">
            <Image src="/clepsy.svg" alt="" width={24} height={24} unoptimized className="rounded-md" />
          </Link>
          <h1 className="shrink-0 text-xl font-semibold">{t('title')}</h1>
          {state && !editingName && (
            <span className="flex min-w-0 items-center gap-1">
              <span className="truncate text-sm text-muted-foreground">· {state.name}</span>
              <button
                type="button"
                onClick={() => {
                  setNameDraft(state.name)
                  setRenameError(null)
                  setEditingName(true)
                }}
                aria-label={t('rename')}
                className="shrink-0 text-muted-foreground hover:text-foreground"
              >
                <Pencil className="size-3.5" />
              </button>
            </span>
          )}
          {state && editingName && (
            <span className="flex min-w-0 items-center gap-1">
              <Input
                autoFocus
                value={nameDraft}
                onChange={(e) => setNameDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') rename()
                  if (e.key === 'Escape') setEditingName(false)
                }}
                maxLength={200}
                className="h-7 w-40 text-sm"
              />
              <Button variant="ghost" size="icon" className="size-7" onClick={rename} aria-label={t('saveName')}>
                <Check className="size-3.5" />
              </Button>
              <Button variant="ghost" size="icon" className="size-7" onClick={() => setEditingName(false)} aria-label={t('cancelRename')}>
                <X className="size-3.5" />
              </Button>
            </span>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {state?.linkedRoomId && (
            <Button asChild variant="outline" size="sm">
              <a href={`/r/${state.linkedRoomId}/control`}>
                <Timer className="size-3.5" /> {t('linkedTo', { room: state.linkedRoomId })}
              </a>
            </Button>
          )}
          <ConnectionBadge status={status} />
          <LocaleSwitcher />
          <AuthButtons />
        </div>
      </div>
      {renameError && <p className="text-sm text-destructive">{renameError}</p>}

      {!state ? (
        <p className="text-muted-foreground">{t('loading')}</p>
      ) : state.mode === 'qna' ? (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_24rem]">
          <div className="flex min-w-0 flex-col gap-6">
            <Card>
              <CardContent className="pt-6">
                <ChorusQnaControls state={state} token={token} onPayload={applyControl} />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  {ended ? tQna('resultsTitle') : tQna('questionsTitle')}
                  <Badge variant="secondary" className="font-normal">
                    {tQna('count', { count: qnaFeed.questions.filter((q) => !q.hidden).length })}
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-4">
                <ChorusQnaPanel
                  code={code}
                  token={token}
                  status={state.status}
                  questions={qnaFeed.questions}
                  highlightId={state.highlight?.id ?? null}
                  onPayload={applyControl}
                  onChanged={qnaFeed.refresh}
                  maxHeightClass="max-h-[40rem]"
                />
                <p className="text-xs text-muted-foreground">{tQna('hiddenHint')}</p>
              </CardContent>
            </Card>
          </div>

          <div className="flex min-w-0 flex-col gap-6">
            <ChorusShareCard code={code} presenterToken={presenterToken} />
          </div>
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_24rem]">
          <div className="flex min-w-0 flex-col gap-6">
            <Card>
              <CardContent className="pt-6">
                <ChorusControls state={state} token={token} onPayload={applyControl} />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  {ended ? t('resultsTitle') : t('answersTitle')}
                  {live && (
                    <Badge variant="secondary" className="font-normal">
                      {tChorus('answersCount', { count: answersFeed.answers.length })}
                    </Badge>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-4">
                {state.status === 'draft' && <p className="text-sm text-muted-foreground">{t('answersDraftHint')}</p>}
                {live && (
                  <ChorusAnswersPanel code={code} token={token} answers={answersFeed.answers} onChanged={answersFeed.refresh} />
                )}
                {ended &&
                  questions.map((question, i) => {
                    const forQuestion = answersFeed.answers.filter((a) => a.questionId === question.id)
                    return (
                      <section key={question.id} className="flex flex-col gap-2">
                        <h3 className="text-sm font-medium">
                          {i + 1}. {question.prompt}{' '}
                          <span className="font-normal text-muted-foreground">
                            · {tChorus('answersCount', { count: forQuestion.length })}
                          </span>
                        </h3>
                        <ChorusAnswersPanel
                          code={code}
                          token={token}
                          answers={forQuestion}
                          onChanged={answersFeed.refresh}
                          maxHeightClass="max-h-none"
                        />
                      </section>
                    )
                  })}
                {state.status !== 'draft' && <p className="text-xs text-muted-foreground">{t('hiddenHint')}</p>}
              </CardContent>
            </Card>
          </div>

          <div className="flex min-w-0 flex-col gap-6">
            <ChorusShareCard code={code} presenterToken={presenterToken} />

            <Card>
              <CardHeader>
                <CardTitle>{t('questionsTitle')}</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-4">
                <ChorusQuestionList
                  questions={displayedQuestions}
                  currentQuestionId={currentQuestionId}
                  editable={!ended}
                  canGoto={live}
                  counts={answersFeed.counts}
                  onGoto={(questionId) => apply(chorusActions.goto(code, token, questionId))}
                  onSave={(questionId, prompt) => apply(chorusActions.updateQuestion(code, token, questionId, prompt))}
                  onDelete={setPendingDelete}
                  onReorder={reorder}
                />
                {!ended && (
                  <div className="flex items-center gap-2">
                    <Input
                      placeholder={t('addQuestionPlaceholder')}
                      value={newPrompt}
                      maxLength={MAX_PROMPT_LENGTH}
                      onChange={(e) => setNewPrompt(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && addQuestion()}
                      className="flex-1"
                    />
                    <Button
                      variant="outline"
                      onClick={addQuestion}
                      disabled={!newPrompt.trim() || questions.length >= MAX_QUESTIONS}
                    >
                      <Plus className="size-4" /> {t('add')}
                    </Button>
                  </div>
                )}
                {addError && <p className="text-sm text-destructive">{addError}</p>}
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={pendingDelete !== null}
        title={t('deleteTitle')}
        description={pendingDelete ? t('deleteDesc', { prompt: pendingDelete.prompt }) : ''}
        confirmLabel={tCommon('delete')}
        onConfirm={() => {
          if (pendingDelete) apply(chorusActions.deleteQuestion(code, token, pendingDelete.id))
          setPendingDelete(null)
        }}
        onCancel={() => setPendingDelete(null)}
      />
    </main>
  )
}
