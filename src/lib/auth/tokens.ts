import { randomBytes, randomInt } from 'crypto'

/**
 * Room share tokens. No user accounts in v1 — a room is protected by two opaque tokens:
 *  - controllerToken: full read/write, goes in the control-panel link
 *  - viewerToken:      read-only, goes in the fullscreen viewer link
 * Every mutating API route must validate the controller token server-side; never trust a
 * client-supplied "am I the controller" flag.
 */

const ROOM_ID_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789' // no 0/O/1/I to avoid ambiguity

/** Re-rolls any all-digit result: an all-digit code is a Chorus session code (see
 * generateChorusCode), which is how one join box tells the two apart. */
export function generateRoomId(length = 6): string {
  for (;;) {
    const bytes = randomBytes(length)
    let id = ''
    for (let i = 0; i < length; i++) {
      id += ROOM_ID_ALPHABET[bytes[i] % ROOM_ID_ALPHABET.length]
    }
    if (!/^\d+$/.test(id)) return id
  }
}

/** A Chorus session's join code: 6 digits, easy to type from a projector screen. Always handled as
 * a string, so a leading zero is fine. Collisions are possible and handled by the caller retrying
 * the insert — see createChorusSession. */
export function generateChorusCode(): string {
  return String(randomInt(0, 1_000_000)).padStart(6, '0')
}

export function generateToken(): string {
  return randomBytes(24).toString('base64url')
}

export function generateId(): string {
  return randomBytes(16).toString('hex')
}
