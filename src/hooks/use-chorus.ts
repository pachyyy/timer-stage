'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createChorusTransport } from '@/lib/sync/create-transport'
import { chorusActions, ActionError } from '@/lib/api/chorus-actions'
import type {
  ChorusAnswerRow,
  ChorusAnswersPayload,
  ChorusControlPayload,
  ChorusQuestionRef,
  QnaFeedPayload,
  QnaQuestionRow,
} from '@/lib/chorus/types'
import { useVersionedState } from './use-room-state'

/**
 * A Chorus session's public state, version-guarded — the Chorus counterpart of useRoom, used as-is
 * by the audience phone and the presenter window. No synced clock: nothing in Chorus is derived
 * from time, so there's no countdown to keep in step.
 */
export function useChorus(code: string) {
  // Browser-only id, same as useRoom's — created once, not a ref (refs must not be read in render).
  const [clientId] = useState(() => crypto.randomUUID())
  const transport = useMemo(() => createChorusTransport(clientId), [clientId])
  return useVersionedState(code, transport)
}

/**
 * The operator's view: the public state plus the full question list, which isn't in the public
 * payload (see src/lib/chorus/types.ts). The list is refetched whenever `version` moves, so another
 * operator's edit, or a delete that moved the live question, shows up here too.
 * `applyControl` is what every mutation's response goes through.
 */
export function useChorusControl(code: string, token: string) {
  const { state, status, applyPayload } = useChorus(code)
  const [questions, setQuestions] = useState<ChorusQuestionRef[]>([])
  const [presenterToken, setPresenterToken] = useState<string | null>(null)
  const [forbidden, setForbidden] = useState(false)
  const questionsVersionRef = useRef(-1)

  const applyControl = useCallback(
    (payload: ChorusControlPayload) => {
      applyPayload(payload.state)
      if (payload.state.version < questionsVersionRef.current) return
      questionsVersionRef.current = payload.state.version
      setQuestions(payload.questions)
      setPresenterToken(payload.presenterToken)
    },
    [applyPayload],
  )

  const version = state?.version
  useEffect(() => {
    if (version === undefined) return
    if (version <= questionsVersionRef.current) return
    let cancelled = false
    chorusActions
      .load(code, token)
      .then((payload) => {
        if (!cancelled) applyControl(payload)
      })
      .catch((err) => {
        if (!cancelled && err instanceof ActionError && err.status === 403) setForbidden(true)
      })
    return () => {
      cancelled = true
    }
  }, [code, token, version, applyControl])

  return { state, status, questions, presenterToken, applyControl, forbidden }
}

const ANSWERS_POLL_MS = 1500

/**
 * Polls the answers feed — only the presenter window and the control page ever need answers, so
 * they poll (with an ETag on `answersVersion`) instead of answers riding the broadcast channel to
 * every phone. `questionId` null fetches every question (controller only — the results view).
 * `refresh` forces an immediate poll, e.g. right after hiding an answer.
 */
export function useChorusAnswers(code: string, token: string, questionId: string | null, enabled = true) {
  const [data, setData] = useState<{ key: string; answers: ChorusAnswerRow[]; counts: Record<string, number> }>({
    key: '',
    answers: [],
    counts: {},
  })
  const [tick, setTick] = useState(0)
  const [forbidden, setForbidden] = useState(false)
  const refresh = useCallback(() => setTick((n) => n + 1), [])
  const key = `${code}|${questionId ?? 'all'}`

  useEffect(() => {
    if (!enabled || !token) return
    let cancelled = false
    let etag: string | null = null
    const url = `/api/chorus/${code}/answers?token=${encodeURIComponent(token)}${
      questionId ? `&questionId=${encodeURIComponent(questionId)}` : ''
    }`

    const poll = async () => {
      try {
        const res = await fetch(url, { headers: etag ? { 'If-None-Match': etag } : {}, cache: 'no-store' })
        if (cancelled || res.status === 304) return
        if (res.status === 403) setForbidden(true)
        if (!res.ok) return
        etag = res.headers.get('ETag')
        const payload = (await res.json()) as ChorusAnswersPayload
        if (!cancelled) setData({ key, answers: payload.answers, counts: payload.counts })
      } catch {
        // transient — the next tick retries
      }
    }

    void poll()
    const interval = setInterval(poll, ANSWERS_POLL_MS)
    return () => {
      cancelled = true
      clearInterval(interval)
    }
  }, [code, token, questionId, enabled, key, tick])

  // Answers from a previous question never flash on screen while the new one's first poll is in flight.
  const current = data.key === key
  return { answers: current ? data.answers : [], counts: data.counts, loaded: current, forbidden, refresh }
}

interface FeedOptions {
  /** Controller or presenter token. Omit for an audience phone. */
  token?: string
  /** The phone's anonymous device key, so the feed can say which questions it voted for. */
  deviceKey?: string
  intervalMs: number
  enabled?: boolean
}

interface FeedData {
  questions: QnaQuestionRow[]
  mine: string[]
  loaded: boolean
}

/**
 * Polls the Q&A feed (see /api/chorus/[code]/qna): an ETag on `feedVersion` makes an unchanged poll
 * nearly free, the next poll is jittered so a few hundred phones don't hit the server in lockstep,
 * and polling pauses while the tab is hidden. `update` applies an optimistic change (a tapped vote
 * shows instantly); `refresh` throws away the ETag and refetches, which is also how a failed
 * optimistic change is rolled back to what the server actually has.
 */
export function useChorusFeed(code: string, { token, deviceKey, intervalMs, enabled = true }: FeedOptions) {
  const [data, setData] = useState<FeedData>({ questions: [], mine: [], loaded: false })
  const [tick, setTick] = useState(0)
  const [forbidden, setForbidden] = useState(false)
  const latestVersionRef = useRef(-1)
  const refresh = useCallback(() => setTick((n) => n + 1), [])
  const update = useCallback((fn: (current: FeedData) => FeedData) => setData(fn), [])

  useEffect(() => {
    if (!enabled) return
    let cancelled = false
    let timer: ReturnType<typeof setTimeout> | undefined
    let etag: string | null = null
    const params = new URLSearchParams()
    if (token) params.set('token', token)
    if (deviceKey) params.set('device', deviceKey)
    const url = `/api/chorus/${code}/qna?${params.toString()}`

    const poll = async () => {
      if (!document.hidden) {
        try {
          const res = await fetch(url, { headers: etag ? { 'If-None-Match': etag } : {}, cache: 'no-store' })
          if (cancelled) return
          if (res.status === 403) setForbidden(true)
          if (res.ok) {
            etag = res.headers.get('ETag')
            const payload = (await res.json()) as QnaFeedPayload
            // An older response arriving late must not roll the list back.
            if (!cancelled && payload.feedVersion >= latestVersionRef.current) {
              latestVersionRef.current = payload.feedVersion
              setData({ questions: payload.questions, mine: payload.mine, loaded: true })
            }
          }
        } catch {
          // transient: the next tick retries
        }
      }
      if (!cancelled) timer = setTimeout(poll, intervalMs * (0.8 + Math.random() * 0.4))
    }

    const onVisible = () => {
      if (!document.hidden) {
        clearTimeout(timer)
        void poll()
      }
    }
    document.addEventListener('visibilitychange', onVisible)
    void poll()
    return () => {
      cancelled = true
      clearTimeout(timer)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [code, token, deviceKey, intervalMs, enabled, tick])

  return { ...data, forbidden, refresh, update }
}
