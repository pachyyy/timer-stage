/**
 * Anonymous-answer spam protection, as a pure decision over what the answers route reads back
 * from `chorus_answers` (no separate rate-limit store needed).
 *
 * Two layers, because neither is enough alone:
 *  - per device: a short cooldown between answers from the same `deviceKey`. This is what a real
 *    person mashing Send hits — but the key comes from the browser, so a script can rotate it.
 *  - per network: a cap per `ipHash` per minute. Deliberately generous, because a whole venue on
 *    one Wi-Fi often shares a single public IP — a tight cap here would block a real audience.
 */

export const DEVICE_COOLDOWN_MS = 3_000
export const IP_WINDOW_MS = 60_000
export const IP_MAX_PER_WINDOW = 300

export interface RateLimitInput {
  nowMs: number
  /** createdAtMs of this device's most recent answer in this session, or null. */
  lastDeviceAnswerAtMs: number | null
  /** Answers from this ipHash in this session within the last IP_WINDOW_MS. */
  ipAnswersInWindow: number
}

export type RateLimitResult = { ok: true } | { ok: false; retryAfterMs: number }

export function checkAnswerRateLimit(input: RateLimitInput): RateLimitResult {
  if (input.lastDeviceAnswerAtMs !== null) {
    const sinceLast = input.nowMs - input.lastDeviceAnswerAtMs
    if (sinceLast < DEVICE_COOLDOWN_MS) return { ok: false, retryAfterMs: DEVICE_COOLDOWN_MS - sinceLast }
  }
  if (input.ipAnswersInWindow >= IP_MAX_PER_WINDOW) return { ok: false, retryAfterMs: IP_WINDOW_MS }
  return { ok: true }
}
