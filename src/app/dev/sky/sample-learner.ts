// A pretend learner with a real-shaped history, for the dev pages: some
// kana, a dozen words with their kanji, in every standing. Built with the
// app's own record shapes (claims, fact aggregates with recent runs), so the
// adapter treats it exactly like a real history file.

import { KANA_SUBJECT } from "@/data/characters";
import { KANJI_SUBJECT } from "@/data/kanji";
import { VOCAB_SUBJECT } from "@/data/vocab";
import { emptyHistory } from "@/lib/history-ops";
import { entryForGlyph, knownFactsOf, libEntry } from "@/lib/library/entries";
import type { FactAggregate, HistoryFile } from "@/types";

const DAY = 86_400_000;

/** A fact drilled `hits` of the last ten runs, last tested `daysAgo`. */
const drilled = (hits: number, daysAgo: number, now: number, stability = 40): FactAggregate => ({
  seen: 10, missed: 10 - hits, firstTry: hits, correct: hits, stability, lastTested: now - daysAgo * DAY,
  recentRuns: Array.from({ length: 10 }, (_, i) => ({ firstTry: i < hits, eventually: i < hits })),
});

type Shape = "solid" | "getting-there" | "shaky" | "slipping" | "claimed";

const factsOfGlyph = (kind: typeof KANA_SUBJECT | typeof KANJI_SUBJECT | typeof VOCAB_SUBJECT, glyph: string) => {
  const id = entryForGlyph(kind, glyph);
  const entry = id ? libEntry(id) : undefined;
  return entry ? knownFactsOf(entry) : [];
};

export function sampleHistory(now = Date.now()): HistoryFile {
  const history = emptyHistory();
  const claims: Record<string, number> = {};
  const set = (kind: typeof KANA_SUBJECT | typeof KANJI_SUBJECT | typeof VOCAB_SUBJECT, glyph: string, shape: Shape) => {
    for (const f of factsOfGlyph(kind, glyph)) {
      if (shape === "claimed") { claims[f] = now - 3 * DAY; continue; }
      history.facts[f] = shape === "solid" ? drilled(9, 1, now) : shape === "getting-there" ? drilled(7, 1, now) : shape === "shaky" ? drilled(3, 1, now) : drilled(10, 90, now, 5);
    }
  };
  for (const k of ["あ", "い", "う", "え", "お", "か", "き"]) set(KANA_SUBJECT, k, "solid");
  set(KANA_SUBJECT, "く", "getting-there");
  set(KANA_SUBJECT, "け", "shaky");
  for (const [k, s] of [["日", "solid"], ["本", "solid"], ["大", "solid"], ["学", "getting-there"], ["火", "solid"], ["山", "claimed"], ["水", "solid"], ["田", "shaky"], ["時", "solid"], ["間", "slipping"], ["電", "solid"], ["車", "solid"], ["木", "solid"], ["休", "claimed"], ["生", "solid"], ["人", "solid"]] as const) set(KANJI_SUBJECT, k, s);
  for (const [w, s] of [["日本", "solid"], ["大学", "getting-there"], ["火山", "solid"], ["水田", "slipping"], ["時間", "shaky"], ["電車", "solid"], ["休む", "claimed"], ["学生", "solid"], ["人", "solid"], ["山", "solid"]] as const) set(VOCAB_SUBJECT, w, s);
  history.claims = claims;
  return history;
}
