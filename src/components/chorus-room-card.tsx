'use client'

import { useCallback, useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useTranslations } from 'next-intl'
import { ExternalLink, Link2, MonitorUp, Plus, Unlink } from 'lucide-react'
import { useChorusAnswers, useChorusControl, useChorusFeed } from '@/hooks/use-chorus'
import { chorusActions, openPresenterWindow } from '@/lib/api/chorus-actions'
import { formatChorusCode } from '@/lib/chorus/model'
import type { ChorusSessionSummary } from '@/lib/chorus/types'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { ChorusControls, ChorusStatusBadge } from '@/components/chorus-controls'
import { ChorusCreateForm } from '@/components/chorus-create-form'
import { ChorusAnswersPanel } from '@/components/chorus-answers-panel'
import { ChorusQnaControls } from '@/components/chorus-qna-controls'
import { ChorusQnaPanel } from '@/components/chorus-qna-panel'

/**
 * The room control page's Chorus card: the sessions linked to this room, and compact controls for
 * the selected one, so one operator screen runs both the timer and the Q&A. Everything here
 * authenticates with the ROOM's token — a linked session accepts its room's controllers (see
 * checkChorusAccess) — so the operator never has to hold a separate Chorus credential.
 */
export function ChorusRoomCard({ roomId, roomToken }: { roomId: string; roomToken: string }) {
  const t = useTranslations('chorusRoomCard')
  const [linked, setLinked] = useState<ChorusSessionSummary[] | null>(null)
  const [selected, setSelected] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [linking, setLinking] = useState(false)

  const [reloadKey, setReloadKey] = useState(0)
  const refresh = useCallback(() => setReloadKey((k) => k + 1), [])

  useEffect(() => {
    let cancelled = false
    fetch(`/api/rooms/${roomId}/chorus?token=${encodeURIComponent(roomToken)}`, { cache: 'no-store' })
      .then((res) => (res.ok ? res.json() : []))
      .then((rows: ChorusSessionSummary[]) => {
        if (cancelled) return
        setLinked(rows)
        // Keep the current pick if it's still linked; otherwise prefer whichever one is live.
        setSelected((prev) =>
          prev && rows.some((r) => r.code === prev) ? prev : ((rows.find((r) => r.status === 'live') ?? rows[0])?.code ?? null),
        )
      })
      .catch(() => {
        if (!cancelled) setLinked([])
      })
    return () => {
      cancelled = true
    }
  }, [roomId, roomToken, reloadKey])

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('title')}</CardTitle>
        <CardDescription>{t('desc')}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {linked && linked.length > 1 && (
          <div className="flex flex-wrap gap-2">
            {linked.map((s) => (
              <Button
                key={s.code}
                size="sm"
                variant={s.code === selected ? 'default' : 'outline'}
                onClick={() => setSelected(s.code)}
              >
                {s.name}
              </Button>
            ))}
          </div>
        )}

        {linked?.length === 0 && <p className="text-sm text-muted-foreground">{t('none')}</p>}

        {selected && (
          <LinkedSession
            key={selected}
            code={selected}
            roomToken={roomToken}
            onUnlinked={() => {
              setSelected(null)
              refresh()
            }}
          />
        )}

        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={() => setCreating(true)}>
            <Plus className="size-4" /> {t('newSession')}
          </Button>
          <Button variant="outline" size="sm" onClick={() => setLinking(true)}>
            <Link2 className="size-4" /> {t('linkExisting')}
          </Button>
        </div>

        <Dialog open={creating} onOpenChange={setCreating}>
          <DialogContent className="max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{t('newTitle')}</DialogTitle>
              <DialogDescription>{t('newDesc')}</DialogDescription>
            </DialogHeader>
            <ChorusCreateForm
              linkRoomId={roomId}
              roomToken={roomToken}
              onCreated={(created) => {
                setCreating(false)
                setSelected(created.code)
                refresh()
              }}
            />
          </DialogContent>
        </Dialog>

        <LinkExistingDialog
          open={linking}
          roomId={roomId}
          roomToken={roomToken}
          onClose={() => setLinking(false)}
          onLinked={(code) => {
            setLinking(false)
            setSelected(code)
            refresh()
          }}
        />
      </CardContent>
    </Card>
  )
}

function LinkedSession({ code, roomToken, onUnlinked }: { code: string; roomToken: string; onUnlinked: () => void }) {
  const t = useTranslations('chorusRoomCard')
  const tChorus = useTranslations('chorus')
  const tShare = useTranslations('chorusShare')
  const { state, presenterToken, applyControl } = useChorusControl(code, roomToken)
  const live = state?.status === 'live'
  const currentQuestionId = live ? (state?.currentQuestion?.id ?? null) : null
  const isQna = state?.mode === 'qna'
  const { answers, refresh } = useChorusAnswers(code, roomToken, currentQuestionId, live && !isQna)
  const qnaFeed = useChorusFeed(code, { token: roomToken, intervalMs: 2000, enabled: Boolean(state) && isQna })

  if (!state) return null

  return (
    <div className="flex flex-col gap-4 rounded-lg border p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="flex min-w-0 flex-col">
          <span className="truncate font-medium">{state.name}</span>
          <span className="font-mono text-xs text-muted-foreground">{formatChorusCode(code)}</span>
        </span>
        <span className="flex flex-wrap items-center gap-1">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => presenterToken && openPresenterWindow(code, presenterToken)}
            disabled={!presenterToken}
          >
            <MonitorUp className="size-3.5" /> {tShare('openPresenter')}
          </Button>
          <Button asChild variant="ghost" size="sm">
            <a href={`/c/${code}/control${roomToken ? `?t=${encodeURIComponent(roomToken)}` : ''}`}>
              <ExternalLink className="size-3.5" /> {t('openControls')}
            </a>
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() =>
              chorusActions
                .unlink(code, roomToken)
                .then(onUnlinked)
                .catch(() => {})
            }
          >
            <Unlink className="size-3.5" /> {t('unlink')}
          </Button>
        </span>
      </div>

      {isQna ? (
        <ChorusQnaControls state={state} token={roomToken} onPayload={applyControl} compact />
      ) : (
        <ChorusControls state={state} token={roomToken} onPayload={applyControl} compact />
      )}

      {isQna && state.status !== 'draft' && (
        <ChorusQnaPanel
          code={code}
          token={roomToken}
          status={state.status}
          questions={qnaFeed.questions}
          highlightId={state.highlight?.id ?? null}
          onPayload={applyControl}
          onChanged={qnaFeed.refresh}
          maxHeightClass="max-h-64"
        />
      )}

      {live && !isQna && (
        <div className="flex flex-col gap-2">
          <span className="text-sm text-muted-foreground">{tChorus('answersCount', { count: answers.length })}</span>
          <ChorusAnswersPanel code={code} token={roomToken} answers={answers} onChanged={refresh} maxHeightClass="max-h-64" />
        </div>
      )}
    </div>
  )
}

function LinkExistingDialog({
  open,
  roomId,
  roomToken,
  onClose,
  onLinked,
}: {
  open: boolean
  roomId: string
  roomToken: string
  onClose: () => void
  onLinked: (code: string) => void
}) {
  const t = useTranslations('chorusRoomCard')
  const tCommon = useTranslations('common')
  const { status } = useSession()
  const [sessions, setSessions] = useState<ChorusSessionSummary[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open || status !== 'authenticated') return
    let cancelled = false
    fetch('/api/me/chorus', { cache: 'no-store' })
      .then((res) => (res.ok ? res.json() : []))
      .then((rows: ChorusSessionSummary[]) => {
        if (!cancelled) setSessions(rows.filter((s) => s.linkedRoomId !== roomId && s.status !== 'ended'))
      })
      .catch(() => {
        if (!cancelled) setSessions([])
      })
    return () => {
      cancelled = true
    }
  }, [open, status, roomId])

  const link = (code: string) => {
    setError(null)
    // The Chorus side is authorized by ownership (the session's account), the room side by its token.
    chorusActions
      .link(code, '', roomId, roomToken)
      .then(() => onLinked(code))
      .catch((err) => setError(err instanceof Error ? err.message : ''))
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('linkTitle')}</DialogTitle>
          <DialogDescription>{t('linkDesc')}</DialogDescription>
        </DialogHeader>
        {status !== 'authenticated' ? (
          <p className="text-sm text-muted-foreground">{t('signInToLink')}</p>
        ) : sessions === null ? (
          <p className="text-sm text-muted-foreground">{tCommon('loading')}</p>
        ) : sessions.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t('noLinkable')}</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {sessions.map((s) => (
              <li key={s.code} className="flex items-center justify-between gap-3 rounded-md border px-3 py-2">
                <span className="flex min-w-0 flex-col gap-1">
                  <span className="truncate text-sm font-medium">{s.name}</span>
                  <span className="flex items-center gap-2">
                    <ChorusStatusBadge status={s.status} />
                    <span className="font-mono text-xs text-muted-foreground">{formatChorusCode(s.code)}</span>
                  </span>
                </span>
                <Button size="sm" onClick={() => link(s.code)}>
                  {t('link')}
                </Button>
              </li>
            ))}
          </ul>
        )}
        {error && <p className="text-sm text-destructive">{error}</p>}
      </DialogContent>
    </Dialog>
  )
}
