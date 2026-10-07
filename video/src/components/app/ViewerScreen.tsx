import type React from "react";
import { formatDuration } from "@/lib/timer/model";
import { phaseFor, type TimerPhase } from "@/lib/timer/phase";
import { ConnectionBadge } from "./ConnectionBadge";
import { Logo } from "./Logo";

const PHASE_CLASS: Record<TimerPhase, string> = {
  normal: "text-white",
  wrapup: "text-amber-400",
  overtime: "text-red-500",
};

/**
 * src/app/r/[roomId]/page.tsx's fullscreen output, scaled to whatever box it's placed in. `size`
 * is the digit height in px — the real TimerDisplay fits digits to the container width in JS; here
 * the caller picks it per device.
 */
export const ViewerScreen: React.FC<{
  timerName: string;
  remainingMs: number;
  wrapUpMs?: number;
  liveLabel: string;
  message?: string | null;
  messageOpacity?: number;
  size: number;
  compact?: boolean;
}> = ({ timerName, remainingMs, wrapUpMs = 60_000, liveLabel, message, messageOpacity = 1, size, compact }) => (
  <div className="relative flex h-full w-full flex-col items-center justify-center gap-2 bg-black text-white">
    <div className={`absolute ${compact ? "top-2 right-2 scale-75 origin-top-right" : "top-3 right-3"}`}>
      <ConnectionBadge label={liveLabel} />
    </div>
    <Logo size={compact ? 16 : 22} className={`absolute opacity-60 ${compact ? "top-2.5 left-2.5" : "top-3.5 left-3.5"}`} />
    {message && (
      <div
        className={`absolute inset-x-0 mx-auto rounded-lg bg-amber-400 text-center font-semibold text-black ${
          compact ? "top-9 w-[88%] px-2 py-1.5 text-[11px] leading-tight" : "top-9 w-[86%] px-4 py-2 text-base"
        }`}
        style={{ opacity: messageOpacity, translate: `0 ${(1 - messageOpacity) * -8}px` }}
      >
        {message}
      </div>
    )}
    {/* On a real full-size screen the banner clears the centred readout with room to spare; in these
     * miniatures it would cover the segment name, so the readout eases down to make room. */}
    <div
      className="flex flex-col items-center gap-2"
      style={{ translate: `0 ${(message ? messageOpacity : 0) * (compact ? 12 : 24)}px` }}
    >
      <div className={`opacity-50 ${compact ? "text-xs" : "text-base"}`}>{timerName}</div>
      <div
        className={`font-mono leading-none tabular-nums ${PHASE_CLASS[phaseFor(remainingMs, wrapUpMs)]}`}
        style={{ fontSize: size }}
      >
        {formatDuration(remainingMs)}
      </div>
    </div>
  </div>
);
