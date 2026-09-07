import type { CoalescedAdjustment, RunEventRecord, RunEventType, RunReport } from '@/lib/history/types'
import { formatAdjustmentLabel, formatSignedMinutes } from '@/lib/history/adjustments'

/** Excel can't render a negative value in a time-formatted cell (shows ####), so signed columns
 * (diff, start drift) are written as plain minutes with an explicit +/- number format instead of
 * `[h]:mm:ss`. Unsigned durations (planned, actual) use the time format so they sort/sum natively. */
const DURATION_FORMAT = '[h]:mm:ss'
const SIGNED_MINUTES_FORMAT = '+0.0" min";-0.0" min";0" min"'

/** ExcelJS serializes a Date using its own UTC field getters, not the process's local time zone —
 * on Vercel that's always UTC regardless of the viewer's clock. Shifting the underlying instant by
 * the viewer's own offset before handing it to ExcelJS makes the *displayed* wall-clock time match
 * what they'd see on their own screen, while leaving the raw epoch untouched everywhere else. */
function toLocalDate(ms: number, tzOffsetMinutes: number): Date {
  return new Date(ms - tzOffsetMinutes * 60_000)
}

function msToDurationSerial(ms: number): number {
  return Math.max(0, ms) / 86_400_000
}

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

function eventDetail(event: RunEventRecord, nameById: Map<string, string>): string {
  switch (event.type) {
    case 'adjust':
      return event.deltaMs !== null ? formatSignedMinutes(event.deltaMs) : ''
    case 'select':
      return event.toTimerId ? `To: ${nameById.get(event.toTimerId) ?? event.toTimerId}` : ''
    case 'message':
      return event.note ?? ''
    default:
      return ''
  }
}

export async function buildRunWorkbook(input: {
  roomName: string
  roomId: string
  run: { seq: number; label: string; startedAtMs: number; endedAtMs: number | null; abandoned: boolean }
  report: RunReport
  events: RunEventRecord[]
  adjustments: CoalescedAdjustment[]
  tzOffsetMinutes: number
}): Promise<ArrayBuffer> {
  // Dynamically imported so exceljs never enters any other route's module graph — it's only ever
  // needed inside this one export handler.
  const ExcelJS = (await import('exceljs')).default
  const workbook = new ExcelJS.Workbook()
  workbook.creator = 'Cue'
  workbook.created = new Date()

  const { tzOffsetMinutes } = input
  const generatedAt = toLocalDate(Date.now(), tzOffsetMinutes)
  const title = `${input.roomName} — Run ${input.run.seq}${input.run.abandoned ? ' (abandoned)' : ''} — generated ${generatedAt.toISOString().slice(0, 16).replace('T', ' ')} (UTC${tzOffsetMinutes <= 0 ? '+' : '-'}${Math.abs(tzOffsetMinutes / 60)})`

  const nameById = new Map(input.report.segments.map((s) => [s.timerId, s.name]))

  // ---- Summary ----
  const summary = workbook.addWorksheet('Summary', { views: [{ state: 'frozen', ySplit: 2 }] })
  summary.addRow([title])
  summary.mergeCells(1, 1, 1, 11)
  summary.getRow(1).font = { bold: true }
  summary.addRow([
    '#', 'Segment', 'Scheduled', 'Actual start', 'Actual end', 'Start drift',
    'Planned', 'Adjustments', 'Adjusted plan', 'Actual', 'Diff',
  ])
  summary.getRow(2).font = { bold: true }
  summary.columns = [
    { width: 4 }, { width: 26 }, { width: 12 }, { width: 12 }, { width: 12 }, { width: 12 },
    { width: 10 }, { width: 12 }, { width: 12 }, { width: 10 }, { width: 10 },
  ]

  input.report.segments.forEach((seg, i) => {
    const row = summary.addRow([
      i + 1,
      seg.name,
      seg.scheduledStartMs !== null ? toLocalDate(seg.scheduledStartMs, tzOffsetMinutes) : null,
      seg.startedAtMs !== null ? toLocalDate(seg.startedAtMs, tzOffsetMinutes) : null,
      seg.endedAtMs !== null ? toLocalDate(seg.endedAtMs, tzOffsetMinutes) : null,
      seg.startDriftMs !== null ? seg.startDriftMs / 60_000 : null,
      msToDurationSerial(seg.plannedMs),
      seg.adjustmentsMs / 60_000,
      msToDurationSerial(seg.adjustedPlannedMs),
      msToDurationSerial(seg.actualMs),
      seg.diffMs / 60_000,
    ])
    ;[3, 4, 5].forEach((col) => (row.getCell(col).numFmt = 'yyyy-mm-dd hh:mm'))
    row.getCell(6).numFmt = SIGNED_MINUTES_FORMAT
    row.getCell(7).numFmt = DURATION_FORMAT
    row.getCell(8).numFmt = SIGNED_MINUTES_FORMAT
    row.getCell(9).numFmt = DURATION_FORMAT
    row.getCell(10).numFmt = DURATION_FORMAT
    row.getCell(11).numFmt = SIGNED_MINUTES_FORMAT
    if (seg.neverRan) row.font = { italic: true, color: { argb: 'FF888888' } }
  })

  const totalsRow = summary.addRow([
    '', 'Total', '', '', '', '',
    msToDurationSerial(input.report.totals.plannedMs),
    input.report.totals.adjustmentsMs / 60_000,
    msToDurationSerial(input.report.totals.plannedMs + input.report.totals.adjustmentsMs),
    msToDurationSerial(input.report.totals.actualMs),
    input.report.totals.diffMs / 60_000,
  ])
  totalsRow.font = { bold: true }
  totalsRow.getCell(7).numFmt = DURATION_FORMAT
  totalsRow.getCell(8).numFmt = SIGNED_MINUTES_FORMAT
  totalsRow.getCell(9).numFmt = DURATION_FORMAT
  totalsRow.getCell(10).numFmt = DURATION_FORMAT
  totalsRow.getCell(11).numFmt = SIGNED_MINUTES_FORMAT

  // ---- Events ----
  const eventsSheet = workbook.addWorksheet('Events', { views: [{ state: 'frozen', ySplit: 2 }] })
  eventsSheet.addRow([title])
  eventsSheet.mergeCells(1, 1, 1, 4)
  eventsSheet.getRow(1).font = { bold: true }
  eventsSheet.addRow(['Time', 'Event', 'Segment', 'Detail'])
  eventsSheet.getRow(2).font = { bold: true }
  eventsSheet.columns = [{ width: 18 }, { width: 14 }, { width: 26 }, { width: 30 }]

  for (const event of input.events) {
    const row = eventsSheet.addRow([
      toLocalDate(event.atMs, tzOffsetMinutes),
      EVENT_LABELS[event.type],
      event.timerName ?? (event.timerId ? nameById.get(event.timerId) : '') ?? '',
      eventDetail(event, nameById),
    ])
    row.getCell(1).numFmt = 'yyyy-mm-dd hh:mm:ss'
  }

  // ---- Adjustments ----
  const adjSheet = workbook.addWorksheet('Adjustments', { views: [{ state: 'frozen', ySplit: 2 }] })
  adjSheet.addRow([title])
  adjSheet.mergeCells(1, 1, 1, 5)
  adjSheet.getRow(1).font = { bold: true }
  adjSheet.addRow(['Segment', 'Total change', 'Detail', 'First at', 'Last at'])
  adjSheet.getRow(2).font = { bold: true }
  adjSheet.columns = [{ width: 26 }, { width: 12 }, { width: 32 }, { width: 18 }, { width: 18 }]

  for (const adjustment of input.adjustments) {
    const row = adjSheet.addRow([
      adjustment.timerName,
      adjustment.totalMs / 60_000,
      formatAdjustmentLabel(adjustment),
      toLocalDate(adjustment.firstAtMs, tzOffsetMinutes),
      toLocalDate(adjustment.lastAtMs, tzOffsetMinutes),
    ])
    row.getCell(2).numFmt = SIGNED_MINUTES_FORMAT
    row.getCell(4).numFmt = 'yyyy-mm-dd hh:mm:ss'
    row.getCell(5).numFmt = 'yyyy-mm-dd hh:mm:ss'
  }
  if (input.adjustments.length === 0) {
    adjSheet.addRow(['No mid-show time adjustments in this run.'])
  }

  // exceljs's own declared Buffer type doesn't line up with @types/node's ambient Buffer, and a
  // Node Buffer's `.buffer` can be a larger pooled ArrayBuffer than its own contents — slicing by
  // byteOffset/byteLength copies out exactly the written bytes as a plain ArrayBuffer, which is
  // what the Web-standard `Response` body type actually wants.
  const raw = await workbook.xlsx.writeBuffer()
  const view = raw as unknown as { buffer: ArrayBufferLike; byteOffset: number; byteLength: number }
  return view.buffer.slice(view.byteOffset, view.byteOffset + view.byteLength) as ArrayBuffer
}
