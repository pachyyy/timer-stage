'use client'

import { use, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { useRoom } from '@/hooks/use-room'
import { getControllerToken, setControllerToken } from '@/lib/auth/local-tokens'
import { roomActions } from '@/lib/api/room-actions'
import { ControllerPanel } from '@/components/controller-panel'
import { AgendaList } from '@/components/agenda-list'
import { ConnectionBadge } from '@/components/connection-badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Plus } from 'lucide-react'
import { parseMinutesInput } from '@/lib/timer/minutes'

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

  const { state, status, activeTimer, syncedNow } = useRoom(roomId, token)
  const [newTimerName, setNewTimerName] = useState('')
  // Free-form text while editing, parsed via parseMinutesInput only when "Add" is clicked — see
  // the comment on DraftTimer.minutes in src/app/page.tsx for why this can't be a clamped number.
  const [newTimerMinutes, setNewTimerMinutes] = useState('5')
  const [viewerToken, setViewerToken] = useState<string | null>(null)

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
      if (state.status === 'running') void roomActions.pause(roomId, token)
      else void roomActions.start(roomId, token)
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [roomId, token, state])

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
            onStart={() => roomActions.start(roomId, token)}
            onPause={() => roomActions.pause(roomId, token)}
            onReset={() => roomActions.reset(roomId, token)}
            onAdjust={(delta) => roomActions.adjust(roomId, token, delta)}
            onBlackoutChange={(v) => roomActions.blackout(roomId, token, v)}
          />

          <Card>
            <CardHeader>
              <CardTitle>Agenda</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <AgendaList
                timers={state.timers}
                activeTimerId={state.activeTimerId}
                onSelect={(timerId) => roomActions.select(roomId, token, timerId)}
                onDelete={(timerId) => roomActions.deleteTimer(roomId, token, timerId)}
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
                    await roomActions.addTimer(roomId, token, {
                      name: newTimerName.trim(),
                      durationMs: parseMinutesInput(newTimerMinutes) * 60_000,
                    })
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
              <CardTitle>Viewer link</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <Input readOnly value={viewerUrl} onFocus={(e) => e.currentTarget.select()} />
                <Button
                  variant="outline"
                  onClick={() => navigator.clipboard.writeText(viewerUrl)}
                >
                  Copy
                </Button>
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                Share this with the stage/confidence monitor. It has no controls — read only.
              </p>
            </CardContent>
          </Card>
        </>
      )}
    </main>
  )
}
