"use client";

// The triage boards and the actions under them — the half of the screen you
// touch. Everything lit is what Redrill will run, which is why the boards and
// the button can't be separated: the count in the button is the board.
//
// Needs work starts ON, Solid starts OFF, and every cell is a toggle either
// way — the split is the app's opinion, not a rule.

import { useState } from "react";

import { Btn, PrimaryBtn } from "@/components/ui";
import type { RunFacts } from "@/components/results/summary";
import type { CharSessionDetail, SessionStats } from "@/types";

function cx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}

/** The cell's tiny note: how it went, in the fewest characters that are true. */
function noteOf(st: CharSessionDetail): string {
  if (!st.everCorrect) return "never";
  if (st.misses > 0) return `×${st.misses}`;
  if (st.slow > 0) return "slow";
  return "";
}

/** Never landed, or fought you more than once. The rest is amber. */
function severe(st: CharSessionDetail): boolean {
  return !st.everCorrect || st.misses >= 2;
}

function Cell({
  char,
  stat,
  on,
  onToggle,
}: {
  char: string;
  stat: CharSessionDetail;
  on: boolean;
  onToggle: () => void;
}) {
  const note = noteOf(stat);
  // Unselected is "not chosen for redrill", NOT "nearly invisible". The old
  // `opacity-40` faded the WHOLE cell — border, glyph and note together — and
  // on kiri's mesh, where --text-muted is already a 50%-alpha ink, that landed
  // the kana near 1.5:1: the に and テ ghosts the user reported. The distinction
  // is carried by border and fill instead, exactly as the selected states carry
  // theirs: a neutral --border and a --panel ground read plainly as "off"
  // against the coloured, tinted "on" cells, and the glyph drops only to
  // --text-muted — the app's standard muted-text contrast (≥3:1 on --card in
  // every theme), legible rather than a smudge.
  const tone = !on
    ? "border-border bg-panel"
    : severe(stat)
      ? "border-danger/50 bg-danger-bg"
      : note
        ? "border-warning/45 bg-warning-bg"
        : // Only reachable by hand: a clean character pulled in from Solid.
          "border-accent/50 bg-accent-bg";
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={on}
      aria-label={note ? `${char}, ${note}` : char}
      className={cx(
        "relative cursor-pointer rounded-[10px] border px-1 pb-1.5 pt-2 text-center",
        tone,
      )}
    >
      {on ? (
        <span
          aria-hidden="true"
          className="absolute right-1 top-0.5 text-[8px] text-accent"
        >
          ✓
        </span>
      ) : null}
      <span
        aria-hidden="true"
        className={cx(
          "block font-kana text-[19px] font-extralight leading-tight",
          !on && "text-text-muted",
        )}
      >
        {char}
      </span>
      {note ? (
        <span aria-hidden="true" className="block text-[9px] leading-tight text-text-muted">
          {note}
        </span>
      ) : null}
    </button>
  );
}

function Board({
  label,
  chars,
  stats,
  selected,
  onToggle,
  onSetAll,
}: {
  label: string;
  chars: string[];
  stats: SessionStats;
  selected: Set<string>;
  onToggle: (char: string) => void;
  onSetAll: (chars: string[], on: boolean) => void;
}) {
  if (!chars.length) return null;
  const n = chars.filter((c) => selected.has(c)).length;
  return (
    <>
      <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-[13px] font-semibold uppercase tracking-[0.04em] text-text-muted">
          {label} · {n} selected
        </p>
        <span className="flex items-center gap-1.5 text-xs text-text-muted">
          <button
            type="button"
            className="cursor-pointer text-accent hover:underline"
            onClick={() => onSetAll(chars, true)}
          >
            All
          </button>
          ·
          <button
            type="button"
            className="cursor-pointer text-accent hover:underline"
            onClick={() => onSetAll(chars, false)}
          >
            None
          </button>
        </span>
      </div>
      <div className="mb-3.5 grid grid-cols-[repeat(auto-fill,minmax(56px,1fr))] gap-1.5">
        {chars.map((c) => (
          <Cell
            key={c}
            char={c}
            stat={stats[c]}
            on={selected.has(c)}
            onToggle={() => onToggle(c)}
          />
        ))}
      </div>
    </>
  );
}

/**
 * Boards + actions. Mount this KEYED BY METRIC: flipping the chip re-derives
 * which characters need work, and the selection it seeded is stale the moment
 * it does. A remount is the honest reset, and it keeps the default out of an
 * effect.
 */
export function TriageSection({
  facts,
  stats,
  weakest,
  onRedrill,
  onRerun,
  onDrillWeakest,
}: {
  facts: RunFacts;
  stats: SessionStats;
  /** Weakest 20 from history — the honest next step when this run left nothing
   * to fix. Empty on day one. */
  weakest: string[];
  onRedrill: (chars: string[]) => void;
  onRerun: () => void;
  onDrillWeakest: () => void;
}) {
  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(facts.needsWork),
  );

  const toggle = (char: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (!next.delete(char)) next.add(char);
      return next;
    });
  const setAll = (chars: string[], on: boolean) =>
    setSelected((prev) => {
      const next = new Set(prev);
      for (const c of chars) if (on) next.add(c);
        else next.delete(c);
      return next;
    });

  const n = selected.size;
  // A perfect run breaks the button: "Redrill 0 selected" is meaningless when
  // the run produced nothing to drill. The honest next step isn't here, it's
  // harder material — so the primary changes rather than sitting there greyed.
  const nothingToFix = !facts.needsWork.length && n === 0;

  return (
    <>
      <Board
        label="Needs work"
        chars={facts.needsWork}
        stats={stats}
        selected={selected}
        onToggle={toggle}
        onSetAll={setAll}
      />
      <Board
        label="Solid"
        chars={facts.solid}
        stats={stats}
        selected={selected}
        onToggle={toggle}
        onSetAll={setAll}
      />
      <div className="flex flex-wrap gap-2">
        {nothingToFix ? (
          <>
            <PrimaryBtn className="flex-1" onClick={onRerun}>
              Rerun full setup
            </PrimaryBtn>
            {weakest.length ? (
              <Btn className="flex-1" onClick={onDrillWeakest}>
                Drill your weakest {weakest.length}
              </Btn>
            ) : null}
          </>
        ) : (
          <>
            <PrimaryBtn
              className="flex-1"
              disabled={!n}
              onClick={() => onRedrill([...selected])}
            >
              Redrill {n} selected
            </PrimaryBtn>
            <Btn className="flex-1" onClick={onRerun}>
              Rerun full setup
            </Btn>
          </>
        )}
      </div>
    </>
  );
}
