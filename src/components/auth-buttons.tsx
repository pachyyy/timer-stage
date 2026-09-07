'use client'

import { signIn, signOut, useSession } from 'next-auth/react'
import { Settings, History, LogOut } from 'lucide-react'
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

  if (status === 'loading') return null

  if (!session?.user) {
    return (
      <Button variant="outline" size={size} onClick={() => signIn('google')}>
        Sign in with Google
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
          <a href="/my-rooms">
            <History />
            History
          </a>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => signOut()}>
          <LogOut />
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
