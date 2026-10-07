import type React from "react";
import { useRef } from "react";
import { interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { Device } from "../components/Device";
import { Cursor } from "../components/Cursor";
import { Page, Screen } from "../components/Screen";
import { Stage } from "../components/Stage";
import { JoinScreen } from "../components/app/JoinScreen";
import { LandingPage } from "../components/app/LandingPage";
import { ViewerScreen } from "../components/app/ViewerScreen";
import { CAPTIONS } from "../lib/captions";
import { makeT, type Locale } from "../lib/i18n";
import { pressScale, progress, stepAt, typed, typedEnd } from "../lib/motion";
import { easeInOut } from "../lib/theme";

export type JoinRoomProps = {
  locale: Locale;
  roomCode: string;
  participantName: string;
  segmentName: string;
  /** Time left on the live segment when the participant gets in. */
  remainingAtJoinMs: number;
};

const PHONE = { x: 760, y: 50, w: 340, h: 700 };
const BEZEL = 7;

/**
 * Join as a participant, on a phone: no account — the room code from the landing page, a name,
 * and the live timer.
 */
export const JoinRoom: React.FC<JoinRoomProps> = ({
  locale,
  roomCode,
  participantName,
  segmentName,
  remainingAtJoinMs,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = makeT(locale);
  const captions = CAPTIONS[locale];

  const codeRef = useRef<HTMLInputElement>(null);
  const joinRef = useRef<HTMLButtonElement>(null);
  const nameRef = useRef<HTMLInputElement>(null);
  const gateJoinRef = useRef<HTMLButtonElement>(null);

  // --- Timeline -----------------------------------------------------------------------------
  const SCROLL = Math.round(0.5 * fps);
  const TAP_CODE = SCROLL + fps;
  const TAP_JOIN = typedEnd(TAP_CODE + 4, roomCode, 2) + 12;
  const SHOW_GATE = TAP_JOIN + 6;
  const TAP_NAME = SHOW_GATE + Math.round(0.7 * fps);
  const TAP_GATE_JOIN = typedEnd(TAP_NAME + 4, participantName, 2) + 12;
  const SHOW_TIMER = TAP_GATE_JOIN + 10;

  const step = stepAt(frame, [0, SHOW_GATE, SHOW_TIMER]);
  const landing = 1 - progress(frame, SHOW_GATE, 7);
  const gate = progress(frame, SHOW_GATE, 7) - progress(frame, SHOW_TIMER, 7);
  const viewer = progress(frame, SHOW_TIMER, 7);
  const inner = { w: PHONE.w - 2 * BEZEL, h: PHONE.h - 2 * BEZEL };

  return (
    <Stage>
      <ol
        className="absolute top-1/2 left-[110px] flex flex-col gap-7"
        style={{ translate: "0 -50%" }}
      >
        {captions.joinSteps.map((label, i) => (
          <li
            key={label}
            className="flex items-center gap-4 text-[30px] font-semibold tracking-tight"
            style={{ opacity: i === step ? 1 : 0.35 }}
          >
            <span
              className={`flex size-11 items-center justify-center rounded-full text-[20px] ${
                i === step
                  ? "bg-[linear-gradient(135deg,var(--primary-gradient-from),var(--primary-gradient-to))] text-white"
                  : "bg-muted text-muted-foreground"
              }`}
            >
              {i + 1}
            </span>
            {label}
          </li>
        ))}
      </ol>

      <Device
        kind="phone"
        x={PHONE.x}
        y={PHONE.y}
        width={PHONE.w}
        height={PHONE.h}
        label={captions.phone}
      >
        <Screen width={inner.w} height={inner.h} scale={1}>
          <Page opacity={landing}>
            <LandingPage
              t={t}
              mobile
              scrollY={interpolate(frame, [SCROLL, SCROLL + 20], [0, 150], {
                extrapolateLeft: "clamp",
                extrapolateRight: "clamp",
                easing: easeInOut,
              })}
              code={typed(frame, TAP_CODE + 4, roomCode, 2)}
              codeFocused={frame >= TAP_CODE && frame < TAP_JOIN}
              codeRef={codeRef}
              joinRef={joinRef}
              joinStyle={{ scale: String(pressScale(frame, TAP_JOIN)) }}
            />
          </Page>
          <Page opacity={gate} className="bg-black">
            <JoinScreen
              t={t}
              name={typed(frame, TAP_NAME + 4, participantName, 2)}
              focused={frame >= TAP_NAME && frame < TAP_GATE_JOIN}
              joining={frame >= TAP_GATE_JOIN}
              nameRef={nameRef}
              joinRef={gateJoinRef}
              joinStyle={{ scale: String(pressScale(frame, TAP_GATE_JOIN)) }}
            />
          </Page>
          <Page opacity={viewer} className="bg-black">
            <ViewerScreen
              timerName={segmentName}
              remainingMs={
                remainingAtJoinMs -
                (Math.max(0, frame - SHOW_TIMER) / fps) * 1000
              }
              liveLabel={t("connectionBadge", "live")}
              size={78}
            />
          </Page>
        </Screen>
      </Device>

      {/* A finger lifts after its last tap rather than gliding off the phone. */}
      <div style={{ opacity: 1 - progress(frame, TAP_GATE_JOIN + 8, 8) }}>
        <Cursor
          variant="touch"
          waypoints={[
            { at: 0, to: [930, 600] },
            { at: TAP_CODE, to: codeRef, click: true, move: 16 },
            { at: TAP_JOIN, to: joinRef, click: true, move: 12 },
            { at: TAP_NAME, to: nameRef, click: true, move: 14 },
            { at: TAP_GATE_JOIN, to: gateJoinRef, click: true, move: 12 },
          ]}
        />
      </div>
    </Stage>
  );
};
