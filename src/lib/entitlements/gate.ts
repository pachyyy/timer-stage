import { countParticipants, getOwnerEmail, hasAnyRun, hasOpenRun } from '@/lib/db/room-limits'
import { tryConsumeRoomQuota, tryConsumeUserQuota } from '@/lib/db/quota'
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
 * Cue's pricing is now a prepaid-quota model, not subscription tiers (see
 * 03_pachy_panel/docs/ARCHITECTURE.md §8): every room includes this many participants for free;
 * a 4th+ draws from the owner's purchased userQuota. Every signed-in, non-"permanent" room gets
 * the same flat, full feature set — see SEGMENTS_PER_QUOTA_ROOM — the only things actually
 * metered are room count and participant count.
 */
export const FREE_PARTICIPANTS_PER_ROOM = 3
export const SEGMENTS_PER_QUOTA_ROOM = 30

/**
 * "permanent" is the one remaining pachy-core-resolved concept for Cue: a hand-picked, fully
 * uncapped grant (see the panel's seed script) that bypasses quota entirely — unlimited rooms,
 * unlimited participants, never single-use. Everyone else who signs in either hasn't bought
 * anything yet (the starter balance IS the free tier now — see quota.ts's STARTER_ROOM_QUOTA) or
 * has topped up via the panel's admin-API call into stagetimer's own quota ledger.
 */
async function isPermanent(ownerUserId: string | null): Promise<boolean> {
  if (!ownerUserId) return false
  const email = await getOwnerEmail(ownerUserId)
  const entitlement = await getEntitlement(email)
  return entitlement.planKey === 'permanent'
}

/**
 * Room creation. Anonymous creation (no signed-in owner) is deliberately NEVER capped here —
 * quota is an account-scoped economic concept, an anonymous room has no account to bill, and
 * capping it would mean requiring sign-in to create any room at all (the "free = 0 rooms" outcome
 * the tier design originally rejected, and still holds under the quota model). A signed-in
 * account's very first room is free (see quota.ts's STARTER_ROOM_QUOTA) — every one after that
 * spends a purchased credit.
 */
export async function canCreateRoom(owner: { userId: string; email: string } | null): Promise<GateResult> {
  if (!entitlementsEnforced()) return ALLOWED
  if (!owner) return ALLOWED

  const entitlement = await getEntitlement(owner.email)
  if (entitlement.planKey === 'permanent') return ALLOWED

  const ok = await tryConsumeRoomQuota(owner.userId)
  if (ok) return ALLOWED

  return {
    allowed: false,
    entitlement,
    reason: `You're out of room credits. Buy more on /pricing to create another room.`,
  }
}

/**
 * Joining a room as a participant. The limit belongs to the ROOM's owner's account, not the
 * joining person — a viewer never has a plan or balance of their own here. An anonymous
 * (ownerless) room resolves to the flat fallback limit, same as everywhere else an ownerless room
 * needs one, and never touches any quota. The first FREE_PARTICIPANTS_PER_ROOM joiners on any
 * owned room are always free; a 4th+ spends one unit of the owner's userQuota.
 */
export async function canJoinParticipant(roomId: string, ownerUserId: string | null): Promise<GateResult> {
  if (!entitlementsEnforced()) return ALLOWED

  if (!ownerUserId) {
    const entitlement = await getEntitlement(null)
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

  const email = await getOwnerEmail(ownerUserId)
  const entitlement = await getEntitlement(email)
  if (entitlement.planKey === 'permanent') return ALLOWED

  const current = await countParticipants(roomId)
  if (current < FREE_PARTICIPANTS_PER_ROOM) return ALLOWED

  const ok = await tryConsumeUserQuota(ownerUserId, roomId, 1)
  if (ok) return ALLOWED

  return {
    allowed: false,
    entitlement,
    reason: `This room already has its ${FREE_PARTICIPANTS_PER_ROOM} free participants, and the owner is out of participant credits. Buy more on /pricing.`,
  }
}

/** Run history. Every signed-in owner (quota-governed or permanent) now gets full history — the
 * only thing history/export ever distinguished was signed-in vs. anonymous. */
export async function canViewHistory(ownerUserId: string | null): Promise<GateResult> {
  if (!entitlementsEnforced()) return ALLOWED
  if (ownerUserId) return ALLOWED

  const entitlement = await getEntitlement(null)
  return {
    allowed: false,
    entitlement,
    reason: `Run history isn't available for anonymous rooms — sign in before creating a room to get history.`,
  }
}

/** .xlsx export. Same shape as canViewHistory, separate message. */
export async function canExportRun(ownerUserId: string | null): Promise<GateResult> {
  if (!entitlementsEnforced()) return ALLOWED
  if (ownerUserId) return ALLOWED

  const entitlement = await getEntitlement(null)
  return {
    allowed: false,
    entitlement,
    reason: `Exporting isn't available for anonymous rooms — sign in before creating a room to export.`,
  }
}

/**
 * Adding segments ("timers" — the underlying table; the product's own UI calls them "segments").
 * Anonymous rooms keep the old flat fallback cap. Every signed-in room (quota-governed or
 * permanent) gets the same generous flat cap — segment count was never part of what's metered.
 */
export async function canAddSegments(
  ownerUserId: string | null,
  existingCount: number,
  additionalCount: number,
): Promise<GateResult> {
  if (!entitlementsEnforced()) return ALLOWED

  if (!ownerUserId) {
    const entitlement = await getEntitlement(null)
    const cap = entitlement.limits.segmentsPerRoom
    if (cap === null || existingCount + additionalCount <= cap) return ALLOWED
    return {
      allowed: false,
      entitlement,
      reason: `Anonymous rooms allow up to ${cap} segments — sign in before creating a room for more.`,
    }
  }

  if (existingCount + additionalCount <= SEGMENTS_PER_QUOTA_ROOM) return ALLOWED

  const trimHint = existingCount > 0 ? 'Remove one before adding another' : 'Trim your agenda and try again'
  return {
    allowed: false,
    reason: `Rooms allow up to ${SEGMENTS_PER_QUOTA_ROOM} segments. ${trimHint}.`,
  }
}

/**
 * "One room credit = one event": a signed-in, non-permanent room can complete exactly one run.
 * Resuming or restarting WITHIN a still-open run is always fine (`hasOpenRun`) — this only ever
 * blocks opening a genuinely NEW run on a room that already closed one, whether that closure was
 * an explicit "End show" or the automatic 12h-stale rollover (src/lib/history/rollover.ts) —
 * without covering the rollover path too, someone could dodge the lock forever just by never
 * clicking "End show". Anonymous rooms are untouched: quota is an account concept, and locking a
 * room nobody paid for wouldn't make sense.
 */
export async function canStartRun(ownerUserId: string | null, roomId: string): Promise<GateResult> {
  if (!entitlementsEnforced()) return ALLOWED
  if (!ownerUserId) return ALLOWED
  if (await isPermanent(ownerUserId)) return ALLOWED

  if (await hasOpenRun(roomId)) return ALLOWED
  if (!(await hasAnyRun(roomId))) return ALLOWED

  return {
    allowed: false,
    reason: `This room already ran its one event. Create a new room (spends a room credit) for your next one.`,
  }
}
