import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { estimateClockOffset } from './clock'

/**
 * Simulates 5 NTP-style round trips with deliberately asymmetric RTT and a distinct offset per
 * sample. estimateClockOffset should pick the lowest-RTT sample, since RTT asymmetry is the
 * dominant error term.
 */
describe('estimateClockOffset', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('selects the offset from the lowest-RTT sample', async () => {
    const samples = [
      { rttMs: 50, offsetMs: 120 },
      { rttMs: 10, offsetMs: 100 }, // lowest RTT — this one should win
      { rttMs: 80, offsetMs: 200 },
      { rttMs: 30, offsetMs: 90 },
      { rttMs: 60, offsetMs: 150 },
    ]
    let callIndex = 0

    vi.stubGlobal(
      'fetch',
      vi.fn(() => {
        const { rttMs, offsetMs } = samples[callIndex++]
        const t0 = Date.now()
        return new Promise((resolve) => {
          setTimeout(() => {
            // Solve for the server timestamp t1 that makes the client's midpoint formula
            // (offsetMs = t1 - (t0+t2)/2, with t2 = t0+rttMs) come out to exactly `offsetMs`.
            const t1 = t0 + rttMs / 2 + offsetMs
            resolve({ json: async () => ({ nowMs: t1 }) } as Response)
          }, rttMs)
        })
      }),
    )

    const resultPromise = estimateClockOffset(5)
    for (const s of samples) {
      await vi.advanceTimersByTimeAsync(s.rttMs)
    }
    const result = await resultPromise

    expect(result.rttMs).toBeCloseTo(10, 0)
    expect(result.offsetMs).toBeCloseTo(100, 0)
  })

  it('tolerates a failed sample as long as one succeeds', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn()
        .mockRejectedValueOnce(new Error('network error'))
        .mockImplementation(() => {
          const t0 = Date.now()
          return Promise.resolve({ json: async () => ({ nowMs: t0 + 42 }) } as Response)
        }),
    )

    const result = await estimateClockOffset(2)
    expect(result.offsetMs).toBeCloseTo(42, 0)
  })
})
