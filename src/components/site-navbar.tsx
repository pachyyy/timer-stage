'use client'

import { useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { JoinRoomForm } from '@/components/join-room-form'
import { AuthButtons } from '@/components/auth-buttons'
import { LocaleSwitcher } from '@/components/locale-switcher'

/**
 * Navbar for the (marketing) route group only — the (app) group uses AppSidebar instead (no top
 * navbar there, see app-sidebar.tsx). Reads its own session client-side, same as AuthButtons,
 * rather than taking a `signedIn` prop from the server layout: keeps this the single place that
 * decides "Log in/Sign up" vs. "Dashboard", instead of splitting that decision between a prop and
 * AuthButtons' own gear-menu content.
 */
export function SiteNavbar() {
  const { data: session, status } = useSession()
  const pathname = usePathname()
  const [joinOpen, setJoinOpen] = useState(false)
  const t = useTranslations('nav')

  const callbackUrl = encodeURIComponent(pathname || '/')

  const LINKS = [
    { href: '/', label: t('home') },
    { href: '/pricing', label: t('pricing') },
    { href: '/docs', label: t('docs') },
  ]

  return (
    <header className="border-b">
      <div className="mx-auto flex h-14 w-full max-w-5xl items-center justify-between gap-4 px-4">
        <Link href="/" className="flex shrink-0 items-center gap-2">
          <Image src="/cue.svg" alt="" width={24} height={24} unoptimized className="rounded-md" />
          <span className="font-semibold tracking-tight">Cue</span>
        </Link>

        <nav className="hidden items-center gap-6 text-sm text-muted-foreground sm:flex">
          {LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={pathname === link.href ? 'text-foreground' : 'hover:text-foreground'}
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => setJoinOpen(true)}>
            {t('joinRoom')}
          </Button>

          <LocaleSwitcher />

          {status === 'loading' ? null : session?.user ? (
            <>
              <Button asChild size="sm" variant="outline">
                <Link href="/dashboard">{t('dashboard')}</Link>
              </Button>
              <AuthButtons />
            </>
          ) : (
            <>
              <Button asChild size="sm" variant="outline">
                <Link href={`/login?callbackUrl=${callbackUrl}`}>{t('login')}</Link>
              </Button>
              <Button asChild size="sm">
                <Link href={`/login?mode=signup&callbackUrl=${callbackUrl}`}>{t('signup')}</Link>
              </Button>
            </>
          )}
        </div>
      </div>

      <Dialog open={joinOpen} onOpenChange={setJoinOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{t('joinRoom')}</DialogTitle>
          </DialogHeader>
          <JoinRoomForm />
        </DialogContent>
      </Dialog>
    </header>
  )
}
