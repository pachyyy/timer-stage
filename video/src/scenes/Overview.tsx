import type React from "react";
import { useRef } from "react";
import { useCurrentFrame, useVideoConfig } from "remotion";
import { BROWSER_BAR_HEIGHT, BrowserFrame } from "../components/BrowserFrame";
import { Cursor } from "../components/Cursor";
import { Device } from "../components/Device";
import { Page, Screen } from "../components/Screen";
import { Stage } from "../components/Stage";
import { Logo } from "../components/app/Logo";
import { MessageCard } from "../components/app/MessageCard";
import { OperatorPanel } from "../components/app/OperatorPanel";
import { ViewerScreen } from "../components/app/ViewerScreen";
import { CAPTIONS } from "../lib/captions";
import { makeT, type Locale } from "../lib/i18n";
import { pressScale, progress, typed, typedEnd } from "../lib/motion";

export type OverviewProps = {
  locale: Locale;
  roomCode: string;
  segmentName: string;
  segmentMinutes: number;
};


const WINDOW = { x: 40, y: 56, w: 640, h: 640 };
const OPERATOR_SCALE = 1.1;

/**
 * Overview: one operator drives every screen. Start, a +1 min adjustment and a message to the
 * screens all land on the stage monitor, a tablet and a participant's phone on the same frame —
 * the derived-state model (CLAUDE.md) in one picture — then the brand end card.
 */
export const Overview: React.FC<OverviewProps> = ({ locale, roomCode, segmentName, segmentMinutes }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = makeT(locale);
  const captions = CAPTIONS[locale];

  const startRef = useRef<HTMLButtonElement>(null);
  const plusRef = useRef<HTMLButtonElement>(null);
  const messageRef = useRef<HTMLInputElement>(null);
  const sendRef = useRef<HTMLButtonElement>(null);

  // --- Timeline -----------------------------------------------------------------------------
  const CLICK_START = Math.round(1.5 * fps);
  const CLICK_PLUS = CLICK_START + 2 * fps;
  const CLICK_MESSAGE = CLICK_PLUS + fps;
  const message = t("control", "messagePlaceholder").replace(/…$/, "");
  const TYPE_MESSAGE = CLICK_MESSAGE + 4;
  const CLICK_SEND = typedEnd(TYPE_MESSAGE, message, 1) + 12;
  const SHOW_MESSAGE = CLICK_SEND + 2;
  const END_CARD = SHOW_MESSAGE + Math.round(2.2 * fps);

  // --- Shared run state, derived identically for every screen ---------------------------------
  const running = frame >= CLICK_START;
  const remainingMs =
    segmentMinutes * 60_000 +
    (frame >= CLICK_PLUS ? 60_000 : 0) -
    (Math.max(0, frame - CLICK_START) / fps) * 1000;
  const liveMessage = frame >= SHOW_MESSAGE ? message : null;
  const messageIn = progress(frame, SHOW_MESSAGE, 8);
  const flash = frame >= CLICK_PLUS && frame < CLICK_PLUS + 15 ? "plus" : null;

  const enter = (delay: number): React.CSSProperties => ({
    opacity: progress(frame, delay, 14) * (1 - progress(frame, END_CARD, 14)),
    translate: `0 ${(1 - progress(frame, delay, 14)) * 16}px`,
  });
  const endCard = progress(frame, END_CARD + 8, 16);

  const screen = (size: number, compact = false) => (
    <ViewerScreen
      timerName={segmentName}
      remainingMs={remainingMs}
      liveLabel={t("connectionBadge", "live")}
      message={liveMessage}
      messageOpacity={messageIn}
      size={size}
      compact={compact}
    />
  );

  return (
    <Stage>
      <div className="absolute" style={{ left: WINDOW.x, top: WINDOW.y, ...enter(0) }}>
        <BrowserFrame path={`/r/${roomCode}/control`} width={WINDOW.w} height={WINDOW.h}>
          <Screen
            width={WINDOW.w}
            height={WINDOW.h - BROWSER_BAR_HEIGHT}
            scale={OPERATOR_SCALE}
            overlay={
              <Cursor
                waypoints={[
                  { at: 0, to: [380, 470] },
                  { at: CLICK_START, to: startRef, click: true, move: 22 },
                  { at: CLICK_PLUS, to: plusRef, click: true, move: 18 },
                  { at: CLICK_MESSAGE, to: messageRef, click: true, offset: [-100, 0], move: 16 },
                  { at: CLICK_SEND, to: sendRef, click: true, move: 12 },
                  { at: CLICK_SEND + fps, to: [420, 300], move: 26 },
                ]}
              />
            }
          >
            <Page opacity={1}>
              <div className="flex flex-col gap-4 p-4">
                <OperatorPanel
                  t={t}
                  timerName={segmentName}
                  remainingMs={remainingMs}
                  isRunning={running}
                  flash={flash}
                  startRef={startRef}
                  startStyle={{ scale: String(pressScale(frame, CLICK_START)) }}
                  plusRef={plusRef}
                  plusStyle={{ scale: String(pressScale(frame, CLICK_PLUS)) }}
                />
                <MessageCard
                  t={t}
                  draft={frame < SHOW_MESSAGE ? typed(frame, TYPE_MESSAGE, message, 1) : ""}
                  focused={frame >= CLICK_MESSAGE && frame < SHOW_MESSAGE}
                  liveMessage={liveMessage}
                  inputRef={messageRef}
                  sendRef={sendRef}
                  sendStyle={{ scale: String(pressScale(frame, CLICK_SEND)) }}
                />
              </div>
            </Page>
          </Screen>
        </BrowserFrame>
        <div className="mt-3 flex items-center justify-center gap-1.5 text-[15px] font-medium text-muted-foreground">
          {captions.operator}
        </div>
      </div>

      <Device kind="monitor" x={720} y={WINDOW.y} width={520} height={300} label={captions.stage} style={enter(6)}>
        {screen(116)}
      </Device>
      <Device kind="phone" x={736} y={448} width={156} height={300} label={captions.phone} style={enter(14)}>
        {screen(44, true)}
      </Device>
      <Device kind="tablet" x={920} y={480} width={320} height={216} label={captions.tablet} style={enter(10)}>
        {screen(72, true)}
      </Device>

      <div
        className="absolute inset-0 flex flex-col items-center justify-center gap-5"
        style={{ opacity: endCard, translate: `0 ${(1 - endCard) * 12}px` }}
      >
        <div className="flex items-center gap-4">
          <Logo size={76} className="rounded-2xl" />
          <span className="bg-[linear-gradient(135deg,var(--primary-gradient-from),var(--primary-gradient-to))] bg-clip-text text-[84px] leading-none font-semibold tracking-tight text-transparent">
            Cue
          </span>
        </div>
        <p className="max-w-3xl text-center text-[30px] leading-snug text-muted-foreground">
          {t("landing", "tagline")}
        </p>
      </div>
    </Stage>
  );
};

