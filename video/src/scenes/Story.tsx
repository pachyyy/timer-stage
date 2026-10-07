import type React from "react";
import { useRef } from "react";
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { linearTiming, TransitionSeries } from "@remotion/transitions";
import { fade } from "@remotion/transitions/fade";
import { slide } from "@remotion/transitions/slide";
import { Link2 } from "lucide-react";
import { formatDuration } from "@/lib/timer/model";
import { phaseFor, type TimerPhase } from "@/lib/timer/phase";
import { BROWSER_BAR_HEIGHT, BrowserFrame } from "../components/BrowserFrame";
import { Cursor } from "../components/Cursor";
import { Device } from "../components/Device";
import { Page, Screen } from "../components/Screen";
import { JoinScreen } from "../components/app/JoinScreen";
import { LandingPage } from "../components/app/LandingPage";
import { Logo } from "../components/app/Logo";
import { OperatorPanel } from "../components/app/OperatorPanel";
import { ViewerScreen } from "../components/app/ViewerScreen";
import { makeT, type T } from "../lib/i18n";
import { pressScale, progress, stepAt, typed, typedEnd } from "../lib/motion";
import { easeInOut, easeOut, geistMono, geistSans } from "../lib/theme";

export type StoryProps = {
  roomCode: string;
  segmentName: string;
  segmentMinutes: number;
  participantName: string;
};

/** Brighter than the app's own gradient so it holds up on the dark backdrop. */
const GRADIENT = "linear-gradient(135deg, #ff7a5c, #ec3013)";
const TRANSITION = 15;
const LABEL: React.CSSProperties = { fontSize: 26, color: "rgba(255,255,255,0.6)", marginTop: 14 };

// Scene lengths in frames. The four transitions overlap neighbours by TRANSITION each, so the
// total is the sum minus 4 × TRANSITION — keep STORY_DURATION in step when retiming.
const HOOK = 75;
const SYNC = 185;
const JOIN = 165;
const WARN = 140;
const END = 95;
export const STORY_DURATION = HOOK + SYNC + JOIN + WARN + END - 4 * TRANSITION;

/**
 * A 20-second 9:16 Instagram story: hook, every screen in sync, join from a phone, warnings and
 * overtime, then the brand card. English only, no audio (music is added in Instagram).
 *
 * Instagram overlays its own UI on roughly the top 250px and bottom 340px of a story, so every
 * headline and device sits between those bands.
 */
export const Story: React.FC<StoryProps> = ({ roomCode, segmentName, segmentMinutes, participantName }) => {
  const t = makeT("en");
  const timing = linearTiming({ durationInFrames: TRANSITION });

  return (
    <AbsoluteFill
      className="text-foreground antialiased"
      style={
        {
          "--font-geist-sans": geistSans,
          "--font-geist-mono": geistMono,
          fontFamily: geistSans,
          background:
            "radial-gradient(90% 45% at 50% 0%, rgba(236,48,19,0.30), transparent 70%), radial-gradient(80% 35% at 50% 100%, rgba(236,48,19,0.14), transparent 70%), #09090b",
        } as React.CSSProperties
      }
    >
      <TransitionSeries>
        <TransitionSeries.Sequence durationInFrames={HOOK}>
          <Hook minutes={segmentMinutes} segmentName={segmentName} />
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition presentation={slide({ direction: "from-bottom" })} timing={timing} />
        <TransitionSeries.Sequence durationInFrames={SYNC}>
          <Sync t={t} roomCode={roomCode} segmentName={segmentName} minutes={segmentMinutes} />
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition presentation={slide({ direction: "from-right" })} timing={timing} />
        <TransitionSeries.Sequence durationInFrames={JOIN}>
          <Join t={t} roomCode={roomCode} segmentName={segmentName} participantName={participantName} />
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition presentation={slide({ direction: "from-right" })} timing={timing} />
        <TransitionSeries.Sequence durationInFrames={WARN}>
          <Warnings t={t} segmentName={segmentName} />
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition presentation={fade()} timing={timing} />
        <TransitionSeries.Sequence durationInFrames={END}>
          <EndCard tagline={t("landing", "tagline")} />
        </TransitionSeries.Sequence>
      </TransitionSeries>
    </AbsoluteFill>
  );
};

// --- Shared pieces ------------------------------------------------------------------------------

const useRise = (delay: number) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const p = spring({ frame: frame - delay, fps, config: { damping: 200 }, durationInFrames: 22 });
  return { opacity: p, translate: `0 ${(1 - p) * 40}px` } satisfies React.CSSProperties;
};

/** Two-line headline: a white line, then a gradient one, each rising in on its own beat. */
const Headline: React.FC<{ lines: [string, string]; top: number; delay?: number }> = ({
  lines,
  top,
  delay = 4,
}) => {
  const first = useRise(delay);
  const second = useRise(delay + 6);
  return (
    <div
      className="absolute inset-x-0 flex flex-col items-center px-14 text-center text-[86px] leading-[1.02] font-bold tracking-[-0.035em] text-white"
      style={{ top }}
    >
      <span style={first}>{lines[0]}</span>
      <span className="bg-clip-text text-transparent" style={{ ...second, backgroundImage: GRADIENT }}>
        {lines[1]}
      </span>
    </div>
  );
};

const Wordmark: React.FC<{ size: number }> = ({ size }) => (
  <div className="flex items-center" style={{ gap: size * 0.22 }}>
    <Logo size={size} className="rounded-[22%]" />
    <span
      className="bg-clip-text leading-none font-semibold tracking-tight text-transparent"
      style={{ fontSize: size * 1.05, backgroundImage: GRADIENT }}
    >
      Clepsy
    </span>
  </div>
);

/** A glow that flares on `at` and fades — "this screen just updated". */
const pulseGlow = (frame: number, ats: number[]): React.CSSProperties => {
  const p = Math.max(
    0,
    ...ats.map((at) => interpolate(frame, [at, at + 4, at + 26], [0, 1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })),
  );
  return { filter: `drop-shadow(0 0 ${36 * p}px rgba(255, 90, 60, ${0.9 * p}))` };
};

// --- 1. Hook ------------------------------------------------------------------------------------

const Hook: React.FC<{ minutes: number; segmentName: string }> = ({ minutes, segmentName }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const brand = useRise(0);
  const digits = spring({ frame: frame - 6, fps, config: { damping: 14, mass: 0.8 } });

  return (
    <AbsoluteFill>
      <div className="absolute inset-x-0 top-[300px] flex justify-center" style={brand}>
        <Wordmark size={72} />
      </div>
      <div
        className="absolute inset-x-0 top-[560px] flex flex-col items-center gap-4"
        style={{ opacity: Math.min(1, digits), scale: String(0.7 + 0.3 * digits) }}
      >
        <div className="text-[34px] text-white/45">{segmentName}</div>
        <div className="font-mono text-[250px] leading-none font-semibold tracking-tight text-white tabular-nums">
          {formatDuration(minutes * 60_000)}
        </div>
      </div>
      <Headline lines={["Keep every speaker", "on time."]} top={1020} delay={16} />
    </AbsoluteFill>
  );
};

// --- 2. Every screen in sync --------------------------------------------------------------------

const OPERATOR = { x: 60, y: 520, w: 960, h: 500, scale: 1.4 };

const Sync: React.FC<{ t: T; roomCode: string; segmentName: string; minutes: number }> = ({
  t,
  roomCode,
  segmentName,
  minutes,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const startRef = useRef<HTMLButtonElement>(null);
  const plusRef = useRef<HTMLButtonElement>(null);

  const CLICK_START = 38;
  const CLICK_PLUS = 108;
  const running = frame >= CLICK_START;
  const remainingMs =
    minutes * 60_000 + (frame >= CLICK_PLUS ? 60_000 : 0) - (Math.max(0, frame - CLICK_START) / fps) * 1000;
  const flash = frame >= CLICK_PLUS && frame < CLICK_PLUS + 15 ? "plus" : null;
  // The screens land a beat after the click, like a real round trip.
  const glow = pulseGlow(frame, [CLICK_START + 2, CLICK_PLUS + 2]);

  const operator = useRise(8);
  const monitor = useRise(16);
  const phone = useRise(22);
  const screen = (size: number, compact = false) => (
    <ViewerScreen
      timerName={segmentName}
      remainingMs={remainingMs}
      liveLabel={t("connectionBadge", "live")}
      size={size}
      compact={compact}
    />
  );

  return (
    <AbsoluteFill>
      <Headline lines={["One operator.", "Every screen in sync."]} top={250} />

      <div className="absolute" style={{ left: OPERATOR.x, top: OPERATOR.y, ...operator }}>
        <BrowserFrame path={`/r/${roomCode}/control`} width={OPERATOR.w} height={OPERATOR.h}>
          <Screen
            width={OPERATOR.w}
            height={OPERATOR.h - BROWSER_BAR_HEIGHT}
            scale={OPERATOR.scale}
            overlay={
              <Cursor
                waypoints={[
                  { at: 0, to: [420, 250] },
                  { at: CLICK_START, to: startRef, click: true, move: 20 },
                  { at: CLICK_PLUS, to: plusRef, click: true, move: 22 },
                  { at: CLICK_PLUS + 30, to: [500, 250], move: 24 },
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
                  flash={flash}
                  startRef={startRef}
                  startStyle={{ scale: String(pressScale(frame, CLICK_START)) }}
                  plusRef={plusRef}
                  plusStyle={{ scale: String(pressScale(frame, CLICK_PLUS)) }}
                />
              </div>
            </Page>
          </Screen>
        </BrowserFrame>
      </div>

      <Device
        kind="monitor"
        x={60}
        y={1090}
        width={650}
        height={366}
        label="Stage screen"
        labelStyle={LABEL}
        style={{ ...monitor, ...glow }}
      >
        {screen(140)}
      </Device>
      <Device
        kind="phone"
        x={770}
        y={1076}
        width={240}
        height={440}
        label="Phone"
        labelStyle={LABEL}
        style={{ ...phone, ...glow }}
      >
        {screen(54, true)}
      </Device>
    </AbsoluteFill>
  );
};

// --- 3. Join from any phone ---------------------------------------------------------------------

const PHONE = { w: 470, h: 960, y: 500, bezel: 7, scale: 1.36 };

const Join: React.FC<{ t: T; roomCode: string; segmentName: string; participantName: string }> = ({
  t,
  roomCode,
  segmentName,
  participantName,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const codeRef = useRef<HTMLInputElement>(null);
  const joinRef = useRef<HTMLButtonElement>(null);
  const nameRef = useRef<HTMLInputElement>(null);
  const gateJoinRef = useRef<HTMLButtonElement>(null);

  const SCROLL = 10;
  const TAP_CODE = 34;
  const TAP_JOIN = typedEnd(TAP_CODE + 4, roomCode, 2) + 10;
  const SHOW_GATE = TAP_JOIN + 6;
  const TAP_NAME = SHOW_GATE + 14;
  const TAP_GATE_JOIN = typedEnd(TAP_NAME + 4, participantName, 2) + 10;
  const SHOW_TIMER = TAP_GATE_JOIN + 8;

  const landing = 1 - progress(frame, SHOW_GATE, 7);
  const gate = progress(frame, SHOW_GATE, 7) - progress(frame, SHOW_TIMER, 7);
  const viewer = progress(frame, SHOW_TIMER, 7);
  const inner = { w: PHONE.w - 2 * PHONE.bezel, h: PHONE.h - 2 * PHONE.bezel };
  const phone = useRise(10);

  return (
    <AbsoluteFill>
      <Headline lines={["Join from any phone.", "No app. No account."]} top={250} />

      <Device
        kind="phone"
        x={(1080 - PHONE.w) / 2}
        y={PHONE.y}
        width={PHONE.w}
        height={PHONE.h}
        label={stepAt(frame, [0, SHOW_GATE, SHOW_TIMER]) === 2 ? "You're in — live" : "Room code, then your name"}
        labelStyle={LABEL}
        style={{ ...phone, ...pulseGlow(frame, [SHOW_TIMER + 4]) }}
      >
        <Screen
          width={inner.w}
          height={inner.h}
          scale={PHONE.scale}
          overlay={
            <div style={{ opacity: 1 - progress(frame, TAP_GATE_JOIN + 8, 8) }}>
              <Cursor
                variant="touch"
                waypoints={[
                  { at: 0, to: [200, 520] },
                  { at: TAP_CODE, to: codeRef, click: true, move: 14 },
                  { at: TAP_JOIN, to: joinRef, click: true, move: 10 },
                  { at: TAP_NAME, to: nameRef, click: true, move: 10 },
                  { at: TAP_GATE_JOIN, to: gateJoinRef, click: true, move: 10 },
                ]}
              />
            </div>
          }
        >
          <Page opacity={landing}>
            <LandingPage
              t={t}
              mobile
              scrollY={interpolate(frame, [SCROLL, SCROLL + 18], [0, 150], {
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
              remainingMs={5 * 60_000 + 52_000 - (Math.max(0, frame - SHOW_TIMER) / fps) * 1000}
              liveLabel={t("connectionBadge", "live")}
              size={80}
            />
          </Page>
        </Screen>
      </Device>
    </AbsoluteFill>
  );
};

// --- 4. Warnings and overtime -------------------------------------------------------------------

const PHASES: { phase: TimerPhase; label: string; className: string }[] = [
  { phase: "normal", label: "On time", className: "bg-white text-black" },
  { phase: "wrapup", label: "Wrap up", className: "bg-amber-400 text-black" },
  { phase: "overtime", label: "Overtime", className: "bg-red-500 text-white" },
];

const Warnings: React.FC<{ t: T; segmentName: string }> = ({ t, segmentName }) => {
  const frame = useCurrentFrame();
  const monitor = useRise(8);
  const chips = useRise(16);

  // Fast-forwarded through the segment's last minute (the real screen counts in real time), slowing
  // into each colour change so it reads. The final-minute flash is left out on purpose — strobing
  // at this speed would be unreadable and unkind to watch.
  const remainingMs = interpolate(
    frame,
    [0, 34, 40, 84, 92, WARN],
    [78_000, 61_000, 59_000, 1_000, -1_000, -14_000],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: easeOut },
  );
  const phase = phaseFor(remainingMs, 60_000);

  return (
    <AbsoluteFill>
      <Headline lines={["Know when to wrap up.", "See overtime instantly."]} top={250} />

      <Device kind="monitor" x={60} y={560} width={960} height={540} label="Stage screen" labelStyle={LABEL} style={monitor}>
        <ViewerScreen
          timerName={segmentName}
          remainingMs={remainingMs}
          liveLabel={t("connectionBadge", "live")}
          size={200}
        />
      </Device>

      <div className="absolute inset-x-0 top-[1250px] flex justify-center gap-5" style={chips}>
        {PHASES.map(({ phase: p, label, className }) => {
          const active = p === phase;
          return (
            <div
              key={p}
              className={`rounded-full px-9 py-4 text-[38px] font-semibold ${active ? className : "bg-white/8 text-white/40"}`}
              style={{ scale: active ? "1.08" : "1" }}
            >
              {label}
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};

// --- 5. End card --------------------------------------------------------------------------------

const EndCard: React.FC<{ tagline: string }> = ({ tagline }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const brand = spring({ frame: frame - 4, fps, config: { damping: 12, mass: 0.7 } });
  const line = useRise(16);
  const cta = useRise(26);
  const breathe = 1 + 0.03 * Math.sin(Math.max(0, frame - 40) / 6);

  return (
    <AbsoluteFill className="items-center justify-center gap-12 px-20">
      <div style={{ opacity: Math.min(1, brand), scale: String(0.6 + 0.4 * brand) }}>
        <Wordmark size={150} />
      </div>
      <p className="max-w-[860px] text-center text-[48px] leading-snug text-white/70" style={line}>
        {tagline}
      </p>
      <div style={cta}>
        <div
          className="flex items-center gap-4 rounded-full px-12 py-6 text-[46px] font-semibold text-white"
          style={{ backgroundImage: GRADIENT, scale: String(breathe), boxShadow: "0 20px 60px -10px rgba(236,48,19,0.6)" }}
        >
          <Link2 className="size-12" />
          Link in bio
        </div>
      </div>
    </AbsoluteFill>
  );
};
