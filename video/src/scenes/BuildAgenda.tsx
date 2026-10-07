import type React from "react";
import { useRef } from "react";
import { interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { BROWSER_BAR_HEIGHT, BrowserFrame } from "../components/BrowserFrame";
import { Cursor } from "../components/Cursor";
import { Page, Screen } from "../components/Screen";
import { Stage } from "../components/Stage";
import { AGENDA_ROW_PITCH, type AgendaSegment } from "../components/app/AgendaRows";
import { AgendaCard, ControlPage } from "../components/app/ControlPage";
import { FOCUSED } from "../components/app/DashboardPage";
import { DialogShell } from "../components/app/Dialog";
import { OperatorPanel } from "../components/app/OperatorPanel";
import { makeT, type Locale } from "../lib/i18n";
import { pressScale, progress, typed, typedEnd } from "../lib/motion";
import { easeInOut } from "../lib/theme";

export type BuildAgendaProps = {
  locale: Locale;
  roomName: string;
  roomCode: string;
  newSegment: { name: string; minutes: string };
  speaker: string;
};

const WINDOW = { x: 40, y: 40, w: 1200, h: 720 };
// A touch less zoom than the other scenes so the full segment dialog fits the viewport.
const SCALE = 1.08;
const BASE = [
  { name: "Opening remarks", durationMs: 5 * 60_000 },
  { name: "Keynote", durationMs: 20 * 60_000 },
  { name: "Q&A", durationMs: 10 * 60_000 },
];

/**
 * Build the agenda: add a segment from the operator page, drag it into place by its handle, link
 * two segments so the next starts automatically, then open a segment's details.
 */
export const BuildAgenda: React.FC<BuildAgendaProps> = ({ locale, roomName, roomCode, newSegment, speaker }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = makeT(locale);

  const nameRef = useRef<HTMLInputElement>(null);
  const minutesRef = useRef<HTMLInputElement>(null);
  const addRef = useRef<HTMLButtonElement>(null);
  const newHandleRef = useRef<HTMLSpanElement>(null);
  const linkRef = useRef<HTMLSpanElement>(null);
  const editRef = useRef<HTMLButtonElement>(null);
  const speakerRef = useRef<HTMLInputElement>(null);
  const saveRef = useRef<HTMLButtonElement>(null);

  // --- Timeline -----------------------------------------------------------------------------
  const CLICK_NAME = Math.round(0.7 * fps);
  const CLICK_MINUTES = typedEnd(CLICK_NAME + 4, newSegment.name, 1) + 10;
  const CLICK_ADD = typedEnd(CLICK_MINUTES + 4, newSegment.minutes, 1) + 12;
  const GRAB = CLICK_ADD + Math.round(0.9 * fps);
  const DRAG_START = GRAB + 5;
  const DROP = DRAG_START + 24;
  const CLICK_LINK = DROP + Math.round(0.9 * fps);
  const CLICK_EDIT = CLICK_LINK + Math.round(0.9 * fps);
  const CLICK_SPEAKER = CLICK_EDIT + Math.round(0.8 * fps);
  const CLICK_SAVE = typedEnd(CLICK_SPEAKER + 4, speaker, 2) + 14;

  // --- Agenda state at this frame -----------------------------------------------------------
  const added = frame >= CLICK_ADD + 2;
  const dropped = frame >= DROP;
  const drag = interpolate(frame, [DRAG_START, DROP - 2], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: easeInOut,
  });
  const dragging = frame >= GRAB && !dropped;

  const opening: AgendaSegment = { ...BASE[0], linked: frame >= CLICK_LINK, linkRef };
  const keynote: AgendaSegment = { ...BASE[1], editRef };
  const qa: AgendaSegment = { ...BASE[2], offsetY: dragging ? drag * AGENDA_ROW_PITCH : undefined };
  const fresh: AgendaSegment = {
    name: newSegment.name,
    durationMs: Number(newSegment.minutes) * 60_000,
    enter: added ? progress(frame, CLICK_ADD + 2, 8) : 0,
    offsetY: dragging ? -drag * AGENDA_ROW_PITCH : undefined,
    lifted: dragging,
    handleRef: newHandleRef,
  };
  const segments = dropped ? [opening, keynote, fresh, qa] : [opening, keynote, qa, fresh];
  // Before "Add" lands, the new row is mounted (so the cursor can measure it) but invisible and
  // takes no space.
  const shown = added ? segments : segments.slice(0, 3);

  const addFocus = frame >= CLICK_NAME && frame < CLICK_MINUTES ? "name" : frame >= CLICK_MINUTES && frame < CLICK_ADD ? "minutes" : null;

  const dialog = progress(frame, CLICK_EDIT + 2, 7) - progress(frame, CLICK_SAVE + 2, 6);

  return (
    <Stage>
      <BrowserFrame path={`/r/${roomCode}/control`} width={WINDOW.w} height={WINDOW.h} style={{ left: WINDOW.x, top: WINDOW.y }}>
        <Screen
          width={WINDOW.w}
          height={WINDOW.h - BROWSER_BAR_HEIGHT}
          scale={SCALE}
          overlay={
            <Cursor
              waypoints={[
                { at: 0, to: [780, 300] },
                { at: CLICK_NAME, to: nameRef, click: true, offset: [-120, 0], move: 18 },
                { at: CLICK_MINUTES, to: minutesRef, click: true, move: 12 },
                { at: CLICK_ADD, to: addRef, click: true, move: 12 },
                { at: GRAB, to: newHandleRef, click: true, move: 20 },
                // Same target again: the handle itself travels with the drag, and the pointer rides it.
                { at: DROP, to: newHandleRef, move: 1 },
                { at: CLICK_LINK, to: linkRef, click: true, move: 18 },
                { at: CLICK_EDIT, to: editRef, click: true, move: 18 },
                { at: CLICK_SPEAKER, to: speakerRef, click: true, offset: [-120, 0], move: 16 },
                { at: CLICK_SAVE, to: saveRef, click: true, move: 14 },
                { at: CLICK_SAVE + fps, to: [900, 330], move: 24 },
              ]}
            />
          }
        >
          <Page opacity={1}>
            <ControlPage t={t} roomName={roomName} scrollY={300}>
              <OperatorPanel t={t} timerName={BASE[0].name} remainingMs={BASE[0].durationMs} isRunning={false} />
              <AgendaCard
                t={t}
                segments={shown}
                activeIndex={0}
                addName={added ? "" : typed(frame, CLICK_NAME + 4, newSegment.name, 1)}
                addMinutes={added ? "5" : frame < CLICK_MINUTES + 4 ? "5" : typed(frame, CLICK_MINUTES + 4, newSegment.minutes, 1)}
                focus={addFocus}
                addNameRef={nameRef}
                addMinutesRef={minutesRef}
                addRef={addRef}
                addStyle={{ scale: String(pressScale(frame, CLICK_ADD)) }}
              />
              {/* Keeps the new row's handle measurable before it's added (see `shown` above). */}
              {!added && (
                <span ref={newHandleRef} className="absolute" style={{ visibility: "hidden" }} />
              )}
            </ControlPage>
            <DialogShell
              open={dialog}
              title={t("segmentDialog", "title")}
              description={t("segmentDialog", "desc")}
              footer={
                <>
                  <Button variant="outline">{t("common", "cancel")}</Button>
                  <Button ref={saveRef} style={{ scale: String(pressScale(frame, CLICK_SAVE)) }}>
                    {t("common", "save")}
                  </Button>
                </>
              }
            >
              <SegmentFields
                t={t}
                name={BASE[1].name}
                minutes="20"
                speaker={typed(frame, CLICK_SPEAKER + 4, speaker, 2)}
                speakerFocused={frame >= CLICK_SPEAKER && frame < CLICK_SAVE}
                speakerRef={speakerRef}
              />
            </DialogShell>
          </Page>
        </Screen>
      </BrowserFrame>
    </Stage>
  );
};

/** The field stack of src/components/segment-dialog.tsx. */
const SegmentFields: React.FC<{
  t: ReturnType<typeof makeT>;
  name: string;
  minutes: string;
  speaker: string;
  speakerFocused: boolean;
  speakerRef: React.Ref<HTMLInputElement>;
}> = ({ t, name, minutes, speaker, speakerFocused, speakerRef }) => (
  <div className="flex flex-col gap-4">
    <div className="flex flex-col gap-1.5">
      <Label>{t("segmentDialog", "nameLabel")}</Label>
      <Input readOnly value={name} />
    </div>
    <div className="flex flex-col gap-1.5">
      <Label>{t("segmentDialog", "durationLabel")}</Label>
      <div className="flex items-center gap-2">
        <Input readOnly value={minutes} className="w-20" />
        <span className="text-sm text-muted-foreground">{t("common", "minUnit")}</span>
        <Input readOnly value="0" className="w-20" />
        <span className="text-sm text-muted-foreground">{t("common", "secUnit")}</span>
      </div>
    </div>
    <div className="flex flex-col gap-1.5">
      <Label>{t("segmentDialog", "scheduledLabel")}</Label>
      <Input readOnly type="datetime-local" className="flex-1" />
      <p className="text-xs text-muted-foreground">{t("segmentDialog", "scheduledHint")}</p>
    </div>
    <div className="flex flex-col gap-1.5">
      <Label>{t("segmentDialog", "speakerLabel")}</Label>
      <Input ref={speakerRef} readOnly value={speaker} className={cn(speakerFocused && FOCUSED)} />
    </div>
    <div className="flex flex-col gap-1.5">
      <Label>{t("segmentDialog", "notesLabel")}</Label>
      <Input readOnly placeholder={t("segmentDialog", "notesPlaceholder")} />
    </div>
    <div className="flex flex-col gap-1.5">
      <Label>{t("segmentDialog", "wrapUpLabel")}</Label>
      <div className="flex items-center gap-2">
        <Input readOnly value="1" className="w-20" />
        <span className="text-sm text-muted-foreground">{t("segmentDialog", "wrapUpSuffix")}</span>
      </div>
    </div>
  </div>
);
