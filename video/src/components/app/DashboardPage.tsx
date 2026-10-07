import type React from "react";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import type { T } from "../../lib/i18n";
import { AppSidebar } from "./AppSidebar";

/** The focus ring Input shows under :focus-visible — applied by hand since nothing is focused in a render. */
export const FOCUSED = "border-ring ring-[3px] ring-ring/50";

export type DraftRow = {
  name: string;
  minutes: string;
  /** 0→1 entrance, for a row just added with "Add segment". */
  enter?: number;
  nameRef?: React.Ref<HTMLInputElement>;
  minutesRef?: React.Ref<HTMLInputElement>;
};

export type DashboardRefs = {
  eventName?: React.Ref<HTMLInputElement>;
  addSegment?: React.Ref<HTMLButtonElement>;
  createRoom?: React.Ref<HTMLButtonElement>;
};

/** The "Create a room" tab of src/app/(app)/dashboard/page.tsx, inside the (app) shell. */
export const DashboardPage: React.FC<{
  t: T;
  userName: string;
  eventName: string;
  rows: DraftRow[];
  /** Which field shows a focus ring: "event", or `${rowIndex}:name` / `${rowIndex}:minutes`. */
  focus?: string | null;
  creating?: boolean;
  scrollY?: number;
  refs?: DashboardRefs;
  addStyle?: React.CSSProperties;
  createStyle?: React.CSSProperties;
}> = ({ t, userName, eventName, rows, focus, creating, scrollY = 0, refs = {}, addStyle, createStyle }) => (
  <div className="flex min-h-0 flex-1">
    <AppSidebar t={t} activeHref="/dashboard" userName={userName} />
    <div className="relative flex-1 overflow-hidden">
      <main
        className="mx-auto flex min-h-full w-full max-w-xl flex-col justify-center gap-6 px-4 py-12"
        style={{ translate: `0 ${-scrollY}px` }}
      >
        <div>
          <h1 className="text-xl font-semibold">{t("nav", "dashboard")}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t("dashboard", "subtitle")}</p>
        </div>

        <Tabs value="create">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="create">{t("dashboard", "tabCreate")}</TabsTrigger>
            <TabsTrigger value="join">{t("dashboard", "tabJoin")}</TabsTrigger>
            <TabsTrigger value="running">{t("dashboard", "tabRunning")}</TabsTrigger>
          </TabsList>

          <Card>
            <CardHeader>
              <CardTitle>{t("dashboard", "newRoomTitle")}</CardTitle>
              <CardDescription>{t("dashboard", "newRoomDesc")}</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-5">
              <div className="flex flex-col gap-1.5">
                <Label>{t("dashboard", "eventNameLabel")}</Label>
                <Input
                  ref={refs.eventName}
                  readOnly
                  placeholder={t("dashboard", "eventNamePlaceholder")}
                  value={eventName}
                  className={cn(focus === "event" && FOCUSED)}
                />
              </div>

              <Separator />

              <div className="flex flex-col gap-3">
                <Label>{t("dashboard", "agendaLabel")}</Label>
                {rows.map((row, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-2"
                    style={{
                      opacity: row.enter ?? 1,
                      translate: `0 ${(1 - (row.enter ?? 1)) * -6}px`,
                    }}
                  >
                    <Input
                      ref={row.nameRef}
                      readOnly
                      placeholder={t("common", "segmentNamePlaceholder")}
                      value={row.name}
                      className={cn("flex-1", focus === `${i}:name` && FOCUSED)}
                    />
                    <Input
                      ref={row.minutesRef}
                      readOnly
                      value={row.minutes}
                      className={cn("w-20", focus === `${i}:minutes` && FOCUSED)}
                    />
                    <span className="text-sm text-muted-foreground">{t("common", "minUnit")}</span>
                    <Button variant="ghost" size="icon" disabled={rows.length <= 1}>
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                ))}
                <Button ref={refs.addSegment} variant="outline" size="sm" className="self-start" style={addStyle}>
                  <Plus className="size-4" /> {t("dashboard", "addSegment")}
                </Button>
              </div>

              <Button ref={refs.createRoom} size="lg" disabled={creating} style={createStyle}>
                {creating ? t("dashboard", "creating") : t("dashboard", "createRoom")}
              </Button>
            </CardContent>
          </Card>
        </Tabs>
      </main>
    </div>
  </div>
);
