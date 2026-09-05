import { randomBytes } from 'crypto'

/**
 * Room share tokens. No user accounts in v1 — a room is protected by two opaque tokens:
 *  - controllerToken: full read/write, goes in the control-panel link
 *  - viewerToken:      read-only, goes in the fullscreen viewer link
 * Every mutating API route must validate the controller token server-side; never trust a
 * client-supplied "am I the controller" flag.
 */

const ROOM_ID_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789' // no 0/O/1/I to avoid ambiguity

export function generateRoomId(length = 6): string {
  const bytes = randomBytes(length)
  let id = ''
  for (let i = 0; i < length; i++) {
    id += ROOM_ID_ALPHABET[bytes[i] % ROOM_ID_ALPHABET.length]
  }
  return id
}

export function generateToken(): string {
  return randomBytes(24).toString('base64url')
}

export function generateId(): string {
  return randomBytes(16).toString('hex')
}
