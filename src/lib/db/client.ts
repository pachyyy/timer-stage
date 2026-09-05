import { drizzle } from 'drizzle-orm/libsql'
import { createClient } from '@libsql/client'
import * as schema from './schema'

/**
 * In development, TURSO_DATABASE_URL can simply be left unset — the libSQL client falls back to
 * a local `file:local.db`, so `npm run dev` uses a real local SQLite file with zero network
 * dependency. In production it must point at a Turso database over HTTPS.
 *
 * We deliberately do NOT apply that same fallback when running on Vercel: Vercel's filesystem is
 * ephemeral and not shared across function instances, so a silent fallback there wouldn't reuse
 * the DB migrations were applied to — it would create a fresh, empty, tableless SQLite file per
 * invocation, and every query would fail with a confusing "no such table" error instead of a
 * clear one. `VERCEL` is set automatically by the platform on every deployment.
 */
const isVercel = !!process.env.VERCEL
const url = process.env.TURSO_DATABASE_URL ?? (isVercel ? undefined : 'file:local.db')
const authToken = process.env.TURSO_AUTH_TOKEN

if (!url) {
  throw new Error(
    'TURSO_DATABASE_URL is not set. On Vercel, add it (and TURSO_AUTH_TOKEN) in ' +
      'Project Settings → Environment Variables, then redeploy — see .env.example.',
  )
}

const client = createClient(authToken ? { url, authToken } : { url })

export const db = drizzle(client, { schema })
