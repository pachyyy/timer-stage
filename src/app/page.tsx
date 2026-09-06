'use client'

import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Plus, Trash2 } from 'lucide-react'
import { setControllerToken } from '@/lib/auth/local-tokens'
import { parseMinutesInput } from '@/lib/timer/minutes'

interface DraftTimer {
  name: string
  // Kept as free-form text while editing (not a number) — parsed only at submit time via
  // parseMinutesInput. Clamping on every keystroke would force the field back to a default the
  // moment it's emptied (e.g. backspacing "1" to type "30"), making the next digits append
  // instead of replace.
  minutes: string
}

export default function Home() {
  const router = useRouter()
  const [eventName, setEventName] = useState('')
  const [draftTimers, setDraftTimers] = useState<DraftTimer[]>([{ name: 'Opening remarks', minutes: '5' }])
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [joinCode, setJoinCode] = useState('')

  const addTimer = () => setDraftTimers((prev) => [...prev, { name: '', minutes: '5' }])
  const removeTimer = (i: number) => setDraftTimers((prev) => prev.filter((_, idx) => idx !== i))
  const updateTimer = (i: number, patch: Partial<DraftTimer>) =>
    setDraftTimers((prev) => prev.map((t, idx) => (idx === i ? { ...t, ...patch } : t)))

  const createRoom = async () => {
    setCreating(true)
    setError(null)
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
      if (!res.ok) throw new Error('Failed to create room')
      const { roomId, controllerToken } = await res.json()
      setControllerToken(roomId, controllerToken)
      router.push(`/r/${roomId}/control?t=${controllerToken}`)
    } catch {
      setError('Something went wrong creating the room. Please try again.')
      setCreating(false)
    }
  }

  const joinRoom = () => {
    const code = joinCode.trim()
    if (!code) return
    // No existence check here — the viewer page itself shows a clear "Room not found" state for
    // a bad code, so there's no need for a second round trip before navigating.
    router.push(`/r/${code}`)
  }

  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col justify-center gap-6 px-4 py-12">
      <div className="text-center">
        <div className="flex items-center justify-center gap-2">
          <Image src="/cue.svg" alt="" width={36} height={36} unoptimized className="rounded-md" />
          <h1 className="bg-[linear-gradient(135deg,var(--primary-gradient-from),var(--primary-gradient-to))] bg-clip-text text-3xl font-semibold tracking-tight text-transparent">
            Cue
          </h1>
        </div>
        <p className="mt-2 text-muted-foreground">
          Create a room and share the code, or join one someone shared with you.
        </p>
      </div>

      <Tabs defaultValue="create">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="create">Create a room</TabsTrigger>
          <TabsTrigger value="join">Join with code</TabsTrigger>
        </TabsList>

        <TabsContent value="create">
          <Card>
            <CardHeader>
              <CardTitle>New room</CardTitle>
              <CardDescription>Set up your agenda — you can edit it later from the controller.</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-5">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="event-name">Event name</Label>
                <Input
                  id="event-name"
                  placeholder="Q3 All Hands"
                  value={eventName}
                  onChange={(e) => setEventName(e.target.value)}
                />
              </div>

              <Separator />

              <div className="flex flex-col gap-3">
                <Label>Agenda</Label>
                {draftTimers.map((timer, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <Input
                      placeholder="Segment name"
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
                    <span className="text-sm text-muted-foreground">min</span>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => removeTimer(i)}
                      disabled={draftTimers.length <= 1}
                      aria-label="Remove segment"
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                ))}
                <Button variant="outline" size="sm" onClick={addTimer} className="self-start">
                  <Plus className="size-4" /> Add segment
                </Button>
              </div>

              {error && <p className="text-sm text-destructive">{error}</p>}

              <Button onClick={createRoom} disabled={creating} size="lg">
                {creating ? 'Creating…' : 'Create room'}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="join">
          <Card>
            <CardHeader>
              <CardTitle>Join a room</CardTitle>
              <CardDescription>Enter the room code the organizer shared with you.</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="join-code">Room code</Label>
                <Input
                  id="join-code"
                  placeholder="e.g. 8QZDV2"
                  value={joinCode}
                  onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                  onKeyDown={(e) => e.key === 'Enter' && joinRoom()}
                  className="font-mono text-lg tracking-widest uppercase"
                />
              </div>
              <Button onClick={joinRoom} disabled={!joinCode.trim()} size="lg">
                Join room
              </Button>
              <p className="text-xs text-muted-foreground">
                You will be asked for your name so the room&apos;s host knows who&apos;s watching.
              </p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </main>
  )
}
