import { NextResponse } from 'next/server'

/**
 * Reference clock for NTP-style offset estimation (see src/lib/sync/clock.ts). Must never be
 * cached — a cached timestamp here would corrupt every client's clock offset — and should stay
 * pinned to a single region so all clients sync against the same physical clock rather than
 * whichever edge happened to answer. Region pinning is done at the platform level (see the
 * `regions` field in vercel.json) rather than via the (deprecated) `preferredRegion` route
 * segment config.
 */
export const dynamic = 'force-dynamic'

export async function GET() {
  return NextResponse.json(
    { nowMs: Date.now() },
    { headers: { 'Cache-Control': 'no-store' } },
  )
}
