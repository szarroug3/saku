// Which corpus sentences a learner can actually READ — the gate on selection.
//
// WHY THIS EXISTS
// ===============
// A selection item cuts a pattern out of a real Tatoeba sentence and asks which
// pattern fills the hole. That is a fair question only if the rest of the
// sentence is readable. It was not: 65.8% of the 5,380 items carried a content
// word past beginner rank 2,000, so the card was "fill in a blank in a sentence
// you cannot read", which is not a grammar question, it is a guess.
//
// THE RULE — DERIVED, NOT TUNED
// =============================
// An item is offered only when EVERY content lemma in its sentence is a word
// the learner knows. No coverage floor, no rank cap, no threshold to pick: the
// gate is a consequence of what she has learned and moves on its own as she
// learns more. This is `word-unlock.ts`'s model one layer up — there a kanji
// reading opens when a word attests it; here a sentence opens when its words
// are known — and "known" is deliberately the SAME predicate, `wordKnown`, so
// claims ("I already know this") unlock sentences exactly as lessons do.
//
// The corpus was built for this. `Example.v` is the content-lemma list (nouns,
// verbs, adjectives, adverbs) and excludes particles on purpose, so the gate
// cannot be washed out by は and を appearing in every sentence.
//
// WHAT IT COSTS (measured on this corpus, blank-only frames already dropped)
// =========================================================================
//   words known      patterns with an item      items
//   10                6                          20
//   50               10                          30
//   100              17                          58
//   500              31                         522
//   1,000            44                       1,320
//   all 12,553       51                       3,714
//
// The shrinkage is the feature. A pattern left with no readable sentence falls
// back to the fixed meaning card, which is a real question in both directions —
// grammar meaning never becomes unaskable, it only stops being asked as a cloze.
//
// SPELLING: A LEMMA IS NOT A `keb`
// ================================
// Tatoeba's lemmas are whatever the tokeniser emitted — みる where the
// vocabulary lists 見る, くる for 来る. Matching on `keb` alone marked 126
// occurrences of みる unknown for a learner who had literally just been taught
// 見る. So a lemma resolves against `keb` OR `reb`, and any vocabulary row it
// lands on can prove it known. One word, one meaning fact, several spellings.

import { effectiveState } from "../claims.ts";
import { VOCAB, wordMeaningFactId, type VocabRow } from "../../data/vocab.ts";
import type { Example } from "../../data/grammar/corpus.ts";
import type { HistoryFile } from "../../types/index.ts";

/**
 * Tatoeba's stock cast, treated as ALWAYS KNOWN.
 *
 * A name is not vocabulary you have to have studied. トム is the single most
 * common content lemma in the whole selection corpus (300 occurrences, 5.6% of
 * all items), with ボストン (22) and メアリー (20) behind it, and NONE of the
 * three is in the app's 12,553-word vocabulary — so as a blocker each one is
 * permanent: no amount of studying could ever open those items, because there
 * is no lesson that teaches トム. Meanwhile the word itself is katakana, which
 * is the first thing this app teaches; a learner who can read the sentence can
 * read the name.
 *
 * Measured, not assumed. Treating the three as known gains 2 patterns and ~25%
 * more items at 10-50 words known (6→8 patterns, 20→25 items at 10; 30→37 items
 * at 50), and +260 items at full vocabulary. Small in the tail, decisive at the
 * beginning, which is where she is.
 *
 * Deliberately just these three, not "every katakana word the vocabulary
 * lacks": that broader rule would wave through ダメ and タバコ, which are real
 * words she has not met, and re-open the hole this file closes. Everything
 * below 20 occurrences is worth ~0.1% of items and is not worth the risk.
 */
export const STOCK_NAMES: ReadonlySet<string> = new Set(["トム", "ボストン", "メアリー"]);

/** lemma (keb OR reb) → the vocabulary rows it could be. Built once. */
const BY_SPELLING: ReadonlyMap<string, VocabRow[]> = buildIndex();

function buildIndex(): Map<string, VocabRow[]> {
  const map = new Map<string, VocabRow[]>();
  for (const w of VOCAB) {
    for (const spelling of new Set([w.keb, w.reb])) {
      const list = map.get(spelling);
      if (list) list.push(w);
      else map.set(spelling, [w]);
    }
  }
  return map;
}

/**
 * A word is KNOWN once its meaning has been learned — seen, claimed, or tested.
 *
 * Byte-for-byte the rule `word-unlock.ts` gates kanji readings on, read through
 * the same `effectiveState`, so a CLAIM counts here exactly as it counts there.
 * There is one notion of known in this app and this is a call to it, not a
 * second copy.
 */
export function wordKnown(keb: string, history: HistoryFile): boolean {
  const fact = wordMeaningFactId(keb);
  const state = effectiveState(
    history.facts[fact],
    history.claims?.[fact],
    history.seen?.[fact],
  );
  return state.lastTested > 0;
}

/**
 * Is this CORPUS LEMMA a word the learner knows?
 *
 * True for a stock name (see STOCK_NAMES). Otherwise true when any vocabulary
 * row spelled this way has its meaning fact known — 見る proves みる.
 *
 * FALSE for a lemma the vocabulary does not contain at all, and that is the
 * intended answer rather than a gap: 43% of items carry at least one such
 * lemma, they are real words the app never teaches, and admitting them would be
 * admitting exactly the sentences she cannot read.
 */
export function lemmaKnown(lemma: string, history: HistoryFile): boolean {
  if (STOCK_NAMES.has(lemma)) return true;
  const rows = BY_SPELLING.get(lemma);
  if (!rows) return false;
  return rows.some((w) => wordKnown(w.keb, history));
}

/**
 * Can the learner read this sentence — every content lemma known?
 *
 * `known` is injectable so a caller filtering hundreds of examples for one
 * pattern can memoise the per-lemma lookup across all of them (the same lemma
 * recurs constantly: する appears in 741 items). Callers with nothing to
 * memoise pass nothing.
 *
 * A sentence with no content lemmas is readable — there is nothing unknown in
 * it — which matches `corpus.coverage`'s empty case.
 */
export function readableBy(
  ex: Example,
  history: HistoryFile,
  known?: (lemma: string) => boolean,
): boolean {
  const test = known ?? ((l: string) => lemmaKnown(l, history));
  return ex.v.every(test);
}

/** A memoised `readableBy` predicate for one history — the shape the selection
 * filter wants, built once per card rather than per example. */
export function readerFor(history: HistoryFile): (ex: Example) => boolean {
  const cache = new Map<string, boolean>();
  const known = (lemma: string): boolean => {
    let v = cache.get(lemma);
    if (v === undefined) {
      v = lemmaKnown(lemma, history);
      cache.set(lemma, v);
    }
    return v;
  };
  return (ex: Example) => readableBy(ex, history, known);
}
