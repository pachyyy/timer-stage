'use client'

import { useEffect, useState, useTransition } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { useLocale, useTranslations } from 'next-intl'
import { Menu, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { AuthButtons } from '@/components/auth-buttons'
import { LocaleSwitcher } from '@/components/locale-switcher'
import { setLocale } from '@/i18n/set-locale'
import { LOCALES, LOCALE_LABELS, type Locale } from '@/i18n/locale'
import { cn } from '@/lib/utils'

/**
 * Navbar for the (marketing) route group and signed-out (public) pages — the (app) group uses
 * AppSidebar instead (no top navbar there, see app-sidebar.tsx). Reads its own session client-side,
 * same as AuthButtons, rather than taking a `signedIn` prop from the server layout: keeps this the
 * single place that decides "Log in/Sign up" vs. "Dashboard", instead of splitting that decision
 * between a prop and AuthButtons' own gear-menu content.
 *
 * Below `sm` the centre links, language switcher and secondary button collapse into a full-height
 * menu behind ☰, keeping only the logo and one primary action in the bar.
 */
export function SiteNavbar() {
  const { data: session, status } = useSession()
  const pathname = usePathname()
  const t = useTranslations('nav')
  const [menuOpen, setMenuOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 4)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  const callbackUrl = encodeURIComponent(pathname || '/')
  const signedIn = Boolean(session?.user)

  const LINKS = [
    { href: '/', label: t('home') },
    { href: '/pricing', label: t('pricing') },
    { href: '/docs', label: t('docs') },
  ]
  // /docs/<section> keeps "Docs" highlighted, not just /docs itself.
  const isActive = (href: string) => (href === '/' ? pathname === '/' : pathname.startsWith(href))

  return (
    <header
      className={cn(
        'sticky top-0 z-30 border-b bg-background/85 backdrop-blur transition-colors',
        !scrolled && 'sm:border-transparent',
      )}
    >
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
              className={isActive(link.href) ? 'text-foreground' : 'hover:text-foreground'}
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="flex shrink-0 items-center gap-2">
          <LocaleSwitcher className="hidden sm:inline-flex" />

          {status === 'loading' ? null : signedIn ? (
            <>
              <Button asChild size="sm" variant="outline">
                <Link href="/dashboard">{t('dashboard')}</Link>
              </Button>
              <span className="hidden sm:contents">
                <AuthButtons />
              </span>
            </>
          ) : (
            <>
              <Button asChild size="sm" variant="outline" className="hidden sm:inline-flex">
                <Link href={`/login?callbackUrl=${callbackUrl}`}>{t('login')}</Link>
              </Button>
              <Button asChild size="sm">
                <Link href={`/login?mode=signup&callbackUrl=${callbackUrl}`}>{t('signup')}</Link>
              </Button>
            </>
          )}

          <Button
            variant="ghost"
            size="icon"
            className="sm:hidden"
            aria-label={t('openMenu')}
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen(true)}
          >
            <Menu className="size-5" />
          </Button>
        </div>
      </div>

      <Dialog open={menuOpen} onOpenChange={setMenuOpen}>
        <DialogContent
          showCloseButton={false}
          className="top-0 left-0 flex h-dvh w-full max-w-none translate-x-0 translate-y-0 flex-col gap-0 rounded-none border-0 p-0 sm:max-w-none"
        >
          <DialogTitle className="sr-only">{t('menu')}</DialogTitle>
          <div className="flex h-14 items-center justify-between border-b px-4">
            <Link href="/" onClick={() => setMenuOpen(false)} className="flex items-center gap-2">
              <Image src="/cue.svg" alt="" width={24} height={24} unoptimized className="rounded-md" />
              <span className="font-semibold tracking-tight">Cue</span>
            </Link>
            <Button variant="ghost" size="icon" aria-label={t('closeMenu')} onClick={() => setMenuOpen(false)}>
              <X className="size-5" />
            </Button>
          </div>

          <nav className="flex flex-col gap-1 px-4 py-6">
            {LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setMenuOpen(false)}
                aria-current={isActive(link.href) ? 'page' : undefined}
                className={cn(
                  'rounded-md px-3 py-3 text-lg font-medium',
                  isActive(link.href) ? 'bg-accent text-accent-foreground' : 'text-foreground/80',
                )}
              >
                {link.label}
              </Link>
            ))}
          </nav>

          <div className="mt-auto flex flex-col gap-4 border-t px-4 py-6">
            <MenuLanguagePicker label={t('language')} />
            {signedIn ? (
              <Button asChild size="lg" className="w-full">
                <Link href="/dashboard" onClick={() => setMenuOpen(false)}>
                  {t('dashboard')}
                </Link>
              </Button>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                <Button asChild size="lg" variant="outline">
                  <Link href={`/login?callbackUrl=${callbackUrl}`} onClick={() => setMenuOpen(false)}>
                    {t('login')}
                  </Link>
                </Button>
                <Button asChild size="lg">
                  <Link href={`/login?mode=signup&callbackUrl=${callbackUrl}`} onClick={() => setMenuOpen(false)}>
                    {t('signup')}
                  </Link>
                </Button>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </header>
  )
}

/** Both languages spelled out as a segmented control — a menu has room the bar's icon-only switcher doesn't. */
function MenuLanguagePicker({ label }: { label: string }) {
  const locale = useLocale() as Locale
  const [pending, startTransition] = useTransition()

  return (
    <div className="flex flex-col gap-2">
      <span className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{label}</span>
      <div className="grid grid-cols-2 gap-1 rounded-lg bg-muted p-1">
        {LOCALES.map((l) => (
          <button
            key={l}
            type="button"
            disabled={pending}
            aria-pressed={l === locale}
            onClick={() => l !== locale && startTransition(async () => setLocale(l))}
            className={cn(
              'rounded-md px-3 py-2 text-sm font-medium transition-colors disabled:opacity-60',
              l === locale ? 'bg-background shadow-sm' : 'text-muted-foreground',
            )}
          >
            {LOCALE_LABELS[l]}
          </button>
        ))}
      </div>
    </div>
  )
}
