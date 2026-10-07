import type React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { geistMono, geistSans } from "../lib/theme";

const BACKDROP = "#f4f4f5";

/**
 * Root of every docs composition: the neutral backdrop, the app's fonts wired to the same CSS
 * variables next/font sets (so `font-sans`/`font-mono` in the shared primitives resolve), and a
 * short fade from/to the backdrop at both ends so the GIF's loop seam isn't a hard cut.
 */
export const Stage: React.FC<{ children: React.ReactNode; loopFade?: number }> = ({
  children,
  loopFade = 8,
}) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();

  return (
    <AbsoluteFill
      className="text-foreground antialiased"
      style={
        {
          "--font-geist-sans": geistSans,
          "--font-geist-mono": geistMono,
          fontFamily: geistSans,
          background: `radial-gradient(120% 90% at 15% 0%, rgba(236, 48, 19, 0.07), transparent 55%), ${BACKDROP}`,
        } as React.CSSProperties
      }
    >
      {children}
      {loopFade > 0 && (
        <AbsoluteFill
          style={{
            backgroundColor: BACKDROP,
            opacity: interpolate(
              frame,
              [0, loopFade, durationInFrames - 1 - loopFade, durationInFrames - 1],
              [1, 0, 0, 1],
              { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
            ),
          }}
        />
      )}
    </AbsoluteFill>
  );
};
