import type React from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import type { T } from "../../lib/i18n";
import { FOCUSED } from "./DashboardPage";
import { Logo } from "./Logo";
import { SiteNavbar } from "./SiteNavbar";

/** src/app/(marketing)/page.tsx — the signed-out landing page, with its join-by-code box. */
export const LandingPage: React.FC<{
  t: T;
  /** Phone-width layout: the navbar's centre links hide, as they do below `sm`. */
  mobile?: boolean;
  scrollY?: number;
  code?: string;
  codeFocused?: boolean;
  loginRef?: React.Ref<HTMLButtonElement>;
  loginStyle?: React.CSSProperties;
  codeRef?: React.Ref<HTMLInputElement>;
  joinRef?: React.Ref<HTMLButtonElement>;
  joinStyle?: React.CSSProperties;
}> = ({ t, mobile, scrollY = 0, code = "", codeFocused, loginRef, loginStyle, codeRef, joinRef, joinStyle }) => (
  <>
    <SiteNavbar t={t} activePath="/" loginRef={loginRef} loginStyle={loginStyle} mobile={mobile} />
    <div className="relative flex-1 overflow-hidden">
      <main
        className="mx-auto flex min-h-full w-full max-w-3xl flex-col items-center justify-center gap-10 px-4 py-10"
        style={{ translate: `0 ${-scrollY}px` }}
      >
        <div className="text-center">
          <div className="flex items-center justify-center gap-2">
            <Logo size={40} />
            <h1 className="bg-[linear-gradient(135deg,var(--primary-gradient-from),var(--primary-gradient-to))] bg-clip-text text-4xl font-semibold tracking-tight text-transparent">
              Cue
            </h1>
          </div>
          <p className="mt-3 text-lg text-muted-foreground">{t("landing", "tagline")}</p>
          <div className="mt-6 flex items-center justify-center gap-3">
            <Button size="lg">{t("landing", "signupCta")}</Button>
            <Button size="lg" variant="outline">
              {t("landing", "pricingCta")}
            </Button>
          </div>
        </div>
        <Card className="w-full max-w-sm">
          <CardHeader>
            <CardTitle>{t("landing", "codeCardTitle")}</CardTitle>
            <CardDescription>{t("landing", "codeCardDesc")}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col gap-1.5">
              <Label>{t("joinForm", "label")}</Label>
              <Input
                ref={codeRef}
                readOnly
                value={code}
                placeholder="e.g. 8QZDV2"
                className={cn("font-mono text-lg tracking-widest uppercase", codeFocused && FOCUSED)}
              />
            </div>
            <Button ref={joinRef} size="lg" className="mt-3 w-full" disabled={!code.trim()} style={joinStyle}>
              {t("joinForm", "button")}
            </Button>
          </CardContent>
        </Card>
      </main>
    </div>
  </>
);
