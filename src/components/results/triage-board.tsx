"use client";

// The triage boards and the actions under them — the half of the screen you
// touch. Everything lit is what Redrill will run, which is why the boards and
// the button can't be separated: the count in the button is the board.
//
// Needs work starts ON, Solid starts OFF, and every cell is a toggle either
// way — the split is the app's opinion, not a rule.

import { useState } from "react";

import { Btn, PrimaryBtn } from "@/components/ui";
import {
  boxKeysForFacts,
  factOfBoxKey,
  missedBoxKeysForFacts,
  type BoxKey,
  WordTable,
} from "@/components/results/word-table";
import { type RunFacts } from "@/components/results/summary";
import { factInfo, readingOfEntry } from "@/lib/facts";
import { useHistory } from "@/lib/use-history";
import { wordKnown } from "@/lib/word-unlock";
import { grammarMeaning, grammarProduction } from "@/data/grammar";
import { patternLabel } from "@/data/grammar/recipes";
import type { EntryId, FactId, HistoryFile, SessionStats } from "@/types";

const GODAN_ENDING: Record<string, string> = {
  v5u: "う",
  v5t: "つ",
  v5r: "る",
  v5m: "む",
  v5b: "ぶ",
  v5n: "ぬ",
  v5k: "く",
  v5g: "ぐ",
  v5s: "す",
};

function grammarClassLabel(cls: string): string {
  if (cls in GODAN_ENDING) return `godan · ${GODAN_ENDING[cls]}`;
  if (cls === "v1") return "ichidan";
  if (cls === "adj-i") return "i-adj";
  if (cls === "adj-na") return "na-adj";
  return cls;
}

function irregularVerbLabel(surface: string, history: HistoryFile): string {
  const kanaBySurface: Record<string, string> = {
    行く: "いく",
    来る: "くる",
    する: "する",
    いい: "いい",
  };
  const kana = kanaBySurface[surface] ?? surface;
  return wordKnown(surface, history) ? surface : kana;
}

function grammarHostLabel(host: string): string {
  if (host === "adj-i") return "i-adj";
  if (host === "adj-na") return "na-adj";
  return host;
}

function grammarDisplayLabel(fact: FactId, history: HistoryFile): string | null {
  const production = grammarProduction(fact);
  if (production) {
    const base = patternLabel(production.recipe).replace(/^〜/, "~");
    const b = production.bucket;
    if (b?.kind === "class") {
      const cls = b.cls;
      return `${base} · ${grammarClassLabel(cls)}`;
    }
    if (b?.kind === "verb") return `${base} · irregular · ${irregularVerbLabel(b.surface, history)}`;
    return `${base} · ${grammarHostLabel(production.host)}`;
  }
  const meaning = grammarMeaning(fact);
  return meaning ? patternLabel(meaning.recipe).replace(/^〜/, "~") : null;
}

function Board({
  label,
  facts,
  stats,
  visibleBoxes,
  solidTone,
  selected,
  onToggle,
  onSetVisible,
  displayEntry,
}: {
  label: string;
  facts: FactId[];
  stats: SessionStats;
  visibleBoxes: Set<BoxKey>;
  solidTone?: boolean;
  selected: Set<BoxKey>;
  onToggle: (box: BoxKey) => void;
  onSetVisible: (boxes: Set<BoxKey>, on: boolean) => void;
  displayEntry?: (entry: EntryId, fact: FactId) => string;
}) {
  if (!facts.length) return null;
  const n = [...visibleBoxes].filter((b) => selected.has(b)).length;
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
            onClick={() => onSetVisible(visibleBoxes, true)}
          >
            All
          </button>
          ·
          <button
            type="button"
            className="cursor-pointer text-accent hover:underline"
            onClick={() => onSetVisible(visibleBoxes, false)}
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
          showOnly={visibleBoxes}
          solidTone={solidTone}
          displayEntry={displayEntry}
          isSelected={(box) => selected.has(box)}
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
  extraSelectedFacts,
}: {
  facts: RunFacts;
  stats: SessionStats;
  /** Weakest 20 from history — the honest next step when this run left nothing
   * to fix. Empty on day one. */
  weakest: FactId[];
  onRedrill: (facts: FactId[]) => void;
  onRerun: () => void;
  onDrillWeakest: () => void;
  extraSelectedFacts?: ReadonlySet<FactId>;
}) {
  const { history } = useHistory();

  const displayEntry = (entry: EntryId, fact: FactId): string => {
    const info = factInfo(fact);
    if (info?.subject === "grammar") {
      return grammarDisplayLabel(fact, history) ?? info.glyph;
    }
    if (info?.subject === "word" && !wordKnown(info.glyph, history)) {
      return readingOfEntry(entry);
    }
    return info?.glyph ?? entry;
  };

  const allBoxes = new Set(boxKeysForFacts(facts.facts, stats));
  const needsWorkBoxes = new Set(missedBoxKeysForFacts(facts.facts, stats));
  const solidBoxes = new Set([...allBoxes].filter((b) => !needsWorkBoxes.has(b)));

  const [selected, setSelected] = useState<Set<BoxKey>>(
    () => new Set(needsWorkBoxes),
  );

  const toggle = (box: BoxKey) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (!next.delete(box)) next.add(box);
      return next;
    });
  const setVisible = (boxes: Set<BoxKey>, on: boolean) =>
    setSelected((prev) => {
      const next = new Set(prev);
      for (const b of boxes)
        if (on) next.add(b);
        else next.delete(b);
      return next;
    });

  const selectedFacts = [...selected]
    .map((box) => factOfBoxKey(box))
    .filter((f): f is FactId => !!f);
  const pickedFacts = [...new Set(selectedFacts)];
  const progressFacts = [...(extraSelectedFacts ?? new Set<FactId>())];
  const mergedFacts = [...new Set([...pickedFacts, ...progressFacts])];
  const extraCount = progressFacts.filter((fact) => !pickedFacts.includes(fact)).length;

  const n = selected.size + extraCount;
  // A perfect run breaks the button: "Redrill 0 selected" is meaningless when
  // the run produced nothing to drill. The honest next step isn't here, it's
  // harder material — so the primary changes rather than sitting there greyed.
  const nothingToFix = !facts.needsWork.length && n === 0;

  return (
    <>
      {needsWorkBoxes.size > 0 ? (
        <Board
          label="Needs work"
          facts={facts.facts}
          stats={stats}
          visibleBoxes={needsWorkBoxes}
          solidTone={false}
          selected={selected}
          onToggle={toggle}
          onSetVisible={setVisible}
          displayEntry={displayEntry}
        />
      ) : null}
      <Board
        label="Solid"
        facts={facts.facts}
        stats={stats}
        visibleBoxes={solidBoxes}
        solidTone
        selected={selected}
        onToggle={toggle}
        onSetVisible={setVisible}
        displayEntry={displayEntry}
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
              onClick={() => onRedrill(mergedFacts)}
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
