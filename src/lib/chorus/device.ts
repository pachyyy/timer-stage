/**
 * An audience phone's anonymous device key — a random id kept in localStorage, sent with every
 * answer purely so the per-device cooldown (src/lib/chorus/rate-limit.ts) has something to key on.
 * It identifies nothing about the person and is never shown anywhere.
 */
const KEY = 'clepsy:chorus-device'

/** crypto.randomUUID only exists in secure contexts; a phone testing against a dev machine over
 * plain-http LAN isn't one. Uniqueness is all that matters here, not unguessability. */
function randomKey(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID()
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`
}

export function getDeviceKey(): string {
  try {
    const existing = localStorage.getItem(KEY)
    if (existing) return existing
    const created = randomKey()
    localStorage.setItem(KEY, created)
    return created
  } catch {
    // Storage blocked: a per-page-load key still gets the cooldown within this visit.
    return randomKey()
  }
}
