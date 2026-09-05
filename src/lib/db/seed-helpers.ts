import { generateId, generateRoomId, generateToken } from '@/lib/auth/tokens'
import { db } from './client'
import { rooms, roomState, timers } from './schema'

export interface CreateRoomInput {
  name: string
  timers: Array<{ name: string; durationMs: number; speaker?: string; wrapUpMs?: number }>
}

/** Creates a room, its agenda, and its initial (stopped) run-state row in one place. */
export async function createRoom(input: CreateRoomInput) {
  const nowMs = Date.now()
  const roomId = generateRoomId()
  const controllerToken = generateToken()
  const viewerToken = generateToken()

  await db.insert(rooms).values({
    id: roomId,
    name: input.name,
    controllerToken,
    viewerToken,
    createdAt: nowMs,
    updatedAt: nowMs,
  })

  const timerRows = input.timers.map((t, i) => ({
    id: generateId(),
    roomId,
    position: i,
    name: t.name,
    speaker: t.speaker ?? null,
    notes: null,
    type: 'countdown' as const,
    durationMs: t.durationMs,
    wrapUpMs: t.wrapUpMs ?? 60_000,
  }))
  if (timerRows.length > 0) {
    await db.insert(timers).values(timerRows)
  }

  await db.insert(roomState).values({
    roomId,
    version: 0,
    activeTimerId: timerRows[0]?.id ?? null,
    status: 'stopped',
    startedAtMs: null,
    elapsedBeforeMs: 0,
    blackout: false,
    updatedAt: nowMs,
  })

  return { roomId, controllerToken, viewerToken }
}
