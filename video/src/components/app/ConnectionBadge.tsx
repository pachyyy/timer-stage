import type React from "react";

/** The "Live" state of src/components/connection-badge.tsx. */
export const ConnectionBadge: React.FC<{ label: string; className?: string }> = ({ label, className }) => (
  <div
    className={`flex items-center gap-1.5 rounded-full bg-black/40 px-2.5 py-1 text-xs text-white/80 ${className ?? ""}`}
  >
    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
    {label}
  </div>
);
