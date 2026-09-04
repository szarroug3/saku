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

export interface FloatingProps {
  at: Anchor;
  /** Space between the anchor and the card, in pixels. */
  gap?: number;
  id?: string;
  className?: string;
  children: ReactNode;
}

export function Floating({ at, gap = 14, id, className = "", children }: FloatingProps) {
  const style = {
    ...(at.flipX ? { right: window.innerWidth - at.x + gap } : { left: at.x + gap }),
    ...(at.flipY ? { bottom: window.innerHeight - at.y + gap } : { top: at.y + gap }),
  };
  return createPortal(
    <div id={id} role="tooltip" style={style} className={`pointer-events-none fixed z-50 ${className}`}>{children}</div>,
    document.body,
  );
}

/** The card itself: dark ground, a line, a shadow. Also used where the card
 * is not floating, so every card over the sky is the same card. */
export function SkyCard({ className = "", children }: { className?: string; children: ReactNode }) {
  return <div className={`rounded-xl border border-sky-line bg-sky-ground-0 p-3 font-sky-ui text-[13px] text-sky-ink shadow-[0_8px_24px_rgba(0,0,0,0.4)] ${className}`}>{children}</div>;
}

/** The small caps line over a card's content: the kind of thing, the subject. */
export function Eyebrow({ className = "", children }: { className?: string; children: ReactNode }) {
  return <div className={`mb-1 text-[10.5px] font-semibold uppercase tracking-[0.12em] text-sky-muted ${className}`}>{children}</div>;
}
