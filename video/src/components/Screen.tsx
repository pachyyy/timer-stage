import type React from "react";

/**
 * A browser viewport: lays its pages out at a logical size of `width / scale` × `height / scale`
 * and zooms them up to fill `width` × `height`, so the app's real 14px UI stays legible in a GIF.
 * Pages stack inside it (see <Page>); `overlay` (the cursor) sits above them, unaffected by any
 * page's own scroll — just like a real pointer over a scrolling page.
 */
export const Screen: React.FC<{
  width: number;
  height: number;
  scale: number;
  children: React.ReactNode;
  overlay?: React.ReactNode;
}> = ({ width, height, scale, children, overlay }) => (
  <div className="relative overflow-hidden" style={{ width, height }}>
    <div
      className="absolute top-0 left-0"
      style={{
        width: width / scale,
        height: height / scale,
        scale: String(scale),
        transformOrigin: "0 0",
      }}
    >
      {children}
      {overlay}
    </div>
  </div>
);

/**
 * One route inside a <Screen>. Every page of a scene stays mounted and only its opacity changes,
 * so the cursor can always measure any page's controls — including the one it's leaving.
 */
export const Page: React.FC<{
  opacity: number;
  className?: string;
  children: React.ReactNode;
}> = ({ opacity, className, children }) => (
  <div
    className={`absolute inset-0 flex flex-col overflow-hidden bg-background ${className ?? ""}`}
    style={{ opacity, visibility: opacity === 0 ? "hidden" : "visible" }}
  >
    {children}
  </div>
);
