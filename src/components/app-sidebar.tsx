'use client'

import { useCallback, useState, useSyncExternalStore } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { signOut, useSession } from 'next-auth/react'
import { useTranslations } from 'next-intl'
import {
  LayoutDashboard,
  DoorOpen,
  History,
  User,
  CreditCard,
  BookOpen,
  LogOut,
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { LocaleSwitcher } from '@/components/locale-switcher'
import { cn } from '@/lib/utils'

/** Per-viewer convenience only (which pane width they last chose) — not app state, so plain
 * localStorage rather than a server-persisted preference. */
const COLLAPSE_KEY = 'cue:sidebar-collapsed'

function subscribeToStorage(onChange: () => void) {
  window.addEventListener('storage', onChange)
  return () => window.removeEventListener('storage', onChange)
}

function getCollapsedSnapshot() {
  try {
    return localStorage.getItem(COLLAPSE_KEY) === '1'
  } catch {
    return false
  }
}

function getCollapsedServerSnapshot() {
  return false
}

/**
 * `useSyncExternalStore` rather than `useState` + a mount effect: reading localStorage is reading
 * an external store, and this is React's own documented way to do that without a hydration
 * mismatch (it renders `getServerSnapshot`'s value through hydration, then swaps to the real
 * client value right after — no "setState inside an effect" needed, which is otherwise flagged by
 * this repo's `react-hooks/set-state-in-effect` lint rule). The native `storage` event only fires
 * in OTHER tabs, so `setCollapsed` below dispatches one manually to update this tab too.
 */
function useSidebarCollapsed(): [boolean, (next: boolean) => void] {
  const collapsed = useSyncExternalStore(subscribeToStorage, getCollapsedSnapshot, getCollapsedServerSnapshot)

  const setCollapsed = useCallback((next: boolean) => {
    try {
      localStorage.setItem(COLLAPSE_KEY, next ? '1' : '0')
    } catch {
      // localStorage unavailable (private mode, blocked) — the toggle just won't persist
    }
    window.dispatchEvent(new StorageEvent('storage'))
  }, [])

  return [collapsed, setCollapsed]
}

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
  const [collapsed, setCollapsed] = useSidebarCollapsed()
  const toggleCollapsed = () => setCollapsed(!collapsed)
  const t = useTranslations('nav')

  const MAIN_LINKS = [
    { href: '/dashboard', label: t('dashboard'), icon: LayoutDashboard },
    { href: '/my-rooms', label: t('myRooms'), icon: DoorOpen },
    { href: '/history', label: t('history'), icon: History },
    { href: '/account', label: t('account'), icon: User },
  ]

  const SECONDARY_LINKS = [
    { href: '/pricing', label: t('pricing'), icon: CreditCard },
    { href: '/docs', label: t('docs'), icon: BookOpen },
  ]

  const isActive = (href: string) => pathname === href

  const navList = (onNavigate?: () => void, iconOnly = false) => (
    <>
      <nav className="flex flex-col gap-1">
        {MAIN_LINKS.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            onClick={onNavigate}
            title={iconOnly ? label : undefined}
            className={cn(
              'flex items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium transition-colors',
              iconOnly && 'justify-center px-0',
              isActive(href)
                ? 'bg-accent text-accent-foreground'
                : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground',
            )}
          >
            <Icon className="size-4 shrink-0" />
            {!iconOnly && label}
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
            title={iconOnly ? label : undefined}
            className={cn(
              'flex items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium transition-colors',
              iconOnly && 'justify-center px-0',
              isActive(href)
                ? 'bg-accent text-accent-foreground'
                : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground',
            )}
          >
            <Icon className="size-4 shrink-0" />
            {!iconOnly && label}
          </Link>
        ))}
      </nav>
    </>
  )

  const footer = (iconOnly = false) => (
    <div
      className={cn(
        'flex items-center gap-1 border-t px-3 py-3',
        iconOnly ? 'flex-col' : 'justify-between',
      )}
    >
      {!iconOnly && (
        <span className="truncate text-xs text-muted-foreground">
          {session?.user?.name ?? session?.user?.email}
        </span>
      )}
      <div className={cn('flex items-center gap-1', iconOnly && 'flex-col')}>
        <LocaleSwitcher />
        <Button
          variant="ghost"
          size="icon"
          aria-label={t('signOut')}
          title={iconOnly ? t('signOut') : undefined}
          onClick={() => signOut({ redirectTo: '/' })}
        >
          <LogOut className="size-4" />
        </Button>
      </div>
    </div>
  )

  return (
    <>
      {/* Desktop — sticky to the viewport (not part of the page's own scroll) so it stays put
       * while the content pane beside it scrolls; see the (app)/layout.tsx and (public) group's
       * AdaptiveShell that render this next to a normal-flow content column. */}
      <aside
        className={cn(
          'sticky top-0 hidden h-screen shrink-0 flex-col border-r transition-[width] duration-200 md:flex',
          collapsed ? 'w-16' : 'w-60',
        )}
      >
        <div className={cn('flex items-center gap-2 px-4 py-4', collapsed && 'justify-center px-0')}>
          <Link href="/dashboard" className="flex items-center gap-2 overflow-hidden">
            <Image src="/cue.svg" alt="" width={24} height={24} unoptimized className="shrink-0 rounded-md" />
            {!collapsed && <span className="truncate font-semibold tracking-tight">Cue</span>}
          </Link>
        </div>

        <div className="flex-1 overflow-y-auto px-2">{navList(undefined, collapsed)}</div>

        {footer(collapsed)}

        <button
          type="button"
          onClick={toggleCollapsed}
          aria-label={collapsed ? t('expandSidebar') : t('collapseSidebar')}
          title={collapsed ? t('expandSidebar') : t('collapseSidebar')}
          className="absolute top-4 -right-3 flex size-6 items-center justify-center rounded-full border bg-background text-muted-foreground shadow-sm hover:text-foreground"
        >
          {collapsed ? <PanelLeftOpen className="size-3.5" /> : <PanelLeftClose className="size-3.5" />}
        </button>
      </aside>

      {/* Mobile top bar — sticky for the same reason as the desktop aside above */}
      <div className="sticky top-0 z-10 flex items-center justify-between border-b bg-background px-4 py-3 md:hidden">
        <Link href="/dashboard" className="flex items-center gap-2">
          <Image src="/cue.svg" alt="" width={24} height={24} unoptimized className="rounded-md" />
          <span className="font-semibold tracking-tight">Cue</span>
        </Link>
        <Button variant="ghost" size="icon" aria-label={t('openMenu')} onClick={() => setMobileOpen(true)}>
          <Menu className="size-5" />
        </Button>
      </div>

      <Dialog open={mobileOpen} onOpenChange={setMobileOpen}>
        <DialogContent
          showCloseButton={false}
          className="left-0 top-0 flex h-full w-64 max-w-[80vw] translate-x-0 translate-y-0 flex-col rounded-none border-r p-0 sm:max-w-[80vw]"
        >
          <DialogTitle className="sr-only">{t('menu')}</DialogTitle>
          <div className="flex items-center gap-2 px-4 py-4">
            <Image src="/cue.svg" alt="" width={24} height={24} unoptimized className="rounded-md" />
            <span className="font-semibold tracking-tight">Cue</span>
          </div>
          <div className="flex-1 px-2">{navList(() => setMobileOpen(false))}</div>
          {footer()}
        </DialogContent>
      </Dialog>
    </>
  )
}
