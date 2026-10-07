import type React from "react";
import { useRef } from "react";
import { interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { BROWSER_BAR_HEIGHT, BrowserFrame } from "../components/BrowserFrame";
import { Cursor, type Waypoint } from "../components/Cursor";
import { Page, Screen } from "../components/Screen";
import { Stage } from "../components/Stage";
import { AgendaCard, ControlPage } from "../components/app/ControlPage";
import { OperatorPanel } from "../components/app/OperatorPanel";
import { DashboardPage, type DraftRow } from "../components/app/DashboardPage";
import { makeT, type Locale } from "../lib/i18n";
import { pressScale, progress, typed, typedEnd } from "../lib/motion";
import { easeInOut, UI_SCALE } from "../lib/theme";

export type CreateRoomProps = {
  locale: Locale;
  userName: string;
  eventName: string;
  roomCode: string;
  /** Rows 2 and 3 typed in after "Add segment" (row 1 is the dashboard's own default draft). */
  segments: { name: string; minutes: string }[];
};

const WINDOW = { x: 40, y: 40, w: 1200, h: 720 };
const DEFAULT_ROW = { name: "Opening remarks", minutes: "5" };

/**
 * Create a room: name the event, add segments to the agenda, "Create room" → the operator page
 * for the new room, agenda already loaded.
 */
export const CreateRoom: React.FC<CreateRoomProps> = ({ locale, userName, eventName, roomCode, segments }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = makeT(locale);

  const eventRef = useRef<HTMLInputElement>(null);
  const addRef = useRef<HTMLButtonElement>(null);
  const createRef = useRef<HTMLButtonElement>(null);
  const nameRefs = [useRef<HTMLInputElement>(null), useRef<HTMLInputElement>(null)];
  const minutesRefs = [useRef<HTMLInputElement>(null), useRef<HTMLInputElement>(null)];

  // --- Timeline -----------------------------------------------------------------------------
  const CLICK_EVENT = Math.round(0.8 * fps);
  const TYPE_EVENT = CLICK_EVENT + 4;
  // Each added row: click "Add segment", click its name, type, click minutes, type.
  const rowBeats = segments.reduce<{ add: number; name: number; minutes: number; end: number }[]>((beats, seg, i) => {
    const prevEnd = i === 0 ? typedEnd(TYPE_EVENT, eventName) : beats[i - 1].end;
    const add = prevEnd + 14;
    const name = add + 14;
    const minutes = typedEnd(name + 4, seg.name) + 10;
    return [...beats, { add, name, minutes, end: typedEnd(minutes + 4, seg.minutes) }];
  }, []);
  const CLICK_CREATE = rowBeats[rowBeats.length - 1].end + 18;
  const SHOW_CONTROL = CLICK_CREATE + Math.round(0.75 * fps);
  const SCROLL_CONTROL = SHOW_CONTROL + Math.round(1.3 * fps);

  // --- Dashboard state at this frame --------------------------------------------------------
  const rows: DraftRow[] = [
    DEFAULT_ROW,
    ...segments
      .map((seg, i): DraftRow | null => {
        const beat = rowBeats[i];
        if (frame < beat.add) return null;
        return {
          name: typed(frame, beat.name + 4, seg.name),
          // The minutes field starts at the dashboard's default 5 until it's retyped.
          minutes: frame < beat.minutes + 4 ? "5" : typed(frame, beat.minutes + 4, seg.minutes),
          enter: progress(frame, beat.add, 8),
          nameRef: nameRefs[i],
          minutesRef: minutesRefs[i],
        };
      })
      .filter((row): row is DraftRow => row !== null),
  ];

  let focus: string | null = null;
  if (frame >= CLICK_EVENT && frame < rowBeats[0].add) focus = "event";
  rowBeats.forEach((beat, i) => {
    if (frame >= beat.name && frame < beat.minutes) focus = `${i + 1}:name`;
    if (frame >= beat.minutes && frame < (rowBeats[i + 1]?.add ?? CLICK_CREATE)) focus = `${i + 1}:minutes`;
  });

  // Each new row pushes "Create room" further down; scroll just enough to keep it in view.
  const ROW_SCROLL = 48;
  const dashboardScroll = interpolate(
    frame,
    rowBeats.flatMap((beat) => [beat.add + 4, beat.add + 18]),
    rowBeats.flatMap((_, i) => [i * ROW_SCROLL, (i + 1) * ROW_SCROLL]),
    { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: easeInOut },
  );

  const dashboard = 1 - progress(frame, SHOW_CONTROL, 8);
  const control = progress(frame, SHOW_CONTROL, 8);
  const contentHeight = WINDOW.h - BROWSER_BAR_HEIGHT;

  const agenda = [DEFAULT_ROW, ...segments].map((seg) => ({
    name: seg.name,
    durationMs: Number(seg.minutes) * 60_000,
  }));

  return (
    <Stage>
      <BrowserFrame
        path={frame < SHOW_CONTROL ? "/dashboard" : `/r/${roomCode}/control`}
        width={WINDOW.w}
        height={WINDOW.h}
        style={{ left: WINDOW.x, top: WINDOW.y }}
      >
        <Screen
          width={WINDOW.w}
          height={contentHeight}
          scale={UI_SCALE}
          overlay={
            <Cursor
              waypoints={[
                { at: 0, to: [760, 470] },
                { at: CLICK_EVENT, to: eventRef, click: true, offset: [-120, 0], move: 20 },
                ...rowBeats.flatMap((beat, i): Waypoint[] => [
                  { at: beat.add, to: addRef, click: true, move: 14 },
                  { at: beat.name, to: nameRefs[i], click: true, offset: [-80, 0], move: 12 },
                  { at: beat.minutes, to: minutesRefs[i], click: true, move: 12 },
                ]),
                { at: CLICK_CREATE, to: createRef, click: true, move: 16 },
                { at: SCROLL_CONTROL + fps, to: [840, 300], move: 24 },
              ]}
            />
          }
        >
          <Page opacity={dashboard}>
            <DashboardPage
              t={t}
              userName={userName}
              eventName={typed(frame, TYPE_EVENT, eventName)}
              rows={rows}
              focus={focus}
              creating={frame >= CLICK_CREATE}
              scrollY={dashboardScroll}
              refs={{ eventName: eventRef, addSegment: addRef, createRoom: createRef }}
              addStyle={{ scale: String(Math.min(...rowBeats.map((b) => pressScale(frame, b.add)))) }}
              createStyle={{ scale: String(pressScale(frame, CLICK_CREATE)) }}
            />
          </Page>
          <Page opacity={control}>
            <ControlPage
              t={t}
              roomName={eventName}
              scrollY={interpolate(frame, [SCROLL_CONTROL, SCROLL_CONTROL + 24], [0, 150], {
                extrapolateLeft: "clamp",
                extrapolateRight: "clamp",
                easing: easeInOut,
              })}
            >
              <OperatorPanel t={t} timerName={agenda[0].name} remainingMs={agenda[0].durationMs} isRunning={false} />
              <AgendaCard t={t} segments={agenda} activeIndex={0} />
            </ControlPage>
          </Page>
        </Screen>
      </BrowserFrame>
    </Stage>
  );
};
