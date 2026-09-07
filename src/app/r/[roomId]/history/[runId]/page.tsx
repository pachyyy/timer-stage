'use client'

import { use, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { useSession } from 'next-auth/react'
import Image from 'next/image'
import { ArrowLeft, Download } from 'lucide-react'
import { getControllerToken, setControllerToken } from '@/lib/auth/local-tokens'
import { MissingToken } from '@/components/missing-token'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { formatDuration } from '@/lib/timer/model'
import { formatAdjustmentLabel, formatSignedMinutes } from '@/lib/history/adjustments'
import type { CoalescedAdjustment, RunEventRecord, RunEventType, RunRecord, RunReport } from '@/lib/history/types'
import { cn } from '@/lib/utils'

const EVENT_LABELS: Record<RunEventType, string> = {
  start: 'Start',
  resume: 'Resume',
  pause: 'Pause',
  reset: 'Reset',
  select: 'Select',
  adjust: 'Adjust',
  blackout_on: 'Blackout on',
  blackout_off: 'Blackout off',
  message: 'Message',
  run_end: 'End show',
}

function fmtTime(ms: number): string {
  return new Date(ms).toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'medium' })
}

function fmtSigned(ms: number): string {
  return formatSignedMinutes(ms)
}

interface RunDetail {
  run: RunRecord
  report: RunReport
  events: RunEventRecord[]
  adjustments: CoalescedAdjustment[]
}

/** Read-only, same as the history list page — no live transport mounted. */
export default function RunDetailPage({ params }: { params: Promise<{ roomId: string; runId: string }> }) {
  const { roomId, runId } = use(params)
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

  const [detail, setDetail] = useState<RunDetail | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [forbidden, setForbidden] = useState(false)
  // Same idea as /control's `resolvingAccess`: with no token, an owner still needs the session to
  // finish loading before this page can tell "no access" apart from "haven't checked yet".
  const resolvingAccess = !token && sessionStatus === 'loading'

  useEffect(() => {
    if (resolvingAccess) return
    const qs = token ? `?token=${encodeURIComponent(token)}` : ''
    fetch(`/api/rooms/${roomId}/runs/${runId}${qs}`)
      .then((res) => {
        if (res.status === 403) {
          setForbidden(true)
          return Promise.reject(res.status)
        }
        return res.ok ? res.json() : Promise.reject(res.status)
      })
      .then(setDetail)
      .catch(() => setError((prev) => prev ?? 'Could not load this run.'))
  }, [roomId, runId, token, resolvingAccess])

  if (resolvingAccess) {
    return (
      <main className="mx-auto flex min-h-screen max-w-4xl flex-col items-center justify-center px-4">
        <p className="text-muted-foreground">Loading…</p>
      </main>
    )
  }
  if (forbidden) return <MissingToken />

  const exportQs = token
    ? `?token=${encodeURIComponent(token)}&tz=${new Date().getTimezoneOffset()}`
    : `?tz=${new Date().getTimezoneOffset()}`
  const exportUrl = typeof window !== 'undefined' ? `/api/rooms/${roomId}/runs/${runId}/export${exportQs}` : ''

  return (
    <main className="mx-auto flex min-h-screen max-w-4xl flex-col gap-6 px-4 py-8">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Image src="/cue.svg" alt="" width={24} height={24} unoptimized className="rounded-md" />
          <h1 className="text-xl font-semibold">Run {detail?.run.seq ?? ''}</h1>
        </div>
        <div className="flex items-center gap-2">
          <Button asChild variant="outline" size="sm">
            <a href={`/r/${roomId}/history${token ? `?t=${token}` : ''}`}>
              <ArrowLeft className="size-3.5" /> All runs
            </a>
          </Button>
          <Button asChild variant="outline" size="sm">
            <a href={`/r/${roomId}/control${token ? `?t=${token}` : ''}`}>Back to live</a>
          </Button>
        </div>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}
      {!detail && !error && <p className="text-muted-foreground">Loading…</p>}

      {detail && (
        <>
          <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
            <span>{fmtTime(detail.run.startedAtMs)}</span>
            {detail.run.abandoned && <span className="text-amber-600 dark:text-amber-400">Abandoned run</span>}
            {detail.report.incomplete && <span className="text-amber-600 dark:text-amber-400">In progress</span>}
            <a href={exportUrl} className="ml-auto">
              <Button size="sm">
                <Download className="size-3.5" /> Download .xlsx
              </Button>
            </a>
          </div>

          <Card className="min-w-0">
            <CardHeader>
              <CardTitle>Summary</CardTitle>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-sm">
                <thead>
                  <tr className="border-b text-left text-xs text-muted-foreground">
                    <th className="py-1.5 pr-2">#</th>
                    <th className="py-1.5 pr-2">Segment</th>
                    <th className="py-1.5 pr-2 text-right">Planned</th>
                    <th className="py-1.5 pr-2 text-right">Adjustments</th>
                    <th className="py-1.5 pr-2 text-right">Actual</th>
                    <th className="py-1.5 pr-2 text-right">Diff</th>
                  </tr>
                </thead>
                <tbody>
                  {detail.report.segments.map((seg, i) => (
                    <tr key={seg.timerId} className={cn('border-b last:border-0', seg.neverRan && 'text-muted-foreground italic')}>
                      <td className="py-1.5 pr-2 tabular-nums">{i + 1}</td>
                      <td className="py-1.5 pr-2">{seg.name}</td>
                      <td className="py-1.5 pr-2 text-right tabular-nums">{formatDuration(seg.plannedMs)}</td>
                      <td className="py-1.5 pr-2 text-right tabular-nums">
                        {seg.adjustmentsMs !== 0 ? fmtSigned(seg.adjustmentsMs) : '—'}
                      </td>
                      <td className="py-1.5 pr-2 text-right tabular-nums">
                        {seg.neverRan ? '—' : formatDuration(seg.actualMs)}
                      </td>
                      <td
                        className={cn(
                          'py-1.5 pr-2 text-right tabular-nums',
                          !seg.neverRan && seg.diffMs > 0 && 'text-destructive',
                        )}
                      >
                        {seg.neverRan ? '—' : fmtSigned(seg.diffMs)}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="font-medium">
                    <td className="pt-2" colSpan={2}>
                      Total
                    </td>
                    <td className="pt-2 text-right tabular-nums">{formatDuration(detail.report.totals.plannedMs)}</td>
                    <td className="pt-2 text-right tabular-nums">
                      {detail.report.totals.adjustmentsMs !== 0 ? fmtSigned(detail.report.totals.adjustmentsMs) : '—'}
                    </td>
                    <td className="pt-2 text-right tabular-nums">{formatDuration(detail.report.totals.actualMs)}</td>
                    <td
                      className={cn(
                        'pt-2 text-right tabular-nums',
                        detail.report.totals.diffMs > 0 && 'text-destructive',
                      )}
                    >
                      {fmtSigned(detail.report.totals.diffMs)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Adjustments</CardTitle>
            </CardHeader>
            <CardContent>
              {detail.adjustments.length === 0 ? (
                <p className="text-sm text-muted-foreground">No mid-show time adjustments in this run.</p>
              ) : (
                <ul className="flex flex-col gap-1.5 text-sm">
                  {detail.adjustments.map((a, i) => (
                    <li key={i}>{formatAdjustmentLabel(a)}</li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          <Card className="min-w-0">
            <CardHeader>
              <CardTitle>Timeline</CardTitle>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <table className="w-full min-w-[560px] text-sm">
                <thead>
                  <tr className="border-b text-left text-xs text-muted-foreground">
                    <th className="py-1.5 pr-2">Time</th>
                    <th className="py-1.5 pr-2">Event</th>
                    <th className="py-1.5 pr-2">Segment</th>
                    <th className="py-1.5 pr-2">Detail</th>
                  </tr>
                </thead>
                <tbody>
                  {detail.events.map((e) => (
                    <tr key={e.seq} className="border-b last:border-0">
                      <td className="py-1.5 pr-2 whitespace-nowrap tabular-nums text-muted-foreground">
                        {fmtTime(e.atMs)}
                      </td>
                      <td className="py-1.5 pr-2">{EVENT_LABELS[e.type]}</td>
                      <td className="py-1.5 pr-2">{e.timerName ?? ''}</td>
                      <td className="py-1.5 pr-2 text-muted-foreground">
                        {e.type === 'adjust' && e.deltaMs !== null ? fmtSigned(e.deltaMs) : e.note ?? ''}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </>
      )}
    </main>
  )
}
