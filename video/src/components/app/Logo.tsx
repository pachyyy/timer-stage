import type React from "react";

/** public/cue.svg, inlined (minus its C2PA metadata) so it renders without an asset round-trip. */
export const Logo: React.FC<{ size?: number; className?: string; style?: React.CSSProperties }> = ({
  size = 24,
  className,
  style,
}) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 256 256"
    className={`shrink-0 rounded-md ${className ?? ""}`}
    style={style}
  >
    <rect width="256" height="256" fill="#ec3013" />
    <path d="M175.6 184.7 A74 74 0 1 1 175.6 71.3" fill="none" stroke="#ffffff" strokeWidth="26" />
    <rect x="119" y="52" width="18" height="76" fill="#ffffff" />
  </svg>
);
