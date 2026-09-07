import type { CueLimits, Entitlement } from './types'

/**
 * Mirrors the "free" plan's limits as seeded in 03_pachy_panel/scripts/seed.ts. Used in two
 * situations, both deliberately without a network call: there's no email to resolve at all (an
 * anonymous room has no owner — 'anonymous'), or the core control-plane DB is unreachable and
 * nothing is cached yet ('fallback', see client.ts). The two copies of these numbers (here and
 * in the panel's seed script) are independent by necessity — this app only has a read-only
 * connection to that database's *data*, not its schema — so if free's limits change there,
 * update this constant too.
 */
export const FALLBACK_LIMITS: CueLimits = {
  activeRooms: 1,
  history: false,
  export: false,
  participantsPerRoom: 10,
}

export function fallbackEntitlement(source: 'anonymous' | 'fallback'): Entitlement {
  return { planKey: 'free', planName: 'Free', limits: FALLBACK_LIMITS, source }
}
