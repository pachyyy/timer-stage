/**
 * Client-side cache of a viewer's participant session, keyed by room id, so refreshing (or
 * reopening) the viewer page doesn't re-prompt for a name or create a duplicate participant row.
 * Mirrors the pattern in local-tokens.ts. Never trusted server-side on its own — every mutating
 * or identity-scoped request re-validates the sessionToken against the participants table.
 */
export interface ParticipantSession {
  participantId: string
  sessionToken: string
  name: string
}

const PREFIX = 'stagetimer:participant:'

export function setParticipantSession(roomId: string, session: ParticipantSession) {
  try {
    localStorage.setItem(PREFIX + roomId, JSON.stringify(session))
  } catch {
    // localStorage unavailable — the join gate will just show again next time
  }
}

export function getParticipantSession(roomId: string): ParticipantSession | null {
  try {
    const raw = localStorage.getItem(PREFIX + roomId)
    if (!raw) return null
    return JSON.parse(raw) as ParticipantSession
  } catch {
    return null
  }
}

/** Called when the admin removes this participant from the room — their sessionToken no longer
 * resolves to anything server-side, so the cached copy must go too or a refresh would just read
 * it back and skip the join gate again. */
export function clearParticipantSession(roomId: string) {
  try {
    localStorage.removeItem(PREFIX + roomId)
  } catch {
    // localStorage unavailable — nothing to clear
  }
}
