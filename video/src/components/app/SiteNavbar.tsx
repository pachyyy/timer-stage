import type React from "react";
import { Languages } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { T } from "../../lib/i18n";
import { Logo } from "./Logo";

/** Signed-out state of src/components/site-navbar.tsx. */
export const SiteNavbar: React.FC<{
  t: T;
  activePath: string;
  loginRef?: React.Ref<HTMLButtonElement>;
  loginStyle?: React.CSSProperties;
  /** Below `sm` the real navbar hides its centre links. */
  mobile?: boolean;
}> = ({ t, activePath, loginRef, loginStyle, mobile }) => {
  const links = [
    { href: "/", label: t("nav", "home") },
    { href: "/pricing", label: t("nav", "pricing") },
    { href: "/docs", label: t("nav", "docs") },
  ];
  return (
    <header className="border-b">
      <div className="mx-auto flex h-14 w-full max-w-5xl items-center justify-between gap-4 px-4">
        <div className="flex shrink-0 items-center gap-2">
          <Logo />
          <span className="font-semibold tracking-tight">Cue</span>
        </div>
        <nav className={mobile ? "hidden" : "flex items-center gap-6 text-sm text-muted-foreground"}>
          {links.map((link) => (
            <span key={link.href} className={activePath === link.href ? "text-foreground" : undefined}>
              {link.label}
            </span>
          ))}
        </nav>
        <div className="flex shrink-0 items-center gap-2">
          <Button variant="ghost" size="icon">
            <Languages className="size-4" />
          </Button>
          <Button ref={loginRef} size="sm" variant="outline" style={loginStyle}>
            {t("nav", "login")}
          </Button>
          <Button size="sm">{t("nav", "signup")}</Button>
        </div>
      </div>
    </header>
  );
};
