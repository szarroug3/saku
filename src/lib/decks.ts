// The deck model — WHAT a quiz draws from, as pure data.
//
// Home's shelves are all decks. The "Decks" shelf holds STATIC ones, derived
// from the character data; the "Target a weakness" shelf holds the same shape
// computed from history instead. The setup panel owns HOW you drill (mode,
// direction, answer style, length); a deck only ever answers WHICH characters.
//
// A deck answers WHICH, and NOTHING ELSE. There used to be a "Full coverage"
// deck that also reached over and set your length to one-pass-each — a card
// silently editing the setup panel, which is exactly what made Home confusing.
// It is now "Everything" (just the 214 characters); one-pass-each lives on as
// the Full coverage LENGTH chip, where a length belongs. If you are tempted to
// give a deck a side-effect again: don't. Decks are a set of characters.
//
// A deck is a set of FACTS — the things you can be asked — not of characters.
// For kana the two are 1:1 and the distinction looks like pedantry; for 生 it
// is the difference between drilling a reading and drilling a glyph that has
// eleven of them.
//
// HOW TO EXTEND
// =============
// Adding another kana-shaped set is a data addition, not a change here: append
// a CharSet to SETS in src/data/characters.ts and it grows a basic/extended
// deck pair automatically (`isExtendedSection` decides the split). Give it a
// face by adding a GLYPHS entry keyed "<setId>-basic" / "<setId>-extended" —
// without one it falls back to the set's first glyph, which still renders fine.
//
// The basic/extended split is PURE KANA — `isExtendedSection` regex-matches
// section labels for Dakuten/Handakuten/Combo. It is left working for kana and
// deliberately not generalised: what "extended" means for kanji or vocabulary
// is unknown, and inventing an answer now would just have to be undone.
//
// Pure by contract: no React, no DOM, no fetch. Home renders these; it does
// not define them.

import {
  isExtendedSection,
  kanaEntry,
  kanaFact,
  LOOKALIKES,
  SETS,
} from "@/data/characters";
import { accuracyOf, summaryOfEntry } from "@/lib/accuracy";
import { ALL_FACTS, entryOf, factsOf, glyphOf } from "@/lib/facts";
import type {
  AccuracyMetric,
  CharSet,
  EntryId,
  FactId,
  HistoryFile,
  QuizSessionRecord,
} from "@/types";

/** A named set of facts a quiz can draw from. */
export interface Deck {
  /** Stable id — React key, and what a click target reports. */
  id: string;
  label: string;
  /** The card's face: one representative glyph. */
  glyph: string;
  facts: FactId[];
}

// ALL_CHARS, deckChars and deckSelectable are GONE, and they said so
// themselves: "correct only while every entry is a single kana whose glyph IS
// its selection key… both land with kanji, and this function should die in the
// same change". The kanji landed and this is that change. Nothing translates a
// deck into characters any more, because nothing selects characters.

/** Card faces, keyed "<setId>-basic" / "<setId>-extended". A set with no entry
 * falls back to its own first character (see buildDecks). */
const GLYPHS: Record<string, string> = {
  "hiragana-basic": "あ",
  "hiragana-extended": "ぎゃ",
  "katakana-basic": "ア",
  "katakana-extended": "ギャ",
};

/** The id of the deck that is simply every character there is. */
export const EVERYTHING_ID = "everything";

function groupFacts(set: CharSet, extended: boolean): FactId[] {
  return set.sections
    .filter((s) => isExtendedSection(s.label) === extended)
    .flatMap((s) => s.chars.map((c) => kanaFact(c.c)));
}

function buildDecks(): Deck[] {
  const decks: Deck[] = [];
  for (const set of SETS) {
    for (const extended of [false, true]) {
      const facts = groupFacts(set, extended);
      if (!facts.length) continue;
      const id = `${set.id}-${extended ? "extended" : "basic"}`;
      decks.push({
        id,
        label: `${set.label} ${extended ? "extended" : "basic"}`,
        glyph: GLYPHS[id] ?? glyphOf(entryOf(facts[0])),
        facts,
      });
    }
  }
  decks.push({
    id: EVERYTHING_ID,
    label: "Everything",
    glyph: "全",
    facts: ALL_FACTS,
  });
  return decks;
}

/** The static decks, in shelf order. */
export const DECKS: Deck[] = buildDecks();

// ---------- history-derived decks ----------

/**
 * The `n` FACTS you are worst at under `metric`, weakest first.
 *
 * Facts, not entries, because this is a drill list and a fact is what can be
 * drilled: "you are worst at 生" is not actionable when 生 has eleven readings
 * and you only fumble two of them. The entry-level summary exists for reading
 * (accuracy.summaryOfEntry) and is deliberately not what ranks this.
 *
 * Only facts with history count — an untouched fact is unknown, not weak. Ties
 * break by `seen` descending, so a 0%-from-one-showing never outranks a
 * 0%-from-twenty: the latter is the better-evidenced weakness.
 *
 * The ordering is accuracy today and becomes a proper scheduling rank next —
 * a pure function of (stability, lastTested, now) dropped in place of the sort
 * below. Nothing outside this function knows how the list is ordered.
 */
export function weakestFacts(
  history: HistoryFile,
  metric: AccuracyMetric,
  n = 20,
): FactId[] {
  const scored: Array<{ f: FactId; acc: number; seen: number }> = [];
  for (const [key, agg] of Object.entries(history.facts)) {
    const f = key as FactId;
    // Guard against history for facts the data no longer has.
    if (!agg.seen || !factsOf(entryOf(f)).length) continue;
    const acc = accuracyOf(agg, metric);
    if (acc === null) continue;
    scored.push({ f, acc, seen: agg.seen });
  }
  scored.sort((a, b) => a.acc - b.acc || b.seen - a.seen);
  return scored.slice(0, n).map((s) => s.f);
}

/**
 * The `n` ENTRIES you are worst at, weakest first — a READING order, for the
 * Statistics table.
 *
 * Ranked by each entry's summary accuracy, which is an average over its facts
 * and so is not comparable with the ratios `weakestFacts` sorts on. The two
 * lists answer different questions and are allowed to disagree.
 */
export function weakestEntries(
  history: HistoryFile,
  metric: AccuracyMetric,
  n = 20,
): EntryId[] {
  const scored: Array<{ e: EntryId; acc: number; seen: number }> = [];
  for (const e of new Set(factKeysOf(history).map(entryOf))) {
    const summary = summaryOfEntry(history, e, metric);
    if (!summary) continue;
    scored.push({ e, acc: summary.meanPct, seen: summary.seen });
  }
  scored.sort((a, b) => a.acc - b.acc || b.seen - a.seen);
  return scored.slice(0, n).map((s) => s.e);
}

function factKeysOf(history: HistoryFile): FactId[] {
  return Object.keys(history.facts) as FactId[];
}

/** Two ENTRIES you mix up, and how often. `count` is 0 for lookalikes.
 * Entries, not facts: you mix up 生 with 先, not one reading with another. */
export interface ConfusionPair {
  a: EntryId;
  b: EntryId;
  /** Times the two were swapped across all sessions; 0 when unmeasured. */
  count: number;
}

export interface Confusions {
  /** Most-confused first. */
  pairs: ConfusionPair[];
  /** The facts to drill — every fact of every entry across `pairs`. */
  facts: FactId[];
  /** True when these are MEASURED mix-ups; false when they're the day-one
   * LOOKALIKES fallback, which must be labelled "common lookalikes" rather
   * than claiming a count the user never produced. */
  fromHistory: boolean;
}

/**
 * The mix-up pairs across every stored session.
 *
 * Mirrors confusions.indexPairs() (which reads a single SessionStats) over all
 * of history: each session's `detail[fact].confused[entry]` counts one
 * direction, so summing on a sorted key folds "a said for b" and "b said for a"
 * into one symmetric pair.
 *
 * With no measured confusions — day one, or history from a version that never
 * stored `detail` — falls back to the LOOKALIKES groups, so there is still
 * something useful to drill. Check `fromHistory` before claiming a count.
 */
export function confusionDecks(history: HistoryFile): Confusions {
  const counts = new Map<string, number>();
  for (const session of history.sessions) {
    for (const [fact, d] of Object.entries(session.detail ?? {})) {
      // `detail` is keyed by FACT and `confused` by ENTRY — the shown side has
      // to be lifted into entry space before the two can be paired. Same
      // conversion confusions.indexPairs() makes, for the same reason.
      const shown = entryOf(fact as FactId);
      for (const [x, n] of Object.entries(d.confused ?? {})) {
        if (shown === x || !n) continue;
        const key = [shown, x].sort().join("·");
        counts.set(key, (counts.get(key) ?? 0) + n);
      }
    }
  }

  if (counts.size) {
    const pairs = [...counts.entries()]
      .map(([key, count]) => {
        const [a, b] = key.split("·") as [EntryId, EntryId];
        return { a, b, count };
      })
      .sort((p, q) => q.count - p.count);
    return { pairs, facts: factsFor(pairs), fromHistory: true };
  }

  // No `enabled` filter any more: this used to restrict the day-one fallback
  // to the characters you had selected, which only made sense while selection
  // WAS a set of characters you could intersect with. A query cannot be
  // intersected with a lookalike group without resolving it, and a caller that
  // wants "the pairs in my selection" can filter the result — that is the
  // caller's question, not this function's.
  const pairs: ConfusionPair[] = [];
  for (const group of LOOKALIKES) {
    for (let i = 0; i < group.length; i++) {
      for (let j = i + 1; j < group.length; j++) {
        pairs.push({ a: kanaEntry(group[i]), b: kanaEntry(group[j]), count: 0 });
      }
    }
  }
  return { pairs, facts: factsFor(pairs), fromHistory: false };
}

/** Every fact of every entry named in `pairs` — the deck a confusion implies.
 * You mix up the ENTRIES, so what you drill is everything they can be asked. */
function factsFor(pairs: ConfusionPair[]): FactId[] {
  return [...new Set(pairs.flatMap((p) => [...factsOf(p.a), ...factsOf(p.b)]))];
}

/** The most recent session, or null when there is no history. */
export function lastSession(history: HistoryFile): QuizSessionRecord | null {
  let latest: QuizSessionRecord | null = null;
  for (const s of history.sessions) if (!latest || s.ts > latest.ts) latest = s;
  return latest;
}

/**
 * Facts missed in the most recent session, most misses first.
 *
 * "Missed" is the forgiving reading — wrong at least once, or never gotten
 * right — matching engine.missedFacts(stats, "forg") and the Results screen's
 * "Redrill the misses". Empty when there are no sessions, or when the latest
 * one has no detail.
 */
export function lastMisses(history: HistoryFile): FactId[] {
  const detail = lastSession(history)?.detail;
  if (!detail) return [];
  return Object.entries(detail)
    .filter(([, d]) => d.misses > 0 || !d.everCorrect)
    .sort((a, b) => b[1].misses - a[1].misses)
    .map(([f]) => f as FactId);
}
