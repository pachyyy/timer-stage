import type React from "react";
import { useRef } from "react";
import { interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { BROWSER_BAR_HEIGHT, BrowserFrame } from "../components/BrowserFrame";
import { Cursor } from "../components/Cursor";
import { Page, Screen } from "../components/Screen";
import { Stage } from "../components/Stage";
import { DashboardPage } from "../components/app/DashboardPage";
import { Logo } from "../components/app/Logo";
import { SiteNavbar } from "../components/app/SiteNavbar";
import { makeT, type Locale, type T } from "../lib/i18n";
import { pressScale, progress } from "../lib/motion";
import { UI_SCALE } from "../lib/theme";

export type SignInProps = { locale: Locale; userName: string };

const WINDOW = { x: 40, y: 40, w: 1200, h: 720 };

/** src/app/(marketing)/page.tsx — signed-out landing. */
const LandingPage: React.FC<{ t: T; loginRef: React.Ref<HTMLButtonElement>; loginStyle: React.CSSProperties }> = ({
  t,
  loginRef,
  loginStyle,
}) => (
  <>
    <SiteNavbar t={t} activePath="/" loginRef={loginRef} loginStyle={loginStyle} />
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col items-center justify-center gap-10 px-4 py-10">
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
            <Input readOnly placeholder="e.g. 8QZDV2" className="font-mono text-lg tracking-widest uppercase" />
          </div>
          <Button size="lg" className="mt-3 w-full" disabled>
            {t("joinForm", "button")}
          </Button>
        </CardContent>
      </Card>
    </main>
  </>
);

/** src/app/(marketing)/login/page.tsx. */
const LoginPage: React.FC<{ t: T; googleRef: React.Ref<HTMLButtonElement>; googleStyle: React.CSSProperties }> = ({
  t,
  googleRef,
  googleStyle,
}) => (
  <>
    <SiteNavbar t={t} activePath="/login" />
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center px-4 py-16">
      <Card>
        <CardHeader>
          <CardTitle>{t("login", "titleLogin")}</CardTitle>
          <CardDescription>{t("login", "descLogin")}</CardDescription>
        </CardHeader>
        <CardContent>
          <Button ref={googleRef} size="lg" className="w-full" style={googleStyle}>
            {t("login", "continueGoogle")}
          </Button>
        </CardContent>
      </Card>
    </main>
  </>
);

/**
 * Sign in: landing → "Log in" → "Continue with Google" → (Google's own consent screen, shown here
 * only as a neutral loading beat rather than imitated) → the dashboard.
 */
export const SignIn: React.FC<SignInProps> = ({ locale, userName }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = makeT(locale);
  const loginRef = useRef<HTMLButtonElement>(null);
  const googleRef = useRef<HTMLButtonElement>(null);

  const CLICK_LOGIN = Math.round(1.3 * fps);
  const SHOW_LOGIN = CLICK_LOGIN + 6;
  const CLICK_GOOGLE = SHOW_LOGIN + Math.round(1.5 * fps);
  const SHOW_REDIRECT = CLICK_GOOGLE + 6;
  const SHOW_DASHBOARD = SHOW_REDIRECT + Math.round(0.9 * fps);
  const FADE = 7;

  const landing = 1 - progress(frame, SHOW_LOGIN, FADE);
  const login = progress(frame, SHOW_LOGIN, FADE) - progress(frame, SHOW_REDIRECT, FADE);
  const redirect = progress(frame, SHOW_REDIRECT, FADE) - progress(frame, SHOW_DASHBOARD, FADE);
  const dashboard = progress(frame, SHOW_DASHBOARD, FADE);

  const path = frame < SHOW_LOGIN ? "/" : frame < SHOW_DASHBOARD ? "/login" : "/dashboard";
  const contentHeight = WINDOW.h - BROWSER_BAR_HEIGHT;

  return (
    <Stage>
      <BrowserFrame path={path} width={WINDOW.w} height={WINDOW.h} style={{ left: WINDOW.x, top: WINDOW.y }}>
        <Screen
          width={WINDOW.w}
          height={contentHeight}
          scale={UI_SCALE}
          overlay={
            <Cursor
              waypoints={[
                { at: 0, to: [640, 420] },
                { at: CLICK_LOGIN, to: loginRef, click: true, move: 24 },
                { at: CLICK_GOOGLE, to: googleRef, click: true, move: 26, offset: [-30, 0] },
                { at: SHOW_DASHBOARD + 2 * fps, to: [700, 380], move: 30 },
              ]}
            />
          }
        >
          <Page opacity={landing}>
            <LandingPage t={t} loginRef={loginRef} loginStyle={{ scale: String(pressScale(frame, CLICK_LOGIN)) }} />
          </Page>
          <Page opacity={login}>
            <LoginPage t={t} googleRef={googleRef} googleStyle={{ scale: String(pressScale(frame, CLICK_GOOGLE)) }} />
          </Page>
          <Page opacity={redirect}>
            <div className="flex flex-1 items-center justify-center text-muted-foreground">
              <Loader2
                className="size-6"
                style={{ rotate: `${interpolate(frame, [SHOW_REDIRECT, SHOW_REDIRECT + fps], [0, 360])}deg` }}
              />
            </div>
          </Page>
          <Page opacity={dashboard}>
            <DashboardPage t={t} userName={userName} eventName="" rows={[{ name: "Opening remarks", minutes: "5" }]} />
          </Page>
        </Screen>
      </BrowserFrame>
    </Stage>
  );
};
