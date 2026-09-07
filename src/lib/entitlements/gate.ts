import { countActiveOwnedRooms, countParticipants, getOwnerEmail } from '@/lib/db/room-limits'
import { getEntitlement } from './client'
import type { Entitlement } from './types'

/**
 * Kill switch — see docs/ARCHITECTURE.md §12 Phase 2. Every gate below is a no-op (always
 * allowed) until this is flipped on, so the checks can ship dark, get watched against real
 * traffic, and only then get turned on for real.
 */
export function entitlementsEnforced(): boolean {
  return process.env.ENTITLEMENTS_ENFORCED === 'true'
}

export interface GateResult {
  allowed: boolean
  /** Present only when allowed is false — safe to show directly to the person who hit the cap. */
  reason?: string
  entitlement?: Entitlement
}

const ALLOWED: GateResult = { allowed: true }

/**
 * Room creation. Anonymous creation (no signed-in owner) is deliberately NEVER capped here —
 * plans are resolved by email, an anonymous room has none, and gating anonymous creation would
 * mean either inventing a fingerprint/IP-based identity (unreliable, out of scope) or requiring
 * sign-in to create any room at all, which is exactly the "free = 0 rooms" outcome
 * docs/ARCHITECTURE.md §8 rejected. A free-tier cap only ever binds once someone signs in.
 */
export async function canCreateRoom(owner: { userId: string; email: string } | null): Promise<GateResult> {
  if (!entitlementsEnforced()) return ALLOWED
  if (!owner) return ALLOWED

  const entitlement = await getEntitlement(owner.email)
  const cap = entitlement.limits.activeRooms
  if (cap === null) return ALLOWED

  const activeCount = await countActiveOwnedRooms(owner.userId)
  if (activeCount < cap) return ALLOWED

  return {
    allowed: false,
    entitlement,
    reason: `Your ${entitlement.planName} plan allows ${cap} active room${cap === 1 ? '' : 's'}. Archive one from My Rooms, or see /pricing to upgrade.`,
  }
}

/**
 * Joining a room as a participant. The limit belongs to the ROOM's owner's plan, not the joining
 * person — a viewer never has a plan of their own here. An anonymous (ownerless) room resolves to
 * the fallback/free limits, same as everywhere else an ownerless room needs a plan.
 */
export async function canJoinParticipant(roomId: string, ownerUserId: string | null): Promise<GateResult> {
  if (!entitlementsEnforced()) return ALLOWED

  const ownerEmail = await getOwnerEmail(ownerUserId)
  const entitlement = await getEntitlement(ownerEmail)
  const cap = entitlement.limits.participantsPerRoom
  if (cap === null) return ALLOWED

  const current = await countParticipants(roomId)
  if (current < cap) return ALLOWED

  return {
    allowed: false,
    entitlement,
    reason: `This room is full — its plan allows ${cap} participant${cap === 1 ? '' : 's'}.`,
  }
}

/** Run history — planned-vs-actual, the timeline, the adjustments list. Gated on the room
 * OWNER's plan, same reasoning as canJoinParticipant. */
export async function canViewHistory(ownerUserId: string | null): Promise<GateResult> {
  if (!entitlementsEnforced()) return ALLOWED

  const ownerEmail = await getOwnerEmail(ownerUserId)
  const entitlement = await getEntitlement(ownerEmail)
  if (entitlement.limits.history) return ALLOWED

  return {
    allowed: false,
    entitlement,
    reason: `Run history isn't included on the ${entitlement.planName} plan — see /pricing to upgrade.`,
  }
}

/** .xlsx export. Same shape as canViewHistory, separate limit key. */
export async function canExportRun(ownerUserId: string | null): Promise<GateResult> {
  if (!entitlementsEnforced()) return ALLOWED

  const ownerEmail = await getOwnerEmail(ownerUserId)
  const entitlement = await getEntitlement(ownerEmail)
  if (entitlement.limits.export) return ALLOWED

  return {
    allowed: false,
    entitlement,
    reason: `Exporting isn't included on the ${entitlement.planName} plan — see /pricing to upgrade.`,
  }
}
