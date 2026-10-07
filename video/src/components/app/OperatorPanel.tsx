import type React from "react";
import { Minus, Pause, Play, Plus, RotateCcw, Square } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatDuration } from "@/lib/timer/model";
import { phaseFor, type TimerPhase } from "@/lib/timer/phase";
import type { T } from "../../lib/i18n";
import { SwitchMock } from "./Dialog";

const PHASE_CLASS: Record<TimerPhase, string> = {
  normal: "text-foreground",
  wrapup: "text-amber-600",
  overtime: "text-destructive",
};

const FLASH_CLASS = "bg-destructive text-white border-destructive hover:bg-destructive";

/** Static render of src/components/controller-panel.tsx — same markup, state passed in per frame. */
export const OperatorPanel: React.FC<{
  t: T;
  timerName: string;
  remainingMs: number;
  wrapUpMs?: number;
  isRunning: boolean;
  /** Whether an event is open — gates "End event", as `hasOpenRun` does in the real panel. */
  hasOpenRun?: boolean;
  blackout?: boolean;
  /** Which ±1 min button is mid-flash (the real panel's click confirmation). */
  flash?: "minus" | "plus" | null;
  startRef?: React.Ref<HTMLButtonElement>;
  startStyle?: React.CSSProperties;
  plusRef?: React.Ref<HTMLButtonElement>;
  plusStyle?: React.CSSProperties;
  blackoutRef?: React.Ref<HTMLSpanElement>;
  endRef?: React.Ref<HTMLButtonElement>;
  endStyle?: React.CSSProperties;
}> = ({
  t,
  timerName,
  remainingMs,
  wrapUpMs = 60_000,
  isRunning,
  hasOpenRun = isRunning,
  blackout = false,
  flash,
  startRef,
  startStyle,
  plusRef,
  plusStyle,
  blackoutRef,
  endRef,
  endStyle,
}) => (
  <div className="flex flex-col gap-4 rounded-xl border p-5">
    <div className="text-sm text-muted-foreground">{timerName}</div>
    <div className={`font-mono text-6xl font-semibold tabular-nums ${PHASE_CLASS[phaseFor(remainingMs, wrapUpMs)]}`}>
      {formatDuration(remainingMs)}
    </div>
    <div className="flex flex-wrap items-center gap-2">
      <Button ref={startRef} size="lg" style={startStyle}>
        {isRunning ? <Pause className="size-4" /> : <Play className="size-4" />}
        {isRunning ? t("common", "pause") : t("common", "start")}
      </Button>
      <Button variant="outline" size="lg">
        <RotateCcw className="size-4" />
        {t("common", "reset")}
      </Button>
      <div className="mx-1 h-6 w-px bg-border" />
      <Button variant="outline" size="sm" className={flash === "minus" ? FLASH_CLASS : ""}>
        <Minus className="size-4" /> {t("operatorPanel", "oneMin")}
      </Button>
      <Button ref={plusRef} variant="outline" size="sm" className={flash === "plus" ? FLASH_CLASS : ""} style={plusStyle}>
        <Plus className="size-4" /> {t("operatorPanel", "oneMin")}
      </Button>
    </div>
    <div className="flex items-center justify-between gap-2 pt-2">
      <div className="flex items-center gap-2">
        <SwitchMock checked={blackout} innerRef={blackoutRef} />
        <span className="text-sm leading-none font-medium">{t("operatorPanel", "blackoutLabel")}</span>
      </div>
      <Button
        ref={endRef}
        variant="outline"
        size="sm"
        className="text-destructive hover:text-destructive"
        disabled={!hasOpenRun}
        style={endStyle}
      >
        <Square className="size-3.5" /> {t("operatorPanel", "endEvent")}
      </Button>
    </div>
    <p className="text-xs text-muted-foreground">
      {/* The real panel renders this with t.rich(); the one tag it uses is mapped by hand here. */}
      {t("operatorPanel", "spaceTip")
        .split(/<kbd>(.*?)<\/kbd>/)
        .map((part, i) =>
          i % 2 === 1 ? (
            <kbd key={i} className="rounded border px-1">
              {part}
            </kbd>
          ) : (
            part
          ),
        )}
    </p>
  </div>
);
