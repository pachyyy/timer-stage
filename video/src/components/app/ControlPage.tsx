import type React from "react";
import { History, Languages, Pencil, Plus, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import type { T } from "../../lib/i18n";
import { AgendaRows, type AgendaSegment } from "./AgendaRows";
import { ConnectionBadge } from "./ConnectionBadge";
import { Logo } from "./Logo";
import { OperatorPanel } from "./OperatorPanel";

/** Top of src/app/r/[roomId]/control/page.tsx: header, operator panel and the agenda card. */
export const ControlPage: React.FC<{
  t: T;
  roomName: string;
  segments: AgendaSegment[];
  activeIndex: number;
  remainingMs: number;
  isRunning: boolean;
  scrollY?: number;
}> = ({ t, roomName, segments, activeIndex, remainingMs, isRunning, scrollY = 0 }) => (
  <main
    className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-8"
    style={{ translate: `0 ${-scrollY}px` }}
  >
    <div className="flex items-center justify-between gap-3">
      <div className="flex min-w-0 items-center gap-2">
        <Logo />
        <h1 className="shrink-0 text-xl font-semibold">{t("control", "title")}</h1>
        <span className="flex min-w-0 items-center gap-1">
          <span className="truncate text-sm text-muted-foreground">— {roomName}</span>
          <Pencil className="size-3.5 shrink-0 text-muted-foreground" />
        </span>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <Button variant="outline" size="sm">
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

    <OperatorPanel
      t={t}
      timerName={segments[activeIndex]?.name ?? t("common", "noSegmentSelected")}
      remainingMs={remainingMs}
      isRunning={isRunning}
    />

    <Card>
      <CardHeader>
        <CardTitle>{t("control", "agendaTitle")}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <AgendaRows t={t} segments={segments} activeIndex={activeIndex} />
        <div className="flex items-center gap-2 pt-2">
          <Input readOnly placeholder={t("common", "segmentNamePlaceholder")} className="flex-1" />
          <Input readOnly value="5" className="w-20" />
          <span className="text-sm text-muted-foreground">{t("common", "minUnit")}</span>
          <Button variant="outline">
            <Plus className="size-4" /> {t("control", "addButton")}
          </Button>
        </div>
      </CardContent>
    </Card>
  </main>
);
