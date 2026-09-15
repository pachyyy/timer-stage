'use client'

import { useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { signOut, useSession } from 'next-auth/react'
import { LayoutDashboard, DoorOpen, History, User, CreditCard, BookOpen, LogOut, Menu } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { cn } from '@/lib/utils'

const MAIN_LINKS = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/my-rooms', label: 'My Rooms', icon: DoorOpen },
  { href: '/history', label: 'History', icon: History },
  { href: '/account', label: 'Account', icon: User },
]

const SECONDARY_LINKS = [
  { href: '/pricing', label: 'Pricing', icon: CreditCard },
  { href: '/docs', label: 'Docs', icon: BookOpen },
]

/**
 * Left sidebar for the (app) route group — deliberately no top navbar there (see the
 * (marketing) group's SiteNavbar for that). Hand-built rather than shadcn's `sidebar` block: that
 * block pulls in sheet/tooltip/skeleton/use-mobile, more than a placeholder needs. Swap it in
 * during the eventual design pass if this needs to get fancier.
 *
 * `/r/[roomId]/control` deliberately stays OUTSIDE the (app) group and keeps its own header +
 * AuthButtons gear — it's a full-width operator screen usable while signed out via `?t=`.
 */
export function AppSidebar() {
  const pathname = usePathname()
  const { data: session } = useSession()
  const [mobileOpen, setMobileOpen] = useState(false)

  const isActive = (href: string) => pathname === href

  const navList = (onNavigate?: () => void) => (
    <>
      <nav className="flex flex-col gap-1">
        {MAIN_LINKS.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            onClick={onNavigate}
            className={cn(
              'flex items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium transition-colors',
              isActive(href)
                ? 'bg-accent text-accent-foreground'
                : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground',
            )}
          >
            <Icon className="size-4" />
            {label}
          </Link>
        ))}
      </nav>

      <div className="my-3 h-px bg-border" />

      <nav className="flex flex-col gap-1">
        {SECONDARY_LINKS.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            onClick={onNavigate}
            className={cn(
              'flex items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium transition-colors',
              isActive(href)
                ? 'bg-accent text-accent-foreground'
                : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground',
            )}
          >
            <Icon className="size-4" />
            {label}
          </Link>
        ))}
      </nav>
    </>
  )

  const footer = (
    <div className="flex items-center justify-between gap-2 border-t px-3 py-3">
      <span className="truncate text-xs text-muted-foreground">{session?.user?.name ?? session?.user?.email}</span>
      <Button variant="ghost" size="icon" aria-label="Sign out" onClick={() => signOut({ redirectTo: '/' })}>
        <LogOut className="size-4" />
      </Button>
    </div>
  )

  return (
    <>
      {/* Desktop */}
      <aside className="hidden w-60 shrink-0 flex-col border-r md:flex">
        <Link href="/dashboard" className="flex items-center gap-2 px-4 py-4">
          <Image src="/cue.svg" alt="" width={24} height={24} unoptimized className="rounded-md" />
          <span className="font-semibold tracking-tight">Cue</span>
        </Link>
        <div className="flex-1 px-2">{navList()}</div>
        {footer}
      </aside>

      {/* Mobile top bar */}
      <div className="flex items-center justify-between border-b px-4 py-3 md:hidden">
        <Link href="/dashboard" className="flex items-center gap-2">
          <Image src="/cue.svg" alt="" width={24} height={24} unoptimized className="rounded-md" />
          <span className="font-semibold tracking-tight">Cue</span>
        </Link>
        <Button variant="ghost" size="icon" aria-label="Open menu" onClick={() => setMobileOpen(true)}>
          <Menu className="size-5" />
        </Button>
      </div>

      <Dialog open={mobileOpen} onOpenChange={setMobileOpen}>
        <DialogContent
          showCloseButton={false}
          className="left-0 top-0 flex h-full w-64 max-w-[80vw] translate-x-0 translate-y-0 flex-col rounded-none border-r p-0 sm:max-w-[80vw]"
        >
          <DialogTitle className="sr-only">Menu</DialogTitle>
          <div className="flex items-center gap-2 px-4 py-4">
            <Image src="/cue.svg" alt="" width={24} height={24} unoptimized className="rounded-md" />
            <span className="font-semibold tracking-tight">Cue</span>
          </div>
          <div className="flex-1 px-2">{navList(() => setMobileOpen(false))}</div>
          {footer}
        </DialogContent>
      </Dialog>
    </>
  )
}
