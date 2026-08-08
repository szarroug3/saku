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
import { effectiveState } from "./claims.ts";

import {
  COUNTER_CURRICULUM,
  NUMBER_UNIT_BIG_MARKER,
  NUMBER_UNIT_MARKERS,
  NUMBER_UNIT_TENS_MARKER,
  constructionMarker,
  counterEntry,
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
  unitContentCost,
  type CounterLesson,
} from "./counter-lesson.ts";
import type { FactId, HistoryFile } from "../types/index.ts";

const AT = Date.UTC(2026, 0, 1);

/** The range every scheduler call is budgeted against unless a test overrides it
 * — the shipped default (5–7), so these tests pin what a fresh learner gets. */
const RANGE = LESSON_RANGE_DEFAULT;

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

function isFresh(fact: FactId, hist: HistoryFile): boolean {
  const state = effectiveState(
    hist.facts[fact],
    hist.claims?.[fact],
    hist.seen?.[fact],
  );
  return state.lastTested === 0;
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
  range = RANGE,
): { before: HistoryFile; lesson: CounterLesson } {
  let hist = history();
  for (let i = 0; i < 100; i++) {
    const lesson = nextCounterLesson(hist, range);
    assert.ok(lesson, "the scheduler ran out before the predicate matched");
    if (hit(lesson)) return { before: hist, lesson };
    hist = claimLesson(hist, lesson);
  }
  throw new Error("advanceUntil: predicate never matched");
}

/** Every lesson the track hands out, start to finish. */
function allLessons(range = RANGE): CounterLesson[] {
  let hist = history();
  const out: CounterLesson[] = [];
  for (let i = 0; i < 100; i++) {
    const lesson = nextCounterLesson(hist, range);
    if (!lesson) break;
    out.push(lesson);
    hist = claimLesson(hist, lesson);
  }
  return out;
}

/** Claim lessons from `start` until the lesson that carries `marker` as its
 * numberUnit marker appears. Returns every visited lesson (including the marker
 * lesson) and the marker lesson itself. */
function lessonsThroughMarker(
  start: HistoryFile,
  marker: FactId,
  range = RANGE,
): { lessons: CounterLesson[]; markerLesson: CounterLesson } {
  let hist = start;
  const lessons: CounterLesson[] = [];
  for (let i = 0; i < 100; i++) {
    const lesson = nextCounterLesson(hist, range);
    assert.ok(lesson, `expected a lesson before reaching ${marker}`);
    lessons.push(lesson!);
    if (lesson!.numberUnit?.marker === marker && lesson!.facts.includes(marker)) {
      return { lessons, markerLesson: lesson! };
    }
    hist = claimLesson(hist, lesson!);
  }
  throw new Error(`marker lesson not reached: ${marker}`);
}

const phase1 = COUNTER_CURRICULUM.filter((f) => f.phase === 1);
const phase1Met = phase1.map(counterMeaningFactId);
const byGlyph = (g: string) => COUNTER_CURRICULUM.find((f) => f.glyph === g)!;

// The 〜つ forms — everything the scheduler teaches as a FORM before the generative
// units. (The Sino numbers 1-10 are no longer rote forms; the tens unit teaches
// their kanji, and the words track teaches their reading via the kanji's word role.)
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
    const lesson = nextCounterLesson(history(), RANGE);
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
    const start = claiming([...phase1Met, ...bothMarkers]);
    const lesson = nextCounterLesson(start, RANGE);
    assert.ok(lesson, "a counters lesson exists");
    assert.equal(
      lesson!.position.from,
      phase1Met.length + 1,
      "claimed markers without prereqs keep the tens unit due for backfill",
    );
    const { markerLesson } = lessonsThroughMarker(start, constructionMarker("nin"), RANGE);
    assert.equal(markerLesson.numberUnit!.marker, constructionMarker("nin"));
    assert.equal(markerLesson.numberUnit!.mode, "number-reading");
  });

  test("a learner with no counters history has not started the track", () => {
    assert.ok(!hasStartedCountersTrack(history()));
    assert.ok(hasStartedCountersTrack(claiming([counterMeaningFactId(phase1[0])])));
  });

  test("legacy markers without number-kanji prereqs still resurface the tens unit", () => {
    // Legacy progress can carry counter:gen:tens/big markers while number-kanji
    // prereqs are still unknown. The scheduler must backfill those prereqs before
    // moving on to the first counter unit.
    const legacy = claiming([
      ...phase1Met,
      NUMBER_UNIT_TENS_MARKER,
      NUMBER_UNIT_BIG_MARKER,
    ]);
    const lesson = nextCounterLesson(legacy, RANGE);
    assert.ok(lesson, "a backfill lesson exists");
    assert.equal(
      lesson!.position.from,
      phase1Met.length + 1,
      "the next due content is still the tens unit",
    );
    assert.ok(
      lesson!.cardPrereqTiles.some((ts) => ts.some((t) => t.glyph === "一")),
      "number-kanji prereqs are re-introduced",
    );
  });
});

describe("the track opens with exactly one intro", () => {
  test("the first counters lesson fires one track-counters card and no spine card", () => {
    const lesson = nextCounterLesson(history(), RANGE)!;
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

describe("the tens unit teaches the number kanji as whole items", () => {
  test("the tens unit teaches the Sino number kanji 一…十 as prereqs", () => {
    // The Sino numbers are no longer rote kana forms; the tens unit (the first
    // material that spells a number in kanji) teaches 一…十 ahead of its rule card.
    const { lessons, markerLesson } = lessonsThroughMarker(
      claiming(numbersDone),
      NUMBER_UNIT_TENS_MARKER,
      RANGE,
    );
    const glyphs = lessons.flatMap((l) => walkGlyphs(l));
    assert.equal(markerLesson.numberUnit!.marker, NUMBER_UNIT_TENS_MARKER);
    for (const k of ["一", "二", "三", "四", "五", "六", "七", "八", "九", "十"]) {
      assert.ok(glyphs.includes(k), `the tens unit teaches ${k}`);
    }
  });

  test("a number kanji is taught whole — none of its shape pieces ride along", () => {
    // Number kanji are memorised wholes: 四 is taught as its own tile with NO 囗/儿
    // sub-tiles, 六 with no 亠/八, and so on. The shape-only pieces that used to
    // ride the tens unit are gone (see src/data/number-kanji.ts).
    const { lessons } = lessonsThroughMarker(
      claiming(numbersDone),
      NUMBER_UNIT_TENS_MARKER,
      RANGE,
    );
    const glyphs = lessons.flatMap((l) => walkGlyphs(l));
    for (const piece of ["囗", "儿", "亠", "丿", "乙"]) {
      assert.ok(!glyphs.includes(piece), `${piece} is NOT taught as a number-kanji piece`);
    }
    // Every number tile is a Kanji tile — no Radical sub-tiles among them.
    const numberTiles = lessons
      .flatMap((l) => l.cardPrereqTiles)
      .flat()
      .filter((t) => ["一", "二", "三", "四", "五", "六", "七", "八", "九", "十"].includes(t.glyph));
    assert.equal(numberTiles.length, 10, "all ten number kanji are taught");
    assert.ok(numberTiles.every((t) => t.type === "Kanji"), "each is a whole kanji tile");
  });

  test("the number kanji reuse the kanji track's meaning fact (no new mint)", () => {
    // The 一 prereq tile seeds meaningFactId('一'), the kanji track's own fact, so
    // the two dedupe: a learner who already met 一 gets no 一 tile.
    const { lesson } = advanceUntil((l) =>
      l.cardPrereqTiles.some((ts) => ts.some((t) => t.glyph === "一")),
    );
    assert.ok(lesson.facts.includes(kanjiMeaningFactId("一")));
    const withKanji = claiming([kanjiMeaningFactId("一")]);
    const first = nextCounterLesson(withKanji, RANGE)!;
    // 一 already known → no 一 tile even where it would otherwise appear.
    assert.ok(
      first.cardPrereqTiles.every((ts) => ts.every((t) => t.glyph !== "一")),
      "a known 一 is not re-taught as a prereq",
    );
  });
});

describe("the cost budget packs a sitting up to the lesson max", () => {
  test("the budget is not one-form-at-a-time, and never blows the max", () => {
    // Some form sittings pack more than one form (〜つ forms ride together at 5–7),
    // proving the budget packs rather than emitting one form per lesson; and no
    // form sitting ever exceeds the configured max.
    const formLessons = allLessons().filter((l) => !l.numberUnit);
    assert.ok(
      formLessons.some((l) => l.cards.length >= 2),
      "at least one form sitting packs two or more forms",
    );
    for (const l of formLessons) {
      assert.ok(
        l.cards.length <= RANGE.max,
        "a form sitting never exceeds the item max",
      );
    }
  });

  test("the 〜つ run SPLITS across lessons to honour max (not one 10-item lesson)", () => {
    // 〜つ is ten memorised kana forms at one cost each. The form-run budget adds
    // them one at a time and closes the sitting when the next would pass max, so
    // at the 5–7 default the ten forms land across more than one lesson — never
    // the single 10-item sitting the old max of 12 produced.
    const first = nextCounterLesson(history(), RANGE)!;
    assert.ok(first.cards.every((c) => c.counter === "つ"), "the first sitting is all 〜つ");
    assert.ok(
      first.cards.length <= RANGE.max,
      `the first 〜つ sitting honours max (${first.cards.length} <= ${RANGE.max})`,
    );
    assert.ok(first.cards.length < 10, "the ten 〜つ forms are NOT one lesson at 5–7");

    // Count 〜つ cards per lesson: the run spreads over at least two lessons, and
    // every one of the ten forms is taught exactly once across the split.
    const tsuByLesson = allLessons().map((l) =>
      l.numberUnit ? 0 : l.cards.filter((c) => c.counter === "つ").length,
    );
    assert.ok(
      tsuByLesson.filter((n) => n > 0).length >= 2,
      "the 〜つ run spans at least two lessons at 5–7",
    );
    assert.equal(
      tsuByLesson.reduce((a, b) => a + b, 0),
      10,
      "all ten 〜つ forms are taught across the split",
    );
  });

  test("a custom cfg range changes how many 〜つ forms a sitting holds", () => {
    // The scheduler honours the caller's range, not a hardcoded default: a wide
    // range fits all ten 〜つ in one sitting, a narrow one takes only three.
    const wide = nextCounterLesson(history(), { min: 8, max: 10 })!;
    const narrow = nextCounterLesson(history(), { min: 2, max: 3 })!;
    assert.ok(wide.cards.every((c) => c.counter === "つ"));
    assert.ok(narrow.cards.every((c) => c.counter === "つ"));
    assert.equal(wide.cards.length, 10, "max 10 fits all ten 〜つ");
    assert.equal(narrow.cards.length, 3, "max 3 takes three 〜つ");
    assert.ok(wide.cards.length > narrow.cards.length);
  });
});

describe("a generative unit's content cost is 1 + its irregular count", () => {
  const unit = (id: string) => GENERATIVE_UNITS.find((u) => u.id === id)!;
  test("a counter costs one for its rule plus one per sound-shift irregular", () => {
    assert.equal(unitContentCost(unit("nin")), 4, "〜人 has 3 irregulars → 4");
    assert.equal(unitContentCost(unit("hon")), 6, "〜本 has 5 irregulars → 6");
    assert.equal(unitContentCost(unit("hiki")), 6, "〜匹 has 5 irregulars → 6");
    assert.equal(unitContentCost(unit("mai")), 1, "〜枚 has no shifts → 1");
    assert.equal(unitContentCost(unit("dai")), 1, "〜台 has no shifts → 1");
  });
  test("the number-range units read their irregular count from the same table", () => {
    assert.equal(unitContentCost(unit("tens")), 1, "11–99 is all regular → 1");
    assert.equal(unitContentCost(unit("big")), 6, "the big range hardens at 5 seams → 6");
  });
});

describe("a heavy counter teaches its kanji chain ahead of its rule card", () => {
  test("〜個 pulls 古 固 個 and teaches them before the 〜個 rule", () => {
    const { lessons, markerLesson } = lessonsThroughMarker(
      history(),
      constructionMarker("ko"),
      RANGE,
    );
    const tiles = lessons.flatMap((l) => l.cardPrereqTiles.flat().map((t) => t.glyph));
    // Prereqs are the ETYMOLOGY pieces now, not the raw shape decomposition:
    // 個 owes 固, 固 owes 古 (and the 囗 radical), and 古's own glyph origin
    // assigns no piece a role, so it is taught whole — 口 is no longer pulled in
    // under it. The chain 古 → 固 → 個 still arrives before the 〜個 rule.
    for (const g of ["古", "固", "個"]) {
      assert.ok(tiles.includes(g), `〜個 teaches ${g}`);
    }
    // The teach walk shows the kanji chain as item cards, THEN the rule card.
    const steps = lessonSteps(markerLesson.facts, history());
    const lastItem = steps.map((s) => s.type).lastIndexOf("item");
    const ruleAt = steps.findIndex(
      (s) => s.type === "intro" && s.intro.id === "intro-counter-ko",
    );
    assert.ok(ruleAt >= 0, "the 〜個 rule card is in the walk");
    assert.ok(lastItem < ruleAt, "every kanji item precedes the rule card");
    // The marker is last so completing the lesson claims the range taught.
    assert.equal(markerLesson.facts.at(-1), constructionMarker("ko"));
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

  test("the tens unit is due after 〜つ and teaches the number kanji 一…十", () => {
    const first = nextCounterLesson(claiming(numbersDone), RANGE)!;
    // With the default 5-7 range, the full 一…十 prereq chain no longer fits in one
    // sitting, so the unit may start with prereq-only lessons.
    assert.ok(first.numberUnit, "the first tens lesson is a unit-backed prereq slice");
    assert.ok(first.numberUnit!.prepOnly, "the first tens slice is prep-only");
    assert.ok(first.cardPrereqTiles[0].length > 0, "it still teaches number kanji prereqs");
    assert.equal(first.position.from, numbersDone.length + 1);
    assert.equal(first.position.total, COUNTERS_CURRICULUM_TOTAL);

    // Claim through the prereq split until the marker lesson appears.
    let hist = claiming(numbersDone);
    let markerLesson: CounterLesson | null = null;
    for (let i = 0; i < 10; i++) {
      const lesson = nextCounterLesson(hist, RANGE)!;
      if (
        lesson.numberUnit?.marker === NUMBER_UNIT_TENS_MARKER &&
        lesson.facts.includes(NUMBER_UNIT_TENS_MARKER)
      ) {
        markerLesson = lesson;
        break;
      }
      hist = claimLesson(hist, lesson);
    }
    assert.ok(markerLesson, "the marker lesson appears after prereq lessons");
    assert.ok(!markerLesson!.numberUnit!.prepOnly, "the marker lesson is the real unit lesson");
    assert.equal(markerLesson!.numberUnit!.intro.id, NUMBERS_COMPOSE.id);
    assert.equal(markerLesson!.numberUnit!.config.numberMax, 99);
    assert.equal(markerLesson!.numberUnit!.config.includeCounters, false);
    assert.equal(markerLesson!.facts.at(-1), NUMBER_UNIT_TENS_MARKER);
  });

  test("the big unit teaches 百千万 before its rule and ends on its marker", () => {
    // As with tens, the first due lesson may be prereq-only at a tight range.
    const first = nextCounterLesson(
      claiming([...numbersDone, NUMBER_UNIT_TENS_MARKER]),
      RANGE,
    )!;
    assert.equal(first.position.from, numbersDone.length + 1);

    let hist = claiming([...numbersDone, NUMBER_UNIT_TENS_MARKER]);
    let markerLesson: CounterLesson | null = null;
    for (let i = 0; i < 10; i++) {
      const lesson = nextCounterLesson(hist, RANGE)!;
      if (
        lesson.numberUnit?.marker === NUMBER_UNIT_BIG_MARKER &&
        lesson.facts.includes(NUMBER_UNIT_BIG_MARKER)
      ) {
        markerLesson = lesson;
        break;
      }
      hist = claimLesson(hist, lesson);
    }
    assert.ok(markerLesson, "the big marker lesson appears after prereq lessons");
    assert.equal(markerLesson!.numberUnit!.intro.id, NUMBERS_BIG.id);
    assert.equal(markerLesson!.facts.at(-1), NUMBER_UNIT_BIG_MARKER);
  });

  test("claiming BOTH range markers advances the scheduler to the 〜人 unit", () => {
    const start = claiming([...numbersDone, NUMBER_UNIT_TENS_MARKER, NUMBER_UNIT_BIG_MARKER]);
    const lesson = nextCounterLesson(start, RANGE);
    assert.ok(lesson, "the 〜人 unit path is due");
    assert.equal(lesson!.position.from, numbersDone.length + 1);
    const { markerLesson } = lessonsThroughMarker(start, constructionMarker("nin"), RANGE);
    assert.equal(markerLesson.numberUnit!.marker, constructionMarker("nin"));
    assert.equal(markerLesson.numberUnit!.config.includeCounters, true);
    assert.deepEqual(markerLesson.numberUnit!.config.counters, ["nin"]);
  });

  test("〜人 has NO rote form lesson — claiming it advances to the next counter unit", () => {
    const start = claiming([...numbersDone, ...bothMarkers, constructionMarker("nin")]);
    const { markerLesson } = lessonsThroughMarker(start, constructionMarker("hon"), RANGE);
    assert.equal(markerLesson.numberUnit!.marker, constructionMarker("hon"));
  });

  test("every counters lesson respects max cost, including unit prep and unit marker lessons", () => {
    const lessons = allLessons(RANGE);
    for (const lesson of lessons) {
      const cost = lesson.facts.reduce((sum, fact) => {
        if (isNumberUnitMarker(fact)) {
          const unit = GENERATIVE_UNITS.find((u) => u.marker === fact);
          return sum + (unit ? unitContentCost(unit) : 0);
        }
        return sum + 1;
      }, 0);
      assert.ok(
        cost <= RANGE.max,
        `lesson cost ${cost} should not exceed max ${RANGE.max}`,
      );
    }
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
    // Finishing the whole run claims every content step exactly once: every form
    // meaning fact and every unit marker is non-fresh.
    const end = lessons.reduce((h, l) => claimLesson(h, l), history());
    for (const f of COUNTER_CURRICULUM) {
      assert.ok(!isFresh(counterMeaningFactId(f), end));
    }
    for (const u of GENERATIVE_UNITS) {
      assert.ok(!isFresh(u.marker, end));
    }
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
