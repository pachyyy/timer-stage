import type React from "react";

/**
 * src/components/ui/dialog.tsx's overlay + content, without Radix's portal/focus machinery (a
 * render has nothing to focus). `open` is 0→1 so the zoom/fade-in can be keyframed per frame,
 * mirroring the real dialog's `zoom-in-95 fade-in-0`.
 */
export const DialogShell: React.FC<{
  open: number;
  title: string;
  description?: string;
  footer: React.ReactNode;
  children?: React.ReactNode;
}> = ({ open, title, description, footer, children }) => (
  <div className="absolute inset-0 z-40" style={{ opacity: open, visibility: open === 0 ? "hidden" : "visible" }}>
    <div className="absolute inset-0 bg-black/50" />
    <div
      className="absolute top-1/2 left-1/2 grid w-full max-w-lg gap-4 rounded-lg border bg-background p-6 shadow-lg"
      style={{ translate: "-50% -50%", scale: String(0.95 + 0.05 * open) }}
    >
      <div className="flex flex-col gap-2 text-left">
        <div className="text-lg leading-none font-semibold">{title}</div>
        {description && <div className="text-sm text-muted-foreground">{description}</div>}
      </div>
      {children}
      <div className="flex flex-row justify-end gap-2">{footer}</div>
    </div>
  </div>
);

/** Resting/checked states of src/components/ui/switch.tsx. */
export const SwitchMock: React.FC<{ checked: boolean; innerRef?: React.Ref<HTMLSpanElement> }> = ({ checked, innerRef }) => (
  <span
    ref={innerRef}
    className={`inline-flex h-[1.15rem] w-8 shrink-0 items-center rounded-full border border-transparent shadow-xs ${
      checked ? "bg-primary" : "bg-input"
    }`}
  >
    <span
      className="block size-4 rounded-full bg-background ring-0"
      style={{ translate: checked ? "calc(100% - 2px) 0" : "0 0" }}
    />
  </span>
);
