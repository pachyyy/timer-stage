'use client'

import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useCallback, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { Plus, Trash2 } from 'lucide-react'
import { setControllerToken, listControllerTokens } from '@/lib/auth/local-tokens'
import { JoinRoomForm } from '@/components/join-room-form'
import { parseMinutesInput } from '@/lib/timer/minutes'
import type { LiveRoomSummary } from '@/lib/db/my-rooms'

interface DraftTimer {
  name: string
  // Kept as free-form text while editing (not a number) — parsed only at submit time via
  // parseMinutesInput. Clamping on every keystroke would force the field back to a default the
  // moment it's emptied (e.g. backspacing "1" to type "30"), making the next digits append
  // instead of replace.
  minutes: string
}

interface LiveRoomEntry extends LiveRoomSummary {
  /** Only set for the anonymous (localStorage token) path — appended to the link so /control
   * doesn't need a session to resolve access. Owned rooms resolve access via the session instead. */
  token?: string
}

export default function Home() {
  const router = useRouter()
  const [eventName, setEventName] = useState('')
  const [draftTimers, setDraftTimers] = useState<DraftTimer[]>([{ name: 'Opening remarks', minutes: '5' }])
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // 402 = a quota/plan block (see src/lib/entitlements/gate.ts) — the one failure worth offering
  // the pricing page for. Checking the status code rather than sniffing the (now-translatable)
  // message text for the word "credit" — that heuristic broke the moment the message could come
  // back in Indonesian.
  const [quotaBlocked, setQuotaBlocked] = useState(false)
  const { data: session } = useSession()
  const [liveRooms, setLiveRooms] = useState<LiveRoomEntry[] | null>(null)
  const [liveLoading, setLiveLoading] = useState(false)
  const t = useTranslations('dashboard')
  const tCommon = useTranslations('common')
  const tNav = useTranslations('nav')

  const statusLabel = (status: LiveRoomSummary['status']) => {
    if (status === 'running') return t('statusRunning')
    if (status === 'paused') return t('statusPaused')
    return t('statusBetween')
  }

  const checkLiveRooms = useCallback(async () => {
    setLiveLoading(true)
    try {
      if (session?.user) {
        const res = await fetch('/api/me/live-rooms')
        setLiveRooms(res.ok ? await res.json() : [])
        return
      }

      // Signed out: there's no server-side account to ask, so check whichever rooms this
      // browser holds a controller token for — the same source /my-rooms uses for "import".
      const tokens = listControllerTokens()
      const results = await Promise.all(
        tokens.map(async ({ roomId, token }): Promise<LiveRoomEntry | null> => {
          try {
            const res = await fetch(`/api/rooms/${roomId}`)
            if (!res.ok) return null
            const payload = await res.json()
            if (!payload.currentRunId) return null
            return { roomId, name: payload.name, status: payload.status, token }
          } catch {
            return null
          }
        }),
      )
      setLiveRooms(results.filter((r): r is LiveRoomEntry => r !== null))
    } finally {
      setLiveLoading(false)
    }
  }, [session])

  const addTimer = () => setDraftTimers((prev) => [...prev, { name: '', minutes: '5' }])
  const removeTimer = (i: number) => setDraftTimers((prev) => prev.filter((_, idx) => idx !== i))
  const updateTimer = (i: number, patch: Partial<DraftTimer>) =>
    setDraftTimers((prev) => prev.map((t, idx) => (idx === i ? { ...t, ...patch } : t)))

  const createRoom = async () => {
    setCreating(true)
    setError(null)
    setQuotaBlocked(false)
    try {
      const res = await fetch('/api/rooms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: eventName || 'Untitled event',
          timers: draftTimers
            .filter((t) => t.name.trim())
            .map((t) => ({ name: t.name.trim(), durationMs: parseMinutesInput(t.minutes) * 60_000 })),
        }),
      })
      if (!res.ok) {
        // A plan-limit block (402) comes back with a real, show-it-directly message — see
        // canCreateRoom in src/lib/entitlements/gate.ts. Anything else falls back to generic.
        const body = await res.json().catch(() => null)
        if (res.status === 402) setQuotaBlocked(true)
        throw new Error(typeof body?.error === 'string' ? body.error : 'Failed to create room')
      }
      const { roomId, controllerToken } = await res.json()
      setControllerToken(roomId, controllerToken)
      router.push(`/r/${roomId}/control?t=${controllerToken}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong creating the room. Please try again.')
      setCreating(false)
    }
  }

  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col justify-center gap-6 px-4 py-12">
      <div>
        <h1 className="text-xl font-semibold">{tNav('dashboard')}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t('subtitle')}</p>
      </div>

      <Tabs
        defaultValue="create"
        onValueChange={(value) => {
          if (value === 'running' && liveRooms === null) checkLiveRooms()
        }}
      >
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="create">{t('tabCreate')}</TabsTrigger>
          <TabsTrigger value="join">{t('tabJoin')}</TabsTrigger>
          <TabsTrigger value="running">{t('tabRunning')}</TabsTrigger>
        </TabsList>

        <TabsContent value="create">
          <Card>
            <CardHeader>
              <CardTitle>{t('newRoomTitle')}</CardTitle>
              <CardDescription>{t('newRoomDesc')}</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-5">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="event-name">{t('eventNameLabel')}</Label>
                <Input
                  id="event-name"
                  placeholder={t('eventNamePlaceholder')}
                  value={eventName}
                  onChange={(e) => setEventName(e.target.value)}
                />
              </div>

              <Separator />

              <div className="flex flex-col gap-3">
                <Label>{t('agendaLabel')}</Label>
                {draftTimers.map((timer, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <Input
                      placeholder={tCommon('segmentNamePlaceholder')}
                      value={timer.name}
                      onChange={(e) => updateTimer(i, { name: e.target.value })}
                      className="flex-1"
                    />
                    <Input
                      type="number"
                      min={1}
                      value={timer.minutes}
                      onChange={(e) => updateTimer(i, { minutes: e.target.value })}
                      onFocus={(e) => e.currentTarget.select()}
                      className="w-20"
                    />
                    <span className="text-sm text-muted-foreground">{tCommon('minUnit')}</span>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => removeTimer(i)}
                      disabled={draftTimers.length <= 1}
                      aria-label={t('removeSegment')}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                ))}
                <Button variant="outline" size="sm" onClick={addTimer} className="self-start">
                  <Plus className="size-4" /> {t('addSegment')}
                </Button>
              </div>

              {error && (
                <p className="text-sm text-destructive">
                  {error}
                  {quotaBlocked && (
                    <>
                      {' '}
                      <Link href="/pricing" className="font-medium underline underline-offset-2">
                        {tCommon('buyMore')}
                      </Link>
                    </>
                  )}
                </p>
              )}

              <Button onClick={createRoom} disabled={creating} size="lg">
                {creating ? t('creating') : t('createRoom')}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="join">
          <Card>
            <CardHeader>
              <CardTitle>{t('joinTitle')}</CardTitle>
              <CardDescription>{t('joinDesc')}</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <JoinRoomForm />
              <p className="text-xs text-muted-foreground">{t('joinHint')}</p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="running">
          <Card>
            <CardHeader>
              <CardTitle>{t('runningTitle')}</CardTitle>
              <CardDescription>{t('runningDesc')}</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              {liveLoading && <p className="text-sm text-muted-foreground">{t('checking')}</p>}
              {!liveLoading && liveRooms?.length === 0 && (
                <p className="text-sm text-muted-foreground">{t('noRunning')}</p>
              )}
              {!liveLoading && liveRooms && liveRooms.length > 0 && (
                <ul className="flex flex-col gap-2">
                  {liveRooms.map((room) => (
                    <li key={room.roomId}>
                      <Card>
                        <CardContent className="flex items-center justify-between gap-3 py-3">
                          <div className="flex flex-col gap-1">
                            <span className="font-medium">{room.name}</span>
                            <Badge variant="secondary" className="w-fit">
                              {statusLabel(room.status)}
                            </Badge>
                          </div>
                          <Button asChild size="sm">
                            <a href={room.token ? `/r/${room.roomId}/control?t=${room.token}` : `/r/${room.roomId}/control`}>
                              {t('goToEvent')}
                            </a>
                          </Button>
                        </CardContent>
                      </Card>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </main>
  )
}
