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
import { ALL_FACTS, entryOf, factsOf, glyphOf } from "@/lib/facts";
import { rank, stateOf, type RankCandidate } from "@/lib/scoring";
import type {
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
 * The `n` facts most worth asking as of `now`, best question first.
 *
 * THIS IS THE APP'S ONE DEFINITION OF "WEAKEST", and it is not about accuracy.
 * See src/lib/scoring.ts: the top of this list is what the app LEAST KNOWS
 * ABOUT YOU, and both tails — you certainly know it, you have certainly lost it
 * — are absent rather than ranked low. The order is scoring.rank()'s and
 * nothing here or above may reproduce, adjust or second-guess it.
 *
 * `now` is a parameter and not `Date.now()`, which is most of why this stays a
 * pure function: the results screen ranks as of the run's own timestamp (so a
 * reopened session says what it said at the time, and a render is not a clock
 * read), and the tests rank in whatever week they please.
 *
 * WHAT USED TO BE HERE, AND WHY IT WAS THE OLD THESIS
 * ==================================================
 * `weakestFacts(history, metric, n)` sorted by accuracy ascending, ties to
 * more-seen. Every line of it was defensible and the whole was wrong: accuracy
 * is a RECORD, and a drill list is a PREDICTION. It could not see that a word
 * was 62 days cold, because 100% never rises — so the fact you are most likely
 * to have forgotten was the one fact it could never surface. It also had no
 * upper tail: the thing you fail every time sat at the top forever, being asked
 * and failed and asked again. Deleting it is the point of this change; the
 * signature changed with it so that no call site keeps its old meaning by
 * accident.
 *
 * WHY THIS TAKES NO `metric`
 * ==========================
 * It has nothing to take one with. firstTry-vs-attempt is a question about how
 * to score a RECORD, and this list is not one. What counts as a hit is settled
 * once, in aggregate.ts, at the moment evidence is folded — and it is settled
 * as first-try, the same thing the HUD pill and the rings call "nailed it". The
 * chips on Statistics and the results screen still choose what those numbers
 * MEAN; they do not, and should not, change what the app asks you next.
 *
 * Facts the data no longer has are skipped: history outlives the material it
 * was recorded against, and a deleted character must not be drillable.
 */
export function weakestFacts(
  history: HistoryFile,
  now: number,
  n = 20,
): FactId[] {
  const facts: RankCandidate[] = [];
  for (const [key, agg] of Object.entries(history.facts)) {
    const f = key as FactId;
    if (!factsOf(entryOf(f)).length) continue;
    facts.push({ id: f, state: stateOf(agg) });
  }
  return rank({ facts, limit: n }, now);
}

// weakestEntries() WAS HERE. It ranked ENTRIES by summary accuracy, for the
// Statistics table, and its own comment conceded the problem: "The two lists
// answer different questions and are allowed to disagree." They were identical
// while every kana was one fact and would have diverged the moment kanji landed
// — Home saying "Weakest 20" while Statistics named different characters, with
// nothing on either screen admitting there were two answers.
//
// It is deleted rather than reconciled, for three reasons, in order of force:
//
//   1. THE MODEL REFUSES TO RANK ENTRIES. Weakness is a function of (stability,
//      lastTested) and those are per-FACT: 生 does not have a stability, it has
//      eleven. An entry's weakness could only be a mean of its facts'
//      weaknesses — an average of predictions, which is the same "61% true of
//      nothing" the entry/fact rekey exists to prevent, one level down. So the
//      answer to "make them one thing or argue why two is right" is neither:
//      the second list was never a thing the model can compute. FactState is
//      not poolable, and after this change it is not poolable in the type
//      system either (see accuracy.totalFor).
//   2. IT HAD NO CALLERS. Statistics never used it. characters-table.tsx sorts
//      its own rows and merely CITED this function in a comment as the rule it
//      was matching — so "two lists that can disagree" was, precisely, one list
//      and one function waiting to become a second one.
//   3. STATISTICS IS NOT A RANKING. It is the record: every row, always, sorted
//      by whichever column you click. Its default sort is the accuracy column
//      ascending — which is not a rival thesis about what is weak, it is a
//      table sorting the column it is displaying. That table was already
//      renamed from "Weakest characters" to "Characters" for exactly this
//      reason, and with this gone the rename is true rather than tactful.
//
// So: ONE list means "weakest" — weakestFacts, over facts, ordered by
// scoring.rank. Statistics displays accuracy and sorts by accuracy, and says
// "accuracy" on the tin. Neither claims the other's job.

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
