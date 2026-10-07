import React from "react";
import { GripVertical, Link2, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatDuration } from "@/lib/timer/model";
import { cn } from "@/lib/utils";
import type { T } from "../../lib/i18n";

export type AgendaSegment = {
  name: string;
  durationMs: number;
  /** This segment's own `linkToNext` — drawn as the toggle under it. */
  linked?: boolean;
  /** 0→1 entrance, for a row just added. */
  enter?: number;
  /** Vertical offset in px — the dragged row, or a neighbour sliding out of its way. */
  offsetY?: number;
  /** The row in hand: raised above its neighbours with dnd-kit's dragging look. */
  lifted?: boolean;
  handleRef?: React.Ref<HTMLSpanElement>;
  editRef?: React.Ref<HTMLButtonElement>;
  linkRef?: React.Ref<HTMLSpanElement>;
};

/** Distance between two rows' tops: row (36px + 2px border) + toggle (20px) + two 4px gaps. */
export const AGENDA_ROW_PITCH = 66;

/** Static render of src/components/agenda-list.tsx's rows (minus dnd-kit). */
export const AgendaRows: React.FC<{ t: T; segments: AgendaSegment[]; activeIndex: number }> = ({
  t,
  segments,
  activeIndex,
}) => (
  <ol className="flex flex-col gap-1">
    {segments.map((segment, i) => (
      <React.Fragment key={segment.name}>
        <li
          className={cn(
            "flex items-center gap-1 rounded-md border bg-background",
            i === activeIndex ? "border-primary bg-accent" : "border-transparent",
            segment.lifted ? "relative z-10 opacity-90 shadow-md" : null,
          )}
          style={{
            opacity: segment.enter ?? undefined,
            translate: `0 ${segment.offsetY ?? (1 - (segment.enter ?? 1)) * -6}px`,
          }}
        >
          <span ref={segment.handleRef} className="flex h-9 w-6 shrink-0 items-center justify-center text-muted-foreground/50">
            <GripVertical className="size-4" />
          </span>
          <span className="flex min-w-0 flex-1 items-center justify-between gap-3 rounded-md px-1 py-2 text-left text-sm">
            <span className="flex min-w-0 items-center gap-2">
              <span className="text-muted-foreground tabular-nums">{i + 1}.</span>
              <span className="truncate">{segment.name}</span>
            </span>
            <span className="flex shrink-0 items-center gap-3 tabular-nums text-muted-foreground">
              {formatDuration(segment.durationMs)}
            </span>
          </span>
          <Button ref={segment.editRef} variant="ghost" size="icon">
            <Pencil className="size-3.5 text-muted-foreground" />
          </Button>
          <Button variant="ghost" size="icon">
            <Trash2 className="size-3.5 text-muted-foreground" />
          </Button>
        </li>
        {i < segments.length - 1 && (
          <li className="flex items-center pl-7" style={{ opacity: segments[i + 1].enter ?? undefined }}>
            <span
              ref={segment.linkRef}
              className={cn(
                "flex items-center gap-1 rounded px-1.5 py-0.5 text-xs text-muted-foreground",
                segment.linked && "text-primary",
              )}
            >
              <Link2 className="size-3" />
              {segment.linked ? t("agendaList", "linkedLabel") : t("agendaList", "linkLabel")}
            </span>
          </li>
        )}
      </React.Fragment>
    ))}
  </ol>
);
