import { useId } from 'react'
import { cn } from '@/lib/utils'

/**
 * Line-art illustrations for the /about page's two name cards. Drawn in `currentColor` (fills at
 * low opacity) rather than shipped as image files, so they follow the surrounding text colour in
 * both light and dark mode with no extra assets.
 */

/** An Athenian klepsydra: a two-handled clay pot draining through a spout at its base. */
export function WaterClockIllustration({ className }: { className?: string }) {
  // useId keeps the clipPath id unique if this is ever rendered twice on one page.
  const clipId = `water-clock-${useId().replace(/:/g, '')}`
  const pot = 'M34 24 C30 50 32 76 46 88 L74 88 C88 76 90 50 86 24 Z'

  return (
    <svg
      viewBox="0 0 120 120"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={cn('size-24', className)}
    >
      <defs>
        <clipPath id={clipId}>
          <path d={pot} />
        </clipPath>
      </defs>
      {/* Water inside the pot, with a gently curved surface. */}
      <g clipPath={`url(#${clipId})`}>
        <path
          d="M20 50 Q35 46 50 50 T80 50 T110 50 V100 H20 Z"
          fill="currentColor"
          fillOpacity={0.15}
          stroke="none"
        />
        <path d="M20 50 Q35 46 50 50 T80 50 T110 50" strokeOpacity={0.5} />
      </g>
      <path d={pot} />
      <path d="M28 24 H92" />
      {/* Handles */}
      <path d="M33 34 C22 34 22 50 32 52" />
      <path d="M87 34 C98 34 98 50 88 52" />
      {/* Spout and falling drops */}
      <path d="M57 88 V94 H63 V88" />
      <path d="M60 99 C62.5 102 63.5 104.5 60 107 C56.5 104.5 57.5 102 60 99 Z" fill="currentColor" fillOpacity={0.5} />
      <path
        d="M60 111 C61.8 113.2 62.5 115 60 116.8 C57.5 115 58.2 113.2 60 111 Z"
        fill="currentColor"
        fillOpacity={0.25}
        strokeOpacity={0.5}
      />
    </svg>
  )
}

/** A small chorus: three figures speaking together, their words gathering above them. */
export function ChorusIllustration({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 120 120"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={cn('size-24', className)}
    >
      {/* Speech bubbles */}
      <path d="M12 24 a6 6 0 0 1 6 -6 H40 a6 6 0 0 1 6 6 V36 a6 6 0 0 1 -6 6 H32 L26 50 L26 42 H18 a6 6 0 0 1 -6 -6 Z" />
      <path d="M20 27 H38 M20 33 H32" strokeOpacity={0.5} />
      <path
        d="M44 12 a6 6 0 0 1 6 -6 H70 a6 6 0 0 1 6 6 V26 a6 6 0 0 1 -6 6 H64 L60 40 L56 32 H50 a6 6 0 0 1 -6 -6 Z"
        fill="currentColor"
        fillOpacity={0.15}
      />
      <path d="M52 16 H68 M52 22 H64" strokeOpacity={0.5} />
      <path d="M74 24 a6 6 0 0 1 6 -6 H102 a6 6 0 0 1 6 6 V36 a6 6 0 0 1 -6 6 H94 L94 50 L88 42 H80 a6 6 0 0 1 -6 -6 Z" />
      <path d="M82 27 H100 M82 33 H94" strokeOpacity={0.5} />
      {/* Figures */}
      <circle cx={26} cy={66} r={8} />
      <path d="M12 98 C12 82 40 82 40 98" />
      <circle cx={60} cy={60} r={9} />
      <path d="M44 98 C44 78 76 78 76 98" />
      <circle cx={94} cy={66} r={8} />
      <path d="M80 98 C80 82 108 82 108 98" />
      <path d="M8 106 H112" strokeOpacity={0.5} />
    </svg>
  )
}
