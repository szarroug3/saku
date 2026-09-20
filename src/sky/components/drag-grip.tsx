"use client";

// The line you drag to resize something, and the only one there is (SAK-471).
//
// Sam, 2026-09-20: "on the lesson page, the drag line is perfect. add it to the
// atlas too since that's missing it." So the lesson's line moved here
// unchanged and the Atlas entry panel draws the same one turned on its side.
// The Atlas had a bare 12px strip with a cursor and no line at all, which is
// why nobody could tell the panel was draggable.
//
// What the component owns is the LOOK and the WAY IT IS DRIVEN: a 12px strip
// you can hit, a short line down the middle of it that takes the accent on
// hover and while it is being dragged, the "Drag to resize" tooltip, and the
// arrow keys for anyone who cannot drag. What it does not own is where it goes
// or what it resizes: the caller puts it where it belongs and does the
// arithmetic, because how far a line can travel is the page's own business.
//
// The strip is focused on pointer down. That is what lights the line for the
// whole drag rather than only while the pointer is still over the 12px it
// started in, and it leaves the keyboard on the grip afterwards, so the arrow
// keys carry on from where the drag stopped.

import type { PointerEvent as ReactPointerEvent } from "react";

/** The line itself: `bg-sky-line` at rest, the accent under the pointer and
 * while the grip has the keyboard. Both of those are `group-` rules, so they
 * read the strip around the line rather than the two pixels of the line. */
const LINE = "rounded-full bg-sky-line group-hover:bg-sky-accent group-focus:bg-sky-accent";

interface DragGripProps {
  /** Which way the line lies. "horizontal" is a line across the top of
   * something, dragged up and down (the lesson's details card); "vertical" is
   * a line down the side of something, dragged left and right (the Atlas entry
   * panel). It is the `aria-orientation` a separator reports, and it decides
   * the cursor, the shape of the line and which two arrow keys are read. */
  orientation: "horizontal" | "vertical";
  /** What dragging it does: "Drag to make the details taller". The tooltip is
   * the short "Drag to resize" on both pages; this is the whole name. */
  label: string;
  /** The id of what it resizes. */
  controls?: string;
  /** Where the thing being resized stands and the two ends it stands between,
   * for assistive tech. All three or none. */
  now?: number;
  min?: number;
  max?: number;
  onDrag: (e: ReactPointerEvent<HTMLDivElement>) => void;
  /** An arrow key. `back` is ArrowUp on a horizontal line and ArrowLeft on a
   * vertical one: both of them take the line toward the top or the left. */
  onNudge: (back: boolean) => void;
  /** Where the strip goes, from the caller: the absolute placing, the z-index,
   * and on the lesson the `hidden lg:block` that keeps it off a narrow page. */
  className?: string;
}

/** The strip, the line in it, and the keys. One component for the lesson's
 * details card and the Atlas's entry panel, so there is one drag line in the
 * Sky rather than two that look alike. */
export function DragGrip({ orientation, label, controls, now, min, max, onDrag, onNudge, className = "" }: DragGripProps) {
  const across = orientation === "horizontal";
  const back = across ? "ArrowUp" : "ArrowLeft";
  const on = across ? "ArrowDown" : "ArrowRight";
  return (
    <div
      role="separator"
      aria-orientation={orientation}
      aria-label={label}
      aria-valuenow={now}
      aria-valuemin={min}
      aria-valuemax={max}
      aria-controls={controls}
      tabIndex={0}
      title="Drag to resize"
      onPointerDown={(e) => { e.currentTarget.focus(); onDrag(e); }}
      onKeyDown={(e) => {
        if (e.key !== back && e.key !== on) return;
        e.preventDefault();
        onNudge(e.key === back);
      }}
      className={`group flex touch-none items-center justify-center ${across ? "h-3 w-full cursor-row-resize" : "h-full w-3 cursor-col-resize"} ${className}`}
    >
      <span aria-hidden className={`${LINE} ${across ? "h-0.5 w-16" : "h-16 w-0.5"}`} />
    </div>
  );
}
