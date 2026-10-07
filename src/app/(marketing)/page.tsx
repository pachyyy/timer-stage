import { redirect } from 'next/navigation'
import Image from 'next/image'
import Link from 'next/link'
import { getTranslations } from 'next-intl/server'
import {
  BellRing,
  Building2,
  ChevronDown,
  Church,
  FileSpreadsheet,
  Languages,
  MessageSquare,
  Presentation,
  RefreshCw,
  UserCog,
  type LucideIcon,
} from 'lucide-react'
import { auth } from '@/auth'
import { Button } from '@/components/ui/button'
import { JoinRoomForm } from '@/components/join-room-form'
import { FREE_PARTICIPANTS_PER_ROOM } from '@/lib/entitlements/gate'
import { ROOM_PRICE } from '@/lib/pricing'

export const dynamic = 'force-dynamic'

type Step = { title: string; body: string }
type UseCase = Step & { agenda: string[] }
type Faq = { q: string; a: string }

// Each how-it-works step reuses its docs section's walkthrough (public/docs, rendered from video/).
const STEP_GIFS = ['create-room', 'share-screen', 'run-timer'] as const
const FEATURE_ICONS: LucideIcon[] = [RefreshCw, MessageSquare, BellRing, UserCog, FileSpreadsheet, Languages]
const USE_CASE_ICONS: LucideIcon[] = [Presentation, Church, Building2]

const BRAND_GRADIENT = 'bg-[linear-gradient(135deg,var(--primary-gradient-from),var(--primary-gradient-to))]'

/**
 * Public landing page. Signed-in visitors are sent straight to /dashboard — there's nothing for
 * them to do here (see CLAUDE.md's Route structure). Everyone else gets the product pitch, written
 * for conferences, churches and corporate meetings, with the join-by-code box high on the page
 * since joining never requires an account (CLAUDE.md's Auth model: "Viewing is intentionally open
 * by room code alone").
 */
export default async function LandingPage() {
  const session = await auth()
  if (session?.user) redirect('/dashboard')

  const t = await getTranslations('landing')
  const steps = t.raw('steps') as Step[]
  const features = t.raw('features') as Step[]
  const useCases = t.raw('useCases') as UseCase[]
  const faq = t.raw('faq') as Faq[]

  return (
    <main className="flex flex-1 flex-col">
      {/* Hero */}
      <section className="relative overflow-hidden">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 -top-40 h-[480px] bg-[radial-gradient(60%_60%_at_50%_0%,color-mix(in_oklch,var(--primary)_14%,transparent),transparent)]"
        />
        <div className="relative mx-auto flex w-full max-w-5xl flex-col items-center px-4 pt-12 pb-14 text-center sm:pt-20">
          <h1 className="max-w-3xl text-4xl font-semibold tracking-tight text-balance sm:text-6xl">
            {t('heroTitle')}
          </h1>
          <p className="mt-4 max-w-xl text-lg text-balance text-muted-foreground">{t('tagline')}</p>
          <div className="mt-8 flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
            <Button asChild size="lg">
              <Link href="/login?mode=signup">{t('signupCta')}</Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <a href="#how">{t('howCta')}</a>
            </Button>
          </div>
          <figure className="mt-12 w-full overflow-hidden rounded-xl border bg-muted shadow-2xl shadow-black/10">
            <Image
              src="/docs/overview.gif"
              alt={t('heroImageAlt')}
              width={1280}
              height={800}
              unoptimized
              priority
              className="h-auto w-full"
            />
          </figure>
        </div>
      </section>

      {/* Join strip — the participant's way in, within a scroll of the top on a phone */}
      <section id="join" className="scroll-mt-20 border-y bg-muted/40">
        <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-10 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-xl font-semibold">{t('codeCardTitle')}</h2>
            <p className="mt-1 text-muted-foreground">{t('codeCardDesc')}</p>
          </div>
          <JoinRoomForm className="w-full sm:max-w-sm" />
        </div>
      </section>

      {/* How it works */}
      <section id="how" className="scroll-mt-20">
        <div className="mx-auto w-full max-w-5xl px-4 py-16 sm:py-24">
          <SectionHeading title={t('howTitle')} subtitle={t('howSubtitle')} />
          <ol className="mt-12 grid gap-8 md:grid-cols-3">
            {steps.map((step, i) => (
              <li key={step.title} className="flex flex-col gap-4">
                <div className="overflow-hidden rounded-lg border bg-muted">
                  <Image
                    src={`/docs/${STEP_GIFS[i]}.gif`}
                    alt=""
                    width={1280}
                    height={800}
                    unoptimized
                    loading="lazy"
                    className="h-auto w-full"
                  />
                </div>
                <div className="flex gap-3">
                  <span
                    className={`flex size-7 shrink-0 items-center justify-center rounded-full text-sm font-semibold text-white ${BRAND_GRADIENT}`}
                  >
                    {i + 1}
                  </span>
                  <div>
                    <h3 className="font-semibold">{step.title}</h3>
                    <p className="mt-1 text-sm text-muted-foreground">{step.body}</p>
                  </div>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* Features */}
      <section className="border-y bg-muted/40">
        <div className="mx-auto w-full max-w-5xl px-4 py-16 sm:py-24">
          <SectionHeading title={t('featuresTitle')} />
          <ul className="mt-12 grid gap-x-8 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
            {features.map((feature, i) => {
              const Icon = FEATURE_ICONS[i]
              return (
                <li key={feature.title} className="flex flex-col gap-3">
                  <span className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <Icon className="size-5" />
                  </span>
                  <h3 className="font-semibold">{feature.title}</h3>
                  <p className="text-sm text-muted-foreground">{feature.body}</p>
                </li>
              )
            })}
          </ul>
        </div>
      </section>

      {/* Use cases */}
      <section>
        <div className="mx-auto w-full max-w-5xl px-4 py-16 sm:py-24">
          <SectionHeading title={t('useCasesTitle')} />
          <ul className="mt-12 grid gap-4 md:grid-cols-3">
            {useCases.map((useCase, i) => {
              const Icon = USE_CASE_ICONS[i]
              return (
                <li key={useCase.title} className="flex flex-col gap-3 rounded-xl border bg-card p-6 shadow-sm">
                  <Icon className="size-6 text-primary" />
                  <h3 className="text-lg font-semibold">{useCase.title}</h3>
                  <p className="text-sm text-muted-foreground">{useCase.body}</p>
                  <div className="mt-auto flex flex-wrap gap-1.5 pt-2">
                    {useCase.agenda.map((segment) => (
                      <span key={segment} className="rounded-full bg-muted px-2.5 py-1 text-xs text-muted-foreground">
                        {segment}
                      </span>
                    ))}
                  </div>
                </li>
              )
            })}
          </ul>
        </div>
      </section>

      {/* Pricing teaser */}
      <section className="border-y bg-muted/40">
        <div className="mx-auto flex w-full max-w-3xl flex-col items-center gap-4 px-4 py-16 text-center sm:py-20">
          <h2 className="text-3xl font-semibold tracking-tight text-balance">{t('pricingTitle')}</h2>
          <p className="max-w-xl text-balance text-muted-foreground">
            {t('pricingBody', { free: FREE_PARTICIPANTS_PER_ROOM })}
          </p>
          <p className="text-lg font-semibold">{t('pricingFrom', { price: ROOM_PRICE })}</p>
          <Button asChild variant="outline" size="lg">
            <Link href="/pricing">{t('pricingCta')}</Link>
          </Button>
        </div>
      </section>

      {/* FAQ */}
      <section>
        <div className="mx-auto w-full max-w-3xl px-4 py-16 sm:py-24">
          <SectionHeading title={t('faqTitle')} />
          <div className="mt-10 divide-y rounded-xl border">
            {faq.map((item) => (
              <details key={item.q} className="group px-5 py-4">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-medium [&::-webkit-details-marker]:hidden">
                  {item.q}
                  <ChevronDown className="size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" />
                </summary>
                <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{item.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* Final call to action */}
      <section className="px-4 pb-16 sm:pb-24">
        <div
          className={`mx-auto flex w-full max-w-5xl flex-col items-center gap-4 rounded-2xl px-6 py-14 text-center text-white ${BRAND_GRADIENT}`}
        >
          <h2 className="text-3xl font-semibold tracking-tight text-balance sm:text-4xl">{t('finalTitle')}</h2>
          <p className="text-white/80">{t('finalBody')}</p>
          <div className="mt-4 flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
            <Button asChild size="lg" className="bg-white bg-none text-foreground hover:bg-white/90 hover:brightness-100">
              <Link href="/login?mode=signup">{t('signupCta')}</Link>
            </Button>
            <Button
              asChild
              size="lg"
              variant="outline"
              className="border-white/40 bg-transparent text-white hover:bg-white/10 hover:text-white"
            >
              <Link href="/docs">{t('docsCta')}</Link>
            </Button>
          </div>
        </div>
      </section>
    </main>
  )
}

function SectionHeading({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="text-center">
      <h2 className="text-3xl font-semibold tracking-tight text-balance">{title}</h2>
      {subtitle && <p className="mt-3 text-balance text-muted-foreground">{subtitle}</p>}
    </div>
  )
}
