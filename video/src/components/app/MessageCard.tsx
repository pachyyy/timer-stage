import type React from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { T } from "../../lib/i18n";
import { FOCUSED } from "./DashboardPage";

/** The "Message to screens" card from src/app/r/[roomId]/control/page.tsx (duration picker omitted). */
export const MessageCard: React.FC<{
  t: T;
  draft: string;
  focused: boolean;
  liveMessage: string | null;
  inputRef?: React.Ref<HTMLInputElement>;
  sendRef?: React.Ref<HTMLButtonElement>;
  sendStyle?: React.CSSProperties;
}> = ({ t, draft, focused, liveMessage, inputRef, sendRef, sendStyle }) => {
  const [before, after] = t("control", "showingNow").split("<b>{message}</b>");
  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("control", "messageTitle")}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="flex items-center gap-2">
          <Input
            ref={inputRef}
            readOnly
            placeholder={t("control", "messagePlaceholder")}
            value={draft}
            className={cn("flex-1", focused && FOCUSED)}
          />
          <Button ref={sendRef} style={sendStyle}>
            {t("control", "send")}
          </Button>
        </div>
        {liveMessage ? (
          <div className="flex items-center gap-2 rounded-md border bg-amber-50 px-3 py-2">
            <span className="flex-1 text-sm">
              {before}
              <span className="font-medium">{liveMessage}</span>
              {after}
            </span>
            <Button size="sm" variant="outline">
              {t("common", "clear")}
            </Button>
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">{t("control", "messageHint")}</p>
        )}
      </CardContent>
    </Card>
  );
};
