import { drizzle } from 'drizzle-orm/libsql'
import { createClient } from '@libsql/client'
import * as schema from './schema'

/**
 * In development, TURSO_DATABASE_URL can simply be `file:local.db` — the libSQL client accepts
 * a local file URL directly, so `npm run dev` uses a real local SQLite file with zero network
 * dependency. In production it points at a Turso database over HTTPS. This is what lets us keep
 * the SQLite mental model without hitting Vercel's ephemeral-filesystem problem in prod.
 */
const url = process.env.TURSO_DATABASE_URL ?? 'file:local.db'
const authToken = process.env.TURSO_AUTH_TOKEN

const client = createClient(authToken ? { url, authToken } : { url })

export const db = drizzle(client, { schema })
