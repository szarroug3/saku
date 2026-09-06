"use client";

// A row of chips that share one width: each is as wide as the widest, so
// a row wraps into a neat grid (Sam, 2026-09-06: same size in width too).
// Measured in the browser after each render, since only the browser knows
// how wide "Dakuten and handakuten" is in the kana face. Only the chips
// are sized (they carry data-sky-chip); anything else in the row, a form
// or a line of links, keeps its own width.

import { useLayoutEffect, useRef, type ReactNode } from "react";

/** One width for every chip in a box: the ref goes on the box, and each
 * chip inside comes out as wide as the widest. `deep` measures every chip
 * under the box rather than its own children, for a box whose chips sit in
 * groups (the sky's filters: standings on one row, collections on the
 * next, all one size). */
export function useEqualChips<T extends HTMLElement>(deep = false) {
  const box = useRef<T>(null);
  useLayoutEffect(() => {
    const chips = [...(box.current?.querySelectorAll<HTMLElement>(deep ? "[data-sky-chip]" : ":scope > [data-sky-chip]") ?? [])];
    for (const c of chips) c.style.minWidth = "";
    const widest = Math.max(0, ...chips.map((c) => c.getBoundingClientRect().width));
    for (const c of chips) c.style.minWidth = `${Math.ceil(widest)}px`;
  });
  return box;
}

export function ChipRow({ className = "", children }: { className?: string; children: ReactNode }) {
  const row = useEqualChips<HTMLDivElement>();
  return <div ref={row} className={`flex flex-wrap gap-2 ${className}`}>{children}</div>;
}
