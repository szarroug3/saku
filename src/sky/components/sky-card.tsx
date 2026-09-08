"use client";

// The card that floats over the sky: the tooltip on a star, the numbers
// behind a discovery bar, the key behind the legend. One shell, one way of
// placing it. Tracked as SAK-335 and SAK-336.
//
// `Floating` renders on the body, fixed to the viewport, anchored by
// whichever edges face away from where it needs room. On the body because a
// styled ancestor (a transform, a backdrop filter) would make "fixed" local
// to itself and put the card far from the pointer, and because a scrolling
// panel would clip it. Where it goes is decided in the event that opens it,
// where reading the viewport is allowed: `pointerAnchor` for a card beside
// the pointer, `aboveAnchor` for one that opens above a control.

import type { ReactNode } from "react";
import { createPortal } from "react-dom";

/** Where a floating card hangs from: a point, and which side of it the card
 * lays out on. `flipX` means the card ends at x (lays out to the left);
 * `flipY` means it ends at y (lays out above). */
export interface Anchor {
  x: number;
  y: number;
  flipX: boolean;
  flipY: boolean;
}

/** Beside the pointer, on the side with more room. */
export function pointerAnchor(clientX: number, clientY: number): Anchor {
  return { x: clientX, y: clientY, flipX: clientX > window.innerWidth * 0.6, flipY: clientY > window.innerHeight * 0.6 };
}

/** Above a control, ending at its right edge (or starting at its left edge
 * when that leaves more room). */
export function aboveAnchor(rect: DOMRect): Anchor {
  const flipX = rect.right > window.innerWidth * 0.5;
  return { x: flipX ? rect.right : rect.left, y: rect.top, flipX, flipY: true };
}

/** Below a control, starting at its left edge (or ending at its right edge
 * when that leaves more room). */
export function belowAnchor(rect: DOMRect): Anchor {
  const flipX = rect.left > window.innerWidth * 0.55;
  return { x: flipX ? rect.right : rect.left, y: rect.bottom, flipX, flipY: false };
}

interface FloatingProps {
  at: Anchor;
  /** Space between the anchor and the card, in pixels. */
  gap?: number;
  id?: string;
  /** A card to be used (a menu) rather than only read (a tooltip): it
   * takes the pointer and names its role. */
  interactive?: boolean;
  className?: string;
  children: ReactNode;
}

export function Floating({ at, gap = 14, id, interactive = false, className = "", children }: FloatingProps) {
  const style = {
    ...(at.flipX ? { right: window.innerWidth - at.x + gap } : { left: at.x + gap }),
    ...(at.flipY ? { bottom: window.innerHeight - at.y + gap } : { top: at.y + gap }),
  };
  return createPortal(
    <div id={id} role={interactive ? "dialog" : "tooltip"} style={style} className={`fixed z-50 ${interactive ? "" : "pointer-events-none"} ${className}`}>{children}</div>,
    document.body,
  );
}

/** The card itself: dark ground, a line, a shadow. Also used where the card
 * is not floating, so every card over the sky is the same card. */
export function SkyCard({ className = "", children }: { className?: string; children: ReactNode }) {
  return <div className={`rounded-xl border border-sky-line bg-sky-ground-0 p-3 font-sky-ui text-[13px] text-sky-ink shadow-[0_8px_24px_rgba(0,0,0,0.4)] ${className}`}>{children}</div>;
}

/** The small caps line over content: the kind of thing, a section's name,
 * a table's title. The ONE such label in the Sky (audit, 2026-09-05):
 * muted by default, in the accent when it names a thing being taught,
 * inheriting its colour when the caller colours it (a verdict).
 *
 * `tight` is the eyebrow with nothing under it: a label on the same line as
 * what it names, or one whose parent already spaces the row. It is a PROP and
 * not a class because a class could not win (SAK-417). The gap here used to be
 * a plain `mb-1`, and sixteen callers wrote `className="mb-0"` to take it off;
 * Tailwind writes `mb-0` before `mb-1` in the stylesheet, so the later rule
 * won every time and every one of those eyebrows kept a margin its author had
 * asked it to drop. Two callers had found `!mb-0` and worked. Asking for the
 * margin or not is now a question the component answers, so there is nothing
 * for two classes to argue about. */
export function Eyebrow({ tone = "muted", size = "sm", tight = false, className = "", children }: { tone?: "muted" | "accent" | "inherit"; size?: "sm" | "md"; tight?: boolean; className?: string; children: ReactNode }) {
  const colour = tone === "muted" ? "text-sky-muted" : tone === "accent" ? "text-sky-accent" : "";
  return <div className={`${tight ? "" : "mb-1"} font-semibold uppercase tracking-[0.12em] ${size === "sm" ? "text-[10.5px]" : "text-[12px]"} ${colour} ${className}`}>{children}</div>;
}
