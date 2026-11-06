import { describe, expect, it } from 'vitest'
import { checkJoinRateLimit, JOIN_MAX_PER_IP_PER_WINDOW, JOIN_WINDOW_MS } from './join'

describe('checkJoinRateLimit', () => {
  it('allows joins under the cap', () => {
    expect(checkJoinRateLimit(0)).toEqual({ ok: true })
    expect(checkJoinRateLimit(JOIN_MAX_PER_IP_PER_WINDOW - 1)).toEqual({ ok: true })
  })

  it('blocks at the cap for one window', () => {
    expect(checkJoinRateLimit(JOIN_MAX_PER_IP_PER_WINDOW)).toEqual({ ok: false, retryAfterMs: JOIN_WINDOW_MS })
  })
})
