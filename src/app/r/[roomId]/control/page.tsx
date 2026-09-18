'use client'

import { use, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { useSession } from 'next-auth/react'
import Image from 'next/image'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { useRoom } from '@/hooks/use-room'
import { useAutoAdvance } from '@/hooks/use-auto-advance'
import { useAutoAdvancePing } from '@/hooks/use-auto-advance-ping'
import { useOwnRole } from '@/hooks/use-own-role'
import { useMessageAlert } from '@/hooks/use-message-alert'
import { getControllerToken, setControllerToken } from '@/lib/auth/local-tokens'
import { roomActions, ActionError } from '@/lib/api/room-actions'
import { ControllerPanel } from '@/components/controller-panel'
import { AgendaList } from '@/components/agenda-list'
import { SegmentDialog } from '@/components/segment-dialog'
import { ConfirmDialog } from '@/components/confirm-dialog'
import { ParticipantsPanel } from '@/components/participants-panel'
import { ConnectionBadge } from '@/components/connection-badge'
import { AuthButtons } from '@/components/auth-buttons'
import { LocaleSwitcher } from '@/components/locale-switcher'
import { MissingToken } from '@/components/missing-token'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Plus, History, Pencil, Check, X } from 'lucide-react'
import { parseMinutesInput } from '@/lib/timer/minutes'
import type { TimerRow } from '@/lib/sync/transport'

export default function ControlPage({ params }: { params: Promise<{ roomId: string }> }) {
  const { roomId } = use(params)
  const searchParams = useSearchParams()
  const t = useTranslations('control')
  const tCommon = useTranslations('common')
  const tNav = useTranslations('nav')
  const tController = useTranslations('controllerPanel')

  const MESSAGE_DURATIONS: { label: string; ms: number | null }[] = [
    { label: t('durationUntilCleared'), ms: null },
    { label: t('duration10s'), ms: 10_000 },
    { label: t('duration30s'), ms: 30_000 },
    { label: t('duration1min'), ms: 60_000 },
  ]

  const token = useMemo(() => {
    const fromUrl = searchParams.get('t')
    if (fromUrl) {
      setControllerToken(roomId, fromUrl)
      return fromUrl
    }
    return getControllerToken(roomId) ?? ''
  }, [roomId, searchParams])

  const { data: session, status: sessionStatus } = useSession()
  const { state, status, activeTimer, syncedNow, applyPayload } = useRoom(roomId, token)
  // Only meaningful if `token` is a promoted participant's sessionToken — stays null forever for
  // the room's own (permanent, non-revocable) controllerToken. Lets a demoted co-controller's
  // page react immediately instead of leaving live controls on screen.
  const ownRole = useOwnRole(roomId, token)
  const wasDemoted = ownRole === 'viewer'
  // A signed-in account that owns this room controls it from ANY device, no token needed at all
  // (the server already enforces this — see resolveRoomAccess) — this just decides what the UI
  // shows before a token exists. Can't be known until BOTH the session and the room's own
  // ownerUserId have loaded, so `resolvingAccess` holds the "missing token" screen back rather
  // than flashing it at a legitimate owner while state is still loading.
  const isOwner = Boolean(session?.user?.id) && state?.ownerUserId === session?.user?.id
  const resolvingAccess = !token && (sessionStatus === 'loading' || (sessionStatus === 'authenticated' && !state))
  const [claimState, setClaimState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  // Same hook the viewer screen uses, so "Showing now" can't claim a timed message is still up
  // after it has already dropped off everyone's screen, and so the operator sees the exact same
  // banner + flash treatment their audience does, without needing a second window open.
  const { message: liveMessage, flashing: messageFlashing } = useMessageAlert(state, syncedNow)
  const [newTimerName, setNewTimerName] = useState('')
  // Free-form text while editing, parsed via parseMinutesInput only when "Add" is clicked — see
  // the comment on DraftTimer.minutes in src/app/page.tsx for why this can't be a clamped number.
  const [newTimerMinutes, setNewTimerMinutes] = useState('5')
  // Surfaces a plan-limit block (e.g. "Your Free plan allows up to 5 segments per room") — the
  // one addTimer failure mode that's actually expected in normal use, unlike the other controller
  // actions here which don't have a comparable everyday failure to show.
  const [addTimerError, setAddTimerError] = useState<string | null>(null)
  // Same idea for Start specifically: under the quota model a room can be locked after its one
  // event (see canStartRun in src/lib/entitlements/gate.ts) — the other actions here (pause,
  // reset, adjust, blackout) have no comparable everyday failure, so they're left as plain
  // fire-and-forget.
  const [startError, setStartError] = useState<string | null>(null)
  // 402 = a quota/plan block (see src/lib/entitlements/gate.ts) — checked via ActionError's status
  // rather than sniffing the (translatable) message text for the word "credit".
  const [startQuotaBlocked, setStartQuotaBlocked] = useState(false)
  const [viewerToken, setViewerToken] = useState<string | null>(null)
  const [copied, setCopied] = useState<'code' | 'link' | null>(null)
  const [messageDraft, setMessageDraft] = useState('')
  // null = stays up until explicitly cleared.
  const [messageDurationMs, setMessageDurationMs] = useState<number | null>(null)
  // Guards two accidental-click risks in the agenda list: switching away from a timer that still
  // has progress on it, and deleting a segment outright. Both are one mis-click away from each
  // other in that list, so both go through a confirm dialog instead of firing immediately.
  const [pendingSwitch, setPendingSwitch] = useState<{ timerId: string; name: string } | null>(null)
  const [pendingDelete, setPendingDelete] = useState<{ timerId: string; name: string } | null>(null)
  const [editingTimer, setEditingTimer] = useState<TimerRow | null>(null)
  // Optimistic drag order: overrides the display order between a drop and the reorder request
  // settling, so a poll tick landing mid-drag can't visually snap the list back. Kept independent
  // of `state.timers`'s own reference identity — see the comment on reorderTimers below.
  const [pendingOrder, setPendingOrder] = useState<string[] | null>(null)
  const [pendingEndShow, setPendingEndShow] = useState(false)
  const [editingName, setEditingName] = useState(false)
  const [nameDraft, setNameDraft] = useState('')
  const [renameError, setRenameError] = useState<string | null>(null)
  const [renaming, setRenaming] = useState(false)

  const copy = (which: 'code' | 'link', text: string) => {
    navigator.clipboard.writeText(text)
    setCopied(which)
    setTimeout(() => setCopied((c) => (c === which ? null : c)), 5000)
  }

  const handleSelect = (timerId: string) => {
    if (!state || timerId === state.activeTimerId) return
    // Switching resets run state unconditionally (see mutateRunState's 'select' case), so anything
    // other than a fresh/never-started active timer would silently lose progress on a bare click.
    const hasProgress = state.status === 'running' || (state.status === 'paused' && state.elapsedBeforeMs > 0)
    if (hasProgress) {
      const name = state.timers.find((timer) => timer.id === timerId)?.name ?? t('thisSegment')
      setPendingSwitch({ timerId, name })
    } else {
      roomActions.select(roomId, token, timerId).then(applyPayload)
    }
  }

  const handleDelete = (timerId: string) => {
    if (!state) return
    const name = state.timers.find((timer) => timer.id === timerId)?.name ?? t('thisSegment')
    setPendingDelete({ timerId, name })
  }

  const handleEdit = (timerId: string) => {
    const timer = state?.timers.find((timer) => timer.id === timerId)
    if (timer) setEditingTimer(timer)
  }

  // Reflects `pendingOrder` immediately after a drop, independent of whatever `state.timers`
  // reference the transport hands back in the meantime — see the pendingOrder comment above.
  const displayedTimers = useMemo(() => {
    if (!state || !pendingOrder) return state?.timers ?? []
    const byId = new Map(state.timers.map((timer) => [timer.id, timer]))
    return pendingOrder.map((id) => byId.get(id)).filter((timer): timer is TimerRow => Boolean(timer))
  }, [state, pendingOrder])

  const handleReorder = (order: string[]) => {
    setPendingOrder(order)
    roomActions
      .reorderTimers(roomId, token, order)
      .then((payload) => {
        applyPayload(payload)
        setPendingOrder(null)
      })
      .catch(() => setPendingOrder(null))
  }

  const handleClaim = async () => {
    setClaimState('saving')
    try {
      const res = await fetch(`/api/rooms/${roomId}/claim`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      })
      setClaimState(res.ok ? 'saved' : 'error')
    } catch {
      setClaimState('error')
    }
  }

  const handleRename = async () => {
    const trimmed = nameDraft.trim()
    if (!trimmed) return
    setRenaming(true)
    setRenameError(null)
    try {
      const payload = await roomActions.renameRoom(roomId, token, trimmed)
      applyPayload(payload)
      setEditingName(false)
    } catch (err) {
      setRenameError(err instanceof Error ? err.message : t('failedRename'))
    } finally {
      setRenaming(false)
    }
  }

  useEffect(() => {
    if (!token) return
    fetch(`/api/rooms/${roomId}/share-links?token=${encodeURIComponent(token)}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => setViewerToken(data?.viewerToken ?? null))
      .catch(() => setViewerToken(null))
  }, [roomId, token])

  // Space bar toggles start/pause, unless the user is typing in a field.
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.code !== 'Space') return
      const tag = (e.target as HTMLElement | null)?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA') return
      e.preventDefault()
      if (!state) return
      const action = state.status === 'running' ? roomActions.pause : roomActions.start
      action(roomId, token).then(applyPayload)
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [roomId, token, state, applyPayload])

  // Optional per-segment "auto-advance" — see the link toggle in AgendaList. This is the fast
  // path: near-instant, but only while this tab is open and foregrounded (requestAnimationFrame
  // throttles/pauses otherwise). useAutoAdvancePing below is the backstop that keeps working even
  // when this tab is backgrounded or closed, as long as some other room screen (e.g. a viewer) is
  // open — see both hooks' doc comments. Safe to run both at once; each advance is idempotent.
  useAutoAdvance({
    runState: { status: state?.status ?? 'stopped', startedAtMs: state?.startedAtMs ?? null, elapsedBeforeMs: state?.elapsedBeforeMs ?? 0 },
    durationMs: activeTimer?.durationMs ?? 0,
    syncedNow,
    isRunning: state?.status === 'running',
    activeTimerId: state?.activeTimerId ?? null,
    linkToNext: Boolean(activeTimer?.linkToNext),
    onZeroCrossing: () => {
      if (!state) return
      const idx = state.timers.findIndex((timer) => timer.id === state.activeTimerId)
      const next = idx >= 0 ? state.timers[idx + 1] : undefined
      if (!next) return
      roomActions
        .advanceTo(roomId, token, next.id)
        .then(applyPayload)
        .catch((err) => console.error('auto-advance failed (non-fatal)', err))
    },
  })
  useAutoAdvancePing({ roomId, isRunning: state?.status === 'running', applyPayload })

  if (resolvingAccess) {
    return (
      <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center px-4 text-center">
        <p className="text-muted-foreground">{tCommon('loading')}</p>
      </main>
    )
  }

  if (!token && !isOwner) return <MissingToken />

  if (wasDemoted) {
    return (
      <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center gap-3 px-4 text-center">
        <h1 className="text-xl font-semibold">{t('demotedTitle')}</h1>
        <p className="text-sm text-muted-foreground">{t('demotedDesc')}</p>
        <Button asChild variant="outline">
          <a href={`/r/${roomId}`}>{t('goToViewer')}</a>
        </Button>
      </main>
    )
  }

  const viewerUrl =
    typeof window !== 'undefined' && viewerToken
      ? `${window.location.origin}/r/${roomId}?t=${viewerToken}`
      : ''

  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col gap-6 px-4 py-8">
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <Link href="/" className="shrink-0">
            <Image src="/cue.svg" alt="" width={24} height={24} unoptimized className="rounded-md" />
          </Link>
          <h1 className="shrink-0 text-xl font-semibold">{t('title')}</h1>
          {state && !editingName && (
            <span className="flex min-w-0 items-center gap-1">
              <span className="truncate text-sm text-muted-foreground">— {state.name}</span>
              <button
                type="button"
                onClick={() => {
                  setNameDraft(state.name)
                  setRenameError(null)
                  setEditingName(true)
                }}
                aria-label={t('renameRoom')}
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
                  if (e.key === 'Enter') handleRename()
                  if (e.key === 'Escape') setEditingName(false)
                }}
                maxLength={200}
                className="h-7 w-40 text-sm"
              />
              <Button variant="ghost" size="icon" className="size-7" onClick={handleRename} disabled={renaming} aria-label={t('saveName')}>
                <Check className="size-3.5" />
              </Button>
              <Button variant="ghost" size="icon" className="size-7" onClick={() => setEditingName(false)} aria-label={t('cancelRename')}>
                <X className="size-3.5" />
              </Button>
            </span>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Button asChild variant="outline" size="sm">
            <a href={`/r/${roomId}/history`}>
              <History className="size-3.5" /> {tNav('history')}
            </a>
          </Button>
          <ConnectionBadge status={status} />
          <LocaleSwitcher />
          <AuthButtons />
        </div>
      </div>
      {renameError && <p className="text-sm text-destructive">{renameError}</p>}

      {!state ? (
        <p className="text-muted-foreground">{t('loadingRoom')}</p>
      ) : (
        <>
          {session?.user?.id && state.ownerUserId === null && claimState !== 'saved' && (
            <div className="flex items-center justify-between gap-3 rounded-lg border bg-accent/40 px-4 py-2.5 text-sm">
              <span>{claimState === 'error' ? t('claimError') : t('claimPrompt')}</span>
              <Button size="sm" variant="outline" onClick={handleClaim} disabled={claimState === 'saving'}>
                {claimState === 'saving' ? tCommon('saving') : tCommon('save')}
              </Button>
            </div>
          )}

          {liveMessage && (
            <div
              className={`rounded-lg px-4 py-3 text-center text-lg font-semibold text-black transition-colors duration-200 ${
                messageFlashing ? 'bg-white ring-4 ring-amber-400' : 'bg-amber-400'
              }`}
            >
              {liveMessage}
            </div>
          )}

          {startError && (
            <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {startError}
              {startQuotaBlocked && (
                <>
                  {' '}
                  <Link href="/pricing" className="font-medium underline underline-offset-2">
                    {tCommon('buyMore')}
                  </Link>
                </>
              )}
            </p>
          )}

          <ControllerPanel
            timerName={activeTimer?.name ?? null}
            runState={{
              status: state.status,
              startedAtMs: state.startedAtMs,
              elapsedBeforeMs: state.elapsedBeforeMs,
            }}
            durationMs={activeTimer?.durationMs ?? 0}
            wrapUpMs={activeTimer?.wrapUpMs ?? 60_000}
            syncedNow={syncedNow}
            isRunning={state.status === 'running'}
            blackout={state.blackout}
            hasOpenRun={state.currentRunId !== null}
            onStart={() => {
              setStartError(null)
              setStartQuotaBlocked(false)
              roomActions
                .start(roomId, token)
                .then(applyPayload)
                .catch((err) => {
                  if (err instanceof ActionError) setStartQuotaBlocked(err.status === 402)
                  setStartError(err instanceof Error ? err.message : t('failedStart'))
                })
            }}
            onPause={() => roomActions.pause(roomId, token).then(applyPayload)}
            onReset={() => roomActions.reset(roomId, token).then(applyPayload)}
            onAdjust={(delta) => roomActions.adjust(roomId, token, delta).then(applyPayload)}
            onBlackoutChange={(v) => roomActions.blackout(roomId, token, v).then(applyPayload)}
            onEndShow={() => setPendingEndShow(true)}
          />

          <Card>
            <CardHeader>
              <CardTitle>{t('agendaTitle')}</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <AgendaList
                timers={displayedTimers}
                activeTimerId={state.activeTimerId}
                onSelect={handleSelect}
                onEdit={handleEdit}
                onDelete={handleDelete}
                onReorder={handleReorder}
                onToggleLink={(timerId, linkToNext) =>
                  roomActions.updateTimer(roomId, token, timerId, { linkToNext }).then(applyPayload)
                }
              />

              <div className="flex items-center gap-2 pt-2">
                <Input
                  placeholder={tCommon('segmentNamePlaceholder')}
                  value={newTimerName}
                  onChange={(e) => setNewTimerName(e.target.value)}
                  className="flex-1"
                />
                <Input
                  type="number"
                  min={1}
                  value={newTimerMinutes}
                  onChange={(e) => setNewTimerMinutes(e.target.value)}
                  onFocus={(e) => e.currentTarget.select()}
                  className="w-20"
                />
                <span className="text-sm text-muted-foreground">{tCommon('minUnit')}</span>
                <Button
                  variant="outline"
                  onClick={async () => {
                    if (!newTimerName.trim()) return
                    setAddTimerError(null)
                    try {
                      const payload = await roomActions.addTimer(roomId, token, {
                        name: newTimerName.trim(),
                        durationMs: parseMinutesInput(newTimerMinutes) * 60_000,
                      })
                      applyPayload(payload)
                      setNewTimerName('')
                    } catch (err) {
                      setAddTimerError(err instanceof Error ? err.message : t('failedAddSegment'))
                    }
                  }}
                >
                  <Plus className="size-4" /> {t('addButton')}
                </Button>
              </div>
              {addTimerError && <p className="text-sm text-destructive">{addTimerError}</p>}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{t('messageTitle')}</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <div className="flex items-center gap-2">
                <Input
                  placeholder={t('messagePlaceholder')}
                  maxLength={200}
                  value={messageDraft}
                  onChange={(e) => setMessageDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key !== 'Enter' || !messageDraft.trim()) return
                    roomActions
                      .sendMessage(roomId, token, messageDraft.trim(), messageDurationMs)
                      .then(applyPayload)
                    setMessageDraft('')
                  }}
                  className="flex-1"
                />
                <Button
                  onClick={() => {
                    if (!messageDraft.trim()) return
                    roomActions
                      .sendMessage(roomId, token, messageDraft.trim(), messageDurationMs)
                      .then(applyPayload)
                    setMessageDraft('')
                  }}
                >
                  {t('send')}
                </Button>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm text-muted-foreground">{t('showFor')}</span>
                {MESSAGE_DURATIONS.map((d) => (
                  <Button
                    key={d.label}
                    size="sm"
                    variant={messageDurationMs === d.ms ? 'default' : 'outline'}
                    onClick={() => setMessageDurationMs(d.ms)}
                  >
                    {d.label}
                  </Button>
                ))}
              </div>

              {liveMessage ? (
                <div className="flex items-center gap-2 rounded-md border bg-amber-50 px-3 py-2 dark:bg-amber-950">
                  <span className="flex-1 text-sm">
                    {t.rich('showingNow', {
                      message: liveMessage,
                      b: (chunks) => <span className="font-medium">{chunks}</span>,
                    })}
                  </span>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => roomActions.clearMessage(roomId, token).then(applyPayload)}
                  >
                    {tCommon('clear')}
                  </Button>
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">{t('messageHint')}</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{t('shareTitle')}</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <div>
                <p className="mb-1.5 text-sm text-muted-foreground">{t('roomCodeHint')}</p>
                <div className="flex items-center gap-2">
                  <Input
                    readOnly
                    value={roomId}
                    onFocus={(e) => e.currentTarget.select()}
                    className="font-mono text-lg tracking-widest"
                  />
                  <Button variant="outline" onClick={() => copy('code', roomId)}>
                    {copied === 'code' ? tCommon('copied') : tCommon('copy')}
                  </Button>
                </div>
              </div>
              <div>
                <p className="mb-1.5 text-sm text-muted-foreground">{t('viewerLinkLabel')}</p>
                <div className="flex items-center gap-2">
                  <Input readOnly value={viewerUrl} onFocus={(e) => e.currentTarget.select()} />
                  <Button variant="outline" onClick={() => copy('link', viewerUrl)}>
                    {copied === 'link' ? tCommon('copied') : tCommon('copy')}
                  </Button>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">{t('shareHint')}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{t('participantsTitle')}</CardTitle>
            </CardHeader>
            <CardContent>
              <ParticipantsPanel roomId={roomId} token={token} />
            </CardContent>
          </Card>

          <SegmentDialog
            key={editingTimer?.id ?? 'none'}
            open={editingTimer !== null}
            timer={editingTimer}
            onSave={(patch) => {
              if (editingTimer) {
                roomActions.updateTimer(roomId, token, editingTimer.id, patch).then(applyPayload)
              }
              setEditingTimer(null)
            }}
            onCancel={() => setEditingTimer(null)}
          />

          <ConfirmDialog
            open={pendingEndShow}
            title={t('endShowTitle')}
            description={t('endShowDesc')}
            confirmLabel={tController('endShow')}
            onConfirm={() => {
              roomActions.endShow(roomId, token).then(applyPayload)
              setPendingEndShow(false)
            }}
            onCancel={() => setPendingEndShow(false)}
          />

          <ConfirmDialog
            open={pendingSwitch !== null}
            title={t('switchTitle')}
            description={
              pendingSwitch
                ? t(state.status === 'running' ? 'switchDescRunning' : 'switchDescPaused', {
                    current: activeTimer?.name ?? t('theCurrentTimer'),
                    next: pendingSwitch.name,
                  })
                : ''
            }
            confirmLabel={t('switchConfirm')}
            onConfirm={() => {
              if (pendingSwitch) roomActions.select(roomId, token, pendingSwitch.timerId).then(applyPayload)
              setPendingSwitch(null)
            }}
            onCancel={() => setPendingSwitch(null)}
          />

          <ConfirmDialog
            open={pendingDelete !== null}
            title={t('deleteTitle')}
            description={
              pendingDelete
                ? t(pendingDelete.timerId === state.activeTimerId ? 'deleteDescActive' : 'deleteDesc', {
                    name: pendingDelete.name,
                  })
                : ''
            }
            confirmLabel={tCommon('delete')}
            onConfirm={() => {
              if (pendingDelete) roomActions.deleteTimer(roomId, token, pendingDelete.timerId).then(applyPayload)
              setPendingDelete(null)
            }}
            onCancel={() => setPendingDelete(null)}
          />
        </>
      )}
    </main>
  )
}
