const FALLBACK = '/dashboard'

/**
 * Validates a `callbackUrl` query param before handing it to `signIn`/`redirect` — an open
 * redirect otherwise, since the query string is fully attacker-controlled. Only a same-origin,
 * root-relative path ("/x") is allowed; anything else (protocol-relative "//evil.com", an
 * absolute "https://…" URL, "javascript:", or a missing/empty value) falls back to the
 * post-login destination.
 */
export function safeCallbackUrl(raw: string | null | undefined): string {
  if (!raw) return FALLBACK
  if (!raw.startsWith('/') || raw.startsWith('//')) return FALLBACK
  return raw
}
