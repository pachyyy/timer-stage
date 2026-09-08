import { timingSafeEqual } from 'node:crypto'
import { NextRequest, NextResponse } from 'next/server'

/**
 * Guards every `/api/admin/v1/*` route — see 03_pachy_panel/docs/ARCHITECTURE.md §7. Returns 404
 * (not 401/403) on any mismatch, including `ADMIN_API_TOKEN` being unset, so the surface isn't
 * advertised to anyone probing without the token.
 *
 * `timingSafeEqual` needs equal-length buffers, so length is checked first — leaking "the length
 * didn't match" is fine, it says nothing about *which* character was wrong the way a naive `===`
 * would via early-exit timing.
 */
export function checkAdminApiAuth(req: NextRequest): NextResponse | null {
  const expected = process.env.ADMIN_API_TOKEN
  const header = req.headers.get('authorization')
  const provided = header?.startsWith('Bearer ') ? header.slice('Bearer '.length) : null

  if (!expected || !provided) return notFound()

  const expectedBuf = Buffer.from(expected)
  const providedBuf = Buffer.from(provided)
  if (expectedBuf.length !== providedBuf.length || !timingSafeEqual(expectedBuf, providedBuf)) {
    return notFound()
  }

  return null
}

function notFound(): NextResponse {
  return NextResponse.json({ error: 'not found' }, { status: 404 })
}
