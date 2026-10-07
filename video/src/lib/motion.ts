import { interpolate } from "remotion";
import { easeOut } from "./theme";

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

/** 0→1 over `duration` frames starting at `start`. */
export const progress = (frame: number, start: number, duration: number) =>
  interpolate(frame, [start, start + duration], [0, 1], { ...clamp, easing: easeOut });

/** The slice of `text` typed so far, at `framesPerChar` frames per character from `start`. */
export const typed = (frame: number, start: number, text: string, framesPerChar = 2) =>
  frame < start ? "" : text.slice(0, Math.floor((frame - start) / framesPerChar) + 1);

/** Frame at which typing `text` from `start` finishes. */
export const typedEnd = (start: number, text: string, framesPerChar = 2) =>
  start + (text.length - 1) * framesPerChar;

/** A brief press-in for a clicked control — pairs with the cursor's own click at `at`. */
export const pressScale = (frame: number, at: number) =>
  interpolate(frame, [at - 1, at + 2, at + 8], [1, 0.96, 1], clamp);

/** Index of the last keyframe at or before `frame` — for discrete UI state (which page, which tab). */
export const stepAt = (frame: number, starts: readonly number[]) => {
  let index = 0;
  starts.forEach((start, i) => {
    if (frame >= start) index = i;
  });
  return index;
};
