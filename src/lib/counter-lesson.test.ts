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
// gated by a marker rather than a run of forms and needing no number kanji. The
// only memorised material past the numbers is 二十歳 はたち, the one reading no
// category can build (〜人's ひとり/ふたり/よにん are taught by the 〜人 category now,
// not as rote forms). These pin the ORDER, the single track intro, and that the
// rote forms are gone.

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
import { COUNTER_SOUND_CHANGE, NUMBERS_BIG, NUMBERS_COMPOSE } from "../data/phase-intros.ts";
import { lessonSteps } from "./lesson-steps.ts";
import {
  COUNTERS_CURRICULUM_TOTAL,
  GENERATIVE_UNITS,
  NUMBER_UNITS,
  counterTeachable,
  hasStartedCountersTrack,
  nextCounterLesson,
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

const phase1 = COUNTER_CURRICULUM.filter((f) => f.phase === 1);
const phase1Met = phase1.map(counterMeaningFactId);
const byGlyph = (g: string) => COUNTER_CURRICULUM.find((f) => f.glyph === g)!;

// The bare numbers 1-10 plus 〜つ — everything the scheduler teaches BEFORE the
// generative units. Claiming their meaning facts (and, where noted, the unit
// markers) is how a test moves history past the numbers.
const numbersDone = COUNTER_CURRICULUM.filter(
  (f) => f.counter === "" || f.counter === "つ",
).map(counterMeaningFactId);
const bothMarkers = [...NUMBER_UNIT_MARKERS];

describe("the gate: phase 1 and the units need no kanji", () => {
  test("every phase-1 form is teachable with no kanji known", () => {
    for (const f of phase1) {
      assert.deepEqual(counterKanjiPrereqs(f), []);
      assert.ok(counterTeachable(f, history()), `${f.glyph} should be teachable`);
    }
  });

  test("二十歳 は the one form still gated on a number kanji (二)", () => {
    // It is the only memorised counted form left, and it reads はたち, not the
    // plain number + 歳 — so it ships as a form and keeps a number-kanji gate.
    const hatachi = byGlyph("二十歳");
    assert.deepEqual(counterKanjiPrereqs(hatachi), ["二"]);
    assert.ok(!counterTeachable(hatachi, history()), "二十歳 waits on 二");
    assert.ok(counterTeachable(hatachi, claiming([kanjiMeaningFactId("二")])));
  });
});

describe("the schedule", () => {
  test("with no history it opens on phase 1, needing no kanji", () => {
    const lesson = nextCounterLesson(history(), 5);
    assert.ok(lesson, "a first counters lesson exists straight after kana");
    // 〜つ leads the curriculum, so the first card is ひとつ, and every card in
    // the opening lesson is a kana form (no reading line, no kanji gate).
    assert.equal(lesson!.cards[0].glyph, "ひとつ");
    assert.equal(lesson!.cards[0].reading, null);
    assert.equal(lesson!.position.from, 1);
    assert.equal(lesson!.position.total, COUNTERS_CURRICULUM_TOTAL);
  });

  test("phase-1 forms + the two range units done → the 〜人 unit is due, ungated", () => {
    // The object counters need NO kanji now: once the numbers and the two range
    // units are behind the learner, the first counter unit (〜人) opens straight
    // away — no waiting on a number kanji the way the old rote forms did.
    const lesson = nextCounterLesson(claiming([...phase1Met, ...bothMarkers]), 5);
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
  test("the first counters lesson fires one track-counters card", () => {
    const lesson = nextCounterLesson(history(), 5)!;
    // The intro is decided from what the learner knew BEFORE this lesson, so the
    // walk is handed the lesson's own facts and a blank history: the counters
    // track is opening, so its card is due once.
    const steps = lessonSteps(lesson.facts, history());
    const intros = steps.filter(
      (s) => s.type === "intro" && s.intro.id === "track-counters",
    );
    assert.equal(intros.length, 1, "exactly one track-counters intro");
    // A phase-1 lesson is all kana forms, so the h→p/b sound-change card never
    // fires here — it now rides the 本/匹 CATEGORY units, not a form.
    assert.ok(
      steps.every((s) => s.type !== "intro" || s.intro.id !== COUNTER_SOUND_CHANGE.id),
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
    // The only memorised counted (kanji) form left is 二十歳.
    const counted = COUNTER_CURRICULUM.filter((f) => !isKanaForm(f)).map((f) => f.glyph);
    assert.deepEqual(counted, ["二十歳"]);
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
    // No curriculum form's fact is ever a marker.
    for (const f of COUNTER_CURRICULUM) {
      assert.ok(!isNumberUnitMarker(counterMeaningFactId(f)));
    }
  });

  test("there is a unit per range and per counter, all number-reading mode", () => {
    // Two number ranges + ten counters.
    assert.equal(GENERATIVE_UNITS.length, 12);
    assert.equal(NUMBER_UNITS.length, 2);
    for (const u of GENERATIVE_UNITS) assert.equal(u.mode, "number-reading");
  });

  test("a range unit's teach walk is its rule card ALONE (formless)", () => {
    const tens = lessonSteps([NUMBER_UNIT_TENS_MARKER], history());
    assert.equal(tens.length, 1);
    assert.ok(tens[0].type === "intro" && tens[0].intro.id === NUMBERS_COMPOSE.id);
    const big = lessonSteps([NUMBER_UNIT_BIG_MARKER], history());
    assert.equal(big.length, 1);
    assert.ok(big[0].type === "intro" && big[0].intro.id === NUMBERS_BIG.id);
  });

  test("a COUNTER unit's teach walk is its own rule card ALONE (formless)", () => {
    const hon = lessonSteps([constructionMarker("hon")], history());
    assert.equal(hon.length, 1);
    assert.ok(hon[0].type === "intro" && hon[0].intro.id === "intro-counter-hon");
  });

  test("the tens unit is due right after 1-10, in number-reading mode", () => {
    const lesson = nextCounterLesson(claiming(numbersDone), 5);
    assert.ok(lesson?.numberUnit, "a generative unit lesson, not a form lesson");
    assert.equal(lesson!.numberUnit!.marker, NUMBER_UNIT_TENS_MARKER);
    assert.equal(lesson!.numberUnit!.mode, "number-reading");
    assert.equal(lesson!.numberUnit!.intro.id, NUMBERS_COMPOSE.id);
    assert.equal(lesson!.numberUnit!.config.numberMax, 99);
    assert.equal(lesson!.numberUnit!.config.includeCounters, false);
    assert.deepEqual(lesson!.facts, [NUMBER_UNIT_TENS_MARKER]);
    assert.equal(lesson!.position.from, numbersDone.length + 1);
    assert.equal(lesson!.position.total, COUNTERS_CURRICULUM_TOTAL);
  });

  test("claiming the tens marker advances the scheduler to the big unit", () => {
    const lesson = nextCounterLesson(
      claiming([...numbersDone, NUMBER_UNIT_TENS_MARKER]),
      5,
    );
    assert.ok(lesson?.numberUnit, "the big unit is now due");
    assert.equal(lesson!.numberUnit!.marker, NUMBER_UNIT_BIG_MARKER);
    assert.equal(lesson!.numberUnit!.intro.id, NUMBERS_BIG.id);
    assert.equal(lesson!.numberUnit!.config.numberMax, 9999);
    assert.deepEqual(lesson!.facts, [NUMBER_UNIT_BIG_MARKER]);
    assert.equal(lesson!.position.from, numbersDone.length + 2);
  });

  test("claiming BOTH range markers advances the scheduler to the 〜人 unit", () => {
    const lesson = nextCounterLesson(
      claiming([...numbersDone, NUMBER_UNIT_TENS_MARKER, NUMBER_UNIT_BIG_MARKER]),
      5,
    );
    assert.ok(lesson?.numberUnit, "the 〜人 unit is now due");
    assert.equal(lesson!.numberUnit!.marker, constructionMarker("nin"));
    assert.equal(lesson!.numberUnit!.config.includeCounters, true);
    assert.deepEqual(lesson!.numberUnit!.config.counters, ["nin"]);
    // Both range units done now sit between the numbers and this one.
    assert.equal(lesson!.position.from, numbersDone.length + NUMBER_UNITS.length + 1);
  });

  test("〜人 has NO rote form lesson — claiming it advances to the next counter unit", () => {
    // ひとり/ふたり/よにん are no longer rote forms; the 〜人 category teaches them.
    // So claiming the 〜人 marker steps straight to the next generative unit (〜本),
    // with no run of memorised 〜人 forms in between.
    const lesson = nextCounterLesson(
      claiming([...numbersDone, ...bothMarkers, constructionMarker("nin")]),
      5,
    );
    assert.ok(lesson, "a lesson exists");
    assert.ok(lesson!.numberUnit, "a generative unit, not a form lesson");
    assert.equal(lesson!.numberUnit!.marker, constructionMarker("hon"));
  });

  test("the compose card is no longer word-gated on a form (the unit owns it)", () => {
    const five = counterMeaningFactId(byGlyph("ご"));
    const steps = lessonSteps([five], history());
    assert.ok(
      steps.every((s) => s.type !== "intro" || s.intro.id !== NUMBERS_COMPOSE.id),
      "the compose card does not ride a bare-number form",
    );
  });
});
