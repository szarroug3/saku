// Run: node --import ./src/lib/conjugate/test-hooks.mjs --test \
//        src/lib/counter-lesson.test.ts
//
// WHAT THESE TESTS ARE FOR
// ========================
// The counters track is `word` facts with a track label, scheduled by a walk
// over COUNTER_CURRICULUM that must respect the approved gate: phase 1 (〜つ, the
// numbers, 〜人, 11-99) is kana and needs no kanji; phase 2 (〜本/匹/枚) and the
// tail gate on their NUMBER kanji being learned. The failure modes all
// type-check — a phase-2 form handed out before its kanji, a phase-1 form made
// to wait on a kanji it does not contain, the track opening with no intro or two
// — so these pin the GATE, the ORDER, and the single intro over the real data.

import assert from "node:assert/strict";
import { describe, test } from "node:test";

import {
  COUNTER_CURRICULUM,
  counterKanjiPrereqs,
  counterMeaningFactId,
  isKanaForm,
} from "../data/counters.ts";
import { meaningFactId as kanjiMeaningFactId } from "../data/kanji.ts";
import { COUNTER_SOUND_CHANGE } from "../data/phase-intros.ts";
import { lessonSteps } from "./lesson-steps.ts";
import {
  COUNTERS_CURRICULUM_TOTAL,
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

const NUMBER_KANJI = ["一", "二", "三", "四", "五", "六", "七", "八", "九", "十"];
const phase1 = COUNTER_CURRICULUM.filter((f) => f.phase === 1);
const phase1Met = phase1.map(counterMeaningFactId);
const numberKanjiKnown = NUMBER_KANJI.map(kanjiMeaningFactId);
const byGlyph = (g: string) => COUNTER_CURRICULUM.find((f) => f.glyph === g)!;

describe("the gate: phase 1 kana-only, phase 2 on its number kanji", () => {
  test("every phase-1 form is teachable with no kanji known", () => {
    for (const f of phase1) {
      assert.deepEqual(counterKanjiPrereqs(f), []);
      assert.ok(counterTeachable(f, history()), `${f.glyph} should be teachable`);
    }
  });

  test("a phase-2 form waits on its number kanji, then opens", () => {
    const san = byGlyph("三本"); // needs 三
    assert.ok(!counterTeachable(san, history()), "三本 must wait on 三");
    assert.ok(
      counterTeachable(san, claiming([kanjiMeaningFactId("三")])),
      "三本 opens once 三 is known",
    );
    // And the gate is the NUMBER kanji, not the counter kanji: knowing 本 (the
    // counter, which this track teaches) does not unlock 三本.
    assert.ok(!counterTeachable(san, claiming([kanjiMeaningFactId("本")])));
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

  test("phase 1 done but no kanji known → nothing teachable (phase 2 gated)", () => {
    const lesson = nextCounterLesson(claiming(phase1Met), 5);
    assert.equal(lesson, null, "phase 2 is gated behind number kanji");
  });

  test("phase 1 done AND number kanji known → phase 2 opens", () => {
    const lesson = nextCounterLesson(claiming([...phase1Met, ...numberKanjiKnown]), 5);
    assert.ok(lesson, "phase 2 opens once the number kanji are learned");
    // 〜本 is the first phase-2 group, so 一本 leads, and it now carries a reading.
    assert.equal(lesson!.cards[0].glyph, "一本");
    assert.equal(lesson!.cards[0].reading, "いっぽん");
    for (const c of lesson!.cards) assert.ok(!isKanaForm(byGlyph(c.glyph)));
    // Met is every learned counter, so the position starts after phase 1.
    assert.equal(lesson!.position.from, phase1.length + 1);
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
    // walk is handed the lesson's own facts to exclude (startedTracks) and a
    // blank history: the counters track is opening, so its card is due once.
    const steps = lessonSteps(lesson.facts, history());
    const intros = steps.filter(
      (s) => s.type === "intro" && s.intro.id === "track-counters",
    );
    assert.equal(intros.length, 1, "exactly one track-counters intro");
    // A phase-1 lesson is all kana forms, so the h→p/b sound-change card never
    // fires here — that rides the first shifting phase-2 form.
    assert.ok(
      steps.every((s) => s.type !== "intro" || s.intro.id !== COUNTER_SOUND_CHANGE.id),
    );
  });
});
