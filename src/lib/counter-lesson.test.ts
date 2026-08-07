// Run: node --import ./src/lib/conjugate/test-hooks.mjs --test \
//        src/lib/counter-lesson.test.ts
//
// WHAT THESE TESTS ARE FOR
// ========================
// The counters track is `word` facts with a track label, scheduled by a walk
// over COUNTER_CURRICULUM plus the generative CATEGORY units. The approved shape:
// 〜つ and the Sino numbers 1-10 are memorised kana forms; everything past that —
// the number ranges (11-99, 100-9999) and every object counter (人, 本, 匹, 枚,
// and the tail) — is a GENERATIVE UNIT (a rule card, then a generated round),
// gated by a marker rather than a run of forms. The only memorised material past
// the numbers is 二十歳 はたち, the one reading no category can build.
//
// THE NUMBER KANJI ARE NOW TAUGHT IN-TRACK, KEIGO-STYLE. There is no number-kanji
// gate any more: a form or unit is always reachable, and its unknown kanji (and
// their radical components, the full chain) ride into the lesson as PREREQ tiles
// prepended to the lesson's own facts, cost-budgeted the keigo way. These pin the
// ORDER, the prereqs-before-kanji-before-kana walk, the cost-budget packing, and
// that a heavy counter teaches its kanji chain ahead of its rule card.

import assert from "node:assert/strict";
import { describe, test } from "node:test";

import {
  COUNTER_CURRICULUM,
  NUMBER_UNIT_BIG_MARKER,
  NUMBER_UNIT_MARKERS,
  NUMBER_UNIT_TENS_MARKER,
  constructionMarker,
  counterKanjiPrereqs,
  counterMeaningFactId,
  isKanaForm,
  isNumberUnitMarker,
} from "../data/counters.ts";
import { meaningFactId as kanjiMeaningFactId } from "../data/kanji.ts";
import { radicalMeaningFactId } from "../data/radicals.ts";
import { COUNTER_SOUND_CHANGE, NUMBERS_BIG, NUMBERS_COMPOSE } from "../data/phase-intros.ts";
import { LESSON_RANGE_DEFAULT } from "./lesson-sizing.ts";
import { lessonSteps } from "./lesson-steps.ts";
import {
  COUNTERS_CURRICULUM_TOTAL,
  GENERATIVE_UNITS,
  NUMBER_UNITS,
  hasStartedCountersTrack,
  nextCounterLesson,
  type CounterLesson,
} from "./counter-lesson.ts";
import type { FactId, HistoryFile } from "../types/index.ts";

const AT = Date.UTC(2026, 0, 1);

function history(over: Partial<HistoryFile> = {}): HistoryFile {
  return { sessions: [], facts: {}, claims: {}, ...over };
}

/** Claim these facts known — the cheap way to move history forward, mirroring
 * /api/claim. A claim is non-fresh, so it satisfies both "kanji known" and
 * "counter met". */
function claiming(facts: readonly FactId[]): HistoryFile {
  const claims: Record<string, number> = {};
  for (const f of facts) claims[f] = AT;
  return history({ claims: claims as HistoryFile["claims"] });
}

/** Claim every fact a lesson seeds (its prereq kanji/radicals AND its own facts
 * or marker) on top of an existing history — the "Start and finish" move the app
 * makes, so the next call sees this lesson as done. */
function claimLesson(hist: HistoryFile, lesson: CounterLesson): HistoryFile {
  const claims = { ...(hist.claims ?? {}) } as Record<string, number>;
  for (const f of lesson.facts) claims[f] = AT;
  return { ...hist, claims: claims as HistoryFile["claims"] };
}

/** Walk the scheduler forward, claiming each lesson, and return the first lesson
 * for which `hit` is true (along with the history that PRECEDED it). Guards
 * against a runaway if the predicate never matches. */
function advanceUntil(
  hit: (l: CounterLesson) => boolean,
): { before: HistoryFile; lesson: CounterLesson } {
  let hist = history();
  for (let i = 0; i < 100; i++) {
    const lesson = nextCounterLesson(hist);
    assert.ok(lesson, "the scheduler ran out before the predicate matched");
    if (hit(lesson)) return { before: hist, lesson };
    hist = claimLesson(hist, lesson);
  }
  throw new Error("advanceUntil: predicate never matched");
}

/** Every lesson the track hands out, start to finish. */
function allLessons(): CounterLesson[] {
  let hist = history();
  const out: CounterLesson[] = [];
  for (let i = 0; i < 100; i++) {
    const lesson = nextCounterLesson(hist);
    if (!lesson) break;
    out.push(lesson);
    hist = claimLesson(hist, lesson);
  }
  return out;
}

const phase1 = COUNTER_CURRICULUM.filter((f) => f.phase === 1);
const phase1Met = phase1.map(counterMeaningFactId);
const byGlyph = (g: string) => COUNTER_CURRICULUM.find((f) => f.glyph === g)!;

// The bare numbers 1-10 plus 〜つ — everything the scheduler teaches BEFORE the
// generative units.
const numbersDone = COUNTER_CURRICULUM.filter(
  (f) => f.counter === "" || f.counter === "つ",
).map(counterMeaningFactId);
const bothMarkers = [...NUMBER_UNIT_MARKERS];

/** The glyphs a lesson's teach walk steps through, in order — the item cards
 * (kanji/radical prereqs and the forms) by glyph, skipping intro cards. */
function walkGlyphs(lesson: CounterLesson): string[] {
  return lessonSteps(lesson.facts, history())
    .filter((s) => s.type === "item")
    .map((s) => (s.type === "item" ? s.item.glyph : ""));
}

describe("phase 1 carries no number-kanji data, and nothing gates on kanji", () => {
  test("every phase-1 form is kana with no number-kanji datum", () => {
    for (const f of phase1) {
      assert.ok(isKanaForm(f), `${f.glyph} is phase 1 but not kana`);
      assert.deepEqual(counterKanjiPrereqs(f), [], `${f.glyph} carries a number kanji`);
    }
  });

  test("二十歳 keeps its number-kanji datum (二) but it no longer gates", () => {
    // It reads はたち, not the plain number + 歳, so it ships as a form and keeps
    // 二 as data. With the gate gone it is simply the last scheduled form, taught
    // after the 〜歳 unit — never stepped over for want of a kanji.
    const hatachi = byGlyph("二十歳");
    assert.deepEqual(counterKanjiPrereqs(hatachi), ["二"]);
    const last = allLessons().at(-1)!;
    assert.equal(last.cards[0].glyph, "二十歳");
  });
});

describe("the schedule", () => {
  test("with no history it opens on 〜つ, all kana, no prereqs", () => {
    const lesson = nextCounterLesson(history());
    assert.ok(lesson, "a first counters lesson exists straight after kana");
    // 〜つ leads the curriculum, so the first card is ひとつ, a kana form (no
    // reading line, no prereq tiles — 〜つ needs no kanji).
    assert.equal(lesson!.cards[0].glyph, "ひとつ");
    assert.equal(lesson!.cards[0].reading, null);
    assert.deepEqual(lesson!.cardPrereqTiles[0], []);
    assert.equal(lesson!.position.from, 1);
    assert.equal(lesson!.position.total, COUNTERS_CURRICULUM_TOTAL);
  });

  test("phase-1 forms + the two range units done → the 〜人 unit is due, ungated", () => {
    const lesson = nextCounterLesson(claiming([...phase1Met, ...bothMarkers]));
    assert.ok(lesson?.numberUnit, "the 〜人 unit is due");
    assert.equal(lesson!.numberUnit!.marker, constructionMarker("nin"));
    assert.equal(lesson!.numberUnit!.mode, "number-reading");
  });

  test("a learner with no counters history has not started the track", () => {
    assert.ok(!hasStartedCountersTrack(history()));
    assert.ok(hasStartedCountersTrack(claiming([counterMeaningFactId(phase1[0])])));
  });
});

describe("the track opens with exactly one intro", () => {
  test("the first counters lesson fires one track-counters card and no spine card", () => {
    const lesson = nextCounterLesson(history())!;
    const steps = lessonSteps(lesson.facts, history());
    const intros = steps.filter(
      (s) => s.type === "intro" && s.intro.id === "track-counters",
    );
    assert.equal(intros.length, 1, "exactly one track-counters intro");
    // A phase-1 〜つ lesson is all kana forms: no prereq kanji, so no sound-change
    // card and no spine (radical/kanji/word) card fires here.
    assert.ok(
      steps.every((s) => s.type !== "intro" || s.intro.id !== COUNTER_SOUND_CHANGE.id),
    );
    assert.ok(
      steps.every(
        (s) =>
          s.type !== "intro" ||
          !["track-radical", "track-kanji", "track-word"].includes(s.intro.id),
      ),
      "a counters lesson does not fire a spine card for its prereq kanji",
    );
  });
});

describe("the rote counted forms are gone", () => {
  test("no bare number past 10, and no 一本…十本 style form, remains", () => {
    const keys = new Set(COUNTER_CURRICULUM.map((f) => f.key));
    for (const k of [
      "counter:num:11",
      "counter:num:20",
      "counter:num:100",
      "counter:hon:1",
      "counter:hon:10",
      "counter:hiki:3",
      "counter:mai:1",
      "counter:ko:1",
    ]) {
      assert.ok(!keys.has(k), `${k} should be removed from the curriculum`);
    }
    const counted = COUNTER_CURRICULUM.filter((f) => !isKanaForm(f)).map((f) => f.glyph);
    assert.deepEqual(counted, ["二十歳"]);
  });
});

describe("prereqs before their kanji, kanji before the kana that uses them", () => {
  test("a number lesson teaches each number kanji ahead of its kana reading", () => {
    // The lesson that first teaches 一: its 一 kanji card precedes the いち card.
    const { lesson } = advanceUntil((l) =>
      l.cardPrereqTiles.some((ts) => ts.some((t) => t.glyph === "一")),
    );
    const glyphs = walkGlyphs(lesson);
    assert.ok(glyphs.includes("一") && glyphs.includes("いち"));
    assert.ok(
      glyphs.indexOf("一") < glyphs.indexOf("いち"),
      "the kanji 一 is taught before the kana いち",
    );
  });

  test("a radical prereq is taught before the kanji it builds", () => {
    // 四 is built from 囗 and 儿; the lesson that teaches 四 teaches those radicals
    // first, then 四, then the kana form よん.
    const { lesson } = advanceUntil((l) =>
      l.cardPrereqTiles.some((ts) => ts.some((t) => t.glyph === "四")),
    );
    const glyphs = walkGlyphs(lesson);
    for (const rad of ["囗", "儿"]) {
      assert.ok(glyphs.includes(rad), `${rad} is taught`);
      assert.ok(glyphs.indexOf(rad) < glyphs.indexOf("四"), `${rad} precedes 四`);
    }
    assert.ok(glyphs.indexOf("四") < glyphs.indexOf("よん"), "四 precedes よん");
  });

  test("the number kanji reuse the kanji track's meaning fact (no new mint)", () => {
    // The 一 prereq tile seeds meaningFactId('一'), the kanji track's own fact, so
    // the two dedupe: a learner who already met 一 gets no 一 tile.
    const { lesson } = advanceUntil((l) =>
      l.cardPrereqTiles.some((ts) => ts.some((t) => t.glyph === "一")),
    );
    assert.ok(lesson.facts.includes(kanjiMeaningFactId("一")));
    const withKanji = claiming([kanjiMeaningFactId("一")]);
    const first = nextCounterLesson(withKanji)!;
    // 一 already known → no 一 tile even where it would otherwise appear.
    assert.ok(
      first.cardPrereqTiles.every((ts) => ts.every((t) => t.glyph !== "一")),
      "a known 一 is not re-taught as a prereq",
    );
  });
});

describe("the cost budget packs a sitting up to the lesson max", () => {
  test("a number sitting packs several numbers at once, never blowing the max", () => {
    // The budget is not one-number-at-a-time: the first number lesson packs more
    // than one number, and no sitting exceeds LESSON_RANGE_DEFAULT.max items.
    const { lesson } = advanceUntil((l) =>
      l.cardPrereqTiles.some((ts) => ts.some((t) => t.glyph === "一")),
    );
    assert.ok(lesson.cards.length >= 2, "the budget packs several numbers into one sitting");
    for (const l of allLessons()) {
      if (l.numberUnit) continue; // a unit is its own boundary
      assert.ok(
        l.cards.length <= LESSON_RANGE_DEFAULT.max,
        "a form sitting never exceeds the item max",
      );
    }
  });

  test("〜つ packs into a single sitting (uniform, cheap, no prereqs)", () => {
    const first = nextCounterLesson(history())!;
    assert.ok(first.cards.every((c) => c.counter === "つ"), "the first sitting is all 〜つ");
    assert.ok(first.cards.length > 5, "〜つ is not capped at the old fixed 5");
  });
});

describe("a heavy counter teaches its kanji chain ahead of its rule card", () => {
  test("〜個 pulls 口 古 固 個 and teaches them before the 〜個 rule", () => {
    const { lesson } = advanceUntil(
      (l) => l.numberUnit?.marker === constructionMarker("ko"),
    );
    const tiles = lesson.cardPrereqTiles[0].map((t) => t.glyph);
    for (const g of ["口", "古", "固", "個"]) {
      assert.ok(tiles.includes(g), `〜個 teaches ${g}`);
    }
    // The teach walk shows the kanji chain as item cards, THEN the rule card.
    const steps = lessonSteps(lesson.facts, history());
    const lastItem = steps.map((s) => s.type).lastIndexOf("item");
    const ruleAt = steps.findIndex(
      (s) => s.type === "intro" && s.intro.id === "intro-counter-ko",
    );
    assert.ok(ruleAt >= 0, "the 〜個 rule card is in the walk");
    assert.ok(lastItem < ruleAt, "every kanji item precedes the rule card");
    // The marker is last so completing the lesson claims the range taught.
    assert.equal(lesson.facts.at(-1), constructionMarker("ko"));
  });
});

describe("the generative units", () => {
  test("the number-range markers are claimable pseudo-facts, never real forms", () => {
    assert.ok(isNumberUnitMarker(NUMBER_UNIT_TENS_MARKER));
    assert.ok(isNumberUnitMarker(NUMBER_UNIT_BIG_MARKER));
    assert.deepEqual([...NUMBER_UNIT_MARKERS], [
      NUMBER_UNIT_TENS_MARKER,
      NUMBER_UNIT_BIG_MARKER,
    ]);
    for (const f of COUNTER_CURRICULUM) {
      assert.ok(!isNumberUnitMarker(counterMeaningFactId(f)));
    }
  });

  test("there is a unit per range and per counter, all number-reading mode", () => {
    assert.equal(GENERATIVE_UNITS.length, 12);
    assert.equal(NUMBER_UNITS.length, 2);
    for (const u of GENERATIVE_UNITS) assert.equal(u.mode, "number-reading");
  });

  test("a marker-only teach walk is the rule card ALONE (formless)", () => {
    // With only the marker in the fact list (no prereqs), the walk is one card.
    const tens = lessonSteps([NUMBER_UNIT_TENS_MARKER], history());
    assert.equal(tens.length, 1);
    assert.ok(tens[0].type === "intro" && tens[0].intro.id === NUMBERS_COMPOSE.id);
    const hon = lessonSteps([constructionMarker("hon")], history());
    assert.equal(hon.length, 1);
    assert.ok(hon[0].type === "intro" && hon[0].intro.id === "intro-counter-hon");
  });

  test("the tens unit is due right after 1-10 and needs no kanji", () => {
    const lesson = nextCounterLesson(claiming(numbersDone));
    assert.ok(lesson?.numberUnit, "a generative unit lesson, not a form lesson");
    assert.equal(lesson!.numberUnit!.marker, NUMBER_UNIT_TENS_MARKER);
    assert.equal(lesson!.numberUnit!.intro.id, NUMBERS_COMPOSE.id);
    assert.equal(lesson!.numberUnit!.config.numberMax, 99);
    assert.equal(lesson!.numberUnit!.config.includeCounters, false);
    // tens is the one unit with no new kanji: the numbers already taught them.
    assert.deepEqual(lesson!.facts, [NUMBER_UNIT_TENS_MARKER]);
    assert.deepEqual(lesson!.cardPrereqTiles[0], []);
    assert.equal(lesson!.position.from, numbersDone.length + 1);
    assert.equal(lesson!.position.total, COUNTERS_CURRICULUM_TOTAL);
  });

  test("the big unit teaches 百千万 before its rule and ends on its marker", () => {
    const lesson = nextCounterLesson(
      claiming([...numbersDone, NUMBER_UNIT_TENS_MARKER]),
    )!;
    assert.ok(lesson.numberUnit, "the big unit is now due");
    assert.equal(lesson.numberUnit!.marker, NUMBER_UNIT_BIG_MARKER);
    assert.equal(lesson.numberUnit!.intro.id, NUMBERS_BIG.id);
    // Prereqs first (百 千 万 and their chain), the marker last.
    const tiles = lesson.cardPrereqTiles[0].map((t) => t.glyph);
    for (const g of ["百", "千", "万"]) assert.ok(tiles.includes(g), `big teaches ${g}`);
    assert.equal(lesson.facts.at(-1), NUMBER_UNIT_BIG_MARKER);
    assert.ok(lesson.facts.includes(kanjiMeaningFactId("百")));
    assert.equal(lesson.position.from, numbersDone.length + 2);
  });

  test("claiming BOTH range markers advances the scheduler to the 〜人 unit", () => {
    const lesson = nextCounterLesson(
      claiming([...numbersDone, NUMBER_UNIT_TENS_MARKER, NUMBER_UNIT_BIG_MARKER]),
    );
    assert.ok(lesson?.numberUnit, "the 〜人 unit is now due");
    assert.equal(lesson!.numberUnit!.marker, constructionMarker("nin"));
    assert.equal(lesson!.numberUnit!.config.includeCounters, true);
    assert.deepEqual(lesson!.numberUnit!.config.counters, ["nin"]);
    assert.equal(lesson!.position.from, numbersDone.length + NUMBER_UNITS.length + 1);
  });

  test("〜人 has NO rote form lesson — claiming it advances to the next counter unit", () => {
    const lesson = nextCounterLesson(
      claiming([...numbersDone, ...bothMarkers, constructionMarker("nin")]),
    );
    assert.ok(lesson, "a lesson exists");
    assert.ok(lesson!.numberUnit, "a generative unit, not a form lesson");
    assert.equal(lesson!.numberUnit!.marker, constructionMarker("hon"));
  });
});

describe("the whole track is finite and content-counted", () => {
  test("it terminates, ending on 二十歳, with the position denominator content-only", () => {
    const lessons = allLessons();
    assert.ok(lessons.length > 0);
    const last = lessons.at(-1)!;
    assert.equal(last.cards[0].glyph, "二十歳");
    // The denominator counts content (forms + units), never the prereq tiles.
    assert.equal(last.position.total, COUNTERS_CURRICULUM_TOTAL);
    assert.equal(last.position.to, COUNTERS_CURRICULUM_TOTAL);
    // Every form and unit is reached exactly once across the run.
    const formsAndUnits = lessons.reduce(
      (n, l) => n + (l.numberUnit ? 1 : l.cards.length),
      0,
    );
    assert.equal(formsAndUnits, COUNTERS_CURRICULUM_TOTAL);
  });
});

// A radical prereq's fact is the radical meaning fact, so it dedupes against the
// radical track the same way the kanji tiles dedupe against the kanji track.
describe("prereq facts are the real kanji/radical meaning facts", () => {
  test("a 囗 radical tile seeds radicalMeaningFactId('囗')", () => {
    const { lesson } = advanceUntil((l) =>
      l.cardPrereqTiles.some((ts) => ts.some((t) => t.glyph === "囗")),
    );
    assert.ok(lesson.facts.includes(radicalMeaningFactId("囗")));
  });
});
