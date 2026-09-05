"use client";

// The Atlas's grid: a tile per entry, the glyph in its standing's colour
// with the meaning under it (no constellation: the Atlas is a grid to
// scan), in cuts that mount their tiles only as they scroll into view, so
// a shelf of twelve thousand words costs nothing until it is reached.
// Tracked as SAK-323 and SAK-328.

import { useEffect, useRef, useState } from "react";

import { japaneseFont } from "@/sky/lib/japanese";
import { STANDING } from "@/sky/lib/standing";
import type { SkyItem } from "@/sky/lib/types";

/** How a tile was clicked: plain opens it alone, cmd or ctrl adds it to
 * the selection, shift takes the run from the last one clicked to it. */
export interface Pick { toggle: boolean; range: boolean }
export type OnPick = (id: string, pick: Pick) => void;

export interface TileGridProps {
  items: readonly SkyItem[];
  selected: ReadonlySet<string>;
  onPick: OnPick;
  /** A tile hovered: fetch its entry ahead, so a click finds it ready. */
  onPeek?: (id: string) => void;
}

/** A glyph that is really a name in English (a sentence rule's "Because /
 * so", a counter's "one thing"): set smaller, allowed to wrap, given a
 * wider tile. */
export const isName = (glyph: string) => /^[\p{Script=Latin}\p{N} /().'’-]+$/u.test(glyph) && glyph.length > 2;

/** Whether a thing is shown by its name rather than a glyph: its glyph is
 * its name (a term, a concept, a rule with no mark), or reads as one. */
export const named = (item: SkyItem) => item.glyph === item.english || isName(item.glyph);

export function Tile({ item, selected, onPick, onPeek }: { item: SkyItem; selected: boolean; onPick: OnPick; onPeek?: (id: string) => void }) {
  const name = named(item);
  const lone = !name && [...item.glyph].length <= 1;
  return (
    <button
      type="button"
      onClick={(e) => onPick(item.id, { toggle: e.metaKey || e.ctrlKey, range: e.shiftKey })}
      onPointerEnter={onPeek ? () => onPeek(item.id) : undefined}
      aria-pressed={selected}
      title={`${item.glyph} ${item.english}`}
      className={`flex min-w-0 flex-col items-center justify-center gap-0.5 rounded-lg border px-1.5 transition-colors ${name ? "h-16" : "aspect-square"} ${selected ? "border-sky-accent bg-sky-card-strong" : "border-transparent bg-sky-panel hover:bg-sky-card-strong"}`}
    >
      <span className={`max-w-full text-center leading-tight ${name ? "line-clamp-2 font-sky-ui text-[12.5px] font-semibold" : `truncate font-sky-display leading-none ${lone ? "text-[24px]" : "text-[15px]"}`} ${STANDING[item.standing].text} ${japaneseFont(item.glyph)}`}>{item.glyph}</span>
      {item.english !== item.glyph && <span className="max-w-full truncate text-[9.5px] text-sky-muted">{item.english}</span>}
    </button>
  );
}

export function TileGrid({ items, selected, onPick, onPeek }: TileGridProps) {
  // tiles keep one size whatever the grid's width (the panel opening beside
  // it must not resize them): fixed columns, wider for a cut of names
  const wide = items.some(named);
  return (
    <div className={`grid gap-1.5 ${wide ? "grid-cols-[repeat(auto-fill,130px)]" : "grid-cols-[repeat(auto-fill,72px)]"}`}>
      {items.map((it) => <Tile key={it.id} item={it} selected={selected.has(it.id)} onPick={onPick} onPeek={onPeek} />)}
    </div>
  );
}

/** A cut of a shelf whose tiles mount only as it comes into view. Until
 * then it holds the room its rows will take. */
export function LazyTileGrid({ label, items, selected, onPick, onPeek }: TileGridProps & { label?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [near, setNear] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || near) return;
    const io = new IntersectionObserver(([entry]) => { if (entry.isIntersecting) setNear(true); }, { rootMargin: "600px 0px" });
    io.observe(el);
    return () => io.disconnect();
  }, [near]);
  // about eight tiles a row at the narrowest the grid gets; only a guess
  // at the room, replaced by the real rows once mounted
  const rows = Math.ceil(items.length / 8);
  return (
    <div ref={ref} className="mt-3" style={near ? undefined : { minHeight: `${rows * 70 + (label ? 22 : 0)}px` }}>
      {label && <p className="mb-1.5 text-[11.5px] font-semibold text-sky-muted">{label}</p>}
      {near && <TileGrid items={items} selected={selected} onPick={onPick} onPeek={onPeek} />}
    </div>
  );
}
