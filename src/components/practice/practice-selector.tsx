"use client";

// WHAT TO PRACTISE — the option-A presets, as tiles.
//
// This replaced the granular query card (kind chips, band chips, a list row).
// Option A's bargain is that Practice offers a few ready pools and sends you to
// the Library for anything finer, rather than carrying a second copy of the
// Library's picker. So there are three preset tiles and one door:
//
//   Everything I have seen .. the whole known pool.
//   Just the shaky ones ..... the bands that need work (see practice-presets).
//   <a saved list> .......... one tile per list you've built.
//   Pick exactly what I want. a link to the Library, where a selection is made
//                             by hand and drilled from its own bar.
//
// Each tile owns its count, resolved the same way Start resolves the pool it
// runs, so the number on the tile is the number you get. A tile is lit only
// when the stored selection is EXACTLY that preset (see activePreset): a rich
// query left over from before, or a session rerun, lights nothing rather than
// mislabelling itself as "Everything".

import Link from "next/link";
import { useMemo } from "react";

import { japaneseFontClass } from "@/lib/japanese-text";
import { resolve } from "@/lib/selection";
import {
  activePreset,
  everythingSelection,
  listSelection,
  shakySelection,
} from "@/lib/practice-presets";
import type { AccuracyMetric, HistoryFile, SavedList, Selection } from "@/types";

function cx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}

function Tile({
  glyph,
  glyphClass,
  label,
  count,
  countClass,
  on,
  onClick,
}: {
  glyph: string;
  glyphClass?: string;
  label: string;
  count: number;
  countClass?: string;
  on: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cx(
        "kq-material flex w-full cursor-pointer items-center gap-3 rounded-lg border px-3 py-2.5 text-left text-[13px]",
        on
          ? "border-accent bg-accent-bg text-accent"
          : "border-border bg-card text-text hover:bg-panel",
      )}
    >
      {/* `jp` was here and no stylesheet has ever defined it, so the あ on the
          first tile has been rendering in the UI face. The rule is the same one
          the Library glyph slots use, and it is why this can stay one component
          for both tiles: あ takes the theme's Japanese face, ▲ does not. */}
      <span className={cx(japaneseFontClass(glyph), "text-lg", glyphClass)}>{glyph}</span>
      <span className="min-w-0 flex-1 truncate">{label}</span>
      <span
        className={cx(
          "flex-none rounded-full border px-2 py-0.5 text-[10.5px] tabular-nums",
          countClass ?? "border-border text-text-muted",
        )}
      >
        {count}
      </span>
    </button>
  );
}

export function PracticeSelector({
  sel,
  lists,
  history,
  metric,
  onChange,
}: {
  sel: Selection;
  lists: SavedList[];
  history: HistoryFile;
  metric: AccuracyMetric;
  onChange: (next: Selection) => void;
}) {
  // One resolve per preset. resolve() walks the known pool, so this is the same
  // cost the query card paid, memoised on the same inputs its counts depend on.
  const everythingCount = useMemo(
    () => resolve(everythingSelection(), history, lists, metric).length,
    [history, lists, metric],
  );
  const shakyCount = useMemo(
    () => resolve(shakySelection(), history, lists, metric).length,
    [history, lists, metric],
  );
  const listCounts = useMemo(
    () =>
      new Map(
        lists.map((l) => [
          l.id,
          resolve(listSelection(l.id), history, lists, metric).length,
        ]),
      ),
    [lists, history, metric],
  );

  const active = activePreset(sel, lists.map((l) => l.id));

  return (
    <div className="kq-material mb-3.5 rounded-xl border border-border bg-card p-3.5">
      <div className="flex flex-col gap-2">
        <Tile
          glyph="あ"
          label="Everything I have seen"
          count={everythingCount}
          on={active.kind === "everything"}
          onClick={() => onChange(everythingSelection())}
        />
        <Tile
          glyph="▲"
          glyphClass="text-warning"
          label="Just the shaky ones"
          count={shakyCount}
          countClass="border-warning text-warning"
          on={active.kind === "shaky"}
          onClick={() => onChange(shakySelection())}
        />
        {lists.map((l) => (
          <Tile
            key={l.id}
            glyph="✎"
            label={l.name}
            count={listCounts.get(l.id) ?? 0}
            on={active.kind === "list" && active.listId === l.id}
            onClick={() => onChange(listSelection(l.id))}
          />
        ))}
        {/* The door, not a preset: a dashed tile that leads to the Library,
            where an arbitrary selection is built and drilled from its own bar.
            It never lights, because it selects nothing here. */}
        <Link
          href="/library"
          className="flex w-full items-center gap-3 rounded-lg border border-dashed border-border bg-card px-3 py-2.5 text-left text-[13px] text-text no-underline hover:bg-panel"
        >
          <span className="jp text-lg">＋</span>
          <span className="min-w-0 flex-1 truncate">
            Pick exactly what I want
          </span>
          <span className="flex-none text-[11px] text-accent">Library →</span>
        </Link>
      </div>
    </div>
  );
}
