/**
 * Thin client-side wrappers around the controller-only API routes. Every one of these resolves
 * with the fresh RoomStatePayload the mutation produced — callers should feed that straight into
 * useRoomState's `applyPayload` so the actor's own screen updates the instant the response
 * arrives, instead of waiting for the next poll/broadcast to deliver the same thing later.
 */
import type { RoomStatePayload } from '@/lib/sync/transport'

async function request(url: string, init: RequestInit): Promise<RoomStatePayload> {
  const res = await fetch(url, init)
  if (!res.ok) throw new Error(`Request failed: ${res.status}`)
  return res.json()
}

const post = (url: string, body: unknown) =>
  request(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })

const del = (url: string, body: unknown) =>
  request(url, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })

export const roomActions = {
  start: (roomId: string, token: string) => post(`/api/rooms/${roomId}/actions`, { action: 'start', token }),
  pause: (roomId: string, token: string) => post(`/api/rooms/${roomId}/actions`, { action: 'pause', token }),
  reset: (roomId: string, token: string) => post(`/api/rooms/${roomId}/actions`, { action: 'reset', token }),
  adjust: (roomId: string, token: string, deltaMs: number) =>
    post(`/api/rooms/${roomId}/actions`, { action: 'adjust', token, deltaMs }),
  select: (roomId: string, token: string, timerId: string) =>
    post(`/api/rooms/${roomId}/actions`, { action: 'select', token, timerId }),
  blackout: (roomId: string, token: string, blackout: boolean) =>
    post(`/api/rooms/${roomId}/actions`, { action: 'blackout', token, blackout }),
  addTimer: (roomId: string, token: string, input: { name: string; durationMs: number }) =>
    post(`/api/rooms/${roomId}/timers`, { token, ...input }),
  deleteTimer: (roomId: string, token: string, timerId: string) =>
    del(`/api/rooms/${roomId}/timers/${timerId}`, { token }),
}
