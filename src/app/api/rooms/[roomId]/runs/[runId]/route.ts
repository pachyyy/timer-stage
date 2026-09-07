import { NextRequest, NextResponse } from 'next/server'
import { resolveRoomAccess } from '@/lib/auth/session-guard'
import { loadRun } from '@/lib/db/run-log'
import { buildRunReport } from '@/lib/history/report'
import { coalesceAdjustments, extractAdjustmentEntries } from '@/lib/history/adjustments'

export const dynamic = 'force-dynamic'

/** One run's full detail: the record, its computed report, the raw event timeline, and coalesced
 * adjustments — the same `buildRunReport`/`coalesceAdjustments` output the xlsx export uses, so
 * the on-screen table and the spreadsheet can never drift apart. Controller-only. */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ roomId: string; runId: string }> },
) {
  const { roomId, runId } = await params
  const token = req.nextUrl.searchParams.get('token')

  const access = await resolveRoomAccess(roomId, token)
  if (access !== 'controller') return NextResponse.json({ error: 'forbidden' }, { status: 403 })

  const loaded = await loadRun(roomId, runId)
  if (!loaded) return NextResponse.json({ error: 'run not found' }, { status: 404 })

  const report = buildRunReport(loaded)
  const adjustments = coalesceAdjustments(extractAdjustmentEntries(loaded.events))

  return NextResponse.json({ run: loaded.run, report, events: loaded.events, adjustments })
}
