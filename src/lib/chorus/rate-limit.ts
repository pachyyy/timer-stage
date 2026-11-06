/**
 * Anonymous-answer spam protection, as a pure decision over what the answers route reads back
 * from `chorus_answers` (no separate rate-limit store needed).
 *
 * Two layers, because neither is enough alone:
 *  - per device: a short cooldown between answers from the same `deviceKey`. This is what a real
 *    person mashing Send hits — but the key comes from the browser, so a script can rotate it.
 *  - per network: a cap per `ipHash` per minute. Deliberately generous, because a whole venue on
 *    one Wi-Fi often shares a single public IP — a tight cap here would block a real audience.
 *
 * Q&A mode reuses this for questions (with a longer cooldown, since a question is more deliberate
 * than an answer) and adds a vote cap — see checkVoteRateLimit.
 */

export const DEVICE_COOLDOWN_MS = 3_000
/** A typed Q&A question: a person writes one every so often, not in bursts. */
export const QNA_QUESTION_COOLDOWN_MS = 10_000
export const IP_WINDOW_MS = 60_000
export const IP_MAX_PER_WINDOW = 300
/** Votes one device may cast per minute: plenty for a person working through a list, not for a script. */
export const VOTE_MAX_PER_WINDOW = 60

export interface RateLimitInput {
  nowMs: number
  /** createdAtMs of this device's most recent answer in this session, or null. */
  lastDeviceAnswerAtMs: number | null
  /** Answers from this ipHash in this session within the last IP_WINDOW_MS. */
  ipAnswersInWindow: number
  /** Minimum gap between this device's submissions. Defaults to DEVICE_COOLDOWN_MS. */
  cooldownMs?: number
}

export type RateLimitResult = { ok: true } | { ok: false; retryAfterMs: number }

export function checkAnswerRateLimit(input: RateLimitInput): RateLimitResult {
  const cooldown = input.cooldownMs ?? DEVICE_COOLDOWN_MS
  if (input.lastDeviceAnswerAtMs !== null) {
    const sinceLast = input.nowMs - input.lastDeviceAnswerAtMs
    if (sinceLast < cooldown) return { ok: false, retryAfterMs: cooldown - sinceLast }
  }
  if (input.ipAnswersInWindow >= IP_MAX_PER_WINDOW) return { ok: false, retryAfterMs: IP_WINDOW_MS }
  return { ok: true }
}

/** `votesInWindow` = this device's votes in this session within the last IP_WINDOW_MS. */
export function checkVoteRateLimit(votesInWindow: number): RateLimitResult {
  if (votesInWindow >= VOTE_MAX_PER_WINDOW) return { ok: false, retryAfterMs: IP_WINDOW_MS }
  return { ok: true }
}
