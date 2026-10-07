import {
  BookOpen,
  DoorOpen,
  History,
  ListOrdered,
  LogIn,
  MonitorUp,
  Smartphone,
  Timer,
  Users,
  type LucideIcon,
} from 'lucide-react'

/**
 * The docs sidebar, in order. `key` indexes `docs.sections.*` in messages/*.json; `slug` is both
 * the route (/docs/<slug>, except Overview at /docs itself) and the GIF at public/docs/<slug>.gif.
 * Those GIFs are rendered by the Remotion project in video/ — its scripts/render-gifs.mjs maps
 * composition ids to these same slugs, so keep the two lists in step.
 */
export const DOC_SECTIONS = [
  { key: 'overview', slug: 'overview', icon: BookOpen },
  { key: 'signIn', slug: 'sign-in', icon: LogIn },
  { key: 'createRoom', slug: 'create-room', icon: DoorOpen },
  { key: 'buildAgenda', slug: 'build-agenda', icon: ListOrdered },
  { key: 'runTimer', slug: 'run-timer', icon: Timer },
  { key: 'shareScreen', slug: 'share-screen', icon: MonitorUp },
  { key: 'joinRoom', slug: 'join-room', icon: Smartphone },
  { key: 'participants', slug: 'participants', icon: Users },
  { key: 'history', slug: 'history', icon: History },
] as const satisfies readonly { key: string; slug: string; icon: LucideIcon }[]

export type DocSection = (typeof DOC_SECTIONS)[number]

export function docHref(section: DocSection): string {
  return section.slug === 'overview' ? '/docs' : `/docs/${section.slug}`
}

export function findDocSection(slug: string): DocSection | undefined {
  return DOC_SECTIONS.find((s) => s.slug === slug)
}
