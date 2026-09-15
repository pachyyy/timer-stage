import type { ReactNode } from 'react'
import { AdaptiveShell } from '@/components/adaptive-shell'

/**
 * /pricing and /docs: public, but should keep the AppSidebar chrome once someone is signed in
 * rather than dropping back to the marketing navbar — see AdaptiveShell for why this needs to be
 * a separate group from (marketing) and (app).
 */
export default function PublicLayout({ children }: { children: ReactNode }) {
  return <AdaptiveShell>{children}</AdaptiveShell>
}
