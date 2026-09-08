// The surfaces on a sky page. `SkySurface` is the see-through box every
// panel, card and rail sits in: the wash colours it and the dust shows
// through, with no blur (measured to stutter). `SkyPanel` is that box with
// a small caps title and, beside it, whatever sums the panel up: "How much
// you've discovered" on the home, "Tonight" on the Observatory, a shelf's
// coverage on the Atlas. Tracked as SAK-336.

import type { ReactNode } from "react";

export const SURFACE = "rounded-2xl border border-sky-line bg-sky-panel font-sky-ui text-sky-ink";

interface SkySurfaceProps {
  as?: "section" | "div" | "nav" | "aside";
  /** The padding: the usual, or the tighter one a rail uses. */
  pad?: "md" | "sm" | "none";
  className?: string;
  children?: ReactNode;
  "aria-label"?: string;
  /** For a surface that is on the page but parked out of sight (the Quiz's
   * list of cards, slid off the right edge): out of the tab order and out
   * of what is read out, rather than merely translated away. */
  "aria-hidden"?: boolean;
  inert?: boolean;
}

export function SkySurface({ as: Tag = "div", pad = "md", className = "", children, ...aria }: SkySurfaceProps) {
  const padding = pad === "md" ? "p-5" : pad === "sm" ? "p-3" : "";
  return <Tag className={`${SURFACE} ${padding} ${className}`} {...aria}>{children}</Tag>;
}

interface SkyPanelProps {
  /** The heading. A node rather than a string so a title can hold something
   * that only a browser can render, such as a time in the reader's own
   * timezone (SAK-355). */
  title: ReactNode;
  /** The line beside the title: "470 of 15,347 Discovered". */
  aside?: ReactNode;
  /** As tall as its content, and no taller than the room it has (SAK-359).
   * A panel whose body scrolls and whose actions sit at the end used to be
   * told to fill its column, so a short list left a void with the buttons
   * pinned far below it. With `fit` the panel stops at its content, and the
   * ceiling is the space it was given: past that the body's own
   * `min-h-0 flex-1 overflow-y-auto` scrolls and the actions are back at the
   * bottom. The same three classes work in a grid cell (`self-start` beats
   * the stretch) and in a flex column (`w-full` keeps `self-start` from
   * narrowing it instead); the caller drops its own `flex-1`. */
  fit?: boolean;
  className?: string;
  children?: ReactNode;
}

export function SkyPanel({ title, aside, fit = false, className = "", children }: SkyPanelProps) {
  return (
    <SkySurface as="section" className={`${fit ? "flex max-h-full min-h-0 w-full flex-col self-start " : ""}${className}`}>
      <div className="flex shrink-0 flex-wrap items-baseline justify-between gap-3">
        <h2 className="text-[12px] font-semibold uppercase tracking-[0.14em] text-sky-muted">{title}</h2>
        {aside && <span className="text-[13px] tabular-nums text-sky-muted">{aside}</span>}
      </div>
      {children}
    </SkySurface>
  );
}

/** A bordered box inside a card: a table, a worked example. Lighter than a
 * surface, with no ground of its own. */
export function SkyBox({ className = "", children }: { className?: string; children: ReactNode }) {
  return <div className={`rounded-xl border border-sky-line px-3.5 py-3 ${className}`}>{children}</div>;
}
