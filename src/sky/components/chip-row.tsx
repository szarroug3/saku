"use client";

// A row of chips that share one width: each is as wide as the widest, so
// a row wraps into a neat grid (Sam, 2026-09-06: same size in width too).
// Measured in the browser after each render, since only the browser knows
// how wide "Dakuten and handakuten" is in the kana face. Only the chips
// are sized (they carry data-sky-chip); anything else in the row, a form
// or a line of links, keeps its own width.

import { useLayoutEffect, useRef, type ReactNode } from "react";

export function ChipRow({ className = "", children }: { className?: string; children: ReactNode }) {
  const row = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const chips = [...(row.current?.querySelectorAll<HTMLElement>(":scope > [data-sky-chip]") ?? [])];
    for (const c of chips) c.style.minWidth = "";
    const widest = Math.max(0, ...chips.map((c) => c.getBoundingClientRect().width));
    for (const c of chips) c.style.minWidth = `${Math.ceil(widest)}px`;
  });
  return <div ref={row} className={`flex flex-wrap gap-2 ${className}`}>{children}</div>;
}
