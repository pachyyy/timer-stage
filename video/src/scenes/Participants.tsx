import type React from "react";
import { useRef } from "react";
import { useCurrentFrame, useVideoConfig } from "remotion";
import { BROWSER_BAR_HEIGHT, BrowserFrame } from "../components/BrowserFrame";
import { Cursor } from "../components/Cursor";
import { Device } from "../components/Device";
import { Page, Screen } from "../components/Screen";
import { Stage } from "../components/Stage";
import { ControlPage, ParticipantsCard } from "../components/app/ControlPage";
import { Logo } from "../components/app/Logo";
import { OperatorPanel } from "../components/app/OperatorPanel";
import { ViewerScreen } from "../components/app/ViewerScreen";
import { CAPTIONS } from "../lib/captions";
import { makeT, type Locale } from "../lib/i18n";
import { pressScale, progress } from "../lib/motion";

export type ParticipantsProps = {
  locale: Locale;
  roomName: string;
  roomCode: string;
  /** Everyone already joined; the last one is given control. */
  participants: string[];
  segmentName: string;
  remainingAtStartMs: number;
};

const OPERATOR = { x: 40, y: 50, w: 800, h: 640 };
const PHONE = { x: 900, y: 50, w: 320, h: 640 };
const BEZEL = 7;

/**
 * Manage participants: the operator gives one participant control. Their phone flags it at once
 * (the green banner, flashing as useRoleAlert does) and one tap opens their own operator panel.
 */
export const Participants: React.FC<ParticipantsProps> = ({
  locale,
  roomName,
  roomCode,
  participants,
  segmentName,
  remainingAtStartMs,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = makeT(locale);
  const captions = CAPTIONS[locale];

  const giveRef = useRef<HTMLButtonElement>(null);
  const bannerRef = useRef<HTMLSpanElement>(null);

  // --- Timeline -----------------------------------------------------------------------------
  const CLICK_GIVE = Math.round(1.3 * fps);
  const PROMOTED = CLICK_GIVE + 4;
  // src/lib/alert.ts's ALERT_FLASH_DURATION_MS: the banner holds its white attention state for 1.2s.
  const FLASH_FRAMES = Math.round(1.2 * fps);
  const TAP_BANNER = PROMOTED + FLASH_FRAMES + Math.round(1.2 * fps);
  const SHOW_PANEL = TAP_BANNER + 6;

  const remainingMs = remainingAtStartMs - (frame / fps) * 1000;
  const promotedIndex = participants.length - 1;
  const rows = participants.map((name, i) => ({
    name,
    operator: i === promotedIndex && frame >= PROMOTED,
    giveRef: i === promotedIndex ? giveRef : undefined,
    giveStyle: i === promotedIndex ? { scale: String(pressScale(frame, CLICK_GIVE)) } : undefined,
  }));

  const panel = progress(frame, SHOW_PANEL, 7);
  const inner = { w: PHONE.w - 2 * BEZEL, h: PHONE.h - 2 * BEZEL };
  const pointerOn = 1 - progress(frame, CLICK_GIVE + fps, 8);
  const fingerOn = progress(frame, CLICK_GIVE + fps, 8) * (1 - progress(frame, TAP_BANNER + 8, 8));

  return (
    <Stage>
      <div className="absolute" style={{ left: OPERATOR.x, top: OPERATOR.y }}>
        <BrowserFrame path={`/r/${roomCode}/control`} width={OPERATOR.w} height={OPERATOR.h}>
          <Screen width={OPERATOR.w} height={OPERATOR.h - BROWSER_BAR_HEIGHT} scale={1.15}>
            <Page opacity={1}>
              <ControlPage t={t} roomName={roomName} scrollY={150}>
                <OperatorPanel t={t} timerName={segmentName} remainingMs={remainingMs} isRunning />
                <ParticipantsCard t={t} rows={rows} />
              </ControlPage>
            </Page>
          </Screen>
        </BrowserFrame>
        <div className="mt-3 text-center text-[15px] font-medium text-muted-foreground">{captions.operator}</div>
      </div>

      <Device kind="phone" x={PHONE.x} y={PHONE.y} width={PHONE.w} height={PHONE.h} label={participants[promotedIndex]}>
        <Screen width={inner.w} height={inner.h} scale={1}>
          <Page opacity={1 - panel} className="bg-black">
            <ViewerScreen
              timerName={segmentName}
              remainingMs={remainingMs}
              liveLabel={t("connectionBadge", "live")}
              size={72}
              compact
              promotedLabel={frame >= PROMOTED ? t("screen", "promotedBanner") : null}
              promotedFlash={frame >= PROMOTED && frame < PROMOTED + FLASH_FRAMES}
              promotedRef={bannerRef}
            />
          </Page>
          <Page opacity={panel}>
            {/* Their own /control page — header trimmed to fit a phone, the panel itself unchanged. */}
            <div className="flex flex-col gap-4 p-3">
              <div className="flex items-center gap-2">
                <Logo />
                <span className="text-xl font-semibold">{t("control", "title")}</span>
              </div>
              <OperatorPanel t={t} timerName={segmentName} remainingMs={remainingMs} isRunning />
            </div>
          </Page>
        </Screen>
      </Device>

      <div style={{ opacity: pointerOn }}>
        <Cursor
          waypoints={[
            { at: 0, to: [560, 300] },
            { at: CLICK_GIVE, to: giveRef, click: true, move: 22 },
          ]}
        />
      </div>
      <div style={{ opacity: fingerOn }}>
        <Cursor
          variant="touch"
          waypoints={[
            { at: 0, to: [1060, 560] },
            { at: TAP_BANNER, to: bannerRef, click: true, move: 20 },
          ]}
        />
      </div>
    </Stage>
  );
};
