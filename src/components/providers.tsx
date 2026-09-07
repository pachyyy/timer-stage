'use client'

import { SessionProvider } from 'next-auth/react'
import type { ReactNode } from 'react'

/** The one client boundary in an otherwise provider-free layout — `useSession()` (auth-buttons.tsx,
 * the homepage, the controller page's claim banner) needs this context to read the signed-in
 * session without each of them fetching it separately. */
export function Providers({ children }: { children: ReactNode }) {
  return <SessionProvider>{children}</SessionProvider>
}
