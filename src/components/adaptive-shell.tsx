'use client'

import type { ReactNode } from 'react'
import { useSession } from 'next-auth/react'
import { SiteNavbar } from '@/components/site-navbar'
import { AppSidebar } from '@/components/app-sidebar'

/**
 * Chrome for pages that are reachable from BOTH the signed-out marketing navbar and the signed-in
 * app sidebar — today that's /pricing and /docs, linked from both SiteNavbar and AppSidebar. `/`
 * and `/login` don't need this: they always redirect a signed-in visitor away (see their own
 * page.tsx), so they never show anything but the navbar. dashboard/my-rooms/history/account don't
 * need it either: they always require a session (see (app)/layout.tsx), so they only ever show
 * the sidebar.
 *
 * Session-driven client-side rather than an `auth()` check in a server layout, so a signed-in
 * visitor clicking "Pricing" from the sidebar keeps the sidebar instead of it flashing over to
 * the navbar — useSession()'s cached value from the SessionProvider (src/components/providers.tsx)
 * is already available the instant a client-side <Link> navigation lands here.
 */
export function AdaptiveShell({ children }: { children: ReactNode }) {
  const { data: session, status } = useSession()

  // Session not resolved yet (a fresh full-page load, not a client-side nav from elsewhere in the
  // app) — render bare rather than guessing, so there's no flash of the wrong chrome.
  if (status === 'loading') {
    return <div className="flex min-h-full flex-1 flex-col">{children}</div>
  }

  if (session?.user) {
    return (
      <div className="flex min-h-full flex-1 flex-col md:flex-row">
        <AppSidebar />
        <div className="flex flex-1 flex-col overflow-x-hidden">{children}</div>
      </div>
    )
  }

  return (
    <div className="flex min-h-full flex-1 flex-col">
      <SiteNavbar />
      <div className="flex flex-1 flex-col">{children}</div>
    </div>
  )
}
