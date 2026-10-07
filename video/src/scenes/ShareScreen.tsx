import type React from "react";
import { useRef } from "react";
import { useCurrentFrame, useVideoConfig } from "remotion";
import { BROWSER_BAR_HEIGHT, BrowserFrame } from "../components/BrowserFrame";
import { Cursor } from "../components/Cursor";
import { Page, Screen } from "../components/Screen";
import { Stage } from "../components/Stage";
import { ControlPage, ParticipantsCard, ShareCard } from "../components/app/ControlPage";
import { JoinScreen } from "../components/app/JoinScreen";
import { ViewerScreen } from "../components/app/ViewerScreen";
import { makeT, type Locale } from "../lib/i18n";
import { pressScale, progress, typed, typedEnd } from "../lib/motion";
import { HOST } from "../lib/theme";

export type ShareScreenProps = {
  locale: Locale;
  roomName: string;
  roomCode: string;
  screenToken: string;
  screenName: string;
  segmentName: string;
  segmentMinutes: number;
};

// Side by side rather than overlapping, so neither window hides the other's part of the story.
const OPERATOR = { x: 40, y: 70, w: 640, h: 660 };
const SCREEN = { x: 710, y: 170, w: 530, h: 420 };

/**
 * Share a screen: copy the direct screen link from the operator page, open it on the display
 * machine, give the screen a name — and it shows the timer, and appears in the operator's
 * Participants list.
 */
export const ShareScreen: React.FC<ShareScreenProps> = ({
  locale,
  roomName,
  roomCode,
  screenToken,
  screenName,
  segmentName,
  segmentMinutes,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = makeT(locale);

  const copyRef = useRef<HTMLButtonElement>(null);
  const nameRef = useRef<HTMLInputElement>(null);
  const joinRef = useRef<HTMLButtonElement>(null);

  // --- Timeline -----------------------------------------------------------------------------
  const CLICK_COPY = fps;
  const OPEN_SCREEN = CLICK_COPY + fps;
  const CLICK_NAME = OPEN_SCREEN + Math.round(0.8 * fps);
  const CLICK_JOIN = typedEnd(CLICK_NAME + 4, screenName, 2) + 12;
  const SHOW_TIMER = CLICK_JOIN + 10;

  const screenPath = `/r/${roomCode}?t=${screenToken}`;
  const screenIn = progress(frame, OPEN_SCREEN, 12);
  const joined = progress(frame, SHOW_TIMER, 8);

  return (
    <Stage>
      <BrowserFrame
        path={`/r/${roomCode}/control`}
        width={OPERATOR.w}
        height={OPERATOR.h}
        style={{ left: OPERATOR.x, top: OPERATOR.y }}
      >
        <Screen width={OPERATOR.w} height={OPERATOR.h - BROWSER_BAR_HEIGHT} scale={1}>
          <Page opacity={1}>
            <ControlPage t={t} roomName={roomName}>
              <ShareCard
                t={t}
                roomCode={roomCode}
                screenUrl={`https://${HOST}${screenPath}`}
                copied={frame >= CLICK_COPY ? "link" : null}
                copyLinkRef={copyRef}
                copyLinkStyle={{ scale: String(pressScale(frame, CLICK_COPY)) }}
              />
              <ParticipantsCard
                t={t}
                rows={frame >= SHOW_TIMER + 4 ? [{ name: screenName, operator: false, enter: progress(frame, SHOW_TIMER + 4, 8) }] : []}
              />
            </ControlPage>
          </Page>
        </Screen>
      </BrowserFrame>

      <BrowserFrame
        path={screenPath}
        width={SCREEN.w}
        height={SCREEN.h}
        style={{
          left: SCREEN.x,
          top: SCREEN.y,
          opacity: screenIn,
          translate: `${(1 - screenIn) * 40}px ${(1 - screenIn) * 20}px`,
        }}
      >
        <Screen width={SCREEN.w} height={SCREEN.h - BROWSER_BAR_HEIGHT} scale={1}>
          <Page opacity={1 - joined} className="bg-black">
            <JoinScreen
              t={t}
              name={typed(frame, CLICK_NAME + 4, screenName, 2)}
              focused={frame >= CLICK_NAME && frame < CLICK_JOIN}
              joining={frame >= CLICK_JOIN}
              nameRef={nameRef}
              joinRef={joinRef}
              joinStyle={{ scale: String(pressScale(frame, CLICK_JOIN)) }}
            />
          </Page>
          <Page opacity={joined} className="bg-black">
            <ViewerScreen
              timerName={segmentName}
              remainingMs={segmentMinutes * 60_000}
              liveLabel={t("connectionBadge", "live")}
              size={110}
            />
          </Page>
        </Screen>
      </BrowserFrame>

      {/* One pointer across both windows, so it lives on the stage rather than inside either Screen. */}
      <Cursor
        waypoints={[
          { at: 0, to: [560, 420] },
          { at: CLICK_COPY, to: copyRef, click: true, move: 20 },
          { at: CLICK_NAME, to: nameRef, click: true, offset: [-80, 0], move: 20 },
          { at: CLICK_JOIN, to: joinRef, click: true, move: 14 },
          { at: SHOW_TIMER + fps, to: [1100, 650], move: 24 },
        ]}
      />
    </Stage>
  );
};
