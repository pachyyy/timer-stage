import Image from 'next/image'
import Link from 'next/link'
import { getTranslations } from 'next-intl/server'
import { ArrowLeft, ArrowRight, Lightbulb } from 'lucide-react'
import { DOC_SECTIONS, docHref, type DocSection } from '@/lib/docs/sections'

/**
 * One docs section: heading, the section's animated walkthrough (public/docs/<slug>.gif, rendered
 * from video/), numbered steps, a tip, and previous/next links. Shared by /docs (Overview) and
 * /docs/[section].
 */
export async function DocSectionPage({ section }: { section: DocSection }) {
  const t = await getTranslations('docs')
  const index = DOC_SECTIONS.findIndex((s) => s.slug === section.slug)
  const prev = DOC_SECTIONS[index - 1]
  const next = DOC_SECTIONS[index + 1]
  const title = t(`sections.${section.key}.title`)
  const steps = t.raw(`sections.${section.key}.steps`) as string[]

  return (
    <article className="flex max-w-3xl flex-col gap-8">
      <header className="flex flex-col gap-3">
        <p className="text-sm font-medium text-primary">
          {t('sectionCount', { current: index + 1, total: DOC_SECTIONS.length })}
        </p>
        <h1 className="text-3xl font-semibold tracking-tight">{title}</h1>
        <p className="text-lg text-muted-foreground">{t(`sections.${section.key}.lead`)}</p>
      </header>

      <figure className="overflow-hidden rounded-xl border bg-muted shadow-sm">
        {/* A looping GIF — next/image's optimizer would re-encode it to a still, so it's served as-is. */}
        <Image
          src={`/docs/${section.slug}.gif`}
          alt={title}
          width={1280}
          height={800}
          unoptimized
          priority
          className="h-auto w-full"
        />
      </figure>

      <section>
        <h2 className="text-lg font-semibold">{t('stepsTitle')}</h2>
        <ol className="mt-4 flex flex-col gap-3">
          {steps.map((step, i) => (
            <li key={i} className="flex gap-3">
              <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary tabular-nums">
                {i + 1}
              </span>
              <span className="pt-0.5 leading-relaxed">{step}</span>
            </li>
          ))}
        </ol>
      </section>

      <aside className="flex gap-3 rounded-lg border bg-accent/40 px-4 py-3 text-sm">
        <Lightbulb className="mt-0.5 size-4 shrink-0 text-primary" />
        <p>
          <span className="font-medium">{t('tipLabel')}:</span> {t(`sections.${section.key}.tip`)}
        </p>
      </aside>

      <nav className="grid gap-3 border-t pt-6 sm:grid-cols-2">
        {prev ? (
          <Link
            href={docHref(prev)}
            className="flex flex-col gap-1 rounded-lg border px-4 py-3 transition-colors hover:bg-accent/50"
          >
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              <ArrowLeft className="size-3" /> {t('previous')}
            </span>
            <span className="font-medium">{t(`sections.${prev.key}.title`)}</span>
          </Link>
        ) : (
          <span className="hidden sm:block" />
        )}
        {next && (
          <Link
            href={docHref(next)}
            className="flex flex-col items-end gap-1 rounded-lg border px-4 py-3 text-right transition-colors hover:bg-accent/50"
          >
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              {t('next')} <ArrowRight className="size-3" />
            </span>
            <span className="font-medium">{t(`sections.${next.key}.title`)}</span>
          </Link>
        )}
      </nav>
    </article>
  )
}
