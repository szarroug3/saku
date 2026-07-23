// The kanji-reading unlock — the payoff that makes kanji and words reinforce
// each other, and the fix for an old hole.
//
// THE HOLE
// ========
// A kanji reading fact is keyed on (kanji, word): `kanji:生/reading@人生`, not
// `kanji:生/reading`, because "what is 生 read as" has nine answers and cannot
// be graded while "what is 生 read as in 人生" has one. The anchor word (人生)
// is the EVIDENCE-RICHEST word attesting that reading — chosen by the ingest for
// weight, not for how early a beginner meets it. So the reading fact shipped
// asking "生 in 人生 → ?" for a user who may never have been taught 人生. Asking
// about a reading in a word you were never shown teaches nothing; it is the same
// ungradeable-question failure one layer up.
//
// THE RULE
// ========
// A kanji reading fact becomes ASKABLE once the user knows at least one TAUGHT
// word that attests it — any word in the reading's `words` list whose meaning
// they have learned. Learning 先生 (a word) makes 生's せい reading askable,
// because 先生 proves it. And the question is then anchored on a word the user
// ACTUALLY LEARNED, not on the ingest's 人生: prefer the reading's own anchor if
// it's known, otherwise the earliest (lowest-beginnerRank) known word. The
// answer — セイ — is the same in every one of those words, so re-anchoring the
// CONTEXT is free of grading consequences; it only makes the question fair.
//
// WHERE THIS PLUGS IN
// ===================
// Two seams, both pure functions of history:
//
//   - `unlockedReadingFacts(history)` — which reading facts are askable now.
//     src/lib/selection.ts folds these into the drillable pool, so an unlocked
//     reading enters your drills the moment a word proves it, exactly as a seen
//     fact would, with no persisted write.
//   - `readingAnchors(history)` — fact → the known word to SHOW. The drill screen
//     hands this to the kanji question's prompt so "生 in ___" names a word you
//     know. Falls back to the ingest anchor when nothing is known (the fact then
//     isn't unlocked anyway, so this is belt-and-braces).
//
// The reading fact's IDENTITY never changes — it stays `kanji:生/reading@人生`,
// stable on disk — because re-keying per user would break history and multiply
// the fact set by every word. Only what the prompt DISPLAYS moves.

import { effectiveState } from "@/lib/claims";
import {
  READING_INDEX,
  READINGS,
  readingFactId,
  type ReadingRow,
} from "@/data/kanji";
import { vocabRow, wordMeaningFactId } from "@/data/vocab";
import type { FactId, HistoryFile } from "@/types";

/** A word is KNOWN once its meaning has been learned — seen, claimed, or tested.
 * The same "not fresh" signal the words and kanji tracks gate on, read here for
 * a word's meaning fact.
 *
 * EXPORTED so there is one answer to "do I know this word" and not three. The
 * reading unlock asks it, `lib/grammar/readable.ts` asks it of every content
 * lemma in a sentence, and the Library's "words you know that use this
 * component" asks it of the vocabulary. A second definition would drift, and it
 * would drift on `claims` — the "I already know this" record is the half a
 * re-implementation always forgets. */
export function wordKnown(keb: string, history: HistoryFile): boolean {
  const state = effectiveState(
    history.facts[wordMeaningFactId(keb)],
    history.claims?.[wordMeaningFactId(keb)],
    history.seen?.[wordMeaningFactId(keb)],
  );
  return state.lastTested > 0;
}

/**
 * The word to ANCHOR a reading question on — a word the user has learned.
 *
 * Prefer the ingest's own anchor when it's known: it is the evidence-richest and
 * the fact is already keyed on it. Otherwise take the earliest known word by
 * beginnerRank — the one most likely to be familiar. Null when the user knows no
 * word that attests this reading, which is exactly when the reading is not yet
 * unlocked.
 */
export function preferredAnchor(
  row: ReadingRow,
  known: (keb: string) => boolean,
): string | null {
  if (known(row.anchor)) return row.anchor;
  let best: string | null = null;
  let bestRank = Infinity;
  for (const w of row.words) {
    if (!known(w)) continue;
    const rank = vocabRow(w)?.beginnerRank ?? Infinity;
    if (rank < bestRank) {
      bestRank = rank;
      best = w;
    }
  }
  return best;
}

/**
 * Every reading fact unlocked by what the user knows, mapped to the KNOWN word
 * to display as its context.
 *
 * Pure: the same history yields the same map. The keys are the canonical reading
 * fact ids (anchored on the ingest's word); the values are the words to SHOW,
 * which may differ. Memoise a `known` lookup across the whole scan — a reading's
 * `words` list overlaps its neighbours', so the same word is asked about many
 * times.
 */
export function readingAnchors(history: HistoryFile): Map<FactId, string> {
  const cache = new Map<string, boolean>();
  const known = (keb: string): boolean => {
    let v = cache.get(keb);
    if (v === undefined) {
      v = wordKnown(keb, history);
      cache.set(keb, v);
    }
    return v;
  };

  const out = new Map<FactId, string>();
  for (const row of READINGS) {
    const anchor = preferredAnchor(row, known);
    if (anchor) out.set(readingFactId(row.k, row.anchor), anchor);
  }
  return out;
}

/** The reading facts that are askable now — the keys of `readingAnchors`. Kept
 * for callers that want the whole unlocked set from history (and for the tests
 * that pin the rule). The lesson handlers use `readingsProvedBy` instead, which
 * works from the WORDS being taught rather than re-deriving from history. */
export function unlockedReadingFacts(history: HistoryFile): FactId[] {
  return [...readingAnchors(history).keys()];
}

/**
 * The kanji reading facts that these WORDS prove — what teaching them unlocks.
 *
 * This is the write side of the unlock: when a word lesson is taught or claimed,
 * the words track marks these seen (page.tsx → /api/seen), which is exactly how
 * the reading becomes drillable — the same seen record a kana "quiz me" writes.
 * Working from the taught words rather than from history means the unlock is a
 * direct consequence of the lesson, recorded at the moment it happens, and does
 * not wait for a later history read to notice the word became known.
 *
 * A reading is proved by a word when the word is in the reading's attesting
 * `words` list. Deduped, since one word (先生) proves several readings and
 * several words prove one.
 */
export function readingsProvedBy(words: readonly string[]): FactId[] {
  const set = new Set(words);
  const out: FactId[] = [];
  for (const row of READINGS) {
    if (row.words.some((w) => set.has(w))) {
      out.push(readingFactId(row.k, row.anchor));
    }
  }
  return out;
}

/**
 * The known word to frame ONE reading fact on — the drill screen's per-question
 * lookup, so it need not build the whole `readingAnchors` map to ask a single
 * card. Undefined for a non-reading fact, or a reading no known word attests
 * (in which case the fact isn't unlocked and the prompt falls back to its own
 * anchor).
 */
export function anchorForFact(
  fact: FactId,
  history: HistoryFile,
): string | undefined {
  const row = READING_INDEX.get(fact);
  if (!row) return undefined;
  return preferredAnchor(row, (keb) => wordKnown(keb, history)) ?? undefined;
}

/** True when `fact` is a kanji's word-anchored READING fact, the kind keyed on
 * (kanji, word). A lookup into READING_INDEX, not a parse of the id: the reading
 * facts are exactly its keys, so a kana or word fact, or a kanji MEANING fact,
 * answers false. This is the one classification the two guards below share. */
export function isReadingFact(fact: FactId): boolean {
  return READING_INDEX.has(fact);
}

/**
 * The facts a kanji CLAIM ("I already know this") is allowed to mark known,
 * with its word-anchored readings removed.
 *
 * Knowing a kanji is knowing its MEANING. Its readings are only ever asked
 * inside a word, and are proved by LEARNING that word (`readingsProvedBy`), not
 * by knowing the character. So claiming 山 must claim `kanji:山/meaning` and drop
 * `kanji:山/reading@登山`, or the learner is credited with a reading in a word
 * (登山) she never met. Kana, word, and kanji-meaning facts are not reading
 * facts, so they pass through untouched: a kana claim still claims its one fact,
 * a word claim still claims all of its facts.
 */
export function claimableFacts(facts: readonly FactId[]): FactId[] {
  return facts.filter((f) => !isReadingFact(f));
}

/**
 * The facts a Library quiz is allowed to ask, with any kanji reading in an
 * unlearned word removed.
 *
 * A reading fact stays only when a word that attests it is known, which is when
 * `anchorForFact` can name a learned word to frame the question on. This is a
 * belt over the source fix in `claimableFacts`: even if a reading became "met"
 * by some other path, the quiz still never asks a kanji's reading inside a word
 * the learner has not learned. Non-reading facts (kana, words, meanings) always
 * pass, so kana and vocabulary quizzes are unaffected.
 */
export function quizzableFacts(
  facts: readonly FactId[],
  history: HistoryFile,
): FactId[] {
  return facts.filter(
    (f) => !isReadingFact(f) || anchorForFact(f, history) !== undefined,
  );
}
