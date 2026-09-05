// A pretend learner with a real-shaped history, for the dev pages: dozens
// of kana, kanji and words in every standing, so every colour shows on the
// bars, plus a few recorded mix-ups. Built with the app's own record shapes
// (claims, fact aggregates with recent runs, quiz sessions with confusions),
// so the adapter treats it exactly like a real history file.

import { KANA_SUBJECT } from "@/data/characters";
import { COUNTER_CURRICULUM, counterEntry } from "@/data/counters";
import { patternEntry } from "@/data/grammar";
import { KANJI_SUBJECT } from "@/data/kanji";
import { KEIGO_SETS, keigoSetEntry } from "@/data/keigo";
import { VERB_PAIRS } from "@/data/transitivity";
import { pairEntry } from "@/data/transitivity-facts";
import { VOCAB_SUBJECT } from "@/data/vocab";
import { CURRICULUM_PATTERNS } from "@/lib/grammar-lesson";
import { emptyHistory } from "@/lib/history-ops";
import { entryForGlyph, knownFactsOf, LIB_ENTRIES_BY_KIND, libEntry, type LibEntry } from "@/lib/library/entries";
import type { FactAggregate, FactId, HistoryFile, QuizSessionRecord, SessionStats } from "@/types";

const DAY = 86_400_000;

/** A fact drilled `hits` of the last ten runs, last tested `daysAgo`. */
const drilled = (hits: number, daysAgo: number, now: number, stability = 40): FactAggregate => ({
  seen: 10, missed: 10 - hits, firstTry: hits, correct: hits, stability, lastTested: now - daysAgo * DAY,
  recentRuns: Array.from({ length: 10 }, (_, i) => ({ firstTry: i < hits, eventually: i < hits })),
});

type Shape = "solid" | "getting-there" | "shaky" | "slipping" | "claimed";
const SHAPES: readonly Shape[] = ["solid", "getting-there", "shaky", "slipping", "claimed"];

/** How many of each subject the learner has met; spread evenly over the
 * shapes. Every kana, so the tracks after kana are open. */
const REACH: Record<string, number> = { [KANA_SUBJECT]: Infinity, [KANJI_SUBJECT]: 150, [VOCAB_SUBJECT]: 250 };

/** Kanji that look alike, the classic mix-ups; each pair recorded in this
 * many runs. Pairs whose kanji the data does not carry are skipped. */
const MIX_UPS: ReadonlyArray<readonly [string, string, number]> = [["日", "目", 4], ["人", "入", 3], ["大", "犬", 2], ["木", "本", 2], ["土", "士", 1]];

export function sampleHistory(now = Date.now()): HistoryFile {
  const history = emptyHistory();
  const claims: Record<string, number> = {};
  const set = (entry: LibEntry, shape: Shape) => {
    for (const f of knownFactsOf(entry)) {
      if (shape === "claimed") { claims[f] = now - 3 * DAY; continue; }
      history.facts[f] = shape === "solid" ? drilled(9, 1, now) : shape === "getting-there" ? drilled(7, 1, now) : shape === "shaky" ? drilled(3, 1, now) : drilled(10, 90, now, 5);
    }
  };
  for (const [kind, reach] of Object.entries(REACH)) {
    // spread over the whole subject (hiragana and katakana, every kanji grade), not its first page
    const all = (LIB_ENTRIES_BY_KIND.get(kind as LibEntry["kind"]) ?? []).filter((e) => knownFactsOf(e).length > 0);
    const stride = Math.max(1, Math.floor(all.length / reach));
    const entries = all.filter((_, i) => i % stride === 0).slice(0, reach);
    entries.forEach((entry, i) => set(entry, SHAPES[i % SHAPES.length]));
  }
  // a start on every other track, so the Observatory shows them open
  const started: Array<[string | undefined, number]> = [
    ...COUNTER_CURRICULUM.slice(0, 8).map((f, i) => [counterEntry(f) as string, i] as [string, number]),
    ...CURRICULUM_PATTERNS.slice(0, 5).map((r, i) => [patternEntry(r.id) as string, i] as [string, number]),
    ...VERB_PAIRS.slice(0, 3).map((p, i) => [pairEntry(p) as string, i] as [string, number]),
    ...KEIGO_SETS.slice(0, 1).map((k, i) => [keigoSetEntry(k) as string, i] as [string, number]),
  ];
  for (const [id, i] of started) {
    const entry = id ? libEntry(id as Parameters<typeof libEntry>[0]) : undefined;
    if (entry && knownFactsOf(entry).length) set(entry, SHAPES[i % SHAPES.length]);
  }

  // the mix-ups: both kanji shaky, and a session per run that confused them
  const pairs = MIX_UPS.flatMap(([a, b, runs]) => {
    const ia = entryForGlyph(KANJI_SUBJECT, a), ib = entryForGlyph(KANJI_SUBJECT, b);
    const ea = ia && libEntry(ia), eb = ib && libEntry(ib);
    if (!ea || !eb) return [];
    set(ea, "shaky"); set(eb, "shaky");
    return [{ a: ea, b: eb, runs }];
  });
  const mostRuns = Math.max(0, ...pairs.map((p) => p.runs));
  for (let run = 0; run < mostRuns; run++) {
    const detail: SessionStats = {};
    for (const p of pairs) {
      if (run >= p.runs) continue;
      const confuse = (shown: LibEntry, said: LibEntry) => {
        for (const f of knownFactsOf(shown)) detail[f] = { seen: 2, misses: 1, everCorrect: true, firstTryCorrect: false, firstTryCount: 1, correct: 1, confused: { [said.id]: 1 } };
      };
      confuse(p.a, p.b);
      confuse(p.b, p.a);
    }
    history.sessions.push(session(now - (mostRuns - run) * 2 * DAY, detail));
  }

  history.claims = claims;
  return history;
}

function session(ts: number, detail: SessionStats): QuizSessionRecord {
  const facts: QuizSessionRecord["facts"] = {};
  for (const [f, d] of Object.entries(detail) as Array<[FactId, SessionStats[FactId]]>) {
    facts[f] = { seen: d.seen, missed: d.misses, firstTry: d.firstTryCount, correct: d.correct };
  }
  const total = Object.keys(detail).length;
  return { id: `sample-${ts}`, ts, mode: "drill", redrill: false, total, forgivingPct: 100, strictPct: 50, facts, detail };
}
