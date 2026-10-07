import type React from "react";

/** A bezel around a screen — the stage monitor, a tablet, a phone — with a caption underneath. */
export const Device: React.FC<{
  kind: "monitor" | "tablet" | "phone";
  x: number;
  y: number;
  width: number;
  height: number;
  label: string;
  style?: React.CSSProperties;
  children: React.ReactNode;
}> = ({ kind, x, y, width, height, label, style, children }) => {
  const bezel = kind === "phone" ? 7 : 9;
  const radius = kind === "phone" ? 26 : kind === "tablet" ? 18 : 12;
  return (
    <div className="absolute flex flex-col items-center" style={{ left: x, top: y, width, ...style }}>
      <div
        className="overflow-hidden bg-zinc-900"
        style={{
          width,
          height,
          padding: bezel,
          borderRadius: radius,
          boxShadow: "0 18px 40px -12px rgba(0,0,0,0.35)",
        }}
      >
        <div className="h-full w-full overflow-hidden" style={{ borderRadius: radius - bezel }}>
          {children}
        </div>
      </div>
      {kind === "monitor" && (
        <>
          <div className="h-5 w-16 bg-gradient-to-b from-zinc-700 to-zinc-500" />
          <div className="h-1.5 w-40 rounded-full bg-zinc-500" />
        </>
      )}
      <div className="mt-3 flex items-center gap-1.5 text-[15px] font-medium text-muted-foreground">
        <span className="size-1.5 rounded-full bg-emerald-500" />
        {label}
      </div>
    </div>
  );
};
