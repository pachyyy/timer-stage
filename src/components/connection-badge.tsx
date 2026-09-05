'use client'

import type { TransportStatus } from '@/lib/sync/transport'

const LABEL: Record<TransportStatus, string> = {
  connecting: 'Connecting…',
  live: 'Live',
  degraded: 'Reconnecting…',
  offline: 'Offline',
  'not-found': 'Room not found',
}

const DOT_CLASS: Record<TransportStatus, string> = {
  connecting: 'bg-amber-400',
  live: 'bg-emerald-500',
  degraded: 'bg-amber-400',
  offline: 'bg-red-500',
  'not-found': 'bg-red-500',
}

/**
 * Small always-visible indicator so an operator can tell, at a glance, whether the room is
 * actually synced right now — important because the derived-state design means the timer keeps
 * running visually even while disconnected, which is correct but could otherwise mask a real
 * problem (e.g. a viewer stuck on stale state for a long outage).
 */
export function ConnectionBadge({ status }: { status: TransportStatus }) {
  return (
    <div className="flex items-center gap-1.5 rounded-full bg-black/40 px-2.5 py-1 text-xs text-white/80">
      <span className={`h-1.5 w-1.5 rounded-full ${DOT_CLASS[status]}`} />
      {LABEL[status]}
    </div>
  )
}
