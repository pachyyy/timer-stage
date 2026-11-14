import type { ReactNode } from 'react'
import type { Metadata } from 'next'
import Link from 'next/link'
import { getTranslations } from 'next-intl/server'
import { ChorusIllustration, WaterClockIllustration } from '@/components/about-illustrations'
import { Reveal } from '@/components/reveal'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('about')
  return { title: `${t('title')} · Clepsy`, description: t('subtitle') }
}

/** Renders the `<em>` tags the name-card messages use for the Greek words. */
const em = (chunks: ReactNode) => <em>{chunks}</em>

export default async function AboutPage() {
  const t = await getTranslations('about')

  const names = [
    {
      key: 'clepsy',
      illustration: <WaterClockIllustration />,
      title: t.rich('clepsyTitle', { em }),
      meaning: t.rich('clepsyMeaning', { em }),
      body: t('clepsyBody'),
    },
    {
      key: 'chorus',
      illustration: <ChorusIllustration />,
      title: t.rich('chorusTitle', { em }),
      meaning: t('chorusMeaning'),
      body: t('chorusBody'),
    },
  ]

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-12 px-4 py-12">
      <div className="text-center">
        <h1 className="text-2xl font-semibold tracking-tight">{t('title')}</h1>
        <p className="mt-2 text-muted-foreground">{t('subtitle')}</p>
      </div>

      <Reveal as="section" className="flex flex-col gap-4">
        <h2 className="text-xl font-semibold tracking-tight">{t('storyTitle')}</h2>
        <div className="flex flex-col gap-4 leading-relaxed text-muted-foreground">
          <p>{t('story1')}</p>
          <p>{t('story2')}</p>
          <p>{t('story3')}</p>
          <p>{t('story4')}</p>
        </div>
      </Reveal>

      <Reveal as="section" className="flex flex-col gap-4">
        <div>
          <h2 className="text-xl font-semibold tracking-tight">{t('namesTitle')}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{t('namesSubtitle')}</p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          {names.map((name) => (
            <Card key={name.key}>
              <CardContent className="flex flex-col gap-3">
                <div className="flex justify-center py-2 text-primary">{name.illustration}</div>
                <h3 className="font-semibold">{name.title}</h3>
                <p className="text-sm text-muted-foreground">{name.meaning}</p>
                <p className="text-sm leading-relaxed">{name.body}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </Reveal>

      <Reveal>
        <Card>
          <CardContent className="flex flex-col items-center gap-4 py-6 text-center">
            <p className="text-lg font-medium">{t('closing')}</p>
            <div className="flex flex-wrap justify-center gap-2">
              <Button asChild>
                <Link href="/login?mode=signup">{t('ctaStart')}</Link>
              </Button>
              <Button asChild variant="outline">
                <Link href="/#join">{t('ctaJoin')}</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </Reveal>
    </main>
  )
}
