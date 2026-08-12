// Run:
//   node --import ./src/lib/conjugate/test-hooks.mjs --test src/lib/pitch-intro.test.ts
//
// THE PITCH CARD is taught once, ahead of the first word the learner meets that
// carries a verified pitch — so the overline is never drawn before it is
// explained. It is a once-ever concept card, so a learner who has read it is
// never shown it again, and (like the spine cards) it only fires when history is
// supplied, so a caller naming a bare teach set gets the pre-track walk.

import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { lessonSteps } from "./lesson-steps.ts";
import { itemsFromFacts } from "./lesson-items.ts";
import { CONCEPT_CARD_IDS } from "./intro-shown.ts";
import { PHASE_INTROS, PITCH_INTRO } from "../data/phase-intros.ts";
import { wordMeaningFactId, wordReadingFactId } from "../data/vocab.ts";
import { meaningFactId, readingFactId, READING_INDEX } from "../data/kanji.ts";
import { wordPitch } from "../data/pitch.ts";
import type { HistoryFile } from "../types/index.ts";

const HISTORY: HistoryFile = { sessions: [], facts: {} };

/** The intro/item ids of a walk, flattened for `includes`. The pitch card is a
 * term page now, so a term step reads out under its `conceptId` (intro-pitch)
 * when it stands in for a concept card, else its entry id. */
function ids(steps: ReturnType<typeof lessonSteps>): string[] {
  return steps.map((s) =>
    s.type === "intro"
      ? s.intro.id
      : s.type === "term"
        ? (s.conceptId ?? String(s.entry))
        : s.type === "item"
          ? s.item.glyph
          : s.type,
  );
}

describe("the pitch card is remembered once-ever", () => {
  test("intro-shown.ts knows the pitch card by its own id", () => {
    assert.ok(CONCEPT_CARD_IDS.includes(PITCH_INTRO.id));
    assert.equal(PITCH_INTRO.id, "intro-pitch");
  });

  test("the card ships in PHASE_INTROS", () => {
    assert.ok(PHASE_INTROS.includes(PITCH_INTRO));
  });
});

describe("the pitch card fires ahead of the first pitch word", () => {
  test("先生 (pitch 3) opens the pitch card, once, before the word", () => {
    assert.notEqual(wordPitch("先生"), null); // fixture guard
    const steps = lessonSteps([wordReadingFactId("先生")], HISTORY, new Set());
    const walk = ids(steps);
    assert.ok(walk.includes("intro-pitch"), "the pitch card is in the walk");
    assert.ok(
      walk.indexOf("intro-pitch") < walk.indexOf("先生"),
      "the card comes before the word whose overline it explains",
    );
  });

  test("a learner who has read it is not shown it again", () => {
    const steps = lessonSteps(
      [wordReadingFactId("先生")],
      HISTORY,
      new Set(["intro-pitch"]),
    );
    assert.ok(!ids(steps).includes("intro-pitch"));
  });

  test("no history means the pre-track walk — no pitch card", () => {
    // The bare-teach-set convention every concept/track card follows: a caller
    // with nothing to read gets the item alone.
    const steps = lessonSteps([wordReadingFactId("先生")]);
    assert.ok(!ids(steps).includes("intro-pitch"));
  });

  test("a FOLDED word (何: kanji-led, taught with its word) still fires the card", () => {
    // The bug: 何 is beginnerRank 1, the first word a learner meets, but it folds
    // into a kanji-led step (item.kind === "kanji"), so a gate keyed on
    // item.kind === "word" skipped it and the pitch card never appeared. The gate
    // keys on the word's READING fact being in the step instead, which a folded
    // item carries. Guard the fold first, then the fire.
    const kReadings = [...READING_INDEX.values()]
      .filter((r) => r.k === "何")
      .map((r) => readingFactId(r.k, r.anchor));
    const facts = [
      meaningFactId("何"),
      ...kReadings,
      wordReadingFactId("何"),
      wordMeaningFactId("何"),
    ];
    const item = itemsFromFacts(facts).find((it) => it.glyph === "何");
    assert.ok(item, "何 is one item");
    assert.equal(item!.kind, "kanji", "何 leads as its kanji — the fold that hid the bug");
    assert.ok(item!.facts.includes(wordReadingFactId("何")), "yet it teaches the word 何");

    const walk = ids(lessonSteps(facts, HISTORY, new Set()));
    assert.ok(walk.includes("intro-pitch"), "the pitch card fires for the folded word");
    assert.ok(walk.indexOf("intro-pitch") < walk.indexOf("何"));
  });
});
