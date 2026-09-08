import { and, eq, gt, gte, sql } from 'drizzle-orm'
import { db } from './client'
import { accountQuota, quotaLedger, users } from './schema'

/** A brand-new account's starting balance — this IS the product's free tier now: everyone gets
 * one room, with the standard 3-free-participants baseline (see FREE_PARTICIPANTS_PER_ROOM in
 * gate.ts), before they need to buy anything. */
export const STARTER_ROOM_QUOTA = 1
export const STARTER_USER_QUOTA = 0

export interface QuotaBalance {
  roomQuota: number
  userQuota: number
}

function toBalance(row: { roomQuota: number; userQuota: number } | undefined): QuotaBalance {
  return row ? { roomQuota: row.roomQuota, userQuota: row.userQuota } : { roomQuota: 0, userQuota: 0 }
}

/**
 * Lazily creates the starter-balance row on first touch — there's no separate "sign up" event to
 * hook this into, so the first time anything needs to know an account's balance is as good a time
 * as any. Safe under a create race: if two requests both try to insert at once, the loser's
 * insert fails on the primary key and it just re-reads what the winner wrote.
 */
export async function getOrCreateAccountQuota(userId: string): Promise<QuotaBalance> {
  const [existing] = await db.select().from(accountQuota).where(eq(accountQuota.userId, userId)).limit(1)
  if (existing) return toBalance(existing)

  try {
    await db.insert(accountQuota).values({
      userId,
      roomQuota: STARTER_ROOM_QUOTA,
      userQuota: STARTER_USER_QUOTA,
      updatedAt: Date.now(),
    })
  } catch {
    // Lost a create race — someone else's insert won; fall through and read theirs.
  }
  const [row] = await db.select().from(accountQuota).where(eq(accountQuota.userId, userId)).limit(1)
  return toBalance(row)
}

/**
 * The actual race-safe enforcement for spending a room credit — a conditional atomic UPDATE, not
 * a read-then-write: `WHERE roomQuota > 0` means two simultaneous attempts can't both succeed off
 * a balance of 1 (whichever's UPDATE commits first "wins" the row; the other affects zero rows).
 * Any earlier balance check in gate.ts is just a friendly early message; this is what's real.
 *
 * `roomId` is null here because this is called BEFORE the room it's paying for exists (see
 * canCreateRoom) — there's a small, accepted window where this succeeds but the subsequent
 * `createRoom()` insert fails for some unrelated reason, spending a credit with nothing to show
 * for it. Not solved with a two-phase commit here — Turso/libSQL inserts are reliable enough that
 * this is a fine trade for the simplicity, for now.
 */
export async function tryConsumeRoomQuota(userId: string): Promise<boolean> {
  await getOrCreateAccountQuota(userId)
  const now = Date.now()
  const result = await db
    .update(accountQuota)
    .set({ roomQuota: sql`${accountQuota.roomQuota} - 1`, updatedAt: now })
    .where(and(eq(accountQuota.userId, userId), gt(accountQuota.roomQuota, 0)))

  const ok = (result.rowsAffected ?? 0) > 0
  if (ok) {
    await db.insert(quotaLedger).values({ userId, atMs: now, kind: 'room_consume', delta: -1, roomId: null, note: null })
  }
  return ok
}

/** Same atomic-conditional pattern as tryConsumeRoomQuota, for participants beyond the free 3 on
 * one room. `roomId` is known here (the room already exists), so the ledger entry gets it. */
export async function tryConsumeUserQuota(userId: string, roomId: string, count = 1): Promise<boolean> {
  await getOrCreateAccountQuota(userId)
  const now = Date.now()
  const result = await db
    .update(accountQuota)
    .set({ userQuota: sql`${accountQuota.userQuota} - ${count}`, updatedAt: now })
    .where(and(eq(accountQuota.userId, userId), gte(accountQuota.userQuota, count)))

  const ok = (result.rowsAffected ?? 0) > 0
  if (ok) {
    await db.insert(quotaLedger).values({ userId, atMs: now, kind: 'user_consume', delta: -count, roomId, note: null })
  }
  return ok
}

/**
 * Adds credit — what the panel's admin-API top-up calls. Deltas can be zero (to top up only one
 * of the two pools) but not negative; a correction is a manual ledger note, not this function.
 * Looks the account up by email since that's the identity the panel/admin thinks in — returns
 * null if this email has never signed into Cue, since accountQuota is keyed on our own `userId`
 * and there's nothing to attach a balance to yet (see the admin route for how that's surfaced).
 */
export async function grantQuotaByEmail(
  email: string,
  roomDelta: number,
  userDelta: number,
  note: string | null,
): Promise<(QuotaBalance & { userId: string }) | null> {
  const [user] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, email.trim().toLowerCase()))
    .limit(1)
  if (!user) return null

  await getOrCreateAccountQuota(user.id)
  const now = Date.now()
  await db
    .update(accountQuota)
    .set({
      roomQuota: sql`${accountQuota.roomQuota} + ${roomDelta}`,
      userQuota: sql`${accountQuota.userQuota} + ${userDelta}`,
      updatedAt: now,
    })
    .where(eq(accountQuota.userId, user.id))

  if (roomDelta !== 0) {
    await db.insert(quotaLedger).values({ userId: user.id, atMs: now, kind: 'room_grant', delta: roomDelta, roomId: null, note })
  }
  if (userDelta !== 0) {
    await db.insert(quotaLedger).values({ userId: user.id, atMs: now, kind: 'user_grant', delta: userDelta, roomId: null, note })
  }

  const [row] = await db.select().from(accountQuota).where(eq(accountQuota.userId, user.id)).limit(1)
  return { userId: user.id, ...toBalance(row) }
}

/** Read-only lookup by email, for the admin API's GET and for surfacing a balance in the UI. */
export async function getQuotaByEmail(email: string): Promise<(QuotaBalance & { userId: string }) | null> {
  const [user] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, email.trim().toLowerCase()))
    .limit(1)
  if (!user) return null

  const balance = await getOrCreateAccountQuota(user.id)
  return { userId: user.id, ...balance }
}
