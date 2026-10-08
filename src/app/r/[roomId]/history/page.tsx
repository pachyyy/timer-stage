'use client'

import { use, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { useSession } from 'next-auth/react'
import Image from 'next/image'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { useTranslations } from 'next-intl'
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
  const { status: sessionStatus } = useSession()

  const token = useMemo(() => {
    const fromUrl = searchParams.get('t')
    if (fromUrl) {
      setControllerToken(roomId, fromUrl)
      return fromUrl
    }
    return getControllerToken(roomId) ?? ''
  }, [roomId, searchParams])

  const [runs, setRuns] = useState<RunSummary[] | null>(null)
  const [roomName, setRoomName] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [forbidden, setForbidden] = useState(false)
  // Same idea as /control's `resolvingAccess`: with no token, an owner still needs the session to
  // finish loading before this page can tell "no access" apart from "haven't checked yet".
  const resolvingAccess = !token && sessionStatus === 'loading'
  const t = useTranslations('historyRoom')
  const tCommon = useTranslations('common')
  const tNav = useTranslations('nav')

  useEffect(() => {
    if (resolvingAccess) return
    const qs = token ? `?token=${encodeURIComponent(token)}` : ''
    fetch(`/api/rooms/${roomId}/runs${qs}`)
      .then((res) => {
        if (res.status === 403) {
          setForbidden(true)
          return Promise.reject(res.status)
        }
        return res.ok ? res.json() : Promise.reject(res.status)
      })
      .then((data: { roomName: string | null; runs: RunSummary[] }) => {
        setRoomName(data.roomName)
        setRuns(data.runs)
      })
      .catch(() => setError((prev) => prev ?? t('loadError')))
  }, [roomId, token, resolvingAccess, t])

  if (resolvingAccess) {
    return (
      <main className="mx-auto flex min-h-screen max-w-3xl flex-col items-center justify-center px-4">
        <p className="text-muted-foreground">{tCommon('loading')}</p>
      </main>
    )
  }
  if (forbidden) return <MissingToken />

  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col gap-6 px-4 py-8">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Link href="/">
            <Image src="/clepsy.svg" alt="" width={24} height={24} unoptimized className="rounded-md" />
          </Link>
          <h1 className="text-xl font-semibold">{tNav('history')}</h1>
          {roomName && <span className="truncate text-sm text-muted-foreground">· {roomName}</span>}
        </div>
        <Button asChild variant="outline" size="sm">
          <a href={`/r/${roomId}/control${token ? `?t=${token}` : ''}`}>
            <ArrowLeft className="size-3.5" /> {t('backToLive')}
          </a>
        </Button>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      {!runs && !error ? (
        <p className="text-muted-foreground">{tCommon('loading')}</p>
      ) : runs && runs.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t('noRuns')}</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {runs?.map((summary) => (
            <li key={summary.run.id}>
              <a
                href={`/r/${roomId}/history/${summary.run.id}${token ? `?t=${token}` : ''}`}
                className="block rounded-md border transition-colors hover:bg-accent/50"
              >
                <Card className="border-0 shadow-none">
                  <CardContent className="flex items-center justify-between gap-3 py-3">
                    <div className="flex flex-col gap-0.5">
                      <span className="font-medium">
                        {t('eventLabel', { seq: summary.run.seq })}
                        {summary.run.endedAtMs === null && (
                          <span className="ml-2 text-xs font-normal text-amber-600 dark:text-amber-400">
                            {t('inProgress')}
                          </span>
                        )}
                        {summary.run.abandoned && (
                          <span className="ml-2 text-xs font-normal text-muted-foreground">
                            {tCommon('abandoned')}
                          </span>
                        )}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {new Date(summary.run.startedAtMs).toLocaleString(undefined, {
                          dateStyle: 'medium',
                          timeStyle: 'short',
                        })}
                        {' · '}
                        {t('segmentCount', { count: summary.segmentCount })}
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
