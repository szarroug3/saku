"use client";

// One control that stands for a set of choices, with the choices in a list
// behind it. Sam, 2026-09-08: the Atlas's "Built from" filter was fifty-odd
// chips in four rows, shoving the tiles half a screen down to offer a cut
// almost nobody was taking. A row that long is not a filter, it is a wall.
//
// So the row becomes one chip-shaped button that says what is picked, and the
// choices live in a card that opens on it: the same `Floating` + `SkyCard` the
// menu chip uses (sky-menu-chip.tsx), closing the same three ways, on a click
// elsewhere, on Escape, and when anything scrolls.
//
// The list is a real `listbox` with `aria-multiselectable`, so it is usable
// without a mouse: the list itself takes the focus and carries
// `aria-activedescendant`, arrows and Home/End walk it, Space and Enter toggle
// the active row, and Escape closes and hands the focus back to the control.
//
// The options are laid out as a grid of cells rather than a column of rows,
// because the Atlas has 868 of them and they are single characters: you find
// the one you want by its shape, the way you did among the chips, and eight to
// a row is eight times less scrolling. Left and right walk one cell, up and
// down walk one row.

import { useCallback, useEffect, useId, useRef, useState, type ReactNode } from "react";

import { CHIP_TONE } from "@/sky/components/sky-button";
import { belowAnchor, Floating, SkyCard, type Anchor } from "@/sky/components/sky-card";

/** Cells to a row in the open list, and the step the up and down arrows take. */
const COLUMNS = 8;

interface SkyMultiSelectOption {
  value: string;
  /** What the row shows: the glyph itself, usually. */
  label: ReactNode;
  className?: string;
}

interface SkyMultiSelectProps {
  /** What the control opens, for a screen reader: "Choose the parts". */
  label: string;
  /** What nothing-picked is called, on the control and at the top of the list. */
  empty: string;
  /** What several of them are called: "parts", for "3 parts". */
  unit: string;
  options: readonly SkyMultiSelectOption[];
  chosen: ReadonlySet<string>;
  onToggle: (value: string) => void;
  onClear: () => void;
  /** How many picks fit on the control before it counts them instead. */
  showAtMost?: number;
  className?: string;
}

export function SkyMultiSelect({ label, empty, unit, options, chosen, onToggle, onClear, showAtMost = 3, className = "" }: SkyMultiSelectProps) {
  const [at, setAt] = useState<Anchor | null>(null);
  // Which row the keyboard is on. -1 is the "Any" row above the options.
  const [active, setActive] = useState(-1);
  const control = useRef<HTMLButtonElement>(null);
  const card = useRef<HTMLDivElement>(null);
  const list = useRef<HTMLUListElement>(null);
  const rows = useId();
  const idOf = (i: number) => `${rows}-${i}`;

  const close = useCallback((focus: boolean) => { setAt(null); if (focus) control.current?.focus(); }, []);

  useEffect(() => {
    if (!at) return;
    const away = (e: MouseEvent) => { const t = e.target as Node; if (!control.current?.contains(t) && !card.current?.contains(t)) setAt(null); };
    const gone = () => setAt(null);
    document.addEventListener("mousedown", away);
    document.addEventListener("scroll", gone, true);
    window.addEventListener("resize", gone);
    return () => { document.removeEventListener("mousedown", away); document.removeEventListener("scroll", gone, true); window.removeEventListener("resize", gone); };
  }, [at]);

  // The list takes the focus when it opens, so the arrows go to it and not to
  // whatever the page had focused before.
  useEffect(() => { if (at) list.current?.focus(); }, [at]);

  const open = () => {
    if (at) return close(true);
    setActive(-1);
    setAt(belowAnchor(control.current!.getBoundingClientRect()));
  };

  const onKey = (e: React.KeyboardEvent) => {
    const last = options.length - 1;
    const step = (by: number) => setActive((i) => Math.max(-1, Math.min(last, i < 0 && by > 0 ? by - 1 : i + by)));
    if (e.key === "Escape") { e.preventDefault(); return close(true); }
    if (e.key === "ArrowRight") { e.preventDefault(); return step(1); }
    if (e.key === "ArrowLeft") { e.preventDefault(); return step(-1); }
    if (e.key === "ArrowDown") { e.preventDefault(); return step(COLUMNS); }
    if (e.key === "ArrowUp") { e.preventDefault(); return step(-COLUMNS); }
    if (e.key === "Home") { e.preventDefault(); return setActive(-1); }
    if (e.key === "End") { e.preventDefault(); return setActive(last); }
    if (e.key === " " || e.key === "Enter") {
      e.preventDefault();
      if (active < 0) return onClear();
      return onToggle(options[active].value);
    }
  };

  // Keep the row the arrows are on in view inside the scrolling list.
  useEffect(() => {
    if (!at || active < 0) return;
    document.getElementById(idOf(active))?.scrollIntoView({ block: "nearest" });
    // idOf is derived from `rows`, which never changes for one control.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [at, active, rows]);

  const picked = options.filter((o) => chosen.has(o.value));
  const tone = picked.length > 0 ? CHIP_TONE.on : CHIP_TONE.off;

  return (
    <>
      <button
        ref={control}
        type="button"
        onClick={open}
        aria-label={label}
        aria-expanded={!!at}
        aria-haspopup="listbox"
        className={`inline-flex h-[26px] items-center gap-1.5 rounded-full border px-2.5 text-[12px] font-semibold leading-none ${tone} ${className}`}
      >
        {picked.length === 0
          ? <span>{empty}</span>
          : picked.length <= showAtMost
            ? picked.map((o) => <span key={o.value} className={o.className}>{o.label}</span>)
            : <span>{picked.length} {unit}</span>}
        <span aria-hidden className={`inline-block text-[10px] leading-none transition-transform ${at ? "rotate-180" : ""}`}>▼</span>
      </button>
      {at && (
        <Floating at={at} gap={6} interactive>
          <div ref={card}>
            <SkyCard className="w-[19rem]">
              <ul
                ref={list}
                role="listbox"
                aria-multiselectable
                aria-label={label}
                tabIndex={0}
                aria-activedescendant={active >= 0 ? idOf(active) : `${rows}-any`}
                onKeyDown={onKey}
                className="grid max-h-[17rem] grid-cols-8 gap-1 overflow-y-auto outline-none"
              >
                <li
                  id={`${rows}-any`}
                  role="option"
                  aria-selected={chosen.size === 0}
                  onClick={onClear}
                  className={`col-span-full cursor-pointer rounded-md px-2 py-1 text-[12.5px] ${active < 0 ? "bg-sky-card-strong" : ""} ${chosen.size === 0 ? "font-semibold text-sky-ink" : "text-sky-muted"}`}
                >
                  {empty}
                </li>
                {options.map((o, i) => {
                  const on = chosen.has(o.value);
                  return (
                    <li
                      key={o.value}
                      id={idOf(i)}
                      role="option"
                      aria-selected={on}
                      onClick={() => onToggle(o.value)}
                      className={`grid h-7 cursor-pointer place-items-center rounded-md border text-[15px] leading-none ${on ? CHIP_TONE.on : `border-transparent text-sky-muted hover:text-sky-ink ${active === i ? "bg-sky-card-strong" : ""}`} ${active === i ? "ring-1 ring-sky-accent" : ""} ${o.className ?? ""}`}
                    >
                      {o.label}
                    </li>
                  );
                })}
              </ul>
            </SkyCard>
          </div>
        </Floating>
      )}
    </>
  );
}
