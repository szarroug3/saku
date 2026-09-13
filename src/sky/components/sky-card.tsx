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
 * inheriting its color when the caller colors it (a verdict).
 *
 * `tight` is the eyebrow with nothing under it: a label on the same line as
 * what it names, or one whose parent already spaces the row. It is a PROP and
 * not a class because a class could not win (SAK-417). The gap here used to be
 * a plain `mb-1`, and sixteen callers wrote `className="mb-0"` to take it off;
 * Tailwind writes `mb-0` before `mb-1` in the stylesheet, so the later rule
 * won every time and every one of those eyebrows kept a margin its author had
 * asked it to drop. Two callers had found `!mb-0` and worked. Asking for the
 * margin or not is now a question the component answers, so there is nothing
 * for two classes to argue about.
 *
 * AND THE CLASS CANNOT COME BACK (SAK-432). One `mb-0` outlived that sweep, on
 * the home's Details bar, doing nothing there for months. The prop refuses the
 * whole family now: a `className` carrying any `mb-` resolves to the sentence
 * below rather than to itself, so the only shape of the props a caller can
 * satisfy is the one that also passes `tight`, and the compiler says so. A
 * tight eyebrow may still set its own margin, because with the component's own
 * `mb-1` gone there is nothing left for the caller's class to lose to. It
 * catches what it can see: a class written out, which is what every call site
 * in the Sky writes. */
type NoMargin<C extends string> = C extends `${string}mb-${string}`
  ? "Eyebrow writes its own mb-1: pass tight to drop it, and only then may a className set a margin"
  : C;

type EyebrowProps<C extends string> = {
  tone?: "muted" | "accent" | "inherit";
  size?: "sm" | "md";
  children: ReactNode;
} & ({ tight: true; className?: C } | { tight?: false; className?: C & NoMargin<C> });

export function Eyebrow<C extends string>(props: EyebrowProps<C>) {
  const { tone = "muted", size = "sm", tight = false, children } = props;
  // read off `props` rather than defaulted in the destructure: the prop's type
  // is the caller's own literal, and "" is not that literal
  const className: string = props.className ?? "";
  const color = tone === "muted" ? "text-sky-muted" : tone === "accent" ? "text-sky-accent" : "";
  return <div className={`${tight ? "" : "mb-1"} font-semibold uppercase tracking-[0.12em] ${size === "sm" ? "text-[10.5px]" : "text-[12px]"} ${color} ${className}`}>{children}</div>;
}
