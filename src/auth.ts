import NextAuth from 'next-auth'
import Google from 'next-auth/providers/google'
import { DrizzleAdapter } from '@auth/drizzle-adapter'
import { db } from '@/lib/db/client'
import { accounts, sessions, users, verificationTokens } from '@/lib/db/schema'

/**
 * Optional and additive when configured at all (see isAuthConfigured, src/lib/auth/config.ts):
 * with no AUTH_* env vars set, local dev is unaffected — every anonymous flow, including room
 * creation, still works with no account. Once configured, creating a room (POST /api/rooms) does
 * require a signed-in session, but the controller/viewer token model
 * (src/lib/auth/tokens.ts, guard.ts) is otherwise untouched — this only gives a signed-in user a
 * `rooms.ownerUserId` link for cross-device control and a cross-room history view. Viewers and
 * joined participants never see a sign-in prompt anywhere; this is exclusively for the controller
 * side.
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
  callbacks: {
    // The default session callback (see @auth/core's defaultCallbacks.session) rebuilds
    // `session.user` from scratch with only name/email/image — `id` is dropped unless a callback
    // restores it. Every owner check in this app (resolveRoomAccess, /control's isOwner, the
    // /api/me/* routes) keys off `session.user.id`, so without this it's silently `undefined`
    // everywhere: control-from-any-device never actually worked, masked on the device that
    // created the room because that device also holds the room's token in localStorage.
    session({ session, user }) {
      session.user.id = user.id
      return session
    },
  },
  pages: {
    // Our own placeholder page (src/app/(marketing)/login/page.tsx) rather than Auth.js's default
    // sign-in form — it starts the Google flow from a button and honors ?callbackUrl.
    signIn: '/login',
  },
})
