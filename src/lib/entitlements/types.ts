/**
 * The shape of a Cue plan's `limits` JSON blob, as defined in 03_pachy_panel's `plans` table
 * (that repo owns the shape; this file is Cue's own copy of the contract, per
 * docs/ARCHITECTURE.md §6 — "a small shared module, copied into each app for now"). `null` on a
 * numeric field means "no cap" — used by the "permanent" tier.
 */
export interface CueLimits {
  activeRooms: number | null
  history: boolean
  export: boolean
  participantsPerRoom: number | null
}

export type EntitlementSource = 'grant' | 'default' | 'anonymous' | 'fallback'

export interface Entitlement {
  planKey: string
  planName: string
  limits: CueLimits
  /** 'grant' = an active grant in pachy-core. 'default' = no grant, resolved to the app's
   * isDefault plan. 'anonymous' = no email to resolve at all (never hit the DB). 'fallback' =
   * the core DB was unreachable and nothing was cached — see client.ts. */
  source: EntitlementSource
}
