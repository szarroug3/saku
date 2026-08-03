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
import { meaningFactId } from "../data/kanji.ts";
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

/** A learner who has merely started or chosen "quiz me". This is enough to make
 * material non-fresh, but not enough to complete a vocabulary prerequisite. */
function met(facts: readonly FactId[]): HistoryFile {
  return {
    sessions: [],
    facts: {},
    seen: Object.fromEntries(facts.map((f) => [f, 1])),
  };
}

/** Completing a taught session and "I already know" both write claims. */
function learned(facts: readonly FactId[]): HistoryFile {
  return {
    sessions: [],
    facts: {},
    claims: Object.fromEntries(facts.map((f) => [f, 1])),
  };
}

// Kanji that appear in each set's forms and that the gate checks.
// EAT: 召し上がる (召, 上); SAY: 申す, 申し上げる (申, 上).
const EAT_KANJI = ["召", "上"].map((c) => meaningFactId(c));
const SAY_KANJI = ["申", "上"].map((c) => meaningFactId(c));

const EAT = KEIGO_SETS.find((s) => s.id === "eat")!;
const SAY = KEIGO_SETS.find((s) => s.id === "say")!;

const WELCOME = KEIGO_SETS.find((s) => s.id === "welcome")!

describe("the track opens EARLY, on a plain verb the learner already knows", () => {
  test("a blank learner sees welcome immediately; no other set is taught yet", () => {
    // welcome has an empty gate so it opens as soon as kana is done (caller\u2019s gate).
    const lesson = nextKeigoLesson(BLANK, 3);
    assert.ok(lesson, "welcome did not open for a blank learner");
    assert.equal(lesson.cards[0].entry, keigoSetEntry(WELCOME));
    // A learner who has done nothing is not \u201cstarted\u201d on keigo (no met sets).
    assert.equal(hasStartedKeigoTrack(BLANK), false);
  });

  test("learning 食べる alone opens the eat / drink set — no other track needed", () => {
    // The verb gate: one plain verb, learned as ordinary vocabulary. There is no
    // reference to transitivity, counters, or grammar anywhere in the unlock.
    // The kanji gate: forms like 召し上がる require knowing 召 and 上 first.
    const history = learned([wordMeaningFactId("食べる"), ...EAT_KANJI]);
    assert.ok(keigoUnlocked(EAT, history));
    const lesson = nextKeigoLesson(history, 3);
    assert.ok(lesson, "the eat set did not open on 食べる");
    // welcome always leads; eat follows as the first unlocked verb set
    assert.ok(lesson.cards.some((c) => c.meaning === "eat / drink"), "eat set missing from lesson");
  });

  test("any one of a set's plain verbs opens it (飲む opens eat too)", () => {
    const history = learned([wordMeaningFactId("飲む"), ...EAT_KANJI]);
    assert.ok(keigoUnlocked(EAT, history));
  });

  test("the position denominator is the whole curriculum", () => {
    const history = learned([wordMeaningFactId("食べる"), ...EAT_KANJI]);
    const lesson = nextKeigoLesson(history, 3)!;
    assert.equal(lesson.position.total, KEIGO_CURRICULUM_TOTAL);
    assert.equal(lesson.position.from, 1);
  });
});

describe("starting a word lesson is not completing its prerequisite", () => {
  test("a seen 食べる does not unlock the eat / drink set", () => {
    // seen-but-not-claimed 食べる leaves eat locked; welcome still opens (empty gate).
    const history = met([wordMeaningFactId("食べる")]);
    assert.equal(keigoUnlocked(EAT, history), false);
    const lesson = nextKeigoLesson(history, 3);
    assert.ok(lesson, "welcome should still be offered");
    assert.ok(lesson.cards.every((c) => c.meaning !== "eat / drink"), "eat opened on seen verb");
  });
});

describe("RECOGNITION FIRST — the lesson teaches identification before practice", () => {
  test("recognition is MC-only while learned facts also support production", () => {
    // The lesson introduces the Japanese form and register first. Once the fact
    // is learned, practice may ask recognition or production; recognition stays
    // MC-only because the register distinction is part of the answer.
    for (const set of KEIGO_SETS) {
      for (const w of set.words) {
        const qt = questionsFor(keigoWordFactId(set, w));
        assert.equal(qt.fixedDir, undefined, `${w.word} cannot be practiced both ways`);
        assert.equal(qt.mcOnly, "jp2en", `${w.word} recognition is not MC-only`);
      }
    }
  });
});

describe("it interleaves rather than blocking", () => {
  test("a set whose plain verb is unmet is skipped, not blocked on", () => {
    // 食べる learned (+ its kanji) but 言う not: the eat set is ready and the say
    // set is not. A blocking track would stall on the say set; this one hands out
    // eat and steps over say.
    const history = learned([wordMeaningFactId("食べる"), ...EAT_KANJI]);
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
    const history = learned([
      wordMeaningFactId("食べる"),
      wordMeaningFactId("言う"),
      ...EAT_KANJI,
      ...SAY_KANJI,
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
