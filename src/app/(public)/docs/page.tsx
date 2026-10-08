import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import { DocSectionPage } from '@/components/doc-section-page'
import { DOC_SECTIONS } from '@/lib/docs/sections'

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('docs')
  return { title: `${t('title')} · Clepsy`, description: t('subtitle') }
}

/** /docs itself is the first section, Overview; the rest live at /docs/[section]. */
export default function DocsPage() {
  return <DocSectionPage section={DOC_SECTIONS[0]} />
}
