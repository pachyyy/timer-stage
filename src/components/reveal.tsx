'use client'

import { useEffect, useRef, type ReactNode, type RefObject } from 'react'

/**
 * Fades its content in (with a slight upward rise) the first time it scrolls into view. Used on
 * the public marketing pages (/, /about, /pricing, /docs) — deliberately never on the timer
 * screens, where nothing should move but the clock.
 *
 * The hidden starting state lives in globals.css (`[data-reveal]`), scoped so content is never
 * stuck invisible: only when scripting is enabled (no-JS visitors and crawlers see everything),
 * only when the visitor hasn't asked for reduced motion, and never when printing. This component
 * only flips `data-visible` once — directly on the DOM node rather than via state, so revealing
 * costs no re-render — and then stops observing, so content doesn't fade out again on scroll-up.
 *
 * Keep it off above-the-fold heroes: they're already on screen, and hiding the largest element
 * until hydration would delay the page's first meaningful paint.
 */
export function Reveal({
  children,
  className,
  as: Tag = 'div',
  distance = 'md',
}: {
  children: ReactNode
  className?: string
  /** Element to render, so wrapping a `<section>` doesn't cost its semantics. */
  as?: 'div' | 'section'
  /** How far the content rises: 'md' (16px) for marketing sections, 'sm' (8px) for the docs. */
  distance?: 'sm' | 'md'
}) {
  const ref = useRef<HTMLElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const show = () => {
      el.dataset.visible = ''
    }
    if (typeof IntersectionObserver === 'undefined') return show()

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          show()
          observer.disconnect()
        }
      },
      // Start a little before the element's top edge clears the bottom of the screen, so the
      // fade is under way by the time it's actually being read.
      { rootMargin: '0px 0px -8% 0px' },
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  return (
    <Tag ref={ref as RefObject<HTMLDivElement>} data-reveal={distance} className={className}>
      {children}
    </Tag>
  )
}
