import { describe, expect, it } from 'vitest'
import { shouldRolloverRun, STALE_RUN_MS } from './rollover'

describe('shouldRolloverRun', () => {
  it('never rolls over a run with no prior events', () => {
    expect(shouldRolloverRun(null, Date.now())).toBe(false)
  })

  it('does not roll over just under the threshold', () => {
    const lastEventAtMs = 0
    expect(shouldRolloverRun(lastEventAtMs, STALE_RUN_MS - 1)).toBe(false)
  })

  it('rolls over just past the threshold', () => {
    const lastEventAtMs = 0
    expect(shouldRolloverRun(lastEventAtMs, STALE_RUN_MS + 1)).toBe(true)
  })
})
