// The frame of a panel that shows one thing and acts on it: a row of
// controls across the top, a body, and actions pinned at the bottom.
// Tracked as SAK-297. The lesson's card, the Atlas's entry and its
// selection, and the Observatory's tonight panel all wear it. With
// `scroll` the frame fills its box and the body scrolls inside it, so the
// box stays put and the buttons never leave the bottom; without it the
// frame is as tall as its content and the page scrolls.

import type { ReactNode } from "react";

import { SkySurface } from "@/sky/components/sky-panel";

export interface DetailFrameProps {
  /** Controls across the top: a widen, a close. */
  toolbar?: ReactNode;
  /** Actions pinned at the bottom, under a hairline. */
  footer?: ReactNode;
  /** Fill the box and scroll the body inside it. */
  scroll?: boolean;
  pad?: "md" | "sm";
  className?: string;
  children: ReactNode;
}

export function DetailFrame({ toolbar, footer, scroll = false, pad = "md", className = "", children }: DetailFrameProps) {
  return (
    <SkySurface as="section" pad={pad} className={`flex flex-col ${scroll ? "h-full overflow-hidden" : ""} ${className}`}>
      {toolbar && <div className="mb-3 flex shrink-0 items-center justify-between gap-2">{toolbar}</div>}
      <div className={scroll ? "-mr-2 flex min-h-0 flex-1 flex-col overflow-y-auto pr-2" : "flex flex-col"}>{children}</div>
      {footer && <div className={`mt-auto flex flex-wrap items-center gap-2 border-t border-sky-line pt-4 ${scroll ? "shrink-0" : "[&:not(:first-child)]:mt-5"}`}>{footer}</div>}
    </SkySurface>
  );
}
