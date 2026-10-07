import type React from "react";
import { Lock } from "lucide-react";
import { HOST } from "../lib/theme";

export const BROWSER_BAR_HEIGHT = 44;

/** Minimal browser window chrome — traffic lights and an address bar showing the current route. */
export const BrowserFrame: React.FC<{
  path: string;
  width: number;
  height: number;
  style?: React.CSSProperties;
  children: React.ReactNode;
}> = ({ path, width, height, style, children }) => (
  <div
    className="absolute overflow-hidden rounded-xl border bg-background"
    style={{
      width,
      height,
      boxShadow: "0 1px 2px rgba(0,0,0,0.04), 0 24px 60px -12px rgba(0,0,0,0.18)",
      ...style,
    }}
  >
    <div
      className="flex items-center gap-2 border-b bg-muted/60 px-4"
      style={{ height: BROWSER_BAR_HEIGHT }}
    >
      <div className="flex gap-1.5">
        <span className="size-3 rounded-full bg-[#ff5f57]" />
        <span className="size-3 rounded-full bg-[#febc2e]" />
        <span className="size-3 rounded-full bg-[#28c840]" />
      </div>
      <div className="mx-auto flex h-7 w-[46%] min-w-0 items-center justify-center gap-1.5 rounded-md bg-background px-2 text-[13px] text-muted-foreground">
        <Lock className="size-3 shrink-0" />
        <span className="truncate">
          {HOST}
          {path}
        </span>
      </div>
      {/* Balances the traffic lights so the address bar sits truly centred. */}
      <div className="w-[52px]" />
    </div>
    <div className="relative" style={{ height: height - BROWSER_BAR_HEIGHT }}>
      {children}
    </div>
  </div>
);
