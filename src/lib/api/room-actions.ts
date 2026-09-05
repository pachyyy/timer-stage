/** Thin client-side wrappers around the controller-only API routes. */

async function post(url: string, body: unknown) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(`Request failed: ${res.status}`)
  return res.json()
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
  addTimer: (roomId: string, token: string, input: { name: string; durationMs: number }) =>
    post(`/api/rooms/${roomId}/timers`, { token, ...input }),
  deleteTimer: (roomId: string, token: string, timerId: string) =>
    fetch(`/api/rooms/${roomId}/timers/${timerId}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
    }),
}
