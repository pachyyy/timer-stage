'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { DOC_SECTIONS, docHref } from '@/lib/docs/sections'
import { cn } from '@/lib/utils'

/**
 * The docs' own section list — a sticky column on desktop, a horizontally scrolling strip of chips
 * on phones. Sits beside AdaptiveShell's chrome (navbar or AppSidebar), not in place of it.
 */
export function DocsNav() {
  const pathname = usePathname()
  const t = useTranslations('docs')

  return (
    <aside className="md:sticky md:top-8 md:w-56 md:shrink-0 md:self-start">
      <p className="mb-2 hidden px-3 text-xs font-medium tracking-wide text-muted-foreground uppercase md:block">
        {t('navTitle')}
      </p>
      <nav className="-mx-4 flex gap-1 overflow-x-auto px-4 pb-1 md:mx-0 md:flex-col md:overflow-visible md:px-0 md:pb-0">
        {DOC_SECTIONS.map((section) => {
          const href = docHref(section)
          const active = pathname === href
          const Icon = section.icon
          return (
            <Link
              key={section.slug}
              href={href}
              aria-current={active ? 'page' : undefined}
              className={cn(
                'flex shrink-0 items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium whitespace-nowrap transition-colors',
                'border md:border-0',
                active
                  ? 'bg-accent text-accent-foreground'
                  : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground',
              )}
            >
              <Icon className="size-4 shrink-0" />
              {t(`sections.${section.key}.title`)}
            </Link>
          )
        })}
      </nav>
    </aside>
  )
}
