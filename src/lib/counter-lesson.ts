// The numbers-and-counters track's curriculum DATA — the generative units and the
// teaching schedule the content model reads.
//
// THE NUMBER KANJI ARE TAUGHT IN-TRACK, KEIGO-STYLE
// =================================================
// The construction tables show kanji (十一, 三人, 三本), so the number kanji
// (一..十) and each counter kanji (人 本 匹 …) must be TAUGHT, not assumed. Each
// generative unit teaches them the way the keigo track teaches the kanji inside
// its verbs: before the material that uses a kanji, the lesson teaches the smaller
// radicals and kanji it is built from. See UNIT_KANJI for the per-unit set.
//
// The generative units and their teaching order live here (GENERATIVE_UNITS,
// SCHEDULE); the generic content-model scheduler in src/lib/content walks them.

import {
  COUNTER_CURRICULUM,
  type ConstructionCategoryId,
  type CounterForm,
} from "@/data/counters";
import { CONSTRUCTION_CATEGORIES } from "@/data/counter-categories";
import { type PhaseIntro } from "@/data/phase-intros";
import type { NumberQuizConfig } from "@/lib/engine/number-quiz";
import type { FactId } from "@/types";

/**
 * A generative NUMBER unit — one scheduler step that teaches a range rule and
 * then drills reading numbers in that range, instead of teaching rote forms.
 *
 * It is gated on a single MARKER pseudo-fact (see src/data/counters.ts): the unit
 * is "done" once its marker is non-fresh in history (claimed on finishing the
 * lesson, or marked seen by "Quiz me"). The teach walk renders `intro` as a
 * formless one-card walk (src/lib/lesson-steps.ts detects the marker), and the
 * drill runs in the normal "drill" mode; the category fact owns `config` and
 * rolls its generated showing inside DrillScreen.
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
  /** The drill mode — generated categories use the shared Drill screen. */
  readonly mode: "drill";
}

function unitOf(cat: (typeof CONSTRUCTION_CATEGORIES)[number]): NumberUnit {
  return {
    id: cat.id,
    kind: cat.id === "tens" ? "tens" : cat.id === "big" ? "big" : "counter",
    marker: cat.marker,
    intro: cat.intro,
    config: cat.config,
    glyph: cat.glyph,
    mode: "drill",
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

/** One step of the numbers-and-counters schedule: a form to teach, or a
 * generative unit. */
export type ScheduleStep = { form: CounterForm } | { unit: NumberUnit };

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
 * itself for a counter unit (人 本 匹 …, and 日/月 for the day/month units), the
 * big-word kanji for the `big` range, and the ten Sino number kanji 一…十 for
 * the `tens` range — the FIRST unit that spells numbers with kanji (十七, 三十
 * 四), so it teaches them here. (They used to ride in on the rote number
 * forms, which taught 一 ahead of いち; those forms are gone — the number's
 * reading is a WORD-role fact now — so their kanji move onto the first unit
 * that uses them, keigo-style. Day/month's own kanji used to ride in the same
 * way, on the 43 rote day/month forms; SAK-163 round 4 made those forms
 * reference-only too, so 日/月 move here on the same pattern.) collectPrereqs
 * pulls the FULL component chain of each (四 → 囗 儿, 個 → 口 古 固, 百 → 白, …)
 * and dedupes a kanji the learner already knows — the owner's ruling: no
 * capping, no deferring. */
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
  // SAK-177: three more generative units — each teaches its own counter kanji
  // before its rule card, same as every counter above it.
  wari: ["割"],
  floor: ["階"],
  en: ["円"],
  // SAK-171: 〜時's own unit teaches 時 before its rule card, same as every
  // other counter above it.
  ji: ["時"],
  day: ["日"],
  month: ["月"],
};

/**
 * The whole schedule, in teaching order:
 *   1. the 〜つ forms — the escape hatch, the native 1-10 (all kana).
 *   2. the two number-range units (compose 11-99, then the big words 100-9999).
 *      The tens unit teaches the number kanji 一…十 as its prereqs (they are no
 *      longer rote forms; see UNIT_KANJI). The Sino numbers' readings ride their
 *      word role in the words track, not a form here.
 *   3. each counter, in page order (人, 本, 匹, 枚, then the tail, then SAK-177's
 *      割/階/円, then SAK-171's 〜時, then day-of-month and month-of-year last):
 *      its rule unit, followed by any memorised
 *      form it still keeps (only 歳's はたち, which no category can build — see
 *      COUNTER_GLYPH_BY_ID; 〜時 keeps none — it is pure generative, like
 *      割/階/円). The regular AND irregular counts are generated by
 *      the category, never listed as rote forms — day/month included, since
 *      SAK-163 round 4 made them generative categories exactly like every
 *      other counter (see counters.ts's CONSTRUCTION_CATEGORY_IDS, which ends
 *      "…, sai, wari, floor, en, ji, day, month" — that trailing order is what
 *      puts them last here, with no bespoke step of their own).
 * A pure function of the curriculum's order and the category list, built once.
 */
export const SCHEDULE: readonly ScheduleStep[] = buildSchedule();

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
