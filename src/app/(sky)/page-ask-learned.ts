// What the learner has learned, for questions about a page (#BuildHybridAI):
// every entry with a fact they have met (answered in a quiz, said they know,
// or opened in a lesson: `isFactMet`, the Sky's own reading of met), newest
// first. Gemini is told to write no Japanese past these and the card, and
// src/sky/lib/page-ask.ts checks the answer against them.
//
// Server only: the library is far too big to ship to the browser.

import { entryOf, factInfo } from "@/lib/facts";
import { isFactMet } from "@/lib/history-ops";
import { libEntry } from "@/lib/library/entries";
import type { Learned } from "@/sky/lib/page-ask";
import type { EntryId, FactId } from "@/types/facts";
import type { HistoryFile } from "@/types/store";

/** When a fact was met, for putting the newest first. */
function metAt(hist: HistoryFile, f: FactId): number {
  return hist.learnedAt?.[f] ?? hist.claims?.[f] ?? hist.seen?.[f] ?? 0;
}

export function learnedFrom(hist: HistoryFile): Learned {
  const facts = new Set<FactId>([
    ...(Object.keys(hist.facts ?? {}) as FactId[]),
    ...(Object.keys(hist.claims ?? {}) as FactId[]),
    ...(Object.keys(hist.seen ?? {}) as FactId[]),
  ]);
  const newest = new Map<EntryId, number>();
  // a kanji's readings the learner has met, each in a word: 人 read じん in
  // 個人 is the fact kanji:人/reading@個人, whose answer is じん
  const readings = new Map<EntryId, Set<string>>();
  for (const f of facts) {
    if (!isFactMet(hist, f)) continue;
    const e = entryOf(f);
    newest.set(e, Math.max(newest.get(e) ?? 0, metAt(hist, f)));
    const reading = f.includes("/reading@") ? factInfo(f)?.answers[0] : undefined;
    if (reading) readings.set(e, (readings.get(e) ?? new Set()).add(reading));
  }
  const kana: string[] = [];
  const kanji: string[] = [];
  const words: string[] = [];
  const grammar: string[] = [];
  for (const [id] of [...newest].sort((a, b) => b[1] - a[1])) {
    const e = libEntry(id);
    if (!e?.glyph) continue;
    const meaning = e.meanings.slice(0, 2).join(", ");
    if (e.kind === "kana") kana.push(e.glyph);
    // a component is drawn like a kanji and is written the same way
    else if (e.kind === "kanji" || e.kind === "radical") {
      const read = [...(readings.get(id) ?? [])];
      kanji.push(`${e.glyph}${read.length ? ` (${read.join(", ")})` : ""}`);
    }
    else if (e.kind === "word") words.push(`${e.glyph}${e.readings[0] && e.readings[0] !== e.glyph ? ` (${e.readings[0]})` : ""}${meaning ? `: ${meaning}` : ""}`);
    else if (e.kind === "grammar") grammar.push(`${e.glyph}${meaning ? `: ${meaning}` : ""}`);
  }
  return { kana: kana.join(""), kanji, words, grammar };
}
