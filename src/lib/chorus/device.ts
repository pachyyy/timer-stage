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

/**
 * Q&A: the ids of the questions this phone asked, so they can be marked "Yours". Kept next to the
 * device key and just as anonymous: it never leaves the phone, and the server can't tell whose a
 * question is.
 */
const OWN_PREFIX = 'clepsy:chorus-qna-mine:'

export function getOwnQuestionIds(code: string): string[] {
  try {
    const raw = localStorage.getItem(OWN_PREFIX + code)
    const parsed = raw ? JSON.parse(raw) : []
    return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === 'string') : []
  } catch {
    return []
  }
}

export function rememberOwnQuestion(code: string, id: string) {
  try {
    const ids = getOwnQuestionIds(code)
    if (!ids.includes(id)) localStorage.setItem(OWN_PREFIX + code, JSON.stringify([...ids, id]))
  } catch {
    // Storage blocked: the question just won't carry a "Yours" badge after a reload.
  }
}
