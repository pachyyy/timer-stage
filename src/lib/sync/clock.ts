/**
 * NTP-style clock offset estimation against our own `/api/time` endpoint.
 *
 * We never trust `Date.now()` directly for rendering the timer: instead we estimate the offset
 * between this device's clock and the server's, then compute a "synced now" using the monotonic
 * `performance.now()` clock plus that offset. Using the monotonic clock (rather than re-reading
 * `Date.now()` each frame) matters because system clock corrections (NTP step, user changing the
 * clock, DST edge cases) would otherwise make the on-screen timer visibly jump mid-show.
 */

export interface ClockSample {
  offsetMs: number
  rttMs: number
}

const SAMPLE_COUNT = 5

async function takeSample(): Promise<ClockSample> {
  const t0 = Date.now()
  const res = await fetch('/api/time', { cache: 'no-store' })
  const t2 = Date.now()
  const { nowMs: t1 } = (await res.json()) as { nowMs: number }
  const rttMs = t2 - t0
  // Assume symmetric network latency: the server's timestamp was taken roughly at the midpoint
  // of our round trip.
  const offsetMs = t1 - (t0 + t2) / 2
  return { offsetMs, rttMs }
}

/**
 * Take several sequential samples (not parallel — concurrent requests contend for the same
 * connection and inflate RTT) and keep the lowest-RTT one, since round-trip asymmetry is the
 * dominant error term and the fastest sample is the most trustworthy.
 */
export async function estimateClockOffset(sampleCount = SAMPLE_COUNT): Promise<ClockSample> {
  let best: ClockSample | null = null
  for (let i = 0; i < sampleCount; i++) {
    try {
      const sample = await takeSample()
      if (!best || sample.rttMs < best.rttMs) best = sample
    } catch {
      // ignore a failed sample; we may still have an earlier successful one
    }
  }
  if (!best) throw new Error('clock sync: all samples failed')
  return best
}

/**
 * A small stateful holder for the current best offset estimate, with a monotonic "synced now".
 * Call `resync()` periodically (on an interval, on visibility change, on transport reconnect).
 */
export class SyncedClock {
  private offsetMs = 0
  private synced = false

  /** Best-effort estimate of the current server time, in epoch ms. */
  now(): number {
    return performance.timeOrigin + performance.now() + this.offsetMs
  }

  get isSynced(): boolean {
    return this.synced
  }

  get currentOffsetMs(): number {
    return this.offsetMs
  }

  async resync(sampleCount = SAMPLE_COUNT): Promise<ClockSample> {
    const sample = await estimateClockOffset(sampleCount)
    this.offsetMs = sample.offsetMs
    this.synced = true
    return sample
  }
}
