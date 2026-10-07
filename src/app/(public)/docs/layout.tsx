import type { ReactNode } from 'react'
import { DocsNav } from '@/components/docs-nav'

/** Section list beside the content, inside (public)'s AdaptiveShell — see DocsNav. */
export default function DocsLayout({ children }: { children: ReactNode }) {
  return (
    <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-8 px-4 py-10 md:flex-row md:gap-12">
      <DocsNav />
      <main className="min-w-0 flex-1">{children}</main>
    </div>
  )
}
