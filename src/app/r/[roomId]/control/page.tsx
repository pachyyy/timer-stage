'use client'

import { use, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { useRoom } from '@/hooks/use-room'
import { useOwnRole } from '@/hooks/use-own-role'
import { useMessageAlert } from '@/hooks/use-message-alert'
import { getControllerToken, setControllerToken } from '@/lib/auth/local-tokens'
import { roomActions } from '@/lib/api/room-actions'
import { ControllerPanel } from '@/components/controller-panel'
import { AgendaList } from '@/components/agenda-list'
import { ParticipantsPanel } from '@/components/participants-panel'
import { ConnectionBadge } from '@/components/connection-badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Plus } from 'lucide-react'
import { parseMinutesInput } from '@/lib/timer/minutes'

const MESSAGE_DURATIONS: { label: string; ms: number | null }[] = [
  { label: 'Until cleared', ms: null },
  { label: '10s', ms: 10_000 },
  { label: '30s', ms: 30_000 },
  { label: '1 min', ms: 60_000 },
]

export default function ControlPage({ params }: { params: Promise<{ roomId: string }> }) {
  const { roomId } = use(params)
  const searchParams = useSearchParams()

  const token = useMemo(() => {
    const fromUrl = searchParams.get('t')
    if (fromUrl) {
      setControllerToken(roomId, fromUrl)
      return fromUrl
    }
    return getControllerToken(roomId) ?? ''
  }, [roomId, searchParams])

  const { state, status, activeTimer, syncedNow, applyPayload } = useRoom(roomId, token)
  // Only meaningful if `token` is a promoted participant's sessionToken — stays null forever for
  // the room's own (permanent, non-revocable) controllerToken. Lets a demoted co-controller's
  // page react immediately instead of leaving live controls on screen.
  const ownRole = useOwnRole(roomId, token)
  const wasDemoted = ownRole === 'viewer'
  // Same expiry derivation the viewers use, so "Showing now" can't claim a timed message is still
  // up after it has already dropped off everyone's screen.
  const { message: liveMessage } = useMessageAlert(state, syncedNow)
  const [newTimerName, setNewTimerName] = useState('')
  // Free-form text while editing, parsed via parseMinutesInput only when "Add" is clicked — see
  // the comment on DraftTimer.minutes in src/app/page.tsx for why this can't be a clamped number.
  const [newTimerMinutes, setNewTimerMinutes] = useState('5')
  const [viewerToken, setViewerToken] = useState<string | null>(null)
  const [copied, setCopied] = useState<'code' | 'link' | null>(null)
  const [messageDraft, setMessageDraft] = useState('')
  // null = stays up until explicitly cleared.
  const [messageDurationMs, setMessageDurationMs] = useState<number | null>(null)

  const copy = (which: 'code' | 'link', text: string) => {
    navigator.clipboard.writeText(text)
    setCopied(which)
    setTimeout(() => setCopied((c) => (c === which ? null : c)), 5000)
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

  if (!token) {
    return (
      <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center gap-3 px-4 text-center">
        <h1 className="text-xl font-semibold">Missing controller token</h1>
        <p className="text-sm text-muted-foreground">
          Open this room using the controller link you received when you created it.
        </p>
      </main>
    )
  }

  if (wasDemoted) {
    return (
      <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center gap-3 px-4 text-center">
        <h1 className="text-xl font-semibold">Your controller access was removed</h1>
        <p className="text-sm text-muted-foreground">The room&apos;s admin took back control access.</p>
        <Button asChild variant="outline">
          <a href={`/r/${roomId}`}>Go to viewer screen</a>
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
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Controller</h1>
        <ConnectionBadge status={status} />
      </div>

      {!state ? (
        <p className="text-muted-foreground">Loading room…</p>
      ) : (
        <>
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
            onStart={() => roomActions.start(roomId, token).then(applyPayload)}
            onPause={() => roomActions.pause(roomId, token).then(applyPayload)}
            onReset={() => roomActions.reset(roomId, token).then(applyPayload)}
            onAdjust={(delta) => roomActions.adjust(roomId, token, delta).then(applyPayload)}
            onBlackoutChange={(v) => roomActions.blackout(roomId, token, v).then(applyPayload)}
          />

          <Card>
            <CardHeader>
              <CardTitle>Agenda</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <AgendaList
                timers={state.timers}
                activeTimerId={state.activeTimerId}
                onSelect={(timerId) => roomActions.select(roomId, token, timerId).then(applyPayload)}
                onDelete={(timerId) => roomActions.deleteTimer(roomId, token, timerId).then(applyPayload)}
              />

              <div className="flex items-center gap-2 pt-2">
                <Input
                  placeholder="Segment name"
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
                <span className="text-sm text-muted-foreground">min</span>
                <Button
                  variant="outline"
                  onClick={async () => {
                    if (!newTimerName.trim()) return
                    const payload = await roomActions.addTimer(roomId, token, {
                      name: newTimerName.trim(),
                      durationMs: parseMinutesInput(newTimerMinutes) * 60_000,
                    })
                    applyPayload(payload)
                    setNewTimerName('')
                  }}
                >
                  <Plus className="size-4" /> Add
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Message to viewers</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <div className="flex items-center gap-2">
                <Input
                  placeholder="Wrap up in 2 minutes…"
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
                  Send
                </Button>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm text-muted-foreground">Show for</span>
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
                    Showing now: <span className="font-medium">{liveMessage}</span>
                  </span>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => roomActions.clearMessage(roomId, token).then(applyPayload)}
                  >
                    Clear
                  </Button>
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">
                  Nothing showing. Viewers get a banner at the top of their screen, and their phone
                  buzzes if it supports vibration (Android only — iPhones can&apos;t).
                </p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Share this room</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <div>
                <p className="mb-1.5 text-sm text-muted-foreground">
                  Room code — read aloud or typed into &quot;Join with code&quot; on the homepage
                </p>
                <div className="flex items-center gap-2">
                  <Input
                    readOnly
                    value={roomId}
                    onFocus={(e) => e.currentTarget.select()}
                    className="font-mono text-lg tracking-widest"
                  />
                  <Button variant="outline" onClick={() => copy('code', roomId)}>
                    {copied === 'code' ? 'Copied' : 'Copy'}
                  </Button>
                </div>
              </div>
              <div>
                <p className="mb-1.5 text-sm text-muted-foreground">Direct viewer link</p>
                <div className="flex items-center gap-2">
                  <Input readOnly value={viewerUrl} onFocus={(e) => e.currentTarget.select()} />
                  <Button variant="outline" onClick={() => copy('link', viewerUrl)}>
                    {copied === 'link' ? 'Copied' : 'Copy'}
                  </Button>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                Either way, whoever opens it enters their name and shows up below — you can grant
                them controller access if you want.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Participants</CardTitle>
            </CardHeader>
            <CardContent>
              <ParticipantsPanel roomId={roomId} token={token} />
            </CardContent>
          </Card>
        </>
      )}
    </main>
  )
}
