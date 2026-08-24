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
import { moraeOf, pitchPatternForLength } from "./pitch.ts";
import { PHASE_INTROS, PITCH_INTRO } from "../data/phase-intros.ts";
import { wordMeaningFactId, wordReadingFactId } from "../data/vocab.ts";
import { meaningFactId, readingFactId, READING_INDEX } from "../data/kanji.ts";
import { wordPitch } from "../data/pitch.ts";
import type { HistoryFile } from "../types/index.ts";
import type { PitchExampleRow } from "../data/phase-intros.ts";

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

/** Find a pitchExamples row by its kanji word, across every group. 橋/端 now
 * appear TWICE (bare in the first group, +から in the "you may have noticed"
 * group) — `variant` picks which one; omit it for a word with only one row. */
function pitchExampleRow(word: string, variant?: "bare" | "followUp"): PitchExampleRow {
  const matches: PitchExampleRow[] = [];
  for (const group of PITCH_INTRO.pitchExamples ?? []) {
    for (const row of group.rows) if (row.word === word) matches.push(row);
  }
  if (matches.length === 0) throw new Error(`no PITCH_INTRO.pitchExamples row for ${word}`);
  if (variant === "bare") return matches.find((r) => !r.followUp) ?? matches[0];
  if (variant === "followUp") return matches.find((r) => r.followUp) ?? matches[0];
  return matches[0];
}

/** The "H"/"L" shape plus drop index for what a row ACTUALLY sends to
 * HearButton/PitchReading — `reading + followUp` (or bare `reading` when
 * there is none) run through the real `pitchPatternForLength`, never a
 * hand-written pattern that could drift from src/lib/pitch.ts. */
function spokenShape(row: PitchExampleRow) {
  const spoken = row.reading + (row.followUp ?? "");
  const pattern = pitchPatternForLength(moraeOf(spoken).length, row.downstep);
  return {
    hl: pattern.map((m) => (m.high ? "H" : "L")).join(""),
    dropAt: pattern.findIndex((m) => m.drop),
  };
}

describe("PITCH_INTRO.pitchExamples — はし set, SAK-142 round 2's follow-up-word fix", () => {
  test("premise check: bare はし really does collide for 橋 and 端", () => {
    // If this fails, the bug this fix addresses is no longer real and the
    // followUp mechanism (and this whole test file) needs re-examining.
    const bridge = pitchPatternForLength(
      moraeOf("はし").length,
      pitchExampleRow("橋", "bare").downstep,
    );
    const edge = pitchPatternForLength(
      moraeOf("はし").length,
      pitchExampleRow("端", "bare").downstep,
    );
    assert.deepEqual(
      bridge.map((m) => m.high),
      edge.map((m) => m.high),
      "heiban and odaka must collide on the bare word for this fix to be necessary",
    );
  });

  test("橋 and 端 appear bare first, alongside 箸, in their own un-noted group", () => {
    const bareGroup = PITCH_INTRO.pitchExamples?.[0];
    assert.ok(bareGroup, "the first pitchExamples group should exist");
    assert.equal(bareGroup!.note, undefined, "no explanation yet — this group is the 'problem' half");
    assert.deepEqual(
      bareGroup!.rows.map((r) => r.word),
      ["箸", "橋", "端"],
    );
    assert.equal(bareGroup!.rows.find((r) => r.word === "橋")!.followUp, undefined);
    assert.equal(bareGroup!.rows.find((r) => r.word === "端")!.followUp, undefined);
  });

  test("橋 (odaka) carries から and its own real downstep (2), unchanged", () => {
    const row = pitchExampleRow("橋", "followUp");
    assert.equal(row.reading, "はし");
    assert.equal(row.followUp, "から");
    assert.equal(row.downstep, 2);
    assert.equal(row.gloss, "from the bridge", "the gloss follows the phrase actually spoken");
  });

  test("端 (heiban) carries から and its own real downstep (0), unchanged", () => {
    const row = pitchExampleRow("端", "followUp");
    assert.equal(row.reading, "はし");
    assert.equal(row.followUp, "から");
    assert.equal(row.downstep, 0);
    assert.equal(row.gloss, "from the edge", "the gloss follows the phrase actually spoken");
  });

  // から (2 morae) rather than が (1 mora): a single trailing mora's pitch is
  // too brief to reliably perceive against VOICEVOX's own natural declining
  // contour (confirmed live — both the raw pitch values and a byte-diff of
  // the actual synthesized clips showed a real but easy-to-miss difference
  // concentrated on one syllable). Two trailing morae at a sustained level
  // give the ear more to hold onto.
  test("橋+から genuinely drops, and stays low for both trailing morae", () => {
    const shape = spokenShape(pitchExampleRow("橋", "followUp"));
    assert.equal(shape.hl, "LHLL");
    assert.equal(shape.dropAt, 1, "the drop lands on the 2nd mora (し), the last high mora before から");
  });

  test("端+から stays level across all three trailing morae — no drop", () => {
    const shape = spokenShape(pitchExampleRow("端", "followUp"));
    assert.equal(shape.hl, "LHHH");
    assert.equal(shape.dropAt, -1);
  });

  test("橋+から and 端+から are now genuinely different, audible patterns", () => {
    assert.notDeepEqual(
      spokenShape(pitchExampleRow("橋", "followUp")),
      spokenShape(pitchExampleRow("端", "followUp")),
    );
  });

  test("箸 (atamadaka) needs no follow-up — its drop is already internal and audible alone", () => {
    const row = pitchExampleRow("箸");
    assert.equal(row.followUp, undefined);
    assert.equal(row.downstep, 1);
    const shape = spokenShape(row);
    assert.equal(shape.hl, "HL");
    assert.equal(shape.dropAt, 0);
  });

  test("the から group carries an explanation naming both 橋 and 端", () => {
    const group = PITCH_INTRO.pitchExamples?.find((g) =>
      g.rows.some((r) => r.word === "橋" && r.followUp),
    );
    assert.ok(group?.note, "the 橋/端 +から group should explain why they need から");
    assert.match(group!.note!, /橋/);
    assert.match(group!.note!, /端/);
  });
});

describe("PITCH_INTRO.pitchExamples — きのう set is unaffected by the はし fix", () => {
  test("昨日 (nakadaka) and 機能 (atamadaka) carry no follow-up word", () => {
    const yesterday = pitchExampleRow("昨日");
    const func = pitchExampleRow("機能");
    assert.equal(yesterday.reading, "きのう");
    assert.equal(func.reading, "きのう");
    assert.equal(yesterday.followUp, undefined);
    assert.equal(func.followUp, undefined);
    assert.equal(yesterday.downstep, 2);
    assert.equal(func.downstep, 1);
  });

  test("both already drop within the bare 3-mora word — no が needed", () => {
    const yesterday = spokenShape(pitchExampleRow("昨日"));
    const func = spokenShape(pitchExampleRow("機能"));
    assert.equal(yesterday.hl, "LHL");
    assert.notEqual(yesterday.dropAt, -1);
    assert.equal(func.hl, "HLL");
    assert.notEqual(func.dropAt, -1);
  });

  test("the きのう group's transition note mentions a mid-word drop", () => {
    const group = PITCH_INTRO.pitchExamples?.find((g) => g.rows.some((r) => r.word === "昨日"));
    assert.ok(group?.note, "the きのう group should bridge from the はし set's edge-of-word drop");
    assert.match(group!.note!, /middle/i);
  });
});
