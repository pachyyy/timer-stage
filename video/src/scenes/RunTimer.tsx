import type React from "react";
import { useRef } from "react";
import { interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { FastForward } from "lucide-react";
import { BROWSER_BAR_HEIGHT, BrowserFrame } from "../components/BrowserFrame";
import { Cursor } from "../components/Cursor";
import { Device } from "../components/Device";
import { Page, Screen } from "../components/Screen";
import { Stage } from "../components/Stage";
import { OperatorPanel } from "../components/app/OperatorPanel";
import { ViewerScreen } from "../components/app/ViewerScreen";
import { CAPTIONS } from "../lib/captions";
import { makeT, type Locale } from "../lib/i18n";
import { pressScale, progress } from "../lib/motion";
import { easeOut, UI_SCALE } from "../lib/theme";

export type RunTimerProps = {
  locale: Locale;
  roomCode: string;
  segmentName: string;
  segmentMinutes: number;
};

const WINDOW = { x: 40, y: 120, w: 680, h: 500 };

/**
 * Run the timer: Start, then a fast-forward through the segment so the screen's phases all show —
 * amber wrap-up, the black/red/white final-minute cycle, red overtime — and finally "Black out
 * screens".
 */
export const RunTimer: React.FC<RunTimerProps> = ({ locale, roomCode, segmentName, segmentMinutes }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = makeT(locale);
  const captions = CAPTIONS[locale];

  const startRef = useRef<HTMLButtonElement>(null);
  const blackoutRef = useRef<HTMLSpanElement>(null);

  // --- Timeline -----------------------------------------------------------------------------
  const CLICK_START = fps;
  const FF_START = CLICK_START + fps;
  const FF_END = FF_START + 2 * fps;
  /** Remaining time when real-time playback resumes — inside the final-minute blink. */
  const RESUME_AT_MS = 3_500;
  const CLICK_BLACKOUT = FF_END + Math.round(5.2 * fps);

  // --- Shared run state ---------------------------------------------------------------------
  const durationMs = segmentMinutes * 60_000;
  const elapsedAtFfStart = ((FF_START - CLICK_START) / fps) * 1000;
  const elapsedAtFfEnd = durationMs - RESUME_AT_MS;
  let elapsedMs = 0;
  if (frame >= FF_END) elapsedMs = elapsedAtFfEnd + ((frame - FF_END) / fps) * 1000;
  else if (frame >= FF_START)
    // Eases out so the run slows into wrap-up rather than flashing past the amber phase.
    elapsedMs = interpolate(frame, [FF_START, FF_END], [elapsedAtFfStart, elapsedAtFfEnd], { easing: easeOut });
  else if (frame >= CLICK_START) elapsedMs = ((frame - CLICK_START) / fps) * 1000;
  const remainingMs = durationMs - elapsedMs;
  const running = frame >= CLICK_START;
  const blackout = frame >= CLICK_BLACKOUT;
  const fastForward = progress(frame, FF_START - 4, 6) - progress(frame, FF_END, 6);

  return (
    <Stage>
      <div
        className="absolute top-12 left-1/2 flex items-center gap-2 rounded-full bg-foreground px-4 py-2 text-[15px] font-medium text-background"
        style={{ translate: "-50% 0", opacity: fastForward }}
      >
        <FastForward className="size-4" />
        {captions.fastForward}
      </div>

      <div className="absolute" style={{ left: WINDOW.x, top: WINDOW.y }}>
        <BrowserFrame path={`/r/${roomCode}/control`} width={WINDOW.w} height={WINDOW.h}>
          <Screen
            width={WINDOW.w}
            height={WINDOW.h - BROWSER_BAR_HEIGHT}
            scale={UI_SCALE}
            overlay={
              <Cursor
                waypoints={[
                  { at: 0, to: [380, 330] },
                  { at: CLICK_START, to: startRef, click: true, move: 20 },
                  { at: CLICK_START + fps, to: [420, 345], move: 24 },
                  { at: CLICK_BLACKOUT, to: blackoutRef, click: true, move: 22 },
                  { at: CLICK_BLACKOUT + fps, to: [300, 345], move: 20 },
                ]}
              />
            }
          >
            <Page opacity={1}>
              <div className="p-4">
                <OperatorPanel
                  t={t}
                  timerName={segmentName}
                  remainingMs={remainingMs}
                  isRunning={running}
                  blackout={blackout}
                  startRef={startRef}
                  startStyle={{ scale: String(pressScale(frame, CLICK_START)) }}
                  blackoutRef={blackoutRef}
                />
              </div>
            </Page>
          </Screen>
        </BrowserFrame>
        <div className="mt-3 text-center text-[15px] font-medium text-muted-foreground">{captions.operator}</div>
      </div>

      <Device kind="monitor" x={760} y={WINDOW.y + 40} width={480} height={280} label={captions.stage}>
        <ViewerScreen
          timerName={segmentName}
          remainingMs={remainingMs}
          liveLabel={t("connectionBadge", "live")}
          size={112}
          blink={frame >= FF_END}
          blackout={blackout}
        />
      </Device>
    </Stage>
  );
};
