import { NextRequest, NextResponse } from 'next/server'
import { checkRoomAccess } from '@/lib/auth/guard'
import { mutateRunState, TimerModel } from '@/lib/db/room-state'
import { publishRoomState } from '@/lib/sync/publish'

export const dynamic = 'force-dynamic'

type ActionBody =
  | { action: 'start'; token: string }
  | { action: 'pause'; token: string }
  | { action: 'reset'; token: string }
  | { action: 'adjust'; token: string; deltaMs: number }
  | { action: 'select'; token: string; timerId: string }
  | { action: 'blackout'; token: string; blackout: boolean }
  | { action: 'message'; token: string; text: string | null; durationMs: number | null }
  | { action: 'end'; token: string }

const MAX_MESSAGE_LENGTH = 200

/**
 * All state transitions go through here. Every timestamp used is the SERVER's Date.now() (inside
 * mutateRunState) — never a value the client sends — so a device with a skewed clock can't
 * corrupt the room for everyone. Every successful mutation bumps `version` and is re-broadcast.
 *
 * Each case also returns an `event` for mutateRunState to log against the room's open run (see
 * src/lib/db/run-log.ts). 'start' and 'resume' both produce `TimerModel.start`'s
 * `status: 'running'` — only this switch, which sees the pre-transition status, can tell them
 * apart, which is why the event type is decided here rather than inferred from the resulting
 * RunState.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ roomId: string }> }) {
  const { roomId } = await params
  const body = (await req.json().catch(() => null)) as ActionBody | null
  if (!body) return NextResponse.json({ error: 'invalid body' }, { status: 400 })

  const access = await checkRoomAccess(roomId, body.token)
  if (access !== 'controller') {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  const payload = await mutateRunState(roomId, (current, nowMs) => {
    switch (body.action) {
      case 'start':
        return {
          runState: TimerModel.start(current, nowMs),
          event: { type: current.status === 'paused' ? ('resume' as const) : ('start' as const) },
        }
      case 'pause':
        return { runState: TimerModel.pause(current, nowMs), event: { type: 'pause' as const } }
      case 'reset':
        return { runState: TimerModel.reset(), event: { type: 'reset' as const } }
      case 'adjust':
        return {
          runState: TimerModel.adjustElapsed(current, nowMs, body.deltaMs),
          event: { type: 'adjust' as const, deltaMs: body.deltaMs },
        }
      case 'select':
        return {
          runState: TimerModel.reset(),
          activeTimerId: body.timerId,
          event: { type: 'select' as const, toTimerId: body.timerId },
        }
      case 'blackout':
        return {
          blackout: body.blackout,
          event: { type: body.blackout ? ('blackout_on' as const) : ('blackout_off' as const) },
        }
      case 'message': {
        const text = body.text?.trim().slice(0, MAX_MESSAGE_LENGTH) || null
        // Resolve the duration against the server's nowMs so every viewer hides it at the same
        // instant regardless of their own clock.
        const expiresAtMs = text && body.durationMs ? nowMs + body.durationMs : null
        return { message: { text, expiresAtMs }, event: { type: 'message' as const, note: text ?? undefined } }
      }
      case 'end':
        // Agenda segments stay in the room — only the run is archived and the timer stops.
        return { runState: TimerModel.reset(), event: { type: 'run_end' as const } }
      default:
        return {}
    }
  })

  if (!payload) return NextResponse.json({ error: 'room not found' }, { status: 404 })

  await publishRoomState(roomId, payload)
  return NextResponse.json(payload)
}
