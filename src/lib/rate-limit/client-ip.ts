import { createHash } from 'crypto'
import type { NextRequest } from 'next/server'

/**
 * The client's network identity for rate limiting, hashed with a scope (a room id or Chorus code)
 * so the stored value can't be joined across rooms/sessions or reversed into an IP. Vercel puts
 * the real client IP first in x-forwarded-for.
 */
export function hashClientIp(req: NextRequest, scope: string): string {
  const forwarded = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
  const ip = forwarded || req.headers.get('x-real-ip') || 'unknown'
  return createHash('sha256').update(`${ip}:${scope}`).digest('hex').slice(0, 32)
}
