import { describe, expect, it } from 'vitest'
import {
  checkAnswerRateLimit,
  checkVoteRateLimit,
  DEVICE_COOLDOWN_MS,
  IP_MAX_PER_WINDOW,
  IP_WINDOW_MS,
  QNA_QUESTION_COOLDOWN_MS,
  VOTE_MAX_PER_WINDOW,
} from './rate-limit'

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

describe('checkAnswerRateLimit with a custom cooldown (Q&A questions)', () => {
  const nowMs = 1_000_000

  it('uses the longer cooldown when given one', () => {
    const lastDeviceAnswerAtMs = nowMs - DEVICE_COOLDOWN_MS
    expect(checkAnswerRateLimit({ nowMs, lastDeviceAnswerAtMs, ipAnswersInWindow: 0 })).toEqual({ ok: true })
    expect(
      checkAnswerRateLimit({ nowMs, lastDeviceAnswerAtMs, ipAnswersInWindow: 0, cooldownMs: QNA_QUESTION_COOLDOWN_MS }),
    ).toEqual({ ok: false, retryAfterMs: QNA_QUESTION_COOLDOWN_MS - DEVICE_COOLDOWN_MS })
  })
})

describe('checkVoteRateLimit', () => {
  it('allows votes up to the per-device window cap', () => {
    expect(checkVoteRateLimit(0)).toEqual({ ok: true })
    expect(checkVoteRateLimit(VOTE_MAX_PER_WINDOW - 1)).toEqual({ ok: true })
    expect(checkVoteRateLimit(VOTE_MAX_PER_WINDOW)).toEqual({ ok: false, retryAfterMs: IP_WINDOW_MS })
  })
})
