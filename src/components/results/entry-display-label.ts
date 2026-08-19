// The shared row-heading rule for the post-quiz WordTable — pure, so both
// screens that group facts into rows (the retry fork's round-complete.tsx and
// the end-of-run triage-board.tsx) read one label off one fact, not two
// almost-identical copies that can drift.
//
// WHY A FACT CAN'T JUST INHERIT ITS ENTRY'S GLYPH
// ================================================
// `groupByEntry` (results-grouping.ts) rows facts up by ENTRY, and for most
// subjects every fact of an entry shares one glyph — 生's meaning fact and
// reading fact are both "生". Falling back to `glyphOf(entry)` (facts.ts,
// which reads BY_ENTRY.get(entry)[0].glyph — the FIRST-MINTED fact's glyph)
// is therefore safe there.
//
// It is NOT safe for a transitivity pair. `src/data/transitivity-facts.ts`
// mints both sides of a pair — 出る (happens) and 出す (doIt) — onto the SAME
// entry (`pairEntry`), because a pair is one thing being taught two ways. Each
// side's OWN FactInfo carries its own verb as `glyph` (that is the whole point
// — a row's cell has to say which verb was asked), but `glyphOf(entry)` only
// ever reads the first-inserted side, so every row defaulted to 出る even when
// the fact on screen was 出す's. See SAK-20.
//
// The fix: label a row by the FACT actually being shown, via `factInfo(fact)
// ?.glyph`, and only fall back to the entry's glyph for an id history kept but
// the data no longer has (factInfo returns undefined). Two subjects get an
// extra look past the raw glyph — grammar (a production reads better as
// "~て · godan · う" than a bare kana) and word (an un-learned word shows its
// reading, not spoilers in kanji) — but the transitivity fix is the same
// `info.glyph` read every other subject already got for free.

import { factInfo, readingOfEntry } from "@/lib/facts";
import { wordKnown } from "@/lib/word-unlock";
import { grammarMeaning, grammarProduction } from "@/data/grammar";
import { patternLabel } from "@/data/grammar/recipes";
import type { EntryId, FactId, HistoryFile } from "@/types";

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

/**
 * The row heading for one FACT, not one entry. Pass to `WordTable`'s
 * `displayEntry` so a row splits by the form actually asked whenever an
 * entry's facts don't all share a glyph (transitivity pairs) — and stays one
 * row when they do (a kanji's facets), because `groupRowsByDisplayLabel`
 * coalesces facts that resolve to the same label back together.
 */
export function entryDisplayLabel(
  entry: EntryId,
  fact: FactId,
  history: HistoryFile,
): string {
  const info = factInfo(fact);
  if (info?.subject === "grammar") {
    return grammarDisplayLabel(fact, history) ?? info.glyph;
  }
  if (info?.subject === "word" && !wordKnown(info.glyph, history)) {
    return readingOfEntry(entry);
  }
  // Every other subject, transitivity included: the fact's OWN glyph, never
  // the entry's — see the file header for why those two differ for a pair.
  return info?.glyph ?? entry;
}
