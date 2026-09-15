'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useTranslations } from 'next-intl'
import { Card, CardContent } from '@/components/ui/card'
import { formatDuration } from '@/lib/timer/model'
import type { OwnedRunSummary } from '@/lib/db/history'

/**
 * Cross-room run history for a signed-in account — every run across every room, newest first.
 * Distinct from /my-rooms (room management) on purpose: this page answers "what did I run and
 * when", not "what rooms do I have"; see auth-buttons.tsx's gear menu, which links to both.
 */
export default function HistoryPage() {
  const { status } = useSession()
  const [runs, setRuns] = useState<OwnedRunSummary[] | null>(null)
  const t = useTranslations('history')
  const tCommon = useTranslations('common')
  const tNav = useTranslations('nav')
  const tHistoryRoom = useTranslations('historyRoom')

  useEffect(() => {
    if (status !== 'authenticated') return
    fetch('/api/me/runs')
      .then((res) => (res.ok ? res.json() : []))
      .then(setRuns)
      .catch(() => setRuns([]))
  }, [status])

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col gap-6 px-4 py-8">
      <h1 className="text-xl font-semibold">{tNav('history')}</h1>

      {status === 'loading' && <p className="text-muted-foreground">{tCommon('loading')}</p>}

      {status === 'unauthenticated' && <p className="text-sm text-muted-foreground">{t('signInHint')}</p>}

      {status === 'authenticated' && (
        <>
          {!runs ? (
            <p className="text-muted-foreground">{tCommon('loading')}</p>
          ) : runs.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t('noRuns')}</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {runs.map((run) => (
                <li key={run.runId}>
                  <a
                    href={`/r/${run.roomId}/history/${run.runId}`}
                    className="block rounded-md border transition-colors hover:bg-accent/50"
                  >
                    <Card className="border-0 shadow-none">
                      <CardContent className="flex items-center justify-between gap-3 py-3">
                        <div className="flex flex-col gap-0.5">
                          <span className="font-medium">
                            {t('runLabel', { roomName: run.roomName, seq: run.seq })}
                            {run.abandoned && (
                              <span className="ml-2 text-xs font-normal text-muted-foreground">
                                {tCommon('abandoned')}
                              </span>
                            )}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {new Date(run.startedAtMs).toLocaleString(undefined, {
                              dateStyle: 'medium',
                              timeStyle: 'short',
                            })}
                            {' · '}
                            {tHistoryRoom('segmentCount', { count: run.segmentCount })}
                          </span>
                        </div>
                        <span className="tabular-nums text-sm text-muted-foreground">
                          {formatDuration(run.durationMs)}
                        </span>
                      </CardContent>
                    </Card>
                  </a>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </main>
  )
}
