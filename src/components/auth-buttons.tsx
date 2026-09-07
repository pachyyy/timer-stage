'use client'

import Image from 'next/image'
import { signIn, signOut, useSession } from 'next-auth/react'
import { Button } from '@/components/ui/button'

/**
 * Optional, everywhere it appears. Nothing downstream requires a session — this is purely the
 * entry point for the additive account features (cross-room My Rooms, claiming a room, control
 * from a second device). Rendered on the homepage and the controller header; never on the viewer
 * screen or the join flow, which stay account-free by design.
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
    <div className="flex items-center gap-2">
      <a href="/my-rooms" className="flex items-center gap-2 text-sm hover:underline">
        {session.user.image && (
          <Image
            src={session.user.image}
            alt=""
            width={24}
            height={24}
            unoptimized
            className="rounded-full"
          />
        )}
        <span className="hidden sm:inline">{session.user.name ?? session.user.email}</span>
      </a>
      <Button variant="ghost" size={size} onClick={() => signOut()}>
        Sign out
      </Button>
    </div>
  )
}
