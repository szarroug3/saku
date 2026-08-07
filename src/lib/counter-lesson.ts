// The numbers-and-counters track's scheduler — the words track's twin, over the
// counters curriculum instead of VOCAB.
//
// WHY IT IS NOT word-lesson.ts
// ============================
// A counter is a `word` fact (COUNTERS_SUBJECT), so it drills and scores exactly
// like vocabulary — but it is NOT in VOCAB (the counting words this track
// teaches first are absent from the generated dictionary; see counters.ts), so
// the words scheduler cannot reach it. This file walks COUNTER_CURRICULUM the
// same way word-lesson.ts walks CURRICULUM_WORDS: a PURE function of history,
// no cursor, the next handful of fresh, teachable forms in teaching order.
//
// THE GATE, PHASE BY PHASE
// ========================
// Phase 1 (〜つ, the Sino numbers, 〜人, 11-99/百千万) is all kana, so
// counterKanjiPrereqs returns [] and every phase-1 form is teachable the moment
// the track opens, right after hiragana. Phase 2 (〜本/〜匹/〜枚) is written with
// a NUMBER kanji, so it gates on that kanji being known: 三本 waits until 三 is
// learned. Phase 3 (the tail) is written with kanji too and gates the same way.
// The gate is `counterTeachable`, and it is `counterKanjiPrereqs` checked
// against `kanjiKnown` — the identical prerequisite the words track applies to a
// kanji word's kanji.
//
// IT INTERLEAVES, IT DOES NOT LOCK
// ================================
// A form whose number kanji is not yet known is STEPPED OVER, not turned into a
// lock card — the transitivity track's model, not the words track's. The number
// kanji (一..十) are among the very first kanji taught, so phase 2 opens almost
// as soon as the kanji track does, and a lock card naming "learn 三" would flash
// and vanish within a lesson or two. So the card is either teaching the next
// ready forms or absent, and a learner with no counters history sees exactly
// what they saw before this file existed: nothing, until the track opens.

import { effectiveState } from "@/lib/claims";
import { factsOf } from "@/lib/facts";
import { kanjiKnown } from "@/lib/kanji-known";
import type { LessonPosition } from "@/lib/lesson-position";
import {
  COUNTERS_SUBJECT,
  COUNTER_CURRICULUM,
  counterEntry,
  counterKanjiPrereqs,
  counterMeaningFactId,
  isKanaForm,
  type ConstructionCategoryId,
  type CounterForm,
} from "@/data/counters";
import { CONSTRUCTION_CATEGORIES } from "@/data/counter-categories";
import { numberConstructionEntry } from "@/data/number-construction";
import { type PhaseIntro } from "@/data/phase-intros";
import type { NumberQuizConfig } from "@/lib/engine/number-quiz";
import type { EntryId, FactId, HistoryFile } from "@/types";

/**
 * A generative NUMBER unit — one scheduler step that teaches a range rule and
 * then drills reading numbers in that range, instead of teaching rote forms.
 *
 * It is gated on a single MARKER pseudo-fact (see src/data/counters.ts): the unit
 * is "done" once its marker is non-fresh in history (claimed on finishing the
 * lesson, or marked seen by "Quiz me"). The teach walk renders `intro` as a
 * formless one-card walk (src/lib/lesson-steps.ts detects the marker), and the
 * drill runs in "number-reading" mode with `config` (src/components/quiz/
 * number-reading-screen.tsx reads it off the carried ActiveQuiz).
 */
export interface NumberUnit {
  /** Which construction category this unit teaches. */
  readonly id: ConstructionCategoryId;
  /** Coarse kind for the Home preview tile: the two bare-number ranges, or a
   * counter. */
  readonly kind: "tens" | "big" | "counter";
  /** The marker fact that gates and records this unit. */
  readonly marker: FactId;
  /** The rule card shown as the unit's whole teach walk. */
  readonly intro: PhaseIntro;
  /** The generative round the drill leg runs. */
  readonly config: NumberQuizConfig;
  /** How the unit's material shows on screen — a range hint (十〜) or a counter
   * (〜本). */
  readonly glyph: string;
  /** The drill mode — always number-reading for a unit. */
  readonly mode: "number-reading";
}

function unitOf(cat: (typeof CONSTRUCTION_CATEGORIES)[number]): NumberUnit {
  return {
    id: cat.id,
    kind: cat.id === "tens" ? "tens" : cat.id === "big" ? "big" : "counter",
    marker: cat.marker,
    intro: cat.intro,
    config: cat.config,
    glyph: cat.glyph,
    mode: "number-reading",
  };
}

/**
 * Every generative unit, in curriculum order: the compose rule + 11-99, the big
 * words + 100-9999, then one per counter (人, 本, 匹, 枚, then the tail). Each
 * teaches a rule card and drills a generated round instead of rote forms. Sourced
 * from CONSTRUCTION_CATEGORIES so a unit, its Library page and its drillable
 * category fact all name the same thing.
 */
export const GENERATIVE_UNITS: readonly NumberUnit[] =
  CONSTRUCTION_CATEGORIES.map(unitOf);

/** The two bare-number range units (tens, big). Kept as its own export because
 * the number ranges precede every counter and a few callers/tests want just
 * them. */
export const NUMBER_UNITS: readonly NumberUnit[] = GENERATIVE_UNITS.filter(
  (u) => u.kind !== "counter",
);

/**
 * How many counters a lesson teaches. A COUNT, not a cost — a counter is a word,
 * uniform and indivisible, so the honest unit is how many you meet in a sitting,
 * the same call the words and grammar tracks make. There is deliberately no
 * Settings knob for it; the caller may pass a size but the app never asks the
 * user to set one.
 */
export const COUNTERS_PER_LESSON_DEFAULT = 5;

/** Clamp a passed count to a sane lesson size — whole, at least 1, capped so a
 * hand-edit can't ask for a 100-item teach screen. Same instinct as
 * clampWordsPerLesson and clampGrammarPerLesson. */
export function clampCountersPerLesson(n: number): number {
  const v = Math.round(Number.isFinite(n) ? n : COUNTERS_PER_LESSON_DEFAULT);
  return Math.min(20, Math.max(1, v));
}

/** The forms the track teaches, in teaching order. It IS COUNTER_CURRICULUM —
 * the sequence is authored there (〜つ first, then the numbers, then the
 * counters built on them, then the tail) — re-exported so a consumer names it
 * without reaching into the data file. */
export const CURRICULUM_COUNTERS: readonly CounterForm[] = COUNTER_CURRICULUM;

/** How many steps the track teaches — the denominator on the lesson card. The
 * memorised forms PLUS every generative unit (the two number ranges and each
 * counter), which each count as one step. */
export const COUNTERS_CURRICULUM_TOTAL =
  CURRICULUM_COUNTERS.length + GENERATIVE_UNITS.length;

/** The facts a counter teaches — its meaning always, its reading unless it is a
 * kana form (whose reading is the glyph itself, so there is no reading fact; see
 * buildCounterFacts). Read off the registry, never rebuilt, so the lesson can
 * only seed facts that actually exist. */
function counterFacts(form: CounterForm): FactId[] {
  return factsOf(counterEntry(form));
}

/** A fact the app has no record of — never answered, never claimed, never
 * "quiz me"'d. The one definition of "new", the same `lastTested === 0` rule the
 * words and grammar tracks read per fact. */
function isFresh(fact: FactId, history: HistoryFile): boolean {
  const state = effectiveState(
    history.facts[fact],
    history.claims?.[fact],
    history.seen?.[fact],
  );
  return state.lastTested === 0;
}

/**
 * Is this counter teachable right now? A kana form (all of phase 1) always is;
 * a counted form is teachable only once its NUMBER kanji is known. This is the
 * approved gate: phase 1 needs kana alone (counterKanjiPrereqs is []), phase 2
 * and the tail need their number kanji learned — 三本 waits on 三.
 */
export function counterTeachable(form: CounterForm, history: HistoryFile): boolean {
  return counterKanjiPrereqs(form).every((c) => kanjiKnown(c, history));
}

/** Has the learner met any counter at all? The words track's
 * `hasStartedWordTrack`, for counters — used to decide whether a returning
 * learner has opened the track. */
export function hasStartedCountersTrack(history: HistoryFile): boolean {
  for (const f of CURRICULUM_COUNTERS) {
    if (!isFresh(counterMeaningFactId(f), history)) return true;
  }
  return false;
}

/** One counter, ready to render on a lesson card. */
export interface CounterCard {
  /** The entry id — for the library link. */
  entry: EntryId;
  /** How it looks — ひとつ, 三本. */
  glyph: string;
  /** Its reading, or null for a kana form (whose reading is the glyph itself, so
   * printing ひとつ · ひとつ would read as a bug). */
  reading: string | null;
  /** The plain-language gloss — "three long objects". */
  meaning: string;
  /** Which counter this is a form of, for a quiet tag; "" for a bare number. */
  counter: string;
}

/** The next counters lesson: the forms to teach, their facts, and where you
 * are. */
export interface CounterLesson {
  cards: CounterCard[];
  facts: FactId[];
  /** Where you are, in COUNTERS — "6-10 of 69". Items are counters (and the two
   * generative units), counted the way the words and grammar tracks count theirs;
   * see lesson-position.ts. */
  position: LessonPosition;
  /**
   * Set when this lesson is a generative NUMBER unit rather than a run of forms.
   * The teach walk shows the unit's rule card only, and the drill runs in
   * number-reading mode with `config` (the marker is the whole teach set, so
   * finishing the lesson claims it and the scheduler advances). Absent for an
   * ordinary form-teaching lesson.
   */
  numberUnit?: {
    mode: "number-reading";
    config: NumberQuizConfig;
    marker: FactId;
    intro: PhaseIntro;
  };
}

function toCard(form: CounterForm): CounterCard {
  return {
    entry: counterEntry(form),
    glyph: form.glyph,
    reading: isKanaForm(form) ? null : form.reading,
    meaning: form.meaning,
    counter: form.counter,
  };
}

/** The Home preview card for a generative unit — one tile hinting the range or
 * counter. Its link points at the unit's own construction page (a real Library
 * entry), and the glyph is the range/counter it drills (十〜, 〜本). */
function unitCard(unit: NumberUnit): CounterCard {
  return {
    entry: numberConstructionEntry(unit.id),
    glyph: unit.glyph,
    reading: null,
    meaning: unit.intro.title,
    counter: "",
  };
}

/** Is this unit still un-taught? Its marker is fresh (never claimed, never marked
 * seen) exactly while the range it covers has not been taught. */
function unitFresh(unit: NumberUnit, history: HistoryFile): boolean {
  return isFresh(unit.marker, history);
}

/** One step of the numbers-and-counters schedule: a form to teach, or a
 * generative unit. */
type ScheduleStep = { form: CounterForm } | { unit: NumberUnit };

/** The counter glyph each counter category counts, so the schedule can splice a
 * category's kept memorised form (歳's はたち) right behind its rule unit. Most
 * counters keep none; 〜人's ひとり/ふたり/よにん are taught by the category itself,
 * not spliced as rote forms. */
const COUNTER_GLYPH_BY_ID: Partial<Record<ConstructionCategoryId, string>> = {
  nin: "人",
  hon: "本",
  hiki: "匹",
  mai: "枚",
  ko: "個",
  dai: "台",
  satsu: "冊",
  hai: "杯",
  kai: "回",
  sai: "歳",
};

/**
 * The whole schedule, in teaching order:
 *   1. the bare-number forms — 〜つ (the escape hatch), then the Sino numbers 1-10.
 *   2. the two number-range units (compose 11-99, then the big words 100-9999).
 *   3. each counter, in page order (人, 本, 匹, 枚, then the tail): its rule unit,
 *      followed by any memorised form it still keeps (only 歳's はたち, which no
 *      category can build). The regular AND irregular counts are generated by the
 *      category, never listed as rote forms.
 * A pure function of the curriculum's order and the category list, built once.
 */
const SCHEDULE: readonly ScheduleStep[] = buildSchedule();

function buildSchedule(): ScheduleStep[] {
  const steps: ScheduleStep[] = [];
  for (const form of CURRICULUM_COUNTERS) {
    if (form.counter === "つ" || form.counter === "") steps.push({ form });
  }
  for (const u of NUMBER_UNITS) steps.push({ unit: u });
  for (const u of GENERATIVE_UNITS) {
    if (u.kind !== "counter") continue;
    steps.push({ unit: u });
    const glyph = COUNTER_GLYPH_BY_ID[u.id];
    for (const form of CURRICULUM_COUNTERS) {
      if (glyph && form.counter === glyph) steps.push({ form });
    }
  }
  return steps;
}

/** How many schedule STEPS are behind the learner: forms met, plus units done. */
function doneSteps(history: HistoryFile): number {
  const metForms = CURRICULUM_COUNTERS.filter(
    (f) => !isFresh(counterMeaningFactId(f), history),
  ).length;
  const doneUnits = GENERATIVE_UNITS.filter((u) => !unitFresh(u, history)).length;
  return metForms + doneUnits;
}

/**
 * The next counters lesson, or null when nothing is teachable yet.
 *
 * Walk the schedule in teaching order collecting the next `count` forms that are
 * new (meaning not met) and teachable now (kana, or number kanji known). A
 * generative unit is a HARD BOUNDARY: forms already collected are taught first
 * (stop at the unit), and when nothing is collected and the unit's marker is
 * fresh, the unit itself is the lesson. A done unit is stepped over, exactly like
 * a met form. Null means the curriculum is finished or the next forms are all
 * still gated behind kanji not yet learned — the same "nothing is shown" every
 * other track's card follows.
 *
 * PURE OF KANA. Like the other post-kana tracks, this does not know whether kana
 * is done; that gate is the caller's (see src/app/page.tsx).
 */
export function nextCounterLesson(
  history: HistoryFile,
  count: number,
): CounterLesson | null {
  const size = clampCountersPerLesson(count);
  const rows: CounterForm[] = [];
  let dueUnit: NumberUnit | null = null;
  for (const step of SCHEDULE) {
    if ("unit" in step) {
      if (rows.length) break; // teach the forms collected so far first
      if (unitFresh(step.unit, history)) {
        dueUnit = step.unit;
        break;
      }
      continue; // unit already done — step over it
    }
    const form = step.form;
    if (!isFresh(counterMeaningFactId(form), history)) continue;
    if (!counterTeachable(form, history)) continue;
    rows.push(form);
    if (rows.length >= size) break;
  }

  // Steps behind the learner, counted over the WHOLE schedule (forms are skipped
  // when gated, so the met set is not a contiguous run and "you have done N" is
  // the only honest count). The next lesson is all fresh, never in this total.
  const done = doneSteps(history);

  if (dueUnit) {
    return {
      cards: [unitCard(dueUnit)],
      facts: [dueUnit.marker],
      numberUnit: {
        mode: dueUnit.mode,
        config: dueUnit.config,
        marker: dueUnit.marker,
        intro: dueUnit.intro,
      },
      position: { from: done + 1, to: done + 1, total: COUNTERS_CURRICULUM_TOTAL },
    };
  }
  if (!rows.length) return null;

  const cards = rows.map(toCard);
  const facts = rows.flatMap(counterFacts);
  return {
    cards,
    facts,
    position: {
      from: done + 1,
      to: done + cards.length,
      total: COUNTERS_CURRICULUM_TOTAL,
    },
  };
}

/** The subject these lessons belong to. Re-exported so a caller holding a lesson
 * never has to reach into the data file to name it. It is `word` — a counter is
 * vocabulary with a track label. */
export { COUNTERS_SUBJECT };
