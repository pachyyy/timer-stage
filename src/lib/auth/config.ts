/**
 * Whether Google sign-in is actually wired up. Auth.js's Google provider (see src/auth.ts) reads
 * `AUTH_GOOGLE_ID`/`AUTH_GOOGLE_SECRET` itself, and `AUTH_SECRET` is required for Auth.js to sign
 * anything at all — CLAUDE.md's "Google sign-in is simply absent if its three AUTH_* vars are
 * unset" refers to exactly these three. Used to relax the (app) group's login gate and the
 * login-required room-creation check in local dev with no env vars set, per CLAUDE.md's promise
 * that no environment variables are required for local dev.
 */
export function isAuthConfigured(): boolean {
  return Boolean(process.env.AUTH_SECRET && process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET)
}
