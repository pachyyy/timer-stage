import type { AgendaSnapshotTimer, RunEventRecord, RunReport, RunRecord, SegmentReport } from './types'

interface Accumulator {
  timerId: string
  name: string
  plannedMs: number | null
  adjustmentsMs: number
  actualMs: number
  runningSince: number | null
  firstStartAtMs: number | null
  startedAtMs: number | null
  endedAtMs: number | null
  scheduledStartMs: number | null
  resetCount: number
}

function newAccumulator(timerId: string, name: string): Accumulator {
  return {
    timerId,
    name,
    plannedMs: null,
    adjustmentsMs: 0,
    actualMs: 0,
    runningSince: null,
    firstStartAtMs: null,
    startedAtMs: null,
    endedAtMs: null,
    scheduledStartMs: null,
    resetCount: 0,
  }
}

function closeInterval(acc: Accumulator, atMs: number) {
  if (acc.runningSince === null) return
  // Wall-clock intervals are the only sound definition of "actual" — TimerModel.adjustElapsed is
  // deliberately unclamped, so the anchor state's own elapsedBeforeMs can go negative and is a
  // display quantity, not a measurement. Sum real time-live intervals instead.
  acc.actualMs += atMs - acc.runningSince
  acc.runningSince = null
  acc.endedAtMs = atMs
}

/**
 * Folds a run's event stream into a per-segment planned-vs-actual report. Pure — no DB, no clock —
 * so this is exercised directly by vitest with hand-built event arrays.
 *
 * "Planned" for a segment is the durationMs captured at the moment it FIRST started in this run
 * (`plannedDurationMs` on that event) — a mid-run duration edit therefore shows up as a delta
 * against the plan actually agreed to for the night, not a silent rewrite of history.
 */
export function buildRunReport(input: {
  run: RunRecord
  events: RunEventRecord[]
  agenda: AgendaSnapshotTimer[]
}): RunReport {
  const { run } = input
  const sorted = [...input.events].sort((a, b) => a.seq - b.seq)
  const byId = new Map<string, Accumulator>()

  const get = (timerId: string, name: string | null) => {
    let acc = byId.get(timerId)
    if (!acc) {
      acc = newAccumulator(timerId, name ?? 'Untitled')
      byId.set(timerId, acc)
    }
    return acc
  }

  for (const event of sorted) {
    switch (event.type) {
      case 'start':
      case 'resume': {
        if (!event.timerId) break
        const acc = get(event.timerId, event.timerName)
        acc.runningSince = event.atMs
        if (acc.startedAtMs === null) acc.startedAtMs = event.atMs
        if (acc.firstStartAtMs === null) {
          acc.firstStartAtMs = event.atMs
          acc.plannedMs = event.plannedDurationMs ?? 0
          acc.scheduledStartMs = event.scheduledStartMs
        }
        break
      }
      case 'pause': {
        if (!event.timerId) break
        closeInterval(get(event.timerId, event.timerName), event.atMs)
        break
      }
      case 'reset': {
        if (!event.timerId) break
        const acc = get(event.timerId, event.timerName)
        closeInterval(acc, event.atMs)
        acc.resetCount += 1
        break
      }
      case 'select': {
        // 'select' logs the OUTGOING segment as `timerId` — the incoming one (`toTimerId`) isn't
        // "started" until its own later start event, per TimerModel.reset() on select.
        if (event.timerId) closeInterval(get(event.timerId, event.timerName), event.atMs)
        break
      }
      case 'adjust': {
        if (!event.timerId || event.deltaMs === null) break
        get(event.timerId, event.timerName).adjustmentsMs += event.deltaMs
        break
      }
      case 'run_end': {
        if (event.timerId) closeInterval(get(event.timerId, event.timerName), event.atMs)
        break
      }
      case 'blackout_on':
      case 'blackout_off':
      case 'message':
        break
    }
  }

  const lastEventAtMs = sorted.length > 0 ? sorted[sorted.length - 1].atMs : null
  const incomplete = run.endedAtMs === null
  const closeAtMs = run.endedAtMs ?? lastEventAtMs ?? run.startedAtMs
  for (const acc of byId.values()) {
    if (acc.runningSince !== null) closeInterval(acc, closeAtMs)
  }

  const agendaIds = new Set(input.agenda.map((t) => t.id))
  const allIds = new Set<string>([...agendaIds, ...byId.keys()])
  const agendaById = new Map(input.agenda.map((t) => [t.id, t]))

  const segments: SegmentReport[] = [...allIds].map((timerId) => {
    const acc = byId.get(timerId)
    const agendaTimer = agendaById.get(timerId)
    const neverRan = !acc || acc.firstStartAtMs === null

    const plannedMs = neverRan ? (agendaTimer?.durationMs ?? 0) : (acc!.plannedMs ?? 0)
    const adjustmentsMs = acc?.adjustmentsMs ?? 0
    const adjustedPlannedMs = plannedMs + adjustmentsMs
    const actualMs = acc?.actualMs ?? 0
    const startedAtMs = acc?.startedAtMs ?? null
    const endedAtMs = acc?.endedAtMs ?? null
    const scheduledStartMs = neverRan
      ? (agendaTimer?.scheduledStartMs ?? null)
      : (acc!.scheduledStartMs ?? agendaTimer?.scheduledStartMs ?? null)

    return {
      timerId,
      name: acc?.name ?? agendaTimer?.name ?? 'Untitled',
      position: agendaTimer?.position ?? null,
      plannedMs,
      adjustmentsMs,
      adjustedPlannedMs,
      actualMs,
      diffMs: actualMs - adjustedPlannedMs,
      rawDiffMs: actualMs - plannedMs,
      startedAtMs,
      endedAtMs,
      scheduledStartMs,
      startDriftMs: startedAtMs !== null && scheduledStartMs !== null ? startedAtMs - scheduledStartMs : null,
      resetCount: acc?.resetCount ?? 0,
      neverRan,
    }
  })

  segments.sort((a, b) => {
    if (a.position !== null && b.position !== null) return a.position - b.position
    if (a.position !== null) return -1
    if (b.position !== null) return 1
    return (a.startedAtMs ?? Infinity) - (b.startedAtMs ?? Infinity)
  })

  const totals = segments.reduce(
    (acc, s) => ({
      plannedMs: acc.plannedMs + s.plannedMs,
      adjustmentsMs: acc.adjustmentsMs + s.adjustmentsMs,
      actualMs: acc.actualMs + s.actualMs,
      diffMs: acc.diffMs + s.diffMs,
    }),
    { plannedMs: 0, adjustmentsMs: 0, actualMs: 0, diffMs: 0 },
  )

  return { run, segments, totals, incomplete }
}
