"use client";

// A chip with a menu on it: the chip toggles the thing, the caret beside
// it opens a card of finer choices (the cuts of a collection in the
// practice recipe). Sam, 2026-09-06: rows of sub-choices under the chips
// were too much; a drop-down on the chip itself. The card floats on the
// body like every other floating card, and closes on a click elsewhere,
// on Escape, or when anything scrolls.

import { useEffect, useRef, useState, type ReactNode } from "react";

import { belowAnchor, Floating, SkyCard, type Anchor } from "@/sky/components/sky-card";

export interface SkyMenuChipProps {
  on: boolean;
  onClick: () => void;
  title?: string;
  /** Something is chosen in the menu: the caret says so. */
  marked?: boolean;
  /** What the caret opens, for a screen reader. */
  menuLabel: string;
  menu: ReactNode;
  className?: string;
  children: ReactNode;
}

export function SkyMenuChip({ on, onClick, title, marked = false, menuLabel, menu, className = "", children }: SkyMenuChipProps) {
  const [at, setAt] = useState<Anchor | null>(null);
  const chip = useRef<HTMLSpanElement>(null);
  const card = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!at) return;
    const away = (e: MouseEvent) => { const t = e.target as Node; if (!chip.current?.contains(t) && !card.current?.contains(t)) setAt(null); };
    const key = (e: KeyboardEvent) => { if (e.key === "Escape") setAt(null); };
    const gone = () => setAt(null);
    document.addEventListener("mousedown", away);
    document.addEventListener("keydown", key);
    document.addEventListener("scroll", gone, true);
    window.addEventListener("resize", gone);
    return () => { document.removeEventListener("mousedown", away); document.removeEventListener("keydown", key); document.removeEventListener("scroll", gone, true); window.removeEventListener("resize", gone); };
  }, [at]);

  const open = () => setAt(at ? null : belowAnchor(chip.current!.getBoundingClientRect()));
  const tone = on ? "border-sky-accent bg-sky-accent text-sky-accent-ink" : "border-sky-line text-sky-muted hover:border-sky-accent hover:text-sky-ink";
  return (
    <>
      <span ref={chip} data-sky-chip="" className={`inline-flex h-[26px] items-stretch overflow-hidden rounded-full border text-[12px] font-semibold leading-none ${tone} ${className}`}>
        <button type="button" onClick={onClick} title={title} aria-pressed={on} className="inline-flex flex-1 items-center justify-center pl-2.5 pr-1.5">{children}</button>
        <button type="button" onClick={open} aria-label={menuLabel} aria-expanded={!!at} aria-haspopup="dialog" className={`inline-flex items-center gap-0.5 border-l pl-1.5 pr-2 ${on ? "border-sky-accent-ink/25" : "border-sky-line"}`}>
          {marked && <span aria-hidden className="text-[9px] leading-none">●</span>}
          <span aria-hidden className={`inline-block text-[10px] leading-none transition-transform ${at ? "rotate-180" : ""}`}>▼</span>
        </button>
      </span>
      {at && (
        <Floating at={at} gap={6} interactive>
          <div ref={card}><SkyCard className="min-w-[16rem] max-w-[26rem]">{menu}</SkyCard></div>
        </Floating>
      )}
    </>
  );
}
