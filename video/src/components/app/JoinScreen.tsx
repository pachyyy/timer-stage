import type React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import type { T } from "../../lib/i18n";
import { FOCUSED } from "./DashboardPage";

/** src/components/join-gate.tsx — the name prompt every screen and participant passes once. */
export const JoinScreen: React.FC<{
  t: T;
  name: string;
  focused: boolean;
  joining?: boolean;
  nameRef?: React.Ref<HTMLInputElement>;
  joinRef?: React.Ref<HTMLButtonElement>;
  joinStyle?: React.CSSProperties;
}> = ({ t, name, focused, joining, nameRef, joinRef, joinStyle }) => (
  <div className="flex h-full w-full items-center justify-center bg-black px-4">
    <div className="flex w-full max-w-sm flex-col gap-4 rounded-xl border border-white/10 bg-white/5 p-6">
      <div>
        <h1 className="text-lg font-semibold text-white">{t("joinGate", "joinTitle")}</h1>
        <p className="mt-1 text-sm text-white/50">{t("joinGate", "joinDesc")}</p>
      </div>
      <div className="flex flex-col gap-1.5">
        <Label className="text-white/70">{t("joinGate", "yourNameLabel")}</Label>
        <Input
          ref={nameRef}
          readOnly
          value={name}
          placeholder={t("joinGate", "namePlaceholder")}
          className={cn("border-white/20 bg-white/10 text-white placeholder:text-white/30", focused && FOCUSED)}
        />
      </div>
      <Button ref={joinRef} disabled={!name.trim() || joining} style={joinStyle}>
        {joining ? t("joinGate", "joining") : t("joinGate", "join")}
      </Button>
    </div>
  </div>
);
