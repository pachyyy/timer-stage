import type React from "react";
import { useLayoutEffect, useRef, useState } from "react";
import { interpolate, useCurrentFrame } from "remotion";
import { easeInOut } from "../lib/theme";

type Point = readonly [number, number];
export type CursorTarget = React.RefObject<HTMLElement | null> | Point;

export type Waypoint = {
  /** Frame the pointer arrives at `to`. */
  at: number;
  to: CursorTarget;
  /** Frames spent travelling from the previous waypoint. */
  move?: number;
  click?: boolean;
  /** Nudge from the target's centre, in logical px (e.g. toward an input's left edge). */
  offset?: Point;
};

const DEFAULT_MOVE = 18;
const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
const isPoint = (t: CursorTarget): t is Point => Array.isArray(t);

/**
 * A pointer that glides between real elements. Targets are measured from the live DOM every frame
 * rather than hand-tuned coordinates, so it keeps landing on the right control when the layout —
 * or the app's own primitives — change. Place it as a <Screen> overlay: it fills that viewport and
 * works in its unscaled logical px.
 */
export const Cursor: React.FC<{ waypoints: Waypoint[] }> = ({ waypoints }) => {
  const frame = useCurrentFrame();
  // Measured against our own anchor rather than <Screen>'s root: React attaches refs child-first,
  // so an ancestor's ref isn't set yet when this layout effect first runs.
  const anchorRef = useRef<HTMLDivElement>(null);
  const [points, setPoints] = useState<(Point | null)[]>([]);

  useLayoutEffect(() => {
    const anchor = anchorRef.current;
    if (!anchor) return;
    const origin = anchor.getBoundingClientRect();
    // Effective zoom including any ancestor transform (<Screen>'s, the Studio player's fit-to-window).
    const zoom = origin.width / anchor.offsetWidth;
    const next = waypoints.map(({ to, offset = [0, 0] }): Point | null => {
      if (isPoint(to)) return [to[0] + offset[0], to[1] + offset[1]];
      const el = to.current;
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return [
        (r.left + r.width / 2 - origin.left) / zoom + offset[0],
        (r.top + r.height / 2 - origin.top) / zoom + offset[1],
      ];
    });
    const changed =
      next.length !== points.length ||
      next.some((p, i) => p?.[0] !== points[i]?.[0] || p?.[1] !== points[i]?.[1]);
    if (changed) setPoints(next);
    // `waypoints` is a fresh array each render, so this still re-measures every frame — on purpose,
    // since targets move as pages scroll and rows appear. The `changed` guard is what ends the loop.
  }, [frame, waypoints, points]);

  const ready = points.length === waypoints.length && points.every((p) => p !== null);

  return (
    <div ref={anchorRef} className="pointer-events-none absolute inset-0 z-50">
      {ready && <Pointer frame={frame} waypoints={waypoints} points={points as Point[]} />}
    </div>
  );
};

const Pointer: React.FC<{ frame: number; waypoints: Waypoint[]; points: Point[] }> = ({ frame, waypoints, points }) => {
  // Next waypoint not yet reached; before its travel window starts, rest on the previous one.
  const nextIndex = waypoints.findIndex((w) => w.at > frame);
  let x: number;
  let y: number;
  if (nextIndex === -1) {
    [x, y] = points[points.length - 1];
  } else if (nextIndex === 0) {
    [x, y] = points[0];
  } else {
    const { at, move = DEFAULT_MOVE } = waypoints[nextIndex];
    const t = interpolate(frame, [at - move, at], [0, 1], { ...clamp, easing: easeInOut });
    const [ax, ay] = points[nextIndex - 1];
    const [bx, by] = points[nextIndex];
    x = ax + (bx - ax) * t;
    y = ay + (by - ay) * t;
  }

  const lastClick = [...waypoints].reverse().find((w) => w.click && w.at <= frame);
  const sinceClick = lastClick ? frame - lastClick.at : 999;

  return (
    <div className="absolute top-0 left-0" style={{ translate: `${x}px ${y}px` }}>
      <div
        className="absolute rounded-full bg-primary/30"
        style={{
          width: 44,
          height: 44,
          left: -22,
          top: -22,
          opacity: interpolate(sinceClick, [0, 14], [0.9, 0], clamp),
          scale: String(interpolate(sinceClick, [0, 14], [0.2, 1], clamp)),
        }}
      />
      <svg
        width="22"
        height="26"
        viewBox="0 0 22 26"
        style={{
          marginLeft: -3,
          marginTop: -2,
          filter: "drop-shadow(0 2px 3px rgba(0,0,0,0.25))",
          scale: String(interpolate(sinceClick, [0, 3, 9], [1, 0.82, 1], clamp)),
          transformOrigin: "3px 2px",
        }}
      >
        <path
          d="M3 2 L3 21 L8 16.5 L11.5 24 L14.5 22.6 L11 15.4 L18 15.4 Z"
          fill="#111"
          stroke="#fff"
          strokeWidth="1.6"
          strokeLinejoin="round"
        />
      </svg>
    </div>
  );
};
