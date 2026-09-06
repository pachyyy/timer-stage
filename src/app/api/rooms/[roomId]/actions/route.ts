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

const MAX_MESSAGE_LENGTH = 200

/**
 * All state transitions go through here. Every timestamp used is the SERVER's Date.now() (inside
 * mutateRunState) — never a value the client sends — so a device with a skewed clock can't
 * corrupt the room for everyone. Every successful mutation bumps `version` and is re-broadcast.
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
        return { runState: TimerModel.start(current, nowMs) }
      case 'pause':
        return { runState: TimerModel.pause(current, nowMs) }
      case 'reset':
        return { runState: TimerModel.reset() }
      case 'adjust':
        return { runState: TimerModel.adjustElapsed(current, nowMs, body.deltaMs) }
      case 'select':
        return { runState: TimerModel.reset(), activeTimerId: body.timerId }
      case 'blackout':
        return { blackout: body.blackout }
      case 'message': {
        const text = body.text?.trim().slice(0, MAX_MESSAGE_LENGTH) || null
        // Resolve the duration against the server's nowMs so every viewer hides it at the same
        // instant regardless of their own clock.
        const expiresAtMs = text && body.durationMs ? nowMs + body.durationMs : null
        return { message: { text, expiresAtMs } }
      }
      default:
        return {}
    }
  })

  if (!payload) return NextResponse.json({ error: 'room not found' }, { status: 404 })

  await publishRoomState(roomId, payload)
  return NextResponse.json(payload)
}
