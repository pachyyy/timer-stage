import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import { DocSectionPage } from '@/components/doc-section-page'
import { findDocSection } from '@/lib/docs/sections'

type Params = { params: Promise<{ section: string }> }

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const section = findDocSection((await params).section)
  if (!section) return {}
  const t = await getTranslations('docs')
  return {
    title: `${t(`sections.${section.key}.title`)} — ${t('title')} — Clepsy`,
    description: t(`sections.${section.key}.lead`),
  }
}

export default async function DocSectionRoute({ params }: Params) {
  const section = findDocSection((await params).section)
  // Overview's canonical home is /docs, not /docs/overview.
  if (!section || section.slug === 'overview') notFound()
  return <DocSectionPage section={section} />
}
