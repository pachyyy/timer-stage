/**
 * Join-flood protection for `POST /api/rooms/[roomId]/participants`, as a pure decision over a
 * count read back from `participants` (no separate rate-limit store; in-memory limits don't
 * survive across serverless instances).
 *
 * This matters for billing more than for load: past the room's free participants, every join
 * spends one of the host's participant credits (canJoinParticipant), and joining needs nothing
 * but the room code. The cap is per network per room, and deliberately generous, because a
 * venue's whole crew is often behind one public IP.
 */
export const JOIN_WINDOW_MS = 10 * 60_000
export const JOIN_MAX_PER_IP_PER_WINDOW = 30

export type JoinRateLimitResult = { ok: true } | { ok: false; retryAfterMs: number }

/** `joinsInWindow` = joins to this room from this ipHash within the last JOIN_WINDOW_MS. */
export function checkJoinRateLimit(joinsInWindow: number): JoinRateLimitResult {
  if (joinsInWindow >= JOIN_MAX_PER_IP_PER_WINDOW) return { ok: false, retryAfterMs: JOIN_WINDOW_MS }
  return { ok: true }
}
