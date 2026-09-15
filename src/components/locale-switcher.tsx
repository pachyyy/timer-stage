'use client'

import { useTransition } from 'react'
import { useLocale } from 'next-intl'
import { Languages } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { setLocale } from '@/i18n/set-locale'
import { LOCALES, LOCALE_LABELS, type Locale } from '@/i18n/locale'
import { cn } from '@/lib/utils'

/**
 * Used in both SiteNavbar and AppSidebar's footer — icon-only everywhere (the dropdown itself
 * spells out "English"/"Bahasa Indonesia", so the trigger doesn't need to) since neither the
 * navbar nor a collapsed sidebar rail has room for a text label here.
 */
export function LocaleSwitcher({ className }: { className?: string }) {
  const locale = useLocale() as Locale
  const [pending, startTransition] = useTransition()

  const handleSelect = (next: Locale) => {
    if (next === locale) return
    // setLocale (a Server Action) sets the cookie request.ts reads and revalidates the tree —
    // wrapping it in a transition keeps the trigger's disabled state accurate while that's in
    // flight, without a separate loading state to track by hand.
    startTransition(async () => {
      await setLocale(next)
    })
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          disabled={pending}
          aria-label="Change language"
          className={cn(className)}
        >
          <Languages className="size-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {LOCALES.map((l) => (
          <DropdownMenuItem key={l} onClick={() => handleSelect(l)} disabled={l === locale}>
            {LOCALE_LABELS[l]}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
