import type React from "react";
import { History, Languages, Pencil, Plus, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { T } from "../../lib/i18n";
import { AgendaRows, type AgendaSegment } from "./AgendaRows";
import { ConnectionBadge } from "./ConnectionBadge";
import { FOCUSED } from "./DashboardPage";
import { Logo } from "./Logo";

/**
 * src/app/r/[roomId]/control/page.tsx, split into its cards so a scene can show just the part it's
 * about — the real page stacks header, operator panel, agenda, message, share and participants in
 * that order.
 */
export const ControlPage: React.FC<{
  t: T;
  roomName: string;
  scrollY?: number;
  historyRef?: React.Ref<HTMLButtonElement>;
  historyStyle?: React.CSSProperties;
  children: React.ReactNode;
}> = ({ t, roomName, scrollY = 0, historyRef, historyStyle, children }) => (
  <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-8" style={{ translate: `0 ${-scrollY}px` }}>
    <div className="flex items-center justify-between gap-3">
      <div className="flex min-w-0 items-center gap-2">
        <Logo />
        <h1 className="shrink-0 text-xl font-semibold">{t("control", "title")}</h1>
        <span className="flex min-w-0 items-center gap-1">
          <span className="truncate text-sm text-muted-foreground">· {roomName}</span>
          <Pencil className="size-3.5 shrink-0 text-muted-foreground" />
        </span>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <Button ref={historyRef} variant="outline" size="sm" style={historyStyle}>
          <History className="size-3.5" /> {t("nav", "history")}
        </Button>
        <ConnectionBadge label={t("connectionBadge", "live")} />
        <Button variant="ghost" size="icon">
          <Languages className="size-4" />
        </Button>
        <Button variant="ghost" size="icon">
          <Settings className="size-5" />
        </Button>
      </div>
    </div>
    {children}
  </main>
);

export const AgendaCard: React.FC<{
  t: T;
  segments: AgendaSegment[];
  activeIndex: number;
  addName?: string;
  addMinutes?: string;
  focus?: "name" | "minutes" | null;
  addNameRef?: React.Ref<HTMLInputElement>;
  addMinutesRef?: React.Ref<HTMLInputElement>;
  addRef?: React.Ref<HTMLButtonElement>;
  addStyle?: React.CSSProperties;
}> = ({ t, segments, activeIndex, addName = "", addMinutes = "5", focus, addNameRef, addMinutesRef, addRef, addStyle }) => (
  <Card>
    <CardHeader>
      <CardTitle>{t("control", "agendaTitle")}</CardTitle>
    </CardHeader>
    <CardContent className="flex flex-col gap-4">
      <AgendaRows t={t} segments={segments} activeIndex={activeIndex} />
      <div className="flex items-center gap-2 pt-2">
        <Input
          ref={addNameRef}
          readOnly
          value={addName}
          placeholder={t("common", "segmentNamePlaceholder")}
          className={cn("flex-1", focus === "name" && FOCUSED)}
        />
        <Input ref={addMinutesRef} readOnly value={addMinutes} className={cn("w-20", focus === "minutes" && FOCUSED)} />
        <span className="text-sm text-muted-foreground">{t("common", "minUnit")}</span>
        <Button ref={addRef} variant="outline" style={addStyle}>
          <Plus className="size-4" /> {t("control", "addButton")}
        </Button>
      </div>
    </CardContent>
  </Card>
);

export const ShareCard: React.FC<{
  t: T;
  roomCode: string;
  screenUrl: string;
  copied: "code" | "link" | null;
  copyLinkRef?: React.Ref<HTMLButtonElement>;
  copyLinkStyle?: React.CSSProperties;
}> = ({ t, roomCode, screenUrl, copied, copyLinkRef, copyLinkStyle }) => (
  <Card>
    <CardHeader>
      <CardTitle>{t("control", "shareTitle")}</CardTitle>
    </CardHeader>
    <CardContent className="flex flex-col gap-4">
      <div>
        <p className="mb-1.5 text-sm text-muted-foreground">{t("control", "roomCodeHint")}</p>
        <div className="flex items-center gap-2">
          <Input readOnly value={roomCode} className="font-mono text-lg tracking-widest" />
          <Button variant="outline">{copied === "code" ? t("common", "copied") : t("common", "copy")}</Button>
        </div>
      </div>
      <div>
        <p className="mb-1.5 text-sm text-muted-foreground">{t("control", "viewerLinkLabel")}</p>
        <div className="flex items-center gap-2">
          <Input readOnly value={screenUrl} />
          <Button ref={copyLinkRef} variant="outline" style={copyLinkStyle}>
            {copied === "link" ? t("common", "copied") : t("common", "copy")}
          </Button>
        </div>
      </div>
      <p className="text-xs text-muted-foreground">{t("control", "shareHint")}</p>
    </CardContent>
  </Card>
);

export type ParticipantRow = {
  name: string;
  operator: boolean;
  enter?: number;
  giveRef?: React.Ref<HTMLButtonElement>;
  giveStyle?: React.CSSProperties;
};

/** The Participants card wrapping src/components/participants-panel.tsx's list. */
export const ParticipantsCard: React.FC<{ t: T; rows: ParticipantRow[] }> = ({ t, rows }) => (
  <Card>
    <CardHeader>
      <CardTitle>{t("control", "participantsTitle")}</CardTitle>
    </CardHeader>
    <CardContent>
      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("participantsPanel", "empty")}</p>
      ) : (
        <ul className="flex flex-col gap-1">
          {rows.map((p) => (
            <li
              key={p.name}
              className="flex items-center justify-between gap-3 rounded-md border px-3 py-2 text-sm"
              style={{ opacity: p.enter ?? undefined, translate: `0 ${(1 - (p.enter ?? 1)) * -6}px` }}
            >
              <span className="truncate">{p.name}</span>
              <span className="flex shrink-0 items-center gap-2">
                {p.operator ? (
                  <>
                    <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                      {t("participantsPanel", "operatorBadge")}
                    </span>
                    <Button variant="ghost" size="sm">
                      {t("participantsPanel", "revokeControl")}
                    </Button>
                  </>
                ) : (
                  <Button ref={p.giveRef} variant="outline" size="sm" style={p.giveStyle}>
                    {t("participantsPanel", "giveControl")}
                  </Button>
                )}
                <Button variant="ghost" size="sm">
                  {t("participantsPanel", "remove")}
                </Button>
              </span>
            </li>
          ))}
        </ul>
      )}
    </CardContent>
  </Card>
);
