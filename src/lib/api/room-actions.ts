/**
 * Thin client-side wrappers around the controller-only API routes. Every one of these resolves
 * with the fresh RoomStatePayload the mutation produced — callers should feed that straight into
 * useRoomState's `applyPayload` so the actor's own screen updates the instant the response
 * arrives, instead of waiting for the next poll/broadcast to deliver the same thing later.
 */
import type { RoomStatePayload } from '@/lib/sync/transport'

/**
 * Carries the HTTP status alongside the message so a caller can tell a quota/plan block (402 —
 * see src/lib/entitlements/gate.ts) apart from any other failure without sniffing the (now
 * translatable, so no longer English-guaranteed) message text for a word like "credit".
 */
export class ActionError extends Error {
  constructor(message: string, readonly status: number) {
    super(message)
    this.name = 'ActionError'
  }
}

async function request(url: string, init: RequestInit): Promise<RoomStatePayload> {
  const res = await fetch(url, init)
  if (!res.ok) {
    // A plan-limit block (402) comes back with a real, show-it-directly message in `error`.
    // Anything else falls back to the status code.
    const body = await res.json().catch(() => null)
    throw new ActionError(
      typeof body?.error === 'string' ? body.error : `Request failed: ${res.status}`,
      res.status,
    )
  }
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

const patch = (url: string, body: unknown) =>
  request(url, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })

export interface TimerPatch {
  name?: string
  speaker?: string | null
  notes?: string | null
  durationMs?: number
  wrapUpMs?: number
  scheduledStartMs?: number | null
  linkToNext?: boolean
}

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
  /** `durationMs: null` keeps the message up until it's explicitly cleared. */
  sendMessage: (roomId: string, token: string, text: string, durationMs: number | null) =>
    post(`/api/rooms/${roomId}/actions`, { action: 'message', token, text, durationMs }),
  clearMessage: (roomId: string, token: string) =>
    post(`/api/rooms/${roomId}/actions`, { action: 'message', token, text: null, durationMs: null }),
  /** Archives the current run and stops the timer. The agenda stays — the next 'start' opens a
   * fresh run, so the same show can be run again. */
  endShow: (roomId: string, token: string) => post(`/api/rooms/${roomId}/actions`, { action: 'end', token }),
  /** Auto-advance: select(next) then start(), sequentially — see the `linkToNext` agenda feature.
   * If a concurrent action (another tab, a manual click) already moved activeTimerId away from
   * `timerId` by the time select() resolves, don't blindly start whatever is active now — bail
   * and return that fresher payload instead. */
  advanceTo: async (roomId: string, token: string, timerId: string): Promise<RoomStatePayload> => {
    const afterSelect = await post(`/api/rooms/${roomId}/actions`, { action: 'select', token, timerId })
    if (afterSelect.activeTimerId !== timerId) return afterSelect
    return post(`/api/rooms/${roomId}/actions`, { action: 'start', token })
  },
  addTimer: (roomId: string, token: string, input: { name: string; durationMs: number }) =>
    post(`/api/rooms/${roomId}/timers`, { token, ...input }),
  deleteTimer: (roomId: string, token: string, timerId: string) =>
    del(`/api/rooms/${roomId}/timers/${timerId}`, { token }),
  updateTimer: (roomId: string, token: string, timerId: string, input: TimerPatch) =>
    patch(`/api/rooms/${roomId}/timers/${timerId}`, { token, ...input }),
  /** `order` is the room's timer ids in their new top-to-bottom order. */
  reorderTimers: (roomId: string, token: string, order: string[]) =>
    patch(`/api/rooms/${roomId}/timers`, { token, order }),
  renameRoom: (roomId: string, token: string, name: string) =>
    patch(`/api/rooms/${roomId}`, { token, name }),
}
