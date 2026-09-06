// The frame every Sky page sits in: the eyebrow, the title and the one-line
// lede in a fixed place at the top, and the page's body in the space that is
// left, scrolling on its own. One column the height of the viewport, never
// the page scrolling under its own heading (Sam's rule, 2026-09-04: the
// name and description stay put, on every page). Tracked as
// SAK-300 and SAK-329.

import type { ReactNode } from "react";
import { Eyebrow } from "@/sky/components/sky-card";

export interface SkyPageShellProps {
  /** The small caps line over the title: "Planetarium". Omitted on the home. */
  eyebrow?: string;
  title: string;
  /** Anything beside the title, on the right. */
  aside?: ReactNode;
  /** How tall the page is: a CSS length. The route knows its own chrome. */
  height?: string;
  /** The body. It gets the space left under the heading and `min-h-0`, so a
   * child with `overflow-y-auto` scrolls inside it. */
  children: ReactNode;
  className?: string;
}

export function SkyPageShell({ eyebrow, title, aside, height = "calc(100vh - 8rem)", children, className = "" }: SkyPageShellProps) {
  return (
    <div className={`flex flex-col overflow-hidden font-sky-ui text-sky-ink ${className}`} style={{ height }}>
      <header className="flex shrink-0 flex-wrap items-end justify-between gap-4">
        <div>
          {eyebrow && <Eyebrow className="mb-0">{eyebrow}</Eyebrow>}
          <h1 className={`font-sky-display text-4xl leading-tight ${eyebrow ? "mt-1" : ""}`}>{title}</h1>
        </div>
        {aside}
      </header>
      <div className="mt-4 flex min-h-0 flex-1 flex-col">{children}</div>
    </div>
  );
}
