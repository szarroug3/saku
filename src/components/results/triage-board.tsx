"use client";

// The triage boards and the actions under them — the half of the screen you
// touch. Everything lit is what Redrill will run, which is why the boards and
// the button can't be separated: the count in the button is the board.
//
// Needs work starts ON, Solid starts OFF, and every cell is a toggle either
// way — the split is the app's opinion, not a rule.

import { useState } from "react";

import { Btn, PrimaryBtn } from "@/components/ui";
import { WordTable } from "@/components/results/word-table";
import { type RunFacts } from "@/components/results/summary";
import type { FactId, SessionStats } from "@/types";

function Board({
  label,
  facts,
  stats,
  selected,
  onToggle,
  onSetAll,
}: {
  label: string;
  facts: FactId[];
  stats: SessionStats;
  selected: Set<FactId>;
  onToggle: (fact: FactId) => void;
  onSetAll: (facts: FactId[], on: boolean) => void;
}) {
  if (!facts.length) return null;
  const n = facts.filter((f) => selected.has(f)).length;
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
            onClick={() => onSetAll(facts, true)}
          >
            All
          </button>
          ·
          <button
            type="button"
            className="cursor-pointer text-accent hover:underline"
            onClick={() => onSetAll(facts, false)}
          >
            None
          </button>
        </span>
      </div>
      {/* One row per word, its facts as cells — the same table the retry fork
          shows. Each cell says how it was asked, how it went, and what you said
          instead. Selecting a cell adds that fact to the redrill. */}
      <div className="mb-3.5">
        <WordTable
          facts={facts}
          stats={stats}
          isSelected={(f) => selected.has(f)}
          onToggle={onToggle}
        />
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
  weakest: FactId[];
  onRedrill: (facts: FactId[]) => void;
  onRerun: () => void;
  onDrillWeakest: () => void;
}) {
  const [selected, setSelected] = useState<Set<FactId>>(
    () => new Set(facts.needsWork),
  );

  const toggle = (fact: FactId) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (!next.delete(fact)) next.add(fact);
      return next;
    });
  const setAll = (list: FactId[], on: boolean) =>
    setSelected((prev) => {
      const next = new Set(prev);
      for (const f of list) if (on) next.add(f);
        else next.delete(f);
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
        facts={facts.needsWork}
        stats={stats}
        selected={selected}
        onToggle={toggle}
        onSetAll={setAll}
      />
      <Board
        label="Solid"
        facts={facts.solid}
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
