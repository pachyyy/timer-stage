import { getTranslations } from 'next-intl/server'
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
 * Clepsy's pricing is now a prepaid-quota model, not subscription tiers (see
 * 03_pachy_panel/docs/ARCHITECTURE.md §8): every room includes this many participants for free;
 * a 4th+ draws from the owner's purchased userQuota. Every signed-in, non-"permanent" room gets
 * the same flat, full feature set — see SEGMENTS_PER_QUOTA_ROOM — the only things actually
 * metered are room count and participant count.
 */
export const FREE_PARTICIPANTS_PER_ROOM = 3
export const SEGMENTS_PER_QUOTA_ROOM = 30

/**
 * "permanent" is the one remaining pachy-core-resolved concept for Clepsy: a hand-picked, fully
 * uncapped grant (see the panel's seed script) that bypasses quota entirely — unlimited rooms,
 * unlimited participants, never single-use. Everyone else who signs in starts at a zero balance
 * (see quota.ts's STARTER_ROOM_QUOTA) and has to be topped up via the panel's admin-API call into
 * stagetimer's own quota ledger before they can create a room.
 */
async function isPermanent(ownerUserId: string | null): Promise<boolean> {
  if (!ownerUserId) return false
  const email = await getOwnerEmail(ownerUserId)
  const entitlement = await getEntitlement(email)
  return entitlement.planKey === 'permanent'
}

/**
 * Room creation. `POST /api/rooms` now requires a signed-in session before it ever calls this
 * (see that route), so `owner` is null here only when auth isn't configured at all (no AUTH_*
 * env vars — local dev keeps working with zero env vars). In that case creation is deliberately
 * NEVER capped — quota is an account-scoped economic concept, and there's no account to bill. A
 * signed-in account starts at zero room quota (see quota.ts's STARTER_ROOM_QUOTA) — every room,
 * including the first, spends a purchased credit.
 */
export async function canCreateRoom(owner: { userId: string; email: string } | null): Promise<GateResult> {
  if (!entitlementsEnforced()) return ALLOWED
  if (!owner) return ALLOWED

  const entitlement = await getEntitlement(owner.email)
  if (entitlement.planKey === 'permanent') return ALLOWED

  const ok = await tryConsumeRoomQuota(owner.userId)
  if (ok) return ALLOWED

  const t = await getTranslations('gate')
  return { allowed: false, entitlement, reason: t('outOfRoomCredits') }
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
    const t = await getTranslations('gate')
    return { allowed: false, entitlement, reason: t('roomFull', { cap }) }
  }

  const email = await getOwnerEmail(ownerUserId)
  const entitlement = await getEntitlement(email)
  if (entitlement.planKey === 'permanent') return ALLOWED

  const current = await countParticipants(roomId)
  if (current < FREE_PARTICIPANTS_PER_ROOM) return ALLOWED

  const ok = await tryConsumeUserQuota(ownerUserId, roomId, 1)
  if (ok) return ALLOWED

  const t = await getTranslations('gate')
  return {
    allowed: false,
    entitlement,
    reason: t('participantCreditsOut', { free: FREE_PARTICIPANTS_PER_ROOM }),
  }
}

/** Run history. Every signed-in owner (quota-governed or permanent) now gets full history — the
 * only thing history/export ever distinguished was signed-in vs. anonymous. */
export async function canViewHistory(ownerUserId: string | null): Promise<GateResult> {
  if (!entitlementsEnforced()) return ALLOWED
  if (ownerUserId) return ALLOWED

  const entitlement = await getEntitlement(null)
  const t = await getTranslations('gate')
  return { allowed: false, entitlement, reason: t('historyAnonBlocked') }
}

/** .xlsx export. Same shape as canViewHistory, separate message. */
export async function canExportRun(ownerUserId: string | null): Promise<GateResult> {
  if (!entitlementsEnforced()) return ALLOWED
  if (ownerUserId) return ALLOWED

  const entitlement = await getEntitlement(null)
  const t = await getTranslations('gate')
  return { allowed: false, entitlement, reason: t('exportAnonBlocked') }
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
    const t = await getTranslations('gate')
    return { allowed: false, entitlement, reason: t('segmentsAnonCap', { cap }) }
  }

  if (existingCount + additionalCount <= SEGMENTS_PER_QUOTA_ROOM) return ALLOWED

  const t = await getTranslations('gate')
  const trimHint = existingCount > 0 ? t('trimHintRemove') : t('trimHintTrim')
  return {
    allowed: false,
    reason: t('segmentsCap', { cap: SEGMENTS_PER_QUOTA_ROOM, trimHint }),
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

  const t = await getTranslations('gate')
  return { allowed: false, reason: t('oneEventPerRoom') }
}
