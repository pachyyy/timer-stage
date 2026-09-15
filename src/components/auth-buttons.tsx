'use client'

import { signOut, useSession } from 'next-auth/react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { Settings, History, LayoutDashboard, LogOut, DoorOpen, User } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

/**
 * Optional, everywhere it appears. Nothing downstream requires a session — this is purely the
 * entry point for the additive account features (cross-room My Rooms, claiming a room, control
 * from a second device). Rendered on the homepage and the controller header; never on the viewer
 * screen or the join flow, which stay account-free by design.
 *
 * Signed in, this is deliberately just a gear icon — no avatar/name inline. Those were previously
 * wrapped in the /my-rooms link, but with no picture and on a narrow viewport (name text hidden
 * below `sm`) that link could render as nothing visible at all, leaving no way to reach History.
 * The gear is always visible and always the same tap target.
 */
export function AuthButtons({ size = 'sm' as const }: { size?: 'sm' | 'default' }) {
  const { data: session, status } = useSession()
  const pathname = usePathname()
  const t = useTranslations('nav')

  if (status === 'loading') return null

  if (!session?.user) {
    return (
      <Button asChild variant="outline" size={size}>
        <Link href={`/login?callbackUrl=${encodeURIComponent(pathname || '/')}`}>{t('login')}</Link>
      </Button>
    )
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Settings">
          <Settings className="size-5" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel className="font-normal text-muted-foreground">
          {session.user.name ?? session.user.email}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/dashboard">
            <LayoutDashboard />
            {t('dashboard')}
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/my-rooms">
            <DoorOpen />
            {t('myRooms')}
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/history">
            <History />
            {t('history')}
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/account">
            <User />
            {t('account')}
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => signOut({ redirectTo: '/' })}>
          <LogOut />
          {t('signOut')}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
