'use client'

import { use, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import Image from 'next/image'
import { ArrowLeft } from 'lucide-react'
import { getControllerToken, setControllerToken } from '@/lib/auth/local-tokens'
import { MissingToken } from '@/components/missing-token'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { formatDuration } from '@/lib/timer/model'
import type { RunSummary } from '@/lib/history/types'

/**
 * Read-only: intentionally does NOT mount useRoom/useSyncedClock — this page has no live timer to
 * keep synced and must not hold a polling/Ably connection open just to show a list of past runs.
 */
export default function HistoryPage({ params }: { params: Promise<{ roomId: string }> }) {
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

  const [runs, setRuns] = useState<RunSummary[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!token) return
    fetch(`/api/rooms/${roomId}/runs?token=${encodeURIComponent(token)}`)
      .then((res) => (res.ok ? res.json() : Promise.reject(res.status)))
      .then(setRuns)
      .catch(() => setError('Could not load history for this room.'))
  }, [roomId, token])

  if (!token) return <MissingToken />

  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col gap-6 px-4 py-8">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Image src="/cue.svg" alt="" width={24} height={24} unoptimized className="rounded-md" />
          <h1 className="text-xl font-semibold">History</h1>
        </div>
        <Button asChild variant="outline" size="sm">
          <a href={`/r/${roomId}/control?t=${token}`}>
            <ArrowLeft className="size-3.5" /> Back to live
          </a>
        </Button>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      {!runs && !error ? (
        <p className="text-muted-foreground">Loading…</p>
      ) : runs && runs.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No runs yet — history is recorded once you Start a segment and later End the show.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {runs?.map((summary) => (
            <li key={summary.run.id}>
              <a
                href={`/r/${roomId}/history/${summary.run.id}?t=${token}`}
                className="block rounded-md border transition-colors hover:bg-accent/50"
              >
                <Card className="border-0 shadow-none">
                  <CardContent className="flex items-center justify-between gap-3 py-3">
                    <div className="flex flex-col gap-0.5">
                      <span className="font-medium">
                        Run {summary.run.seq}
                        {summary.run.endedAtMs === null && (
                          <span className="ml-2 text-xs font-normal text-amber-600 dark:text-amber-400">live</span>
                        )}
                        {summary.run.abandoned && (
                          <span className="ml-2 text-xs font-normal text-muted-foreground">abandoned</span>
                        )}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {new Date(summary.run.startedAtMs).toLocaleString(undefined, {
                          dateStyle: 'medium',
                          timeStyle: 'short',
                        })}
                        {' · '}
                        {summary.segmentCount} segment{summary.segmentCount === 1 ? '' : 's'}
                      </span>
                    </div>
                    <span className="tabular-nums text-sm text-muted-foreground">
                      {formatDuration(summary.durationMs)}
                    </span>
                  </CardContent>
                </Card>
              </a>
            </li>
          ))}
        </ul>
      )}
    </main>
  )
}
