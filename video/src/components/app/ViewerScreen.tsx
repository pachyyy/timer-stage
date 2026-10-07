import type React from "react";
import { formatDuration } from "@/lib/timer/model";
import { blinkStep, phaseFor, type TimerPhase } from "@/lib/timer/phase";
import { ConnectionBadge } from "./ConnectionBadge";
import { Logo } from "./Logo";

const PHASE_CLASS: Record<TimerPhase, string> = {
  normal: "text-white",
  wrapup: "text-amber-400",
  overtime: "text-red-500",
};

// Same final-minute cycle as src/components/timer-display.tsx: black → red → white surfaces.
const BLINK_DIGIT_CLASS = ["text-white", "text-white", "text-black"] as const;
const BLINK_SURFACE = ["#000000", "#dc2626", "#ffffff"] as const;
const BLINK_TEXT = ["#ffffff", "#ffffff", "#000000"] as const;

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
  /** Run the final-minute colour cycle (the real screen skips it only for reduced motion). */
  blink?: boolean;
  blackout?: boolean;
  /** "You've been made an operator" pill, and whether it's on its attention flash. */
  promotedLabel?: string | null;
  promotedFlash?: boolean;
  promotedRef?: React.Ref<HTMLSpanElement>;
}> = ({
  timerName,
  remainingMs,
  wrapUpMs = 60_000,
  liveLabel,
  message,
  messageOpacity = 1,
  size,
  compact,
  blink = false,
  blackout = false,
  promotedLabel,
  promotedFlash,
  promotedRef,
}) => {
  if (blackout) return <div className="h-full w-full bg-black" />;
  const step = blink ? blinkStep(remainingMs) : null;
  const digitClass = step === null ? PHASE_CLASS[phaseFor(remainingMs, wrapUpMs)] : BLINK_DIGIT_CLASS[step];

  return (
    <div
      className="relative flex h-full w-full flex-col items-center justify-center gap-2"
      style={{ backgroundColor: step === null ? "#000" : BLINK_SURFACE[step], color: step === null ? "#fff" : BLINK_TEXT[step] }}
    >
      <div className={`absolute ${compact ? "top-2 right-2 origin-top-right scale-75" : "top-3 right-3"}`}>
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
      {promotedLabel && (
        <span
          ref={promotedRef}
          className={`absolute top-9 left-2.5 rounded-full px-2.5 py-1 text-[10px] leading-tight font-medium text-black ${
            promotedFlash ? "bg-white ring-4 ring-emerald-400" : "bg-emerald-500"
          }`}
        >
          {promotedLabel}
        </span>
      )}
      {/* On a real full-size screen the banner clears the centred readout with room to spare; in these
       * miniatures it would cover the segment name, so the readout eases down to make room. */}
      <div
        className="flex flex-col items-center gap-2"
        style={{ translate: `0 ${(message ? messageOpacity : 0) * (compact ? 12 : 24)}px` }}
      >
        <div className={`opacity-50 ${compact ? "text-xs" : "text-base"}`}>{timerName}</div>
        <div className={`font-mono leading-none tabular-nums ${digitClass}`} style={{ fontSize: size }}>
          {formatDuration(remainingMs)}
        </div>
      </div>
    </div>
  );
};
