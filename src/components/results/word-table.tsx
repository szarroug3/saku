"use client";

// The post-quiz table both result screens share — the round-complete fork and
// the end-of-run triage board. One ROW per word, its facts as selectable cells,
// each cell saying how the showing was asked, how it went, and — for a miss —
// what you answered instead.
//
// It is presentation only: it owns no selection state and scores nothing. The
// screen passes what to show, which cells are lit, and what a tap does. That is
// what keeps the two screens honestly identical — they render the same table
// from the same data and differ only in what "selected" means (retry vs
// redrill).

import { glyphOf } from "@/lib/facts";
import { presentationPhrase } from "@/lib/question-presentation";
import { nounFor } from "@/lib/quiz-instruction";
import {
  confusedEntries,
  groupByEntry,
  outcomeOf,
  type Outcome,
} from "@/lib/results-grouping";
import type { FactId, SessionStats } from "@/types";

function cx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}

/** How-you-did, as a word and a colour. The same four states the cell reads
 * from — see outcomeOf. */
const OUTCOME: Record<Outcome, { label: string; text: string; dot: string }> = {
  "first-try": { label: "first try", text: "text-success", dot: "bg-success" },
  recovered: { label: "another look", text: "text-warning", dot: "bg-warning" },
  missed: { label: "missed", text: "text-danger", dot: "bg-danger" },
  unseen: { label: "not shown", text: "text-text-muted", dot: "bg-text-muted" },
};

function HowYouDid({ outcome }: { outcome: Outcome }) {
  const o = OUTCOME[outcome];
  return (
    <span className={cx("flex items-center gap-1 text-[9px] font-medium", o.text)}>
      <span className={cx("inline-block h-1.5 w-1.5 rounded-full", o.dot)} />
      {o.label}
    </span>
  );
}

function PresentationCell({
  fact,
  stats,
  selected,
  onToggle,
}: {
  fact: FactId;
  stats: SessionStats;
  selected: boolean;
  onToggle: () => void;
}) {
  const st = stats[fact];
  const outcome = outcomeOf(st);
  const phrase = presentationPhrase(fact, st?.shown);
  // What you said instead, when a miss named a single entry to blame. Glyphs
  // only — this cell is about to be re-asked, so it must not print the answer,
  // and the entry you confused it FOR is not this fact's answer.
  const confused = confusedEntries(st).map(glyphOf);
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={selected}
      aria-label={`${phrase}, ${OUTCOME[outcome].label}${
        confused.length ? `, answered ${confused.join(" ")} instead` : ""
      }`}
      className={cx(
        "relative flex min-w-0 flex-col gap-1 rounded-[10px] border px-2 py-1.5 text-left",
        "cursor-pointer transition-colors",
        selected
          ? "border-accent bg-accent-bg"
          : "border-border bg-panel hover:bg-card",
      )}
    >
      {selected ? (
        <span
          aria-hidden="true"
          className="absolute right-1 top-0.5 text-[9px] text-accent"
        >
          ✓
        </span>
      ) : null}
      <span className="text-[10px] uppercase leading-tight tracking-[0.04em] text-text">
        {phrase}
      </span>
      <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
        <HowYouDid outcome={outcome} />
        {confused.length ? (
          <span className="text-[9px] text-danger">
            → said{" "}
            <span aria-hidden="true" className="font-kana">
              {confused.join(" ")}
            </span>
          </span>
        ) : null}
      </span>
    </button>
  );
}

/**
 * The word table. `facts` are grouped into a row per entry; every cell is
 * selectable, and `isSelected` / `onToggle` are the screen's — retry on the
 * fork, redrill on the results board.
 */
export function WordTable({
  facts,
  stats,
  isSelected,
  onToggle,
}: {
  facts: FactId[];
  stats: SessionStats;
  isSelected: (fact: FactId) => boolean;
  onToggle: (fact: FactId) => void;
}) {
  const rows = groupByEntry(facts);
  if (!rows.length) return null;
  return (
    <div className="flex flex-col gap-2">
      {rows.map((row) => (
        <div
          key={row.entry}
          className="grid grid-cols-[minmax(48px,auto)_1fr] items-center gap-x-2.5 gap-y-1"
        >
          {/* The word, once, disambiguated by its noun so 人 the kanji and 人
              the word read as two rows, not one repeated glyph. */}
          <div className="flex flex-col items-center justify-center py-1">
            <span aria-hidden="true" className="font-kana text-[22px] font-extralight leading-none">
              {glyphOf(row.entry)}
            </span>
            <span className="mt-0.5 text-[8.5px] uppercase tracking-[0.06em] text-text-muted">
              {nounFor(row.facts[0])}
            </span>
          </div>
          <div className="grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-1.5">
            {row.facts.map((f) => (
              <PresentationCell
                key={f}
                fact={f}
                stats={stats}
                selected={isSelected(f)}
                onToggle={() => onToggle(f)}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
