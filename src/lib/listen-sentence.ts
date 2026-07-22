// SENTENCE-LISTENING RECOGNITION — hear a sentence, pick its English meaning.
//
// The THIRD listening question type, and the first over SENTENCES. Task 22
// shipped the two WORD listening types (listen.ts) and the owner ruled sentence
// TRANSCRIPTION out: romaji transcription of a whole sentence is ambiguous (は as
// wa, long vowels, spacing) and would break the absolute "never mark correct
// Japanese wrong" rule. RECOGNITION escapes that: the audio plays, 3-4 English
// meanings are shown, the learner PICKS the right one. There is exactly one right
// meaning, so it grades with certainty — which is the whole reason it is allowed
// where transcription is not.
//
// WHY IT IS ITS OWN MODULE (and its own screen), NOT A DRILL FLAG
// ==============================================================
// listenRomaji / listenMeaning are PRESENTATIONS of an existing word FACT: the
// drill hides the glyph and plays the word, then grades the same jp2en fact on
// the same FactId MC path. A recognition card cannot ride that path, because its
// options are English SENTENCE MEANINGS, not FactIds — there is no fact whose
// answer is "which of these four English sentences", so the drill's
// `picked === q.f` comparison has nothing to compare. So this is a corpus-driven,
// known-words-gated question type with its OWN screen, exactly like assembly and
// substitution (task 11), and its enabling chip lives in the Listening row.
//
// SOURCE + GATE (reused, not reinvented)
// ======================================
// Sentences come from the grammar CORPUS (jp + en). The known-words gate is the
// SAME predicate assembly and the selection cloze use — `readerFor(history)` over
// `Example.v`, the content-lemma list — so a recognition prompt never plays words
// the learner has not met. That is the jargon bug the readability gate closes,
// one layer up.
//
// DISTRACTORS — PLAUSIBLE, AND PROVABLY NOT A SECOND CORRECT ANSWER
// ================================================================
// The wrong meanings are other sentences' `en`, chosen near the answer's length
// for plausibility. The load-bearing rule is `ambiguousMeanings`: no distractor
// may EQUAL, ENTAIL (be a sub-phrase of), or PARAPHRASE (share most content
// words with) the correct meaning, and no two options may do so to each other.
// Two options that both read the audio correctly is the never-mark-wrong rule
// again — this time it would mark a correct pick wrong. The check is deliberately
// CONSERVATIVE (it would rather drop a fair distractor than admit a risky one),
// and `pickRecognition` asserts the finished board is clean before returning it.

import { CORPUS, type Example } from "@/data/grammar/corpus";
import { patternMeaningFactId } from "@/data/grammar";
import { factInfo } from "@/lib/facts";
import { readerFor } from "@/lib/grammar/readable";
import type { Rng } from "@/lib/grammar/vehicles";
import type { FactId, HistoryFile } from "@/types";

/** One recognition showing — plain data, so it rides the screen's serialized
 * runtime exactly like an AssemblyItem does. */
export interface RecognitionItem {
  /** Tatoeba id of the AUDIO sentence, for attribution and bug reports. */
  readonly id: number;
  /** The sentence that is PLAYED. Never rendered as text before the learner
   * answers — the one thing an audio prompt exists to withhold. */
  readonly jp: string;
  /** The correct English meaning — one of `options`. */
  readonly answer: string;
  /** The choices shown, already shuffled: the answer plus 2-3 distractors. */
  readonly options: readonly string[];
  /** Index of `answer` within `options`. */
  readonly correct: number;
  /** Pattern MEANING facts a correct pick credits — the same facts the selection
   * cloze and assembly move, filtered to those the registry has. */
  readonly facts: readonly FactId[];
}

/** How many distractors sit beside the answer, and the target total (3-4
 * options). At least MIN_DISTRACTORS must be found or the sentence is skipped. */
const WANT_DISTRACTORS = 3;
const MIN_DISTRACTORS = 2;
/** First-pass English word-count window for "similar length" distractors; the
 * second pass drops it when the tight window can't fill the board. */
const LENGTH_WINDOW = 4;

/** Normalise an English meaning for comparison: lower-case, strip surrounding
 * quotes and terminal punctuation, collapse whitespace. */
function normalize(s: string): string {
  return s
    .toLowerCase()
    .replace(/[."'!?,;:()]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Content tokens of a normalised meaning — the set for overlap tests. */
function tokenSet(s: string): Set<string> {
  return new Set(normalize(s).split(" ").filter(Boolean));
}

function wordCount(s: string): number {
  const n = normalize(s);
  return n ? n.split(" ").length : 0;
}

function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 1;
  let inter = 0;
  for (const t of a) if (b.has(t)) inter++;
  const union = a.size + b.size - inter;
  return union === 0 ? 0 : inter / union;
}

/** Overlap at or above this reads as "the same meaning, said differently". */
const PARAPHRASE_JACCARD = 0.6;

/**
 * Could these two English meanings BOTH be a correct reading of one audio?
 *
 * True — so the pair may NOT share a board — when they are identical, when one
 * is a sub-phrase of the other (entailment: "I ate." vs "I ate rice."), or when
 * they share most of their content words (paraphrase). Conservative on purpose:
 * a false positive only costs a distractor, a false negative costs the
 * never-mark-wrong rule.
 */
export function ambiguousMeanings(a: string, b: string): boolean {
  const na = normalize(a);
  const nb = normalize(b);
  if (!na || !nb) return true; // an empty meaning is never a usable option
  if (na === nb) return true;
  // Entailment: the shorter phrase appears whole inside the longer one.
  const [short, long] = na.length <= nb.length ? [na, nb] : [nb, na];
  if ((` ${long} `).includes(` ${short} `)) return true;
  return jaccard(tokenSet(na), tokenSet(nb)) >= PARAPHRASE_JACCARD;
}

/** A Fisher-Yates over indices with an INJECTABLE rng (engine.shuffle uses
 * Math.random directly, which a test can't pin). Returns a fresh array. */
function shuffledIndices(n: number, rng: Rng): number[] {
  const a = Array.from({ length: n }, (_, i) => i);
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * The distractor meanings for an answer sentence — near its length, plausible,
 * and each proven not to be a second correct answer (and not to duplicate one
 * another). Draws from the whole corpus (the learner READS these, so they need
 * not be sentences she can decode), preferring similar length. Fewer than
 * MIN_DISTRACTORS means this sentence can't make a safe board right now.
 */
function pickDistractors(answer: Example, rng: Rng): string[] {
  const answerLen = wordCount(answer.en);
  const chosen: string[] = [];
  const order = shuffledIndices(CORPUS.length, rng);
  for (const window of [LENGTH_WINDOW, Infinity]) {
    for (const i of order) {
      if (chosen.length >= WANT_DISTRACTORS) break;
      const c = CORPUS[i];
      if (c.id === answer.id) continue;
      const en = c.en.trim();
      if (!en) continue;
      if (window !== Infinity && Math.abs(wordCount(en) - answerLen) > window) {
        continue;
      }
      if (ambiguousMeanings(en, answer.en)) continue;
      if (chosen.some((ch) => ambiguousMeanings(en, ch))) continue;
      chosen.push(en);
    }
    if (chosen.length >= WANT_DISTRACTORS) break;
  }
  return chosen;
}

/** The pattern meaning facts a correct pick credits. */
function recognitionFacts(ex: Example): FactId[] {
  return ex.p.map(patternMeaningFactId).filter((f) => factInfo(f));
}

/**
 * Every corpus sentence the learner can READ right now — the recognition pool.
 *
 * Same gate assembly and the selection cloze use: every content lemma known.
 * A sentence with unknown words would be an audio prompt of jargon, which is
 * the exact bug the readability gate closes.
 */
export function readableRecognition(history: HistoryFile): readonly Example[] {
  const reader = readerFor(history);
  return CORPUS.filter((ex) => ex.jp.trim() && ex.en.trim() && reader(ex));
}

/**
 * Roll one recognition item, or null when none can be built.
 *
 * Picks a readable sentence, then a safe set of distractors; returns null when
 * the learner can read nothing yet (the ordinary early answer) or when the
 * chosen sentence can't raise MIN_DISTRACTORS clean distractors. Asserts the
 * finished board has no ambiguous pair before returning — the never-mark-wrong
 * invariant, checked at the source rather than trusted. `rng` is injectable for
 * tests.
 */
export function pickRecognition(
  history: HistoryFile,
  rng: Rng = Math.random,
): RecognitionItem | null {
  const pool = readableRecognition(history);
  if (pool.length === 0) return null;
  const answer = pool[Math.floor(rng() * pool.length)] ?? pool[0];
  const distractors = pickDistractors(answer, rng);
  if (distractors.length < MIN_DISTRACTORS) return null;

  const options = distractors.slice(0, WANT_DISTRACTORS);
  options.push(answer.en.trim());
  // Shuffle the board (rng-driven) and locate the answer.
  const order = shuffledIndices(options.length, rng);
  const shuffled = order.map((i) => options[i]);
  const correct = shuffled.indexOf(answer.en.trim());

  const item: RecognitionItem = {
    id: answer.id,
    jp: answer.jp,
    answer: answer.en.trim(),
    options: shuffled,
    correct,
    facts: recognitionFacts(answer),
  };
  // The invariant, asserted at the source: no two options are a correct reading
  // of the audio, and the answer is exactly one option. A violation is a bug in
  // the picker, not something to serve — return null rather than a bad board.
  if (!boardIsUnambiguous(item)) return null;
  return item;
}

/**
 * Is this board safe to grade — the answer present exactly once, and no pair of
 * options a correct reading of the other? The property `pickRecognition`
 * guarantees, exported so a test can assert it directly over many rolls.
 */
export function boardIsUnambiguous(item: RecognitionItem): boolean {
  if (item.options[item.correct] !== item.answer) return false;
  if (item.options.filter((o) => o === item.answer).length !== 1) return false;
  for (let i = 0; i < item.options.length; i++) {
    for (let j = i + 1; j < item.options.length; j++) {
      if (ambiguousMeanings(item.options[i], item.options[j])) return false;
    }
  }
  return true;
}

/** Did the learner pick the right meaning? Graded by INDEX, never by the option
 * text — two options can never share text (boardIsUnambiguous forbids it), but
 * grading by index keeps this a pure, obvious check. */
export function gradeRecognition(item: RecognitionItem, chosen: number): boolean {
  return chosen === item.correct;
}
