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

/** Every room this browser holds a controller token for — the raw material for the "import your
 * rooms" prompt on /my-rooms after signing in. Rooms already linked to an account (or belonging
 * to someone else) simply fail their claim attempt server-side; this list is just what to try. */
export function listControllerTokens(): { roomId: string; token: string }[] {
  try {
    const out: { roomId: string; token: string }[] = []
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (!key?.startsWith(PREFIX)) continue
      const token = localStorage.getItem(key)
      if (token) out.push({ roomId: key.slice(PREFIX.length), token })
    }
    return out
  } catch {
    return []
  }
}
