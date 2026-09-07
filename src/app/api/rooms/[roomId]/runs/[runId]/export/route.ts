import { NextRequest, NextResponse } from 'next/server'
import { checkRoomAccess } from '@/lib/auth/guard'
import { db } from '@/lib/db/client'
import { rooms } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { loadRun } from '@/lib/db/run-log'
import { buildRunReport } from '@/lib/history/report'
import { coalesceAdjustments, extractAdjustmentEntries } from '@/lib/history/adjustments'
import { buildRunWorkbook } from '@/lib/export/run-workbook'

export const dynamic = 'force-dynamic'
// exceljs uses Node Buffers/zlib internally — this route must run on the Node runtime, not Edge.
export const runtime = 'nodejs'

/**
 * Streams a 3-sheet .xlsx for one run. GET with the token in the query string (not a POST) so the
 * browser can trigger it as a plain navigation/download — no fetch → blob → object-URL dance.
 * `tz` is the viewer's own `new Date().getTimezoneOffset()`, since the server (Vercel) always
 * renders in UTC otherwise — see buildRunWorkbook's toLocalDate.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ roomId: string; runId: string }> },
) {
  const { roomId, runId } = await params
  const token = req.nextUrl.searchParams.get('token')
  const tzOffsetMinutes = Number(req.nextUrl.searchParams.get('tz') ?? '0') || 0

  const access = await checkRoomAccess(roomId, token)
  if (access !== 'controller') return NextResponse.json({ error: 'forbidden' }, { status: 403 })

  const loaded = await loadRun(roomId, runId)
  if (!loaded) return NextResponse.json({ error: 'run not found' }, { status: 404 })

  const [room] = await db.select({ name: rooms.name }).from(rooms).where(eq(rooms.id, roomId))
  const report = buildRunReport(loaded)
  const adjustments = coalesceAdjustments(extractAdjustmentEntries(loaded.events))

  const buffer = await buildRunWorkbook({
    roomName: room?.name ?? 'Untitled event',
    roomId,
    run: loaded.run,
    report,
    events: loaded.events,
    adjustments,
    tzOffsetMinutes,
  })

  const safeName = (room?.name ?? 'cue').replace(/[^a-z0-9]+/gi, '-').toLowerCase()
  const filename = `${safeName}-run-${loaded.run.seq}.xlsx`

  // The plain Web `Response` (not NextResponse) is used here deliberately — NextResponse's own
  // type declarations don't line up with a raw Uint8Array body, even though it's valid at runtime.
  return new Response(buffer, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-store',
    },
  })
}
