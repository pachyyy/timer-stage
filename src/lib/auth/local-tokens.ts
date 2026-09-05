/**
 * Client-side cache of controller tokens, keyed by room id, so refreshing the controller tab
 * (or closing and reopening it) doesn't lose control of a live show. Never used for anything
 * server-trusted on its own — the server always re-validates the token on every mutation.
 */
const PREFIX = 'stagetimer:controller:'

export function setControllerToken(roomId: string, token: string) {
  try {
    localStorage.setItem(PREFIX + roomId, token)
  } catch {
    // localStorage unavailable (private mode, blocked) — the URL's own ?t= param still works
  }
}

export function getControllerToken(roomId: string): string | null {
  try {
    return localStorage.getItem(PREFIX + roomId)
  } catch {
    return null
  }
}
