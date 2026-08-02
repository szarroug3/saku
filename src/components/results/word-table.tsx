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
import { nounFor } from "@/lib/quiz-instruction";
import {
  confusedEntries,
  groupByEntry,
  outcomeOf,
  type Outcome,
} from "@/lib/results-grouping";
import {
  boxKeyOf,
  boxKeysForFact,
  boxKeysForFacts,
  factOfBoxKey,
  missedBoxKeysForFacts,
  presentationPhrasesForFact,
  type BoxKey,
} from "@/components/results/word-table-keys";
import type { FactId, SessionStats } from "@/types";

export type { BoxKey };
export {
  boxKeyOf,
  boxKeysForFact,
  boxKeysForFacts,
  factOfBoxKey,
  missedBoxKeysForFacts,
  presentationPhrasesForFact,
};

function saidTextForPhrase(st: SessionStats[FactId] | undefined, phrase: string): string | null {
  const raw = st?.saidByPhrase?.[phrase];
  if (raw == null) return null;
  const said = raw.trim();
  if (!said || said === "--") return null;
  return said;
}

function outcomeForPhrase(
  st: SessionStats[FactId] | undefined,
  phrase: string,
): Outcome {
  if (!st || st.seen === 0) return "unseen";
  const hasPhraseMissData = Array.isArray(st.missedPhrases);
  if (hasPhraseMissData) {
    const missed = new Set(st.missedPhrases ?? []);
    if (missed.has(phrase)) return st.everCorrect ? "recovered" : "missed";
    // This table is phrase-scoped; when per-phrase miss data exists and this
    // phrase was not missed, it was clean for this phrase.
    return "first-try";
  }
  if (st.firstTryCorrect === true) return "first-try";
  // Legacy/inferred sessions may lack phrase-level evidence.
  return outcomeOf(st);
}

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

function HowYouDid({
  outcome,
  hideFirstTry,
}: {
  outcome: Outcome;
  hideFirstTry?: boolean;
}) {
  if (hideFirstTry && outcome === "first-try") return null;
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
  phrase,
  stats,
  selected,
  onToggle,
  hideFirstTry,
  solidTone,
}: {
  fact: FactId;
  phrase: string;
  stats: SessionStats;
  selected: boolean;
  onToggle: () => void;
  hideFirstTry?: boolean;
  solidTone?: boolean;
}) {
  const st = stats[fact];
  const outcome = outcomeForPhrase(st, phrase);
  const canShowSaid = outcome === "recovered" || outcome === "missed";
  const said = canShowSaid ? saidTextForPhrase(st, phrase) : null;
  // What you said instead, when a miss named a single entry to blame. Glyphs
  // only — this cell is about to be re-asked, so it must not print the answer,
  // and the entry you confused it FOR is not this fact's answer.
  const confused = canShowSaid ? confusedEntries(st).map(glyphOf) : [];
  const saidParts = said ? [said] : [];
  for (const glyph of confused) {
    if (!saidParts.includes(glyph)) saidParts.push(glyph);
  }
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={selected}
      aria-label={`${phrase}, ${OUTCOME[outcome].label}${
        saidParts.length ? `, answered ${saidParts.join(" ")} instead` : ""
      }`}
      className={cx(
        "relative flex min-w-0 flex-col gap-1 rounded-[10px] border px-2 py-1.5 text-left",
        "cursor-pointer transition-colors",
        selected
          ? "border-accent bg-accent-bg"
          : solidTone
            ? "border-success/45 bg-success-bg hover:bg-success-bg"
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
        <HowYouDid outcome={outcome} hideFirstTry={hideFirstTry} />
        {saidParts.length ? (
          <span className="inline-flex items-center gap-1 text-[9px] text-danger">
            <span aria-hidden="true" className="leading-none">
              →
            </span>
            <span className="whitespace-nowrap">
              said <span aria-hidden="true" className="font-kana">{saidParts.join(" ")}</span>
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
  showOnly,
  hideFirstTry,
  solidTone,
}: {
  facts: FactId[];
  stats: SessionStats;
  isSelected: (box: BoxKey) => boolean;
  onToggle: (box: BoxKey) => void;
  /** Optional box filter: render only these boxes, hide rows with none. */
  showOnly?: ReadonlySet<BoxKey>;
  /** Optional: hide first-try status marker (dot + label). */
  hideFirstTry?: boolean;
  /** Optional: tint unselected cells as solid/safe. */
  solidTone?: boolean;
}) {
  const rows = groupByEntry(facts);
  if (!rows.length) return null;
  return (
    <div className="flex flex-col gap-2">
      {rows.map((row) => {
        const cells = row.facts.flatMap((f) =>
          presentationPhrasesForFact(f, stats)
            .map((phrase) => ({ fact: f, phrase, box: boxKeyOf(f, phrase) }))
            .filter((x) => !showOnly || showOnly.has(x.box)),
        );
        if (!cells.length) return null;
        return (
          <div
            key={row.entry}
            className="border-b border-border/70 pb-2 mb-2 last:border-b-0 last:pb-0 last:mb-0"
          >
            <div
              // A FIXED first track, not minmax(_,auto): under `auto` a longer glyph
              // (あなた) grew its own row's word column and pushed that row's boxes
              // right, so the boxes no longer lined up down the table. A fixed width
              // starts every row's boxes at the same x. `1fr` for the second track
              // keeps the whole thing inside its container — no horizontal overflow.
              className="grid grid-cols-[72px_1fr] items-center gap-x-2.5 gap-y-1"
            >
              {/* The word, once, disambiguated by its noun so 人 the kanji and 人
                  the word read as two rows, not one repeated glyph. */}
              <div className="flex min-w-0 flex-col items-center justify-center py-1">
                {/* `max-w-full` + `break-all` so a rare word wider than the fixed
                    column wraps inside it instead of spilling over the boxes. */}
                <span aria-hidden="true" className="max-w-full break-all text-center font-kana text-[22px] font-extralight leading-none">
                  {glyphOf(row.entry)}
                </span>
                <span className="mt-0.5 text-[8.5px] uppercase tracking-[0.06em] text-text-muted">
                  {nounFor(row.facts[0])}
                </span>
              </div>
              <div className="grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-1.5">
                {cells.map((x, i) => (
                  <PresentationCell
                    key={`${x.fact}-${x.phrase}-${i}`}
                    fact={x.fact}
                    phrase={x.phrase}
                    stats={stats}
                    selected={isSelected(x.box)}
                    onToggle={() => onToggle(x.box)}
                    hideFirstTry={hideFirstTry}
                    solidTone={solidTone}
                  />
                ))}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
