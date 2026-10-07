import Image from 'next/image'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { whatsappUrl } from '@/lib/pricing'

/**
 * Footer for the public pages (wherever SiteNavbar shows). Repeats the navbar's links so they're
 * reachable from the bottom of any page — which on a phone is where a reader actually ends up.
 */
export function SiteFooter() {
  const t = useTranslations('footer')
  const tNav = useTranslations('nav')

  const columns = [
    {
      title: t('product'),
      links: [
        { href: '/', label: tNav('home') },
        { href: '/pricing', label: tNav('pricing') },
        { href: '/docs', label: tNav('docs') },
      ],
    },
    {
      title: t('getStarted'),
      links: [
        { href: '/login?mode=signup', label: tNav('signup') },
        { href: '/login', label: tNav('login') },
        { href: '/#join', label: tNav('joinRoom') },
      ],
    },
  ]

  return (
    <footer className="border-t">
      <div className="mx-auto grid w-full max-w-5xl grid-cols-2 gap-8 px-4 py-10 sm:grid-cols-[1.5fr_1fr_1fr_1fr]">
        <div className="col-span-2 flex flex-col gap-3 sm:col-span-1">
          <Link href="/" className="flex items-center gap-2">
            <Image src="/clepsy.svg" alt="" width={24} height={24} unoptimized className="rounded-md" />
            <span className="font-semibold tracking-tight">Clepsy</span>
          </Link>
          <p className="max-w-xs text-sm text-muted-foreground">{t('blurb')}</p>
        </div>
        {columns.map((column) => (
          <div key={column.title} className="flex flex-col gap-3">
            <p className="text-sm font-medium">{column.title}</p>
            <ul className="flex flex-col gap-2 text-sm text-muted-foreground">
              {column.links.map((link) => (
                <li key={link.href}>
                  <Link href={link.href} className="hover:text-foreground">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
        <div className="flex flex-col gap-3">
          <p className="text-sm font-medium">{t('contact')}</p>
          <a
            href={whatsappUrl(t('whatsappMessage'))}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            WhatsApp
          </a>
        </div>
      </div>
      <div className="border-t">
        <p className="mx-auto w-full max-w-5xl px-4 py-4 text-xs text-muted-foreground">
          © {new Date().getFullYear()} Clepsy
        </p>
      </div>
    </footer>
  )
}
