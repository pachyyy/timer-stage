import NextAuth from 'next-auth'
import Google from 'next-auth/providers/google'
import { DrizzleAdapter } from '@auth/drizzle-adapter'
import { db } from '@/lib/db/client'
import { accounts, sessions, users, verificationTokens } from '@/lib/db/schema'

/**
 * Optional and additive: nothing here is required for the app to work. Anonymous room creation
 * and the controller/viewer token model (src/lib/auth/tokens.ts, guard.ts) are unaffected whether
 * or not anyone ever signs in — this only gives a signed-in user a `rooms.ownerUserId` link for
 * cross-device control and a cross-room history view. Viewers and joined participants never see
 * a sign-in prompt anywhere; this is exclusively for the controller side.
 *
 * Database sessions (not JWT) — every request already touches the DB via checkRoomAccess, and a
 * DB-backed session means `signOut()` (or deleting the row) actually revokes access immediately,
 * unlike a JWT that stays valid until it expires. This also means no `middleware.ts` is needed or
 * wanted: that would force the Edge runtime, which doesn't support database sessions here.
 */
export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: DrizzleAdapter(db, {
    usersTable: users,
    accountsTable: accounts,
    sessionsTable: sessions,
    verificationTokensTable: verificationTokens,
  }),
  providers: [Google],
  session: { strategy: 'database' },
  pages: {
    // Skip Auth.js's default sign-in page — every entry point here starts the Google flow
    // directly from a button (see src/components/auth-buttons.tsx), there's no form to render.
    signIn: '/',
  },
})
