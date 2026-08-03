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
import { kanjiRow, meaningFactId, variantOriginal } from "@/data/kanji";
import {
  isRadicalTaughtAsKanji,
  radicalByWrittenForm,
  radicalMeaningFactId,
  radicalOfKanji,
  type RadicalRow,
} from "@/data/radicals";
import { kanjiKnown } from "@/lib/kanji-known";
import { kanjiCost, radicalCost } from "@/lib/kanji-lesson";
import { LESSON_RANGE_DEFAULT } from "@/lib/lesson-sizing";
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

/** One tile shown above the keigo preview — a kanji or radical this lesson teaches first. */
export interface KeigoPrereqTile {
  glyph: string;
  type: "Kanji" | "Radical";
}

/** The next keigo lesson: the sets to teach, their facts, and where you are. */
export interface KeigoLesson {
  cards: KeigoCard[];
  facts: FactId[];
  /** Prerequisite tiles (radical pieces then kanji) this lesson teaches before the keigo forms. */
  prereqTiles: readonly KeigoPrereqTile[];
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

/** Internal: one item in the prereq collection buffer. */
interface PrereqItem {
  glyph: string;
  type: "Kanji" | "Radical";
  fact: FactId;
  cost: number;
}

/**
 * Collect the prereq tiles needed before kanji `c` can be taught: its unknown
 * radical-only components (and those of any unknown kanji components, recursively),
 * then `c` itself if unknown. Mirrors curriculum-order.ts's component walk.
 *
 * `seenKanji` / `seenRadicals` prevent duplicate emission across calls.
 */
function collectPrereqs(
  c: string,
  history: HistoryFile,
  seenKanji: Set<string>,
  seenRadicals: Set<string>,
  out: PrereqItem[],
): void {
  if (seenKanji.has(c)) return;
  seenKanji.add(c);
  const row = kanjiRow(c);
  if (!row) return;
  // Already known — it and its components were taught by the curriculum earlier.
  if (kanjiKnown(c, history)) return;

  for (const part of row.comps) {
    if (part === c) continue;
    if (kanjiRow(part) !== undefined) {
      collectPrereqs(part, history, seenKanji, seenRadicals, out);
    } else {
      const rad = radicalByWrittenForm(part);
      if (rad && !isRadicalTaughtAsKanji(rad.num)) {
        addRadicalIfNew(rad, history, seenRadicals, out);
      } else {
        const orig = variantOriginal(part);
        if (orig !== undefined && orig !== c) {
          if (kanjiRow(orig) !== undefined) {
            collectPrereqs(orig, history, seenKanji, seenRadicals, out);
          } else {
            const origRad = radicalByWrittenForm(orig);
            if (origRad && !isRadicalTaughtAsKanji(origRad.num)) {
              addRadicalIfNew(origRad, history, seenRadicals, out);
            }
          }
        }
      }
    }
  }

  // Filed-under radical — may not appear in `comps`.
  const filed = radicalOfKanji(c);
  if (filed && !isRadicalTaughtAsKanji(filed.num)) {
    // Skip when the radical is itself built from `c` (avoids the 王↔玉 cycle).
    const filedRow = kanjiRow(filed.glyph);
    if (!filedRow || !filedRow.comps.includes(c)) {
      addRadicalIfNew(filed, history, seenRadicals, out);
    }
  }

  out.push({ glyph: c, type: "Kanji", fact: meaningFactId(c), cost: kanjiCost(c) });
}

function addRadicalIfNew(
  rad: RadicalRow,
  history: HistoryFile,
  seenRadicals: Set<string>,
  out: PrereqItem[],
): void {
  if (seenRadicals.has(rad.glyph)) return;
  seenRadicals.add(rad.glyph);
  const fact = radicalMeaningFactId(rad.glyph);
  const state = effectiveState(
    history.facts[fact],
    history.claims?.[fact],
    history.seen?.[fact],
  );
  if (state.lastTested > 0) return;
  out.push({ glyph: rad.glyph, type: "Radical", fact, cost: radicalCost(rad.num) });
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
 * push the total teach-work over `LESSON_RANGE_DEFAULT.max`, it starts the next
 * lesson instead. At least one set is always taken.
 *
 * PURE OF KANA. Like the other post-kana tracks, this does not know whether kana
 * is done; that gate is the caller's (see src/app/page.tsx).
 */
export function nextKeigoLesson(
  history: HistoryFile,
  count: number,
): KeigoLesson | null {
  const size = clampKeigoPerLesson(count);
  const rows: KeigoSet[] = [];
  let met = 0;

  const seenKanji = new Set<string>();
  const seenRadicals = new Set<string>();
  const prereqItems: PrereqItem[] = [];
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
    const addedCost = tempItems.reduce((n, p) => n + p.cost, 0);

    // Budget check: if the new prereqs would overflow the lesson, roll back and stop.
    // The first set is always taken regardless of cost (never leave an empty lesson).
    if (rows.length > 0 && totalPrereqCost + addedCost > LESSON_RANGE_DEFAULT.max) {
      seenKanji.clear();
      for (const x of kanjiSnap) seenKanji.add(x);
      seenRadicals.clear();
      for (const x of radSnap) seenRadicals.add(x);
      break;
    }

    prereqItems.push(...tempItems);
    totalPrereqCost += addedCost;
    rows.push(set);
    if (rows.length >= size) break;
  }

  if (!rows.length) return null;

  const cards = rows.map(toCard);
  const facts = [...prereqItems.map((p) => p.fact), ...rows.flatMap(setFacts)];
  return {
    cards,
    facts,
    prereqTiles: prereqItems.map(({ glyph, type }) => ({ glyph, type })),
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
