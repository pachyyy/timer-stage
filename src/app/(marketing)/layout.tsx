import type { ReactNode } from 'react'
import { SiteNavbar } from '@/components/site-navbar'

/**
 * Shared shell for the public marketing pages (/, /pricing, /docs, /login) — the navbar with
 * Home/Pricing/Docs and Log in/Sign up (or Dashboard, once signed in). The (app) group
 * (dashboard, my-rooms, history, account) uses AppSidebar instead and has no top navbar — see its
 * own layout.tsx.
 */
export default function MarketingLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-full flex-1 flex-col">
      <SiteNavbar />
      <div className="flex flex-1 flex-col">{children}</div>
    </div>
  )
}
