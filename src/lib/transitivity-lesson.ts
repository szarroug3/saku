// The transitivity track: the fifth curriculum, taught per PAIR and unlocked one
// pair at a time as the two verbs behind it become learned vocabulary.
//
// WHY THIS IS grammar-lesson.ts, NOT kanji-lesson.ts
// ==================================================
// A pair has no learning COST to size a lesson by — it is two verbs the learner
// already met and one distinction between them — so this is a COUNT of new pairs
// in a sitting, a pure function of history with no cursor, exactly the shape the
// grammar and words tracks take. Kanji's cost-packed groups have no analogue
// here.
//
// THE UNIT IS A PAIR, AND THE GATE IS "BOTH VERBS LEARNED"
// =======================================================
// This is the transitivity mirror of grammar's HOST GATE. A grammar pattern
// needs a real learned word of the type it attaches to before it means anything
// (learnedHosts in grammar-lesson.ts); a transitivity pair needs BOTH of its own
// verbs to be learned vocabulary before the distinction between them is a
// question the learner can even parse. So a pair unlocks exactly when its
// happens-verb and its doIt-verb are both no-longer-fresh vocab meanings.
//
// INTERLEAVED, NOT BLOCKING
// =========================
// Grammar's gate BLOCKS the whole set: if the next pattern's host is unmet, the
// lesson is null and a lock card shows, because grammar is taught in one fixed
// order and simply waits. Transitivity instead INTERLEAVES: the 66 pairs depend
// on 132 different verbs that are learned at wildly different times, so blocking
// on the first not-yet-unlocked pair would stall the entire track behind one
// stray verb. So a locked pair is SKIPPED, not blocked on, and the track always
// hands out the next pair that is actually ready. This is the "unlock per-pair as
// both verbs are learned, interleaved" the owner asked for.
//
// WHAT COUNTS, AND WHAT ONLY RIDES ALONG AS A DISTRACTOR
// =====================================================
// Only pairs whose BOTH verbs are in the words curriculum can ever be unlocked,
// so only those 66 are the track (CURRICULUM_PAIRS); the 4 pairs with a verb the
// app never teaches are excluded from the denominator, the same way grammar
// excludes the non-drillable recipes it will never quiz. And within a taught
// pair, only its ASKABLE sides are scheduled — see src/data/transitivity-facts.ts
// for why a side whose distractor is ambitransitive is minted (as an option) but
// never asked.

import { effectiveState } from "@/lib/claims";
import type { LessonPosition } from "@/lib/lesson-position";
import { CURRICULUM_WORDS } from "@/lib/word-lesson";
import {
  TRANSITIVITY_SUBJECT,
  pairEntry,
  sideFactId,
  transitivitySide,
} from "@/data/transitivity-facts";
import { VERB_PAIRS, type VerbPair } from "@/data/transitivity";
import { wordMeaningFactId } from "@/data/vocab";
import type { EntryId, FactId, HistoryFile } from "@/types";

/**
 * How many NEW pairs a lesson teaches. Smaller than the words default and equal
 * to grammar's: a pair is a dense contrast, not a flashcard, and a calm handful
 * is the right sitting. A caller may pass its own count; the app never asks the
 * user to set one.
 */
export const TRANSITIVITY_PER_LESSON_DEFAULT = 4;

/** Clamp a passed count to a sane lesson size — whole, at least 1, capped so a
 * hand-edit can't ask for a giant teach screen. Same instinct as grammar's. */
export function clampTransitivityPerLesson(n: number): number {
  const v = Math.round(
    Number.isFinite(n) ? n : TRANSITIVITY_PER_LESSON_DEFAULT,
  );
  return Math.min(20, Math.max(1, v));
}

/** The written forms the words curriculum teaches — the only verbs a pair's
 * gate can ever be satisfied by. Built once. */
const CURRICULUM_KEBS = new Set(CURRICULUM_WORDS.map((w) => w.keb));

/** Whether both of a pair's verbs are words the app actually teaches. A pair
 * with a verb outside the curriculum can never unlock, so it is not part of the
 * track — the transitivity analogue of grammar's DRILLABLE filter. */
function pairInCurriculum(p: VerbPair): boolean {
  return CURRICULUM_KEBS.has(p.happens.word) && CURRICULUM_KEBS.has(p.doIt.word);
}

/**
 * The pairs the track teaches, in teaching order: every pair whose both verbs
 * are in the words curriculum, in data order (the curated table's own order,
 * which groups familiar pairs first). A property of the data, computed once.
 */
export const CURRICULUM_PAIRS: readonly VerbPair[] =
  VERB_PAIRS.filter(pairInCurriculum);

/**
 * How many pairs the track teaches — the denominator on the lesson card. 66,
 * out of the 70 curated pairs. The 4 excluded pairs have a verb the app never
 * teaches, so the track can never reach them; counting them would promise
 * lessons that cannot exist, the same error grammar avoids by counting only its
 * drillable recipes.
 */
export const TRANSITIVITY_CURRICULUM_TOTAL = CURRICULUM_PAIRS.length;

/** A fact the app has no record of — never answered, claimed, or seen. The one
 * definition of "new", the same `lastTested === 0` rule the other tracks read
 * per fact. */
function isFresh(fact: FactId, history: HistoryFile): boolean {
  const state = effectiveState(
    history.facts[fact],
    history.claims?.[fact],
    history.seen?.[fact],
  );
  return state.lastTested === 0;
}

/**
 * The askable side facts of a pair — the ones the drill may quiz, which is what
 * the lesson seeds. A side whose distractor is ambitransitive is unaskable and
 * omitted (see transitivity-facts.ts); every pair has at least one askable side.
 */
function askableFacts(p: VerbPair): FactId[] {
  const facts: FactId[] = [];
  for (const side of ["happens", "doIt"] as const) {
    const id = sideFactId(p, side);
    if (transitivitySide(id)?.askable) facts.push(id);
  }
  return facts;
}

/** Whether a pair still has anything to teach — any askable side still fresh.
 * A pair whose every askable side is met is done and no longer offered. */
function pairFresh(p: VerbPair, history: HistoryFile): boolean {
  return askableFacts(p).some((f) => isFresh(f, history));
}

/** Whether a pair's gate is open: both of its verbs are learned vocabulary (the
 * meaning fact of each is no longer fresh). Until then the distinction the pair
 * teaches has no two known verbs to stand between. */
function pairUnlocked(p: VerbPair, history: HistoryFile): boolean {
  return (
    !isFresh(wordMeaningFactId(p.happens.word), history) &&
    !isFresh(wordMeaningFactId(p.doIt.word), history)
  );
}

/** Has the learner met any transitivity pair at all? Decides whether the track
 * counts as started (the completed-state signal Home reads), the mirror of
 * grammar's hasStartedGrammarTrack. */
export function hasStartedTransitivityTrack(history: HistoryFile): boolean {
  for (const p of CURRICULUM_PAIRS) {
    if (!pairFresh(p, history)) return true;
  }
  return false;
}

/** One pair, ready to render on a lesson card. */
export interface TransitivityCard {
  /** The entry the pair's facts hang off — the teach walk groups on it. */
  entry: EntryId;
  /** The intransitive verb and its English cue. 開く · "The door opened." */
  happens: { word: string; reading: string; en: string };
  /** The transitive verb and its English cue. 開ける · "I opened the door." */
  doIt: { word: string; reading: string; en: string };
}

/** The next transitivity lesson: the pairs to teach, their askable facts, and
 * where you are. */
export interface TransitivityLesson {
  cards: TransitivityCard[];
  facts: FactId[];
  /** Where you are, in PAIRS — "3–6 of 66". Items are pairs, not lessons. */
  position: LessonPosition;
}

function toCard(p: VerbPair): TransitivityCard {
  return {
    entry: pairEntry(p),
    happens: { word: p.happens.word, reading: p.happens.reading, en: p.happens.en },
    doIt: { word: p.doIt.word, reading: p.doIt.reading, en: p.doIt.en },
  };
}

/**
 * The next transitivity lesson, or null when there is nothing teachable — either
 * the track is finished, or every remaining pair is still locked behind a verb
 * the learner has not met.
 *
 * Walk the curriculum in teaching order. A pair that is fully met is counted and
 * skipped. A fresh pair that is still LOCKED (a verb unmet) is skipped WITHOUT
 * counting — it is not yet part of the learner's progress and it must not block
 * the pairs behind it (see the header: interleaved, not blocking). A fresh,
 * unlocked pair is taken, up to `count` of them.
 *
 * PURE OF KANA. Like the other tracks, this does not know whether kana is done;
 * that gate is the caller's (see src/app/page.tsx).
 */
export function nextTransitivityLesson(
  history: HistoryFile,
  count: number,
): TransitivityLesson | null {
  const size = clampTransitivityPerLesson(count);
  const rows: VerbPair[] = [];
  let met = 0;
  for (const p of CURRICULUM_PAIRS) {
    if (!pairFresh(p, history)) {
      met++;
      continue;
    }
    if (!pairUnlocked(p, history)) continue;
    rows.push(p);
    if (rows.length >= size) break;
  }
  if (!rows.length) return null;

  const cards = rows.map(toCard);
  const facts = rows.flatMap(askableFacts);
  return {
    cards,
    facts,
    position: {
      from: met + 1,
      to: met + cards.length,
      total: TRANSITIVITY_CURRICULUM_TOTAL,
    },
  };
}

/** The subject these lessons belong to. Re-exported so a caller holding a
 * lesson never has to reach into the data file to name it. */
export { TRANSITIVITY_SUBJECT };
