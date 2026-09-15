import type { ReactNode } from 'react'
import { redirect } from 'next/navigation'
import { auth } from '@/auth'
import { isAuthConfigured } from '@/lib/auth/config'
import { AppSidebar } from '@/components/app-sidebar'

/**
 * Shell for the signed-in app area (dashboard, my-rooms, history, account) — a left sidebar
 * instead of a top navbar (see AppSidebar). This is a convenience redirect, not the security
 * boundary: the routes/APIs underneath (e.g. POST /api/rooms) re-check the session themselves,
 * per this repo's usual "never trust a client-side gate alone" rule.
 *
 * Skipped entirely when auth isn't configured (no AUTH_* env vars — see isAuthConfigured), so
 * local dev with no env vars set keeps working per CLAUDE.md's "no environment variables are
 * required for local dev".
 */
export default async function AppLayout({ children }: { children: ReactNode }) {
  if (isAuthConfigured()) {
    const session = await auth()
    // Shared by every page in this group, so there's no single "current path" to send back as
    // callbackUrl here — safeCallbackUrl's own default (/dashboard) is close enough for a
    // convenience redirect; a deep link can still pass its own ?callbackUrl if that matters later.
    if (!session?.user) redirect('/login')
  }

  return (
    <div className="flex min-h-full flex-1 flex-col md:flex-row">
      <AppSidebar />
      <div className="flex flex-1 flex-col overflow-x-hidden">{children}</div>
    </div>
  )
}
