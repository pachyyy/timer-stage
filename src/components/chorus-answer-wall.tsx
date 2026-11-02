'use client'

import type { ChorusAnswerRow } from '@/lib/chorus/types'

/**
 * The presenter window's answer wall: newest first, in balanced CSS columns so short and long
 * answers pack without a JS masonry library. `fontPercent` (the operator's A−/A+) scales only the
 * answers, never the question above them. Each card fades in on first render — keyed by answer
 * id, so only genuinely new answers animate when a poll lands.
 */
export function ChorusAnswerWall({ answers, fontPercent }: { answers: ChorusAnswerRow[]; fontPercent: number }) {
  return (
    <div
      className="columns-1 gap-4 sm:columns-2 xl:columns-3"
      style={{ fontSize: `calc(clamp(1rem, 1.6vw, 2rem) * ${fontPercent / 100})` }}
    >
      {answers.map((answer) => (
        <div
          key={answer.id}
          className="mb-4 break-inside-avoid rounded-xl bg-white/10 px-[1em] py-[0.7em] leading-snug break-words whitespace-pre-wrap text-white animate-in fade-in zoom-in-95 duration-500"
        >
          {answer.text}
        </div>
      ))}
    </div>
  )
}
