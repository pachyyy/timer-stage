import type React from "react";
import { useRef } from "react";
import { useCurrentFrame, useVideoConfig } from "remotion";
import { ArrowLeft, Download, FileSpreadsheet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatAdjustmentLabel, formatSignedMinutes } from "@/lib/history/adjustments";
import { formatDuration } from "@/lib/timer/model";
import { cn } from "@/lib/utils";
import { BROWSER_BAR_HEIGHT, BrowserFrame } from "../components/BrowserFrame";
import { Cursor } from "../components/Cursor";
import { Page, Screen } from "../components/Screen";
import { Stage } from "../components/Stage";
import { AgendaCard, ControlPage } from "../components/app/ControlPage";
import { DialogShell } from "../components/app/Dialog";
import { Logo } from "../components/app/Logo";
import { OperatorPanel } from "../components/app/OperatorPanel";
import { makeT, type Locale, type T } from "../lib/i18n";
import { pressScale, progress } from "../lib/motion";
import { UI_SCALE } from "../lib/theme";

type ReportRow = { name: string; plannedMs: number; adjustmentsMs: number; actualMs: number };

export type HistoryProps = {
  locale: Locale;
  roomName: string;
  roomCode: string;
  /** Event start, as an ISO string (JSON-serializable for defaultProps). */
  startedAt: string;
  report: ReportRow[];
};

const WINDOW = { x: 40, y: 40, w: 1200, h: 720 };
const DATE_LOCALE = { en: "en-US", id: "id-ID" } as const;

/**
 * End event & history: "End event" → confirm → History → the event's report (planned vs actual,
 * adjustments) → Download .xlsx.
 */
export const History: React.FC<HistoryProps> = ({ locale, roomName, roomCode, startedAt, report }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = makeT(locale);

  const endRef = useRef<HTMLButtonElement>(null);
  const confirmRef = useRef<HTMLButtonElement>(null);
  const historyRef = useRef<HTMLButtonElement>(null);
  const eventRef = useRef<HTMLDivElement>(null);
  const downloadRef = useRef<HTMLButtonElement>(null);

  // --- Timeline -----------------------------------------------------------------------------
  const CLICK_END = Math.round(1.1 * fps);
  const CLICK_CONFIRM = CLICK_END + Math.round(1.4 * fps);
  const CLICK_HISTORY = CLICK_CONFIRM + fps;
  const SHOW_LIST = CLICK_HISTORY + 6;
  const CLICK_EVENT = SHOW_LIST + fps;
  const SHOW_DETAIL = CLICK_EVENT + 6;
  const CLICK_DOWNLOAD = SHOW_DETAIL + Math.round(1.6 * fps);

  const ended = frame >= CLICK_CONFIRM;
  const dialog = progress(frame, CLICK_END + 2, 7) - progress(frame, CLICK_CONFIRM + 2, 6);
  const control = 1 - progress(frame, SHOW_LIST, 7);
  const list = progress(frame, SHOW_LIST, 7) - progress(frame, SHOW_DETAIL, 7);
  const detail = progress(frame, SHOW_DETAIL, 7);
  const download = progress(frame, CLICK_DOWNLOAD + 4, 8);

  const path = frame < SHOW_LIST ? `/r/${roomCode}/control` : frame < SHOW_DETAIL ? `/r/${roomCode}/history` : `/r/${roomCode}/history/1`;
  const started = new Date(startedAt);
  const totals = report.reduce(
    (acc, r) => ({
      plannedMs: acc.plannedMs + r.plannedMs,
      adjustmentsMs: acc.adjustmentsMs + r.adjustmentsMs,
      actualMs: acc.actualMs + r.actualMs,
    }),
    { plannedMs: 0, adjustmentsMs: 0, actualMs: 0 },
  );
  const fileName = `${roomName.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}-run-1.xlsx`;

  return (
    <Stage>
      <BrowserFrame path={path} width={WINDOW.w} height={WINDOW.h} style={{ left: WINDOW.x, top: WINDOW.y }}>
        <Screen
          width={WINDOW.w}
          height={WINDOW.h - BROWSER_BAR_HEIGHT}
          scale={UI_SCALE}
          overlay={
            <Cursor
              waypoints={[
                { at: 0, to: [600, 470] },
                { at: CLICK_END, to: endRef, click: true, move: 20 },
                { at: CLICK_CONFIRM, to: confirmRef, click: true, move: 18 },
                { at: CLICK_HISTORY, to: historyRef, click: true, move: 18 },
                { at: CLICK_EVENT, to: eventRef, click: true, offset: [-200, 0], move: 18 },
                { at: CLICK_DOWNLOAD, to: downloadRef, click: true, move: 20 },
              ]}
            />
          }
        >
          <Page opacity={control}>
            <ControlPage
              t={t}
              roomName={roomName}
              historyRef={historyRef}
              historyStyle={{ scale: String(pressScale(frame, CLICK_HISTORY)) }}
            >
              <OperatorPanel
                t={t}
                timerName={report[report.length - 1].name}
                remainingMs={ended ? report[report.length - 1].plannedMs : -65_000}
                isRunning={!ended}
                hasOpenRun={!ended}
                endRef={endRef}
                endStyle={{ scale: String(pressScale(frame, CLICK_END)) }}
              />
              <AgendaCard
                t={t}
                segments={report.map((r) => ({ name: r.name, durationMs: r.plannedMs }))}
                activeIndex={report.length - 1}
              />
            </ControlPage>
            <DialogShell
              open={dialog}
              title={t("control", "endEventTitle")}
              description={t("control", "endEventDesc")}
              footer={
                <>
                  <Button variant="outline">{t("common", "cancel")}</Button>
                  <Button ref={confirmRef} style={{ scale: String(pressScale(frame, CLICK_CONFIRM)) }}>
                    {t("operatorPanel", "endEvent")}
                  </Button>
                </>
              }
            />
          </Page>

          <Page opacity={list}>
            <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-8">
              <PageHeader t={t} title={t("nav", "history")} roomName={roomName} backLabel={t("historyRoom", "backToLive")} />
              <ul className="flex flex-col gap-2">
                <li className="block rounded-md border">
                  <Card className="border-0 shadow-none">
                    <CardContent ref={eventRef} className="flex items-center justify-between gap-3 py-3">
                      <div className="flex flex-col gap-0.5">
                        <span className="font-medium">{t("historyRoom", "eventLabel", { seq: 1 })}</span>
                        <span className="text-xs text-muted-foreground">
                          {started.toLocaleString(DATE_LOCALE[locale], { dateStyle: "medium", timeStyle: "short" })}
                          {" · "}
                          {t("historyRoom", "segmentCount", { count: report.length })}
                        </span>
                      </div>
                      <span className="text-sm text-muted-foreground tabular-nums">{formatDuration(totals.actualMs)}</span>
                    </CardContent>
                  </Card>
                </li>
              </ul>
            </main>
          </Page>

          <Page opacity={detail}>
            <main className="mx-auto flex w-full max-w-4xl flex-col gap-6 px-4 py-8">
              <PageHeader
                t={t}
                title={t("runDetail", "title", { seq: 1 })}
                roomName={roomName}
                backLabel={t("runDetail", "backToLive")}
                allEventsLabel={t("runDetail", "allEvents")}
              />
              <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                <span>{started.toLocaleString(DATE_LOCALE[locale], { dateStyle: "short", timeStyle: "medium" })}</span>
                <Button ref={downloadRef} size="sm" className="ml-auto" style={{ scale: String(pressScale(frame, CLICK_DOWNLOAD)) }}>
                  <Download className="size-3.5" /> {t("runDetail", "download")}
                </Button>
              </div>
              <SummaryCard t={t} report={report} totals={totals} />
              <Card>
                <CardHeader>
                  <CardTitle>{t("runDetail", "adjustmentsTitle")}</CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="flex flex-col gap-1.5 text-sm">
                    {report
                      .filter((r) => r.adjustmentsMs !== 0)
                      .map((r) => (
                        <li key={r.name}>
                          {formatAdjustmentLabel({
                            timerId: r.name,
                            timerName: r.name,
                            totalMs: r.adjustmentsMs,
                            count: 1,
                            stepMs: r.adjustmentsMs,
                            firstAtMs: 0,
                            lastAtMs: 0,
                          })}
                        </li>
                      ))}
                  </ul>
                </CardContent>
              </Card>
            </main>
          </Page>
        </Screen>

        {/* The browser's own download chip — a generic one, not any particular browser's. */}
        <div
          className="absolute top-14 right-4 z-50 flex items-center gap-3 rounded-lg border bg-background px-4 py-3 shadow-lg"
          style={{ opacity: download, translate: `0 ${(1 - download) * -8}px` }}
        >
          <FileSpreadsheet className="size-6 text-emerald-600" />
          <div className="flex flex-col">
            <span className="text-sm font-medium">{fileName}</span>
            <span className="text-xs text-muted-foreground">Excel · 9 KB</span>
          </div>
        </div>
      </BrowserFrame>
    </Stage>
  );
};

const PageHeader: React.FC<{ t: T; title: string; roomName: string; backLabel: string; allEventsLabel?: string }> = ({
  title,
  roomName,
  backLabel,
  allEventsLabel,
}) => (
  <div className="flex items-center justify-between">
    <div className="flex items-center gap-2">
      <Logo />
      <h1 className="text-xl font-semibold">{title}</h1>
      <span className="truncate text-sm text-muted-foreground">— {roomName}</span>
    </div>
    <div className="flex items-center gap-2">
      {allEventsLabel && (
        <Button variant="outline" size="sm">
          <ArrowLeft className="size-3.5" /> {allEventsLabel}
        </Button>
      )}
      <Button variant="outline" size="sm">
        {!allEventsLabel && <ArrowLeft className="size-3.5" />} {backLabel}
      </Button>
    </div>
  </div>
);

/** The Summary card of src/app/r/[roomId]/history/[runId]/page.tsx. Diff is actual vs planned+adjustments, as in report.ts. */
const SummaryCard: React.FC<{
  t: T;
  report: ReportRow[];
  totals: { plannedMs: number; adjustmentsMs: number; actualMs: number };
}> = ({ t, report, totals }) => {
  const diff = (r: { plannedMs: number; adjustmentsMs: number; actualMs: number }) => r.actualMs - (r.plannedMs + r.adjustmentsMs);
  return (
    <Card className="min-w-0">
      <CardHeader>
        <CardTitle>{t("runDetail", "summaryTitle")}</CardTitle>
      </CardHeader>
      <CardContent>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left text-xs text-muted-foreground">
              <th className="py-1.5 pr-2">{t("runDetail", "colIndex")}</th>
              <th className="py-1.5 pr-2">{t("runDetail", "colSegment")}</th>
              <th className="py-1.5 pr-2 text-right">{t("runDetail", "colPlanned")}</th>
              <th className="py-1.5 pr-2 text-right">{t("runDetail", "colAdjustments")}</th>
              <th className="py-1.5 pr-2 text-right">{t("runDetail", "colActual")}</th>
              <th className="py-1.5 pr-2 text-right">{t("runDetail", "colDiff")}</th>
            </tr>
          </thead>
          <tbody>
            {report.map((r, i) => (
              <tr key={r.name} className="border-b last:border-0">
                <td className="py-1.5 pr-2 tabular-nums">{i + 1}</td>
                <td className="py-1.5 pr-2">{r.name}</td>
                <td className="py-1.5 pr-2 text-right tabular-nums">{formatDuration(r.plannedMs)}</td>
                <td className="py-1.5 pr-2 text-right tabular-nums">
                  {r.adjustmentsMs !== 0 ? formatSignedMinutes(r.adjustmentsMs) : "—"}
                </td>
                <td className="py-1.5 pr-2 text-right tabular-nums">{formatDuration(r.actualMs)}</td>
                <td className={cn("py-1.5 pr-2 text-right tabular-nums", diff(r) > 0 && "text-destructive")}>
                  {formatSignedMinutes(diff(r))}
                </td>
              </tr>
            ))}
            <tr className="font-medium">
              <td className="pt-2" colSpan={2}>
                {t("runDetail", "total")}
              </td>
              <td className="pt-2 text-right tabular-nums">{formatDuration(totals.plannedMs)}</td>
              <td className="pt-2 text-right tabular-nums">
                {totals.adjustmentsMs !== 0 ? formatSignedMinutes(totals.adjustmentsMs) : "—"}
              </td>
              <td className="pt-2 text-right tabular-nums">{formatDuration(totals.actualMs)}</td>
              <td className={cn("pt-2 text-right tabular-nums", diff(totals) > 0 && "text-destructive")}>
                {formatSignedMinutes(diff(totals))}
              </td>
            </tr>
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
};
