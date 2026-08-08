// The keigo track's scheduler — the transitivity track's twin, over KEIGO_SETS
// instead of verb pairs, and gated EARLY.
//
// THE UNIT IS A SET, AND THE GATE IS "THE PLAIN VERB IS KNOWN"
// ===========================================================
// A keigo set teaches the honorific and humble forms of a plain verb the learner
// already knows. Until that plain verb is learned, "召し上がる is the polite form
// of 食べる" means nothing — there is no 食べる in the learner's head to hang it
// on. So a set opens the moment ANY of its plain verbs is learned vocabulary (its
// meaning fact no longer fresh). This is the grammar track's HOST GATE and the
// transitivity track's "both verbs learned" gate, applied to keigo: the track
// opens EARLY, on a handful of known words, not after some later track finishes.
// It has NO dependency on transitivity, counters, or anything but plain vocab.
//
// RECOGNITION FIRST
// =================
// Every fact a set seeds is a RECOGNITION fact (see src/data/keigo.ts and the
// keigo question type in src/lib/engine/question.ts): shown the keigo verb, pick
// what it means and which register it is. There is no production fact on this
// track yet, so a set can never ask the learner to PRODUCE a keigo form before
// its concept is taught — the ruling's "recognition first" holds by construction.
//
// INTERLEAVED, NOT BLOCKING
// =========================
// The sets depend on different plain verbs, learned at wildly different times, so
// a set whose plain verb is not yet known is STEPPED OVER, not blocked on — the
// transitivity model. The track always hands out the next set that is actually
// ready, and a learner with no keigo history sees exactly what they saw before
// this file existed: nothing, until a plain verb opens the first set.

import { effectiveState } from "@/lib/claims";
import {
  collectPrereqs,
  toPrereqTiles,
  type PrereqItem,
  type PrereqTile,
} from "@/lib/kanji-prereqs";
import type { LessonRange } from "@/lib/lesson-sizing";
import type { LessonPosition } from "@/lib/lesson-position";
import {
  KEIGO_SETS,
  KEIGO_SUBJECT,
  keigoSetEntry,
  keigoWordFactId,
  recognitionGloss,
  type KeigoSet,
  type KeigoWord,
} from "@/data/keigo";
import { wordMeaningFactId } from "@/data/vocab";
import type { EntryId, FactId, HistoryFile } from "@/types";

/**
 * How many NEW sets a lesson teaches. Small, and equal to the transitivity and
 * grammar defaults: a keigo set is a dense relationship (a plain verb and its two
 * registers), not a flashcard, so a calm handful is the right sitting. A caller
 * may pass its own count; the app never asks the user to set one.
 */
export const KEIGO_PER_LESSON_DEFAULT = 3;

/** Clamp a passed count to a sane lesson size — whole, at least 1, capped so a
 * hand-edit can't ask for a giant teach screen. Same instinct as the other
 * tracks'. */
export function clampKeigoPerLesson(n: number): number {
  const v = Math.round(Number.isFinite(n) ? n : KEIGO_PER_LESSON_DEFAULT);
  return Math.min(20, Math.max(1, v));
}

/** The sets the track teaches, in teaching order. It IS KEIGO_SETS — the order
 * is authored there — re-exported so a consumer names it without reaching into
 * the data file. */
export const CURRICULUM_KEIGO: readonly KeigoSet[] = KEIGO_SETS;

/** How many sets the track teaches — the denominator on the lesson card. */
export const KEIGO_CURRICULUM_TOTAL = CURRICULUM_KEIGO.length;

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

/** Every recognition fact a set teaches. */
function setFacts(set: KeigoSet): FactId[] {
  return set.words.map((w) => keigoWordFactId(set, w));
}

/** Whether a set still has anything to teach — any of its recognition facts
 * still fresh. A set whose every word is met is done and no longer offered. */
function setFresh(set: KeigoSet, history: HistoryFile): boolean {
  return setFacts(set).some((f) => isFresh(f, history));
}

/**
 * Whether a set's gate is open: at least one of the plain verbs it replaces has
 * a completed lesson or was explicitly claimed. An empty gate (formulaic phrases)
 * is always open — kana completion is the only requirement, and that is the
 * caller's gate. Kanji in the forms are now taught inside the lesson (prepended
 * to the fact list so the spine plan schedules them first), not required upfront.
 */
export function keigoUnlocked(set: KeigoSet, history: HistoryFile): boolean {
  if (set.gate.length === 0) return true;
  return set.gate.some((keb) => !!history.claims?.[wordMeaningFactId(keb)]);
}

/** Has the learner met any keigo set at all? Decides whether the track counts as
 * started — the mirror of the other tracks' hasStarted*Track. */
export function hasStartedKeigoTrack(history: HistoryFile): boolean {
  for (const set of CURRICULUM_KEIGO) {
    if (!setFresh(set, history)) return true;
  }
  return false;
}

/** One keigo word, ready to render on a set's lesson card. */
export interface KeigoCardWord {
  /** How it looks — 召し上がる. */
  word: string;
  /** Its reading. */
  reading: string;
  /** honorific | humble. */
  register: string;
  /** The recognition gloss — "eat / drink (honorific)". */
  gloss: string;
}

/** One set, ready to render on a lesson card: the plain verb it replaces and the
 * keigo words that do. */
export interface KeigoCard {
  /** The entry the set's facts hang off — the teach walk groups on it. */
  entry: EntryId;
  /** The shared action — "eat / drink". */
  meaning: string;
  /** The plain verbs the set replaces, for the card's left column. */
  plain: readonly { word: string; reading: string }[];
  /** The keigo words, honorific first. */
  words: readonly KeigoCardWord[];
}

/** One tile shown above the keigo preview — a kanji or radical this lesson teaches
 * first. It is the shared PrereqTile, kept re-exported under this name for the
 * component that already imports it. */
export type KeigoPrereqTile = PrereqTile;

/** The next keigo lesson: the sets to teach, their facts, and where you are. */
export interface KeigoLesson {
  cards: KeigoCard[];
  facts: FactId[];
  /** Prerequisite tiles per card, in the same order as `cards`. */
  cardPrereqTiles: readonly (readonly KeigoPrereqTile[])[];
  /** Where you are, in SETS — "1–3 of 9". */
  position: LessonPosition;
}

function toCardWord(set: KeigoSet, word: KeigoWord): KeigoCardWord {
  return {
    word: word.word,
    reading: word.reading,
    register: word.register,
    gloss: recognitionGloss(set, word),
  };
}

function toCard(set: KeigoSet): KeigoCard {
  return {
    entry: keigoSetEntry(set),
    meaning: set.meaning,
    plain: set.plain.map((p) => ({ word: p.keb, reading: p.reading })),
    words: set.words.map((w) => toCardWord(set, w)),
  };
}

const HAN = /\p{Script=Han}/u;

/**
 * The next keigo lesson, or null when there is nothing teachable — either the
 * track is finished, or every remaining set is still locked behind a plain verb
 * the learner has not met.
 *
 * Walk the curriculum in teaching order. A fully-met set is counted and skipped.
 * A fresh set that is still LOCKED (its plain verb unmet) is skipped WITHOUT
 * counting — it is not yet part of progress and must not block the sets behind
 * it. A fresh, unlocked set is taken, up to `count` of them — subject to the
 * prereq cost budget: if a set's unknown kanji and their radical components would
 * push the total teach-work over the passed `range.max` (the same
 * `cfg.lessonMinCost`/`lessonMaxCost` range the kanji packer reads), it starts the
 * next lesson instead. At least one set is always taken.
 *
 * PURE OF KANA. Like the other post-kana tracks, this does not know whether kana
 * is done; that gate is the caller's (see src/app/page.tsx).
 */
export function nextKeigoLesson(
  history: HistoryFile,
  count: number,
  range: LessonRange,
): KeigoLesson | null {
  const size = clampKeigoPerLesson(count);
  const rows: KeigoSet[] = [];
  let met = 0;

  const seenKanji = new Set<string>();
  const seenRadicals = new Set<string>();
  const cardPrereqItems: PrereqItem[][] = [];
  let totalPrereqCost = 0;

  for (const set of CURRICULUM_KEIGO) {
    if (!setFresh(set, history)) {
      met++;
      continue;
    }
    if (!keigoUnlocked(set, history)) continue;

    // Tentatively collect this set's prereq pieces into a temp buffer.
    const kanjiSnap = new Set(seenKanji);
    const radSnap = new Set(seenRadicals);
    const tempItems: PrereqItem[] = [];
    for (const { word } of set.words) {
      for (const c of word) {
        if (!HAN.test(c)) continue;
        collectPrereqs(c, history, seenKanji, seenRadicals, tempItems);
      }
    }
    // A set's full difficulty is its prereq reading-units PLUS its own content:
    // one register-form per keigo word (setFacts is one recognition fact each),
    // so set.words.length is what the lesson pays to teach the set itself. Both
    // halves are budgeted against the sitting, matching the owner's worked example
    // where 言う's three register-forms count alongside their prereq glyphs.
    const addedCost =
      tempItems.reduce((n, p) => n + p.cost, 0) + set.words.length;

    // Budget check: if this set's full difficulty would overflow the lesson, roll
    // back and stop. The first set is always taken regardless of cost (never leave
    // an empty lesson), so a single set heavier than the budget fills its own.
    if (rows.length > 0 && totalPrereqCost + addedCost > range.max) {
      seenKanji.clear();
      for (const x of kanjiSnap) seenKanji.add(x);
      seenRadicals.clear();
      for (const x of radSnap) seenRadicals.add(x);
      break;
    }

    cardPrereqItems.push(tempItems);
    totalPrereqCost += addedCost;
    rows.push(set);
    if (rows.length >= size) break;
  }

  if (!rows.length) return null;

  const cards = rows.map(toCard);
  // Facts ordered per-card so the teach walk steps through each set's prereqs then its keigo words.
  const facts = rows.flatMap((set, i) => [
    ...cardPrereqItems[i].map((p) => p.fact),
    ...setFacts(set),
  ]);
  return {
    cards,
    facts,
    cardPrereqTiles: cardPrereqItems.map(toPrereqTiles),
    position: {
      from: met + 1,
      to: met + cards.length,
      total: KEIGO_CURRICULUM_TOTAL,
    },
  };
}

/** The subject these lessons belong to. Re-exported so a caller holding a lesson
 * never has to reach into the data file to name it. */
export { KEIGO_SUBJECT };
