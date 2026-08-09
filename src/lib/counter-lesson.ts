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
// THE NUMBER KANJI ARE TAUGHT IN-TRACK, KEIGO-STYLE
// =================================================
// The construction tables show kanji (十一, 三人, 三本), so the number kanji
// (一..十) and each counter kanji (人 本 匹 …) must be TAUGHT, not assumed. This
// track teaches them the exact way the keigo track teaches the kanji inside its
// verbs: before the material that uses a kanji, the lesson teaches the smaller
// radicals and kanji that kanji is built from (its full component chain), so a
// new character reads as pieces the learner already knows. The shared walk is
// `collectPrereqs` (src/lib/kanji-prereqs.ts), threaded across a sitting so a
// piece is taught once.
//
// So there is NO number-kanji gate any more: a form or unit is always reachable,
// and its unknown kanji ride along as PREREQ TILES prepended to the lesson's own
// facts. The kana reading (いち) and the number kanji (一) are two taught items —
// the reading teaches the sound, the kanji reuses its existing kanji meaning fact
// (so it dedupes against the kanji track), and the construction rule card is
// where 一 = いち is visually linked.
//
// COST-BUDGETED, NOT A FIXED COUNT
// ================================
// A number form now carries a variable amount of prereq work (一 pulls nothing,
// 四 pulls 囗 儿, 六 pulls 亠 八 …), so a fixed "5 per lesson" is the wrong unit.
// The sitting is cost-budgeted against the caller's LessonRange.max the keigo way
// (the same `cfg.lessonMinCost`/`lessonMaxCost` range the kanji packer reads):
// Σ prereq reading-units + the form's own content, always taking at least the
// first step. A generative unit is its own lesson (a rule card + a generated
// round), with its counter kanji's chain taught ahead of the rule card; its
// CONTENT cost is 1 + its irregular count (see unitContentCost), a rule plus its
// exceptions rather than the ten rote forms it replaces.

import { effectiveState } from "@/lib/claims";
import { factsOf } from "@/lib/facts";
import {
  collectPrereqs,
  toPrereqTiles,
  type PrereqItem,
  type PrereqTile,
} from "@/lib/kanji-prereqs";
import type { LessonRange } from "@/lib/lesson-sizing";
import type { LessonPosition } from "@/lib/lesson-position";
import {
  COUNTERS_SUBJECT,
  COUNTER_CURRICULUM,
  counterEntry,
  counterMeaningFactId,
  isKanaForm,
  type ConstructionCategoryId,
  type CounterForm,
} from "@/data/counters";
import { CONSTRUCTION_CATEGORIES } from "@/data/counter-categories";
import { isNumberKanji } from "@/data/number-kanji";
import {
  numberConstructionEntry,
  numberConstructionRow,
} from "@/data/number-construction";
import { vocabRow, wordReadingFactId } from "@/data/vocab";
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
  /** Prerequisite tiles per card, in the same order as `cards`: the radicals and
   * kanji this lesson teaches before the counter/number that needs them (mirrors
   * KeigoLesson.cardPrereqTiles). Empty for a card that needs no new kanji. */
  cardPrereqTiles: readonly (readonly PrereqTile[])[];
  /** Where you are, in COUNTERS — "6-10 of 69". Items are counters (and the two
   * generative units), counted the way the words and grammar tracks count theirs;
   * see lesson-position.ts. Prereq tiles are overhead and do NOT move this. */
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
    /** True when this lesson is a prereq-only slice for the unit: it runs the
     * unit drill mode but does not include the marker fact yet, so completion
     * does not advance the unit gate. */
    prepOnly?: boolean;
  };
}

/** Pick a budgeted prefix of prereq items, mirroring the form-packer rule:
 * take at least one item, then stop before the next would exceed max. */
function packPrereqs(items: readonly PrereqItem[], max: number): PrereqItem[] {
  const packed: PrereqItem[] = [];
  let cost = 0;
  for (const item of items) {
    if (packed.length > 0 && cost + item.cost > max) break;
    packed.push(item);
    cost += item.cost;
  }
  return packed;
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

/**
 * The reading facts that should ride with a number-UNIT prereq slice.
 *
 * The number units teach their number kanji as item cards — tens (一…十) and big
 * (百 千 万). Those are WORDS: their pronunciation lives on the matching
 * one-character word reading fact, so it must ride the same lesson, or the
 * learner meets the kanji with no reading. Restricted to the unit's OWN number
 * kanji, NOT the component chain collectPrereqs also pulls: 百's prereq 白 is a
 * word too, but it is not a number and its reading is taught on its own turn.
 */
function numberUnitReadingFacts(
  unit: NumberUnit,
  prereqs: readonly PrereqItem[],
  history: HistoryFile,
): FactId[] {
  if (unit.id !== "tens" && unit.id !== "big") return [];
  const own = new Set(UNIT_KANJI[unit.id]);
  const out: FactId[] = [];
  const seen = new Set<FactId>();
  for (const p of prereqs) {
    if (!own.has(p.glyph) || !vocabRow(p.glyph)) continue;
    const fact = wordReadingFactId(p.glyph);
    if (seen.has(fact) || !isFresh(fact, history)) continue;
    seen.add(fact);
    out.push(fact);
  }
  return out;
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
 * seen) while the range it covers has not been taught.
 *
 * Legacy/partial progress may already have the marker while still missing the
 * unit's kanji chain. In that case the unit must resurface to backfill those
 * prereqs; otherwise progression skips material the learner has never seen.
 */
function unitFresh(unit: NumberUnit, history: HistoryFile): boolean {
  if (isFresh(unit.marker, history)) return true;
  const seenKanji = new Set<string>();
  const seenRadicals = new Set<string>();
  const prereqs: PrereqItem[] = [];
  for (const c of UNIT_KANJI[unit.id]) {
    collectPrereqs(c, history, seenKanji, seenRadicals, prereqs, isNumberKanji);
  }
  return prereqs.length > 0;
}

/** How many irregular counts a unit's construction teaches — the length of the
 * "Irregular" group in its construction page's example tables, the SAME table the
 * Library page renders, so the number can never drift from what the learner sees.
 * `tens` has no irregular group (0); `big` hardens at five seams (300/600/800/
 * 3000/8000); each counter carries its own (〜人 3, 〜本 5, 〜枚 0). */
function unitIrregularCount(id: ConstructionCategoryId): number {
  const group = numberConstructionRow(id)?.exampleGroups.find(
    (g) => g.title === "Irregular",
  );
  return group ? group.examples.length : 0;
}

/**
 * A generative unit's CONTENT cost — what teaching its rule is worth to the
 * sitting's budget, separate from and added on top of its prereq kanji-chain cost.
 *
 * One for the rule itself, plus one per irregular it must also teach: a
 * construction counter is a rule and its exceptions, not the ten rote forms it
 * replaces, so a flat 1 undercharges a counter full of sound-shifts and 10
 * overcharges a regular one. So 〜枚/〜台 (no shifts) cost 1, 〜人 costs 4, 〜本/〜匹
 * cost 6, and the big range costs 6. 〜つ is NOT a unit — it stays ten memorised
 * kana forms at one each, split across lessons by the form-run budget.
 */
export function unitContentCost(unit: NumberUnit): number {
  return 1 + unitIrregularCount(unit.id);
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

/** The kanji a generative UNIT teaches before its rule card: the counter kanji
 * itself for a counter unit (人 本 匹 …), the big-word kanji for the `big` range,
 * and the ten Sino number kanji 一…十 for the `tens` range — the FIRST unit that
 * spells numbers with kanji (十七, 三十四), so it teaches them here. (They used to
 * ride in on the rote number forms, which taught 一 ahead of いち; those forms are
 * gone — the number's reading is a WORD-role fact now — so their kanji move onto
 * the first unit that uses them, keigo-style.) collectPrereqs pulls the FULL
 * component chain of each (四 → 囗 儿, 個 → 口 古 固, 百 → 白, …) and dedupes a kanji
 * the learner already knows — the owner's ruling: no capping, no deferring. */
export const UNIT_KANJI: Readonly<Record<ConstructionCategoryId, readonly string[]>> = {
  tens: ["一", "二", "三", "四", "五", "六", "七", "八", "九", "十"],
  big: ["百", "千", "万"],
  nin: ["人"],
  hon: ["本"],
  hiki: ["匹"],
  mai: ["枚"],
  ko: ["個"],
  dai: ["台"],
  satsu: ["冊"],
  hai: ["杯"],
  kai: ["回"],
  sai: ["歳"],
};

const HAN = /\p{Script=Han}/u;

/** The kanji a FORM teaches as prereqs before its own facts: any Han characters
 * in its glyph. Only 二十歳 has Han in its glyph now (the 〜つ forms are pure kana),
 * and its 二 十 歳 are all taught by the tens unit and the 〜歳 unit ahead of it, so
 * collectPrereqs finds nothing new to add there. */
function formKanji(form: CounterForm): readonly string[] {
  return [...form.glyph].filter((ch) => HAN.test(ch));
}

/**
 * The whole schedule, in teaching order:
 *   1. the 〜つ forms — the escape hatch, the native 1-10 (all kana).
 *   2. the two number-range units (compose 11-99, then the big words 100-9999).
 *      The tens unit teaches the number kanji 一…十 as its prereqs (they are no
 *      longer rote forms; see UNIT_KANJI). The Sino numbers' readings ride their
 *      word role in the words track, not a form here.
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
    if (form.counter === "つ") steps.push({ form });
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
 * The next counters lesson, or null when the curriculum is finished.
 *
 * Walk the schedule in teaching order. A met form and a done unit are stepped
 * over. Fresh FORMS pack into one sitting the keigo way: each form's number-kanji
 * prereqs are collected (shared seen-sets across the sitting so a component is
 * taught once), and the sitting's cost — Σ prereq reading-units + each form's own
 * content — is budgeted against the passed `range.max`; the first form is always
 * taken, so a form heavier than the budget fills its own lesson. A generative UNIT
 * is a HARD BOUNDARY and its own lesson: forms collected so far are taught first,
 * and a due unit teaches its counter kanji's full component chain ahead of its
 * rule card. Prereq tiles are OVERHEAD — they ride the facts but never move the
 * "N of M" position, which counts content (forms + units) only.
 *
 * PURE OF KANA. Like the other post-kana tracks, this does not know whether kana
 * is done; that gate is the caller's (see src/app/page.tsx).
 */
export function nextCounterLesson(
  history: HistoryFile,
  range: LessonRange,
): CounterLesson | null {
  const seenKanji = new Set<string>();
  const seenRadicals = new Set<string>();
  const rows: CounterForm[] = [];
  const rowPrereqs: PrereqItem[][] = [];
  let totalCost = 0;

  let dueUnit: NumberUnit | null = null;
  const unitPrereqs: PrereqItem[] = [];
  let unitPrepOnly: NumberUnit | null = null;

  for (const step of SCHEDULE) {
    if ("unit" in step) {
      if (rows.length) break; // teach the forms collected so far first
      if (!unitFresh(step.unit, history)) continue; // already done — step over it
      // The unit is due. It is its own lesson (a rule card + a generated round),
      // with its counter kanji's full component chain taught ahead of the rule.
      dueUnit = step.unit;
      for (const c of UNIT_KANJI[step.unit.id]) {
        // The number kanji 一…十 are taught as whole tiles — their shape-only
        // pieces (囗 儿 亠 …) mislead, so isNumberKanji marks them leaf. Counter
        // kanji (人 本 匹 …) are not in the set and decompose as before.
        collectPrereqs(c, history, seenKanji, seenRadicals, unitPrereqs, isNumberKanji);
      }

      // Respect the lesson range for unit lessons too: if teaching the whole
      // prereq chain plus the unit's own rule would overflow max, hand out a
      // prereq-only lesson first. Claiming those real kanji/radical facts moves
      // history forward, so the next call shrinks the remaining chain until the
      // marker lesson itself fits.
      const unitCost =
        unitPrereqs.reduce((n, p) => n + p.cost, 0) + unitContentCost(step.unit);
      if (unitCost > range.max && unitPrereqs.length > 0) {
        const packed = packPrereqs(unitPrereqs, range.max);
        unitPrereqs.length = 0;
        unitPrereqs.push(...packed);
        dueUnit = null;
        unitPrepOnly = step.unit;
      }
      break;
    }
    const form = step.form;
    if (!isFresh(counterMeaningFactId(form), history)) continue;

    // Tentatively collect this form's number-kanji prereqs into a temp buffer, so
    // an over-budget form can roll the shared seen-sets back before it is dropped.
    const kanjiSnap = new Set(seenKanji);
    const radSnap = new Set(seenRadicals);
    const tempItems: PrereqItem[] = [];
    for (const c of formKanji(form)) {
      // Number kanji stay whole here too (see the unit branch); 二十歳's 二 十 are
      // the only number kanji a form's glyph carries, and both are already taught
      // by the tens unit ahead of it, so this rarely adds anything.
      collectPrereqs(c, history, seenKanji, seenRadicals, tempItems, isNumberKanji);
    }
    // A form's full difficulty is its prereq reading-units PLUS its own content:
    // one per kana meaning fact (a bare number / 〜つ form is one), the mirror of
    // keigo's set.words.length. Both halves budget against the sitting.
    const addedCost =
      tempItems.reduce((n, p) => n + p.cost, 0) + counterFacts(form).length;

    // The first form is always taken (never an empty lesson); a later form that
    // would overflow the budget rolls the seen-sets back and starts the next one.
    if (rows.length > 0 && totalCost + addedCost > range.max) {
      seenKanji.clear();
      for (const x of kanjiSnap) seenKanji.add(x);
      seenRadicals.clear();
      for (const x of radSnap) seenRadicals.add(x);
      break;
    }

    rowPrereqs.push(tempItems);
    totalCost += addedCost;
    rows.push(form);
  }

  // Steps behind the learner, counted over the WHOLE schedule (a met set is not a
  // contiguous run, so "you have done N" is the only honest count). The next
  // lesson is all fresh, never in this total. Prereq tiles never enter it.
  const done = doneSteps(history);

  if (dueUnit) {
    const readingFacts = numberUnitReadingFacts(dueUnit, unitPrereqs, history);
    return {
      cards: [unitCard(dueUnit)],
      // Prereqs first, then the marker: the teach walk shows the kanji/radical
      // item cards, then the unit's rule card (see lesson-steps.ts).
      facts: [...unitPrereqs.map((p) => p.fact), ...readingFacts, dueUnit.marker],
      cardPrereqTiles: [toPrereqTiles(unitPrereqs)],
      numberUnit: {
        mode: dueUnit.mode,
        config: dueUnit.config,
        marker: dueUnit.marker,
        intro: dueUnit.intro,
      },
      position: { from: done + 1, to: done + 1, total: COUNTERS_CURRICULUM_TOTAL },
    };
  }
  if (unitPrepOnly) {
    const readingFacts = numberUnitReadingFacts(unitPrepOnly, unitPrereqs, history);
    return {
      cards: [unitCard(unitPrepOnly)],
      // A unit-prep lesson teaches only part of the due unit's prereq chain.
      // No marker yet: the rule card remains due until its own lesson runs.
      facts: [...unitPrereqs.map((p) => p.fact), ...readingFacts],
      cardPrereqTiles: [toPrereqTiles(unitPrereqs)],
      numberUnit: {
        mode: unitPrepOnly.mode,
        config: unitPrepOnly.config,
        marker: unitPrepOnly.marker,
        intro: unitPrepOnly.intro,
        prepOnly: true,
      },
      position: { from: done + 1, to: done + 1, total: COUNTERS_CURRICULUM_TOTAL },
    };
  }
  if (!rows.length) return null;

  const cards = rows.map(toCard);
  // Facts ordered per-card so the teach walk steps through each form's prereq
  // kanji/radicals, then the form itself.
  const facts = rows.flatMap((form, i) => [
    ...rowPrereqs[i].map((p) => p.fact),
    ...counterFacts(form),
  ]);
  return {
    cards,
    facts,
    cardPrereqTiles: rowPrereqs.map(toPrereqTiles),
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
