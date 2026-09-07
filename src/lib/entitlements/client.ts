import { createClient, type Client } from '@libsql/client'
import { fallbackEntitlement, FALLBACK_LIMITS } from './defaults'
import type { CueLimits, Entitlement } from './types'

const APP_ID = process.env.PACHY_APP_ID ?? 'cue'
const CACHE_TTL_MS = 60_000

// Lazy + memoized: most requests never call getEntitlement at all (only room creation,
// participant join, and history/export routes do), so there's no reason to open a connection at
// module load for every serverless invocation.
let coreClient: Client | null | undefined
function getCoreClient(): Client | null {
  if (coreClient !== undefined) return coreClient
  const url = process.env.PACHY_CORE_URL
  if (!url) {
    coreClient = null
    return coreClient
  }
  const authToken = process.env.PACHY_CORE_READONLY_TOKEN
  coreClient = createClient(authToken ? { url, authToken } : { url })
  return coreClient
}

interface CacheEntry {
  entitlement: Entitlement
  fetchedAtMs: number
}
// Per-process, per-email cache — see docs/ARCHITECTURE.md §6. A serverless instance is
// short-lived, so this mostly collapses the handful of lookups inside one request rather than
// surviving across many; the panel's cache-invalidate call (Phase 3) is what makes an upgrade
// land sooner than the 60s TTL would on its own.
const cache = new Map<string, CacheEntry>()

/**
 * Resolves what plan `email` is on for Cue, reading the shared pachy-core control-plane DB
 * directly and read-only — see docs in 03_pachy_panel/docs/ARCHITECTURE.md §6.
 *
 * `email === null` means there's no identity to resolve at all (an anonymous room has no
 * owner) — that's answered locally with the fallback limits, no network call at all, not an
 * error case.
 *
 * On any DB error, or if PACHY_CORE_URL isn't configured, serves the last cached value for this
 * email if there is one, else the fallback plan. This never throws, and deliberately never blocks
 * a mutation on the core DB's reachability — every limit here is checked at creation/join time
 * only, never during a running show, so the worst case is "a plan-limit check is briefly wrong in
 * one direction," never "the timer stops."
 */
export async function getEntitlement(email: string | null): Promise<Entitlement> {
  if (!email) return fallbackEntitlement('anonymous')

  const normalized = email.trim().toLowerCase()
  const cached = cache.get(normalized)
  if (cached && Date.now() - cached.fetchedAtMs < CACHE_TTL_MS) {
    return cached.entitlement
  }

  const client = getCoreClient()
  if (!client) return cached?.entitlement ?? fallbackEntitlement('fallback')

  try {
    const entitlement = await resolveFromCore(client, normalized)
    cache.set(normalized, { entitlement, fetchedAtMs: Date.now() })
    return entitlement
  } catch (err) {
    console.error('[entitlements] pachy-core lookup failed, serving fallback:', err)
    return cached?.entitlement ?? fallbackEntitlement('fallback')
  }
}

/** Test-only: clears the in-process cache so a test can assert on a fresh lookup. */
export function _clearEntitlementCacheForTests() {
  cache.clear()
}

export interface PublicPlan {
  key: string
  name: string
  limits: CueLimits
}

// Mirrors the free/mid/top rows in 03_pachy_panel/scripts/seed.ts, minus "permanent" — that tier
// is for manual VIP/lifetime grants (see the seed script's own comment), not something to
// advertise on a public pricing page. Served only if the core DB is unreachable, so /pricing
// always renders something rather than an empty page.
const FALLBACK_PUBLIC_PLANS: PublicPlan[] = [
  { key: 'free', name: 'Free', limits: { activeRooms: 1, history: false, export: false, participantsPerRoom: 10 } },
  { key: 'mid', name: 'Mid', limits: { activeRooms: 2, history: true, export: false, participantsPerRoom: 20 } },
  { key: 'top', name: 'Top', limits: { activeRooms: 5, history: true, export: true, participantsPerRoom: 50 } },
]

/** Every publicly-listed plan for Cue, cheapest first — the data source for /pricing. Not
 * per-email, so it isn't cached the same way getEntitlement is (this is called once per page
 * render, not per-request-in-a-hot-path); a fresh query each time is fine. */
export async function listPublicPlans(): Promise<PublicPlan[]> {
  const client = getCoreClient()
  if (!client) return FALLBACK_PUBLIC_PLANS

  try {
    const result = await client.execute({
      sql: `select key, name, limits from plans where app_id = ? and key != 'permanent' order by rank asc`,
      args: [APP_ID],
    })
    if (result.rows.length === 0) return FALLBACK_PUBLIC_PLANS
    return result.rows.map((row) => ({
      key: String(row.key),
      name: String(row.name),
      limits: parseLimits(row.limits),
    }))
  } catch (err) {
    console.error('[entitlements] listPublicPlans failed, serving fallback:', err)
    return FALLBACK_PUBLIC_PLANS
  }
}

async function resolveFromCore(client: Client, email: string): Promise<Entitlement> {
  const now = Date.now()

  const grantResult = await client.execute({
    sql: `select g.status as status, g.expires_at as expires_at, p.key as key, p.name as name, p.limits as limits
          from grants g join plans p on p.id = g.plan_id
          where g.app_id = ? and g.email = ?
          limit 1`,
    args: [APP_ID, email],
  })
  const grantRow = grantResult.rows[0]
  const expiresAt = grantRow?.expires_at
  const isLive = !expiresAt || Number(expiresAt) > now
  if (grantRow && grantRow.status === 'active' && isLive) {
    return {
      planKey: String(grantRow.key),
      planName: String(grantRow.name),
      limits: parseLimits(grantRow.limits),
      source: 'grant',
    }
  }

  const defaultResult = await client.execute({
    sql: `select key, name, limits from plans where app_id = ? and is_default = 1 limit 1`,
    args: [APP_ID],
  })
  const defaultRow = defaultResult.rows[0]
  if (defaultRow) {
    return {
      planKey: String(defaultRow.key),
      planName: String(defaultRow.name),
      limits: parseLimits(defaultRow.limits),
      source: 'default',
    }
  }

  // No app/plans registered in pachy-core at all yet — behave exactly as if unconfigured.
  return fallbackEntitlement('fallback')
}

function parseLimits(raw: unknown): CueLimits {
  try {
    const obj = (typeof raw === 'string' ? JSON.parse(raw) : raw) as Partial<CueLimits> | null
    return {
      activeRooms: obj?.activeRooms ?? null,
      history: !!obj?.history,
      export: !!obj?.export,
      participantsPerRoom: obj?.participantsPerRoom ?? null,
    }
  } catch {
    return FALLBACK_LIMITS
  }
}
