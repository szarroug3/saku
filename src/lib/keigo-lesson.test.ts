// Run: node --import ./src/lib/conjugate/test-hooks.mjs --test src/lib/keigo-lesson.test.ts
//
// WHAT THESE PIN
// ==============
// The owner's ruling for the keigo track (task 12) has three load-bearing parts,
// and each is a test here:
//   1. It opens EARLY — the moment the plain verb behind a set is learned, with
//      no dependency on transitivity or any later track being done.
//   2. RECOGNITION FIRST — every question is "shown the keigo verb, what is it",
//      never "produce the keigo verb". No production/en→jp fact exists yet.
//   3. It interleaves rather than blocking — a set whose plain verb is unmet is
//      skipped, not turned into a lock card.

import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { KEIGO_SETS, keigoSetEntry, keigoWordFactId } from "../data/keigo.ts";
import { wordMeaningFactId } from "../data/vocab.ts";
import { questionsFor } from "./engine/question.ts";
import {
  KEIGO_CURRICULUM_TOTAL,
  hasStartedKeigoTrack,
  keigoUnlocked,
  nextKeigoLesson,
} from "./keigo-lesson.ts";
import type { FactId, HistoryFile } from "../types/index.ts";

/** A learner who has done nothing. */
const BLANK: HistoryFile = { sessions: [], facts: {} };

/** A learner who has met exactly these facts, by the weakest record that counts
 * ("quiz me") — enough to make them non-fresh. */
function met(facts: readonly FactId[]): HistoryFile {
  return {
    sessions: [],
    facts: {},
    seen: Object.fromEntries(facts.map((f) => [f, 1])),
  };
}

const EAT = KEIGO_SETS.find((s) => s.id === "eat")!;
const SAY = KEIGO_SETS.find((s) => s.id === "say")!;

describe("the track opens EARLY, on a plain verb the learner already knows", () => {
  test("a blank learner has nothing to teach and has not started", () => {
    assert.equal(nextKeigoLesson(BLANK, 3), null);
    assert.equal(hasStartedKeigoTrack(BLANK), false);
  });

  test("learning 食べる alone opens the eat / drink set — no other track needed", () => {
    // The whole gate: one plain verb, learned as ordinary vocabulary. There is no
    // reference to transitivity, counters, or grammar anywhere in the unlock.
    const history = met([wordMeaningFactId("食べる")]);
    assert.ok(keigoUnlocked(EAT, history));
    const lesson = nextKeigoLesson(history, 3);
    assert.ok(lesson, "the eat set did not open on 食べる");
    assert.equal(lesson.cards[0].entry, keigoSetEntry(EAT));
    assert.equal(lesson.cards[0].meaning, "eat / drink");
  });

  test("any one of a set's plain verbs opens it (飲む opens eat too)", () => {
    const history = met([wordMeaningFactId("飲む")]);
    assert.ok(keigoUnlocked(EAT, history));
  });

  test("the position denominator is the whole curriculum", () => {
    const history = met([wordMeaningFactId("食べる")]);
    const lesson = nextKeigoLesson(history, 3)!;
    assert.equal(lesson.position.total, KEIGO_CURRICULUM_TOTAL);
    assert.equal(lesson.position.from, 1);
  });
});

describe("RECOGNITION FIRST — every fact is shown-then-identify, never produce", () => {
  test("every keigo fact is asked jp→en, multiple choice only", () => {
    // Recognition = shown the Japanese keigo verb, pick what it means and which
    // register. Production (shown a situation, type the verb) would be en→jp; no
    // keigo fact is, so a learner can never be asked to produce before the
    // concept is taught.
    for (const set of KEIGO_SETS) {
      for (const w of set.words) {
        const qt = questionsFor(keigoWordFactId(set, w));
        assert.equal(qt.fixedDir, "jp2en", `${w.word} is not fixed to recognition`);
        assert.equal(qt.mcOnly, true, `${w.word} is not multiple-choice only`);
      }
    }
  });
});

describe("it interleaves rather than blocking", () => {
  test("a set whose plain verb is unmet is skipped, not blocked on", () => {
    // 食べる learned but 言う not: the eat set is ready and the say set is not.
    // A blocking track would stall on the say set; this one hands out eat and
    // steps over say.
    const history = met([wordMeaningFactId("食べる")]);
    assert.ok(keigoUnlocked(EAT, history));
    assert.ok(!keigoUnlocked(SAY, history));
    const lesson = nextKeigoLesson(history, 9)!;
    const taught = new Set(lesson.cards.map((c) => c.meaning));
    assert.ok(taught.has("eat / drink"), "the ready set was not taught");
    assert.ok(!taught.has("say"), "a locked set was taught anyway");
  });

  test("a met set is counted but not re-offered", () => {
    // Learn 食べる (opens eat) and meet the eat set's facts. The next lesson skips
    // eat and its position counts it as done.
    const eatFacts = EAT.words.map((w) => keigoWordFactId(EAT, w));
    const history = met([
      wordMeaningFactId("食べる"),
      wordMeaningFactId("言う"),
      ...eatFacts,
    ]);
    assert.ok(hasStartedKeigoTrack(history));
    const lesson = nextKeigoLesson(history, 3)!;
    assert.ok(
      lesson.cards.every((c) => c.meaning !== "eat / drink"),
      "a fully-met set was offered again",
    );
    assert.equal(lesson.position.from, 2, "the met set was not counted");
  });
});
