import { loadFont as loadGeist } from "@remotion/google-fonts/Geist";
import { loadFont as loadGeistMono } from "@remotion/google-fonts/GeistMono";
import { Easing } from "remotion";

// Same families the app loads through next/font (src/app/layout.tsx).
export const { fontFamily: geistSans } = loadGeist("normal", {
  weights: ["400", "500", "600", "700"],
  subsets: ["latin"],
});
export const { fontFamily: geistMono } = loadGeistMono("normal", {
  weights: ["500", "600"],
  subsets: ["latin"],
});

export const FPS = 30;
export const WIDTH = 1280;
export const HEIGHT = 800;

/** The app's UI is authored for a real browser — rendered 1:1 at 1280 wide it reads tiny once a
 * docs page shrinks the GIF to column width, so every browser frame zooms its content by this. */
export const UI_SCALE = 1.2;

export const easeOut = Easing.bezier(0.16, 1, 0.3, 1);
export const easeInOut = Easing.bezier(0.65, 0, 0.35, 1);

/** Prefixed to each route in the fake address bar — empty shows the path alone. Set it to the
 * production domain once there is one. */
export const HOST = "";
