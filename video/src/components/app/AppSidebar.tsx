import type React from "react";
import { BookOpen, CreditCard, DoorOpen, History, Languages, LayoutDashboard, LogOut, PanelLeftClose, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { T } from "../../lib/i18n";
import { Logo } from "./Logo";

/** Expanded desktop state of src/components/app-sidebar.tsx. */
export const AppSidebar: React.FC<{ t: T; activeHref: string; userName: string }> = ({
  t,
  activeHref,
  userName,
}) => {
  const main = [
    { href: "/dashboard", label: t("nav", "dashboard"), icon: LayoutDashboard },
    { href: "/my-rooms", label: t("nav", "myRooms"), icon: DoorOpen },
    { href: "/history", label: t("nav", "history"), icon: History },
    { href: "/account", label: t("nav", "account"), icon: User },
  ];
  const secondary = [
    { href: "/pricing", label: t("nav", "pricing"), icon: CreditCard },
    { href: "/docs", label: t("nav", "docs"), icon: BookOpen },
  ];
  const item = (link: (typeof main)[number]) => (
    <div
      key={link.href}
      className={cn(
        "flex items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium",
        activeHref === link.href ? "bg-accent text-accent-foreground" : "text-muted-foreground",
      )}
    >
      <link.icon className="size-4 shrink-0" />
      {link.label}
    </div>
  );

  return (
    <aside className="relative flex w-60 shrink-0 flex-col border-r">
      <div className="flex items-center gap-2 px-4 py-4">
        <Logo />
        <span className="truncate font-semibold tracking-tight">Cue</span>
      </div>
      <div className="flex-1 px-2">
        <nav className="flex flex-col gap-1">{main.map(item)}</nav>
        <div className="my-3 h-px bg-border" />
        <nav className="flex flex-col gap-1">{secondary.map(item)}</nav>
      </div>
      <div className="flex items-center justify-between gap-1 border-t px-3 py-3">
        <span className="truncate text-xs text-muted-foreground">{userName}</span>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon">
            <Languages className="size-4" />
          </Button>
          <Button variant="ghost" size="icon">
            <LogOut className="size-4" />
          </Button>
        </div>
      </div>
      <div className="absolute top-4 -right-3 flex size-6 items-center justify-center rounded-full border bg-background text-muted-foreground shadow-sm">
        <PanelLeftClose className="size-3.5" />
      </div>
    </aside>
  );
};
