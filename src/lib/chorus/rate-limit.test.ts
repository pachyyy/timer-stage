import { describe, expect, it } from 'vitest'
import { checkAnswerRateLimit, DEVICE_COOLDOWN_MS, IP_MAX_PER_WINDOW, IP_WINDOW_MS } from './rate-limit'

describe('checkAnswerRateLimit', () => {
  const nowMs = 1_000_000

  it('allows a first answer', () => {
    expect(checkAnswerRateLimit({ nowMs, lastDeviceAnswerAtMs: null, ipAnswersInWindow: 0 })).toEqual({ ok: true })
  })

  it('enforces the per-device cooldown and reports the remaining wait', () => {
    expect(checkAnswerRateLimit({ nowMs, lastDeviceAnswerAtMs: nowMs - 1_000, ipAnswersInWindow: 0 })).toEqual({
      ok: false,
      retryAfterMs: DEVICE_COOLDOWN_MS - 1_000,
    })
    expect(
      checkAnswerRateLimit({ nowMs, lastDeviceAnswerAtMs: nowMs - DEVICE_COOLDOWN_MS, ipAnswersInWindow: 0 }),
    ).toEqual({ ok: true })
  })

  it('caps answers per network per window', () => {
    expect(checkAnswerRateLimit({ nowMs, lastDeviceAnswerAtMs: null, ipAnswersInWindow: IP_MAX_PER_WINDOW })).toEqual({
      ok: false,
      retryAfterMs: IP_WINDOW_MS,
    })
    expect(checkAnswerRateLimit({ nowMs, lastDeviceAnswerAtMs: null, ipAnswersInWindow: IP_MAX_PER_WINDOW - 1 })).toEqual({
      ok: true,
    })
  })
})
