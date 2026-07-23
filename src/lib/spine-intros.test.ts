// Run: node --import ./src/lib/conjugate/test-hooks.mjs --test \
//        src/lib/spine-intros.test.ts
//
// WHAT THESE TESTS ARE FOR
// ========================
// The three concept cards are the first explanation a learner gets of what a
// radical is, what a kanji is, and what a word is. Every way they can be wrong is
// silent:
//
//   1. Not firing at all. That is the regression this file was written after: the
//      old subject gate read the kanji READINGS unlocked by the first lesson's
//      own word as proof the kanji track had already been touched, and the kanji
//      and radical cards went missing for good. Nothing threw. The learner was
//      handed 人 亅 丁 with "radical" undefined.
//   2. Firing twice, or firing late. An introduction that comes back says the app
//      is not tracking what it has told you; one that lands after the item it
//      explains is the failure the card exists to prevent.
//   3. Taking the kana cards down with them. Kana is a separate track and its
//      intro is untouched by any of this.
//
// Written against the real sequence and the real packing, because what is under
// test is that a card is wired to material the app actually teaches.
//
// NO GLYPHS ARE NAMED. The sequence contents move; the rules do not. Every
// assertion reads the anchor off the data and checks a property of it.

import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { kanaFact } from "../data/characters.ts";
import { TRACK_INTROS } from "../data/track-intros.ts";
import { ROLE_ORDER } from "./character-role.ts";
import { CURRICULUM_SEQUENCE } from "./curriculum-order.ts";
import { curriculum, lessonWords } from "./curriculum-lesson.ts";
import { LESSON_RANGE_DEFAULT } from "./lesson-sizing.ts";
import { lessonSteps } from "./lesson-steps.ts";
import { SPINE_ANCHORS, spineIntrosFor } from "./spine-intros.ts";
import { readingsProvedBy } from "./word-unlock.ts";
import type { FactId, HistoryFile } from "../types/index.ts";

const GROUPS = curriculum(LESSON_RANGE_DEFAULT);
const BLANK: HistoryFile = { sessions: [], facts: {} };
const CARD_IDS = new Set(SPINE_ANCHORS.map((a) => a.intro.id));

/** A learner who has met exactly these facts, by the weakest record that counts,
 * "quiz me". Enough to make them non-fresh, which is the whole gate. */
function met(facts: Iterable<FactId>): HistoryFile {
  const seen: Record<string, number> = {};
  for (const f of facts) seen[f] = 1;
  return { sessions: [], facts: {}, seen: seen as HistoryFile["seen"] };
}

/** The intro ids a walk of this lesson emits, in order. */
function introsOf(facts: readonly FactId[], history: HistoryFile): string[] {
  return lessonSteps(facts, history)
    .filter((s) => s.type === "intro")
    .map((s) => s.key);
}

/**
 * Everything the app puts into history when a lesson is STARTED, which is what
 * the walk then reads.
 *
 * The reading unlock is the part that matters and the part that caused the bug:
 * `startCurriculumLesson` marks the lesson's facts seen AND every kanji reading
 * the lesson's words prove, before the session opens. So the walk renders against
 * a history that already contains kanji facts nobody was taught.
 */
function factsWrittenOnStart(group: (typeof GROUPS)[number]): FactId[] {
  return [...group.facts, ...readingsProvedBy(lessonWords(group.items))];
}

describe("every role is anchored to the first item that plays it", () => {
  test("all three roles have a card, in radical, kanji, word order", () => {
    assert.deepEqual(
      SPINE_ANCHORS.map((a) => a.role),
      [...ROLE_ORDER],
    );
    assert.deepEqual(
      SPINE_ANCHORS.map((a) => a.intro.id),
      ROLE_ORDER.map((r) => TRACK_INTROS[r].id),
    );
  });

  test("an anchor IS the first item of the sequence carrying its role", () => {
    for (const anchor of SPINE_ANCHORS) {
      const first = CURRICULUM_SEQUENCE.find((it) => it.roles.includes(anchor.role));
      assert.ok(first, `nothing plays ${anchor.role}`);
      assert.equal(anchor.glyph, first.glyph, anchor.role);
    }
  });

  test("an anchor's gate facts are the meaning facts of the roles it plays", () => {
    for (const anchor of SPINE_ANCHORS) {
      assert.ok(anchor.facts.length > 0, `${anchor.role} has no gate fact`);
      // Meaning facts only. A reading is something a later word proves, not
      // evidence the item was ever taught, and treating one as evidence is
      // exactly how the cards went missing.
      for (const f of anchor.facts) {
        assert.ok(!f.includes("/reading"), `${anchor.role} gates on a reading`);
      }
    }
  });

  test("a glyph that anchors nothing owes no card", () => {
    assert.deepEqual(spineIntrosFor("あ", BLANK, new Set()), []);
  });
});

describe("each card lands in the first lesson that teaches its role, before the item", () => {
  for (const anchor of SPINE_ANCHORS) {
    describe(anchor.role, () => {
      /** The first lesson holding an item that plays this role. */
      const at = GROUPS.findIndex((g) =>
        g.items.some((it) => it.roles.includes(anchor.role)),
      );

      test("that lesson is the one holding the anchor", () => {
        assert.ok(at >= 0, `no lesson teaches ${anchor.role}`);
        assert.ok(
          GROUPS[at].items.some((it) => it.glyph === anchor.glyph),
          `the first ${anchor.role} lesson does not hold the anchor`,
        );
      });

      test("the card fires there, ahead of every item", () => {
        const before = GROUPS.slice(0, at).flatMap(factsWrittenOnStart);
        const history = met([...before, ...factsWrittenOnStart(GROUPS[at])]);
        const steps = lessonSteps(GROUPS[at].facts, history);
        const cardAt = steps.findIndex(
          (s) => s.type === "intro" && s.key === anchor.intro.id,
        );
        assert.ok(cardAt >= 0, `${anchor.role} card never fired`);
        const firstItem = steps.findIndex((s) => s.type === "item");
        assert.ok(cardAt < firstItem, `${anchor.role} card lands after an item`);
      });

      test("it fires once in that walk, not once per item that plays the role", () => {
        const n = introsOf(GROUPS[at].facts, BLANK).filter(
          (id) => id === anchor.intro.id,
        ).length;
        assert.equal(n, 1);
      });
    });
  }
});

// THE REGRESSION ITSELF, pinned at the exact shape it had. Starting the first
// lesson unlocks the kanji readings its words prove, and those are written to
// history BEFORE the walk renders. Under the old subject gate that read as "the
// kanji track has already been touched" and took two cards with it.
describe("a reading unlocked by the lesson itself does not suppress its cards", () => {
  const first = GROUPS[0];

  test("the first lesson really does unlock a reading", () => {
    // If this ever stops being true the test below is still correct and no longer
    // proves anything, so it is asserted and not assumed.
    assert.ok(
      readingsProvedBy(lessonWords(first.items)).length > 0,
      "the first lesson proves no reading, so this pins nothing",
    );
  });

  test("every card the first lesson owes still fires with those readings in history", () => {
    const withReadings = met(factsWrittenOnStart(first));
    const fired = introsOf(first.facts, withReadings).filter((id) => CARD_IDS.has(id));
    const owed = SPINE_ANCHORS.filter((a) =>
      first.items.some((it) => it.roles.includes(a.role)),
    ).map((a) => a.intro.id);
    assert.deepEqual(fired, owed);
  });

  test("and the order is radical, kanji, word, ahead of the material", () => {
    const steps = lessonSteps(first.facts, met(factsWrittenOnStart(first)));
    const kinds = steps.map((s) => (s.type === "intro" ? "intro" : "item"));
    const lastIntro = kinds.lastIndexOf("intro");
    const firstItem = kinds.indexOf("item");
    assert.ok(lastIntro < firstItem, "an item comes before a card");
    assert.deepEqual(
      steps.slice(0, lastIntro + 1).map((s) => s.key),
      SPINE_ANCHORS.filter((a) =>
        first.items.some((it) => it.roles.includes(a.role)),
      ).map((a) => a.intro.id),
    );
  });
});

describe("a card does not come back", () => {
  test("no later lesson can even own one, because no later lesson holds the anchor", () => {
    for (const anchor of SPINE_ANCHORS) {
      const holders = GROUPS.filter((g) =>
        g.items.some((it) => it.glyph === anchor.glyph),
      );
      assert.equal(holders.length, 1, `${anchor.glyph} is in ${holders.length} lessons`);
    }
  });

  test("walking the progression fires each card exactly once", () => {
    // The real thing: walk lessons in order, writing to history what Start
    // writes, and count. Bounded to a long prefix rather than all 2,000-odd
    // lessons, because the gate re-reads the whole of history on every step. The
    // test above covers the rest, by showing no later lesson can fire one.
    const fired = new Map<string, number>();
    const seen = new Set<FactId>();
    for (const g of GROUPS.slice(0, 300)) {
      const history = met([...seen, ...factsWrittenOnStart(g)]);
      for (const id of introsOf(g.facts, history)) {
        if (CARD_IDS.has(id)) fired.set(id, (fired.get(id) ?? 0) + 1);
      }
      for (const f of factsWrittenOnStart(g)) seen.add(f);
    }
    for (const anchor of SPINE_ANCHORS) {
      assert.equal(fired.get(anchor.intro.id), 1, `${anchor.role} fired wrongly`);
    }
  });

  test("a later lesson that teaches the same role shows nothing", () => {
    for (const anchor of SPINE_ANCHORS) {
      const at = GROUPS.findIndex((g) =>
        g.items.some((it) => it.roles.includes(anchor.role)),
      );
      const later = GROUPS.findIndex(
        (g, i) => i > at && g.items.some((it) => it.roles.includes(anchor.role)),
      );
      assert.ok(later > at, `only one lesson ever teaches ${anchor.role}`);
      const before = GROUPS.slice(0, later).flatMap(factsWrittenOnStart);
      const history = met([...before, ...factsWrittenOnStart(GROUPS[later])]);
      assert.ok(
        !introsOf(GROUPS[later].facts, history).includes(anchor.intro.id),
        `${anchor.role} introduced itself twice`,
      );
    }
  });
});

// The sequence ends on two tails: the jouyou kanji no curriculum word is written
// with, then the radical-only shapes nothing at all is built from. A learner who
// gets there has walked every lesson before it, so every card fired long ago.
describe("the orphan tails introduce nothing", () => {
  const tail = GROUPS.slice(-40);

  test("the tails are past every anchor", () => {
    for (const anchor of SPINE_ANCHORS) {
      assert.ok(
        !tail.some((g) => g.items.some((it) => it.glyph === anchor.glyph)),
        `${anchor.role}'s anchor is in the tail`,
      );
    }
  });

  test("an orphan radical lesson shows no card, having been explained at the start", () => {
    const orphan = tail.find((g) =>
      g.items.every((it) => it.roles.length === 1 && it.roles[0] === "radical"),
    );
    assert.ok(orphan, "the tail has a radical-only lesson");
    const before = GROUPS.slice(0, GROUPS.indexOf(orphan)).flatMap(factsWrittenOnStart);
    const history = met([...before, ...factsWrittenOnStart(orphan)]);
    assert.deepEqual(
      introsOf(orphan.facts, history).filter((id) => CARD_IDS.has(id)),
      [],
    );
  });
});

describe("kana is a separate track and is untouched", () => {
  test("hiragana still opens on its own card, before あ", () => {
    const steps = lessonSteps([..."あいうえお"].map(kanaFact), BLANK);
    assert.equal(steps[0].type, "intro");
    assert.equal(steps[0].type === "intro" ? steps[0].key : "", "track-hiragana");
    // And no spine card rides in on kana, which plays none of the three roles.
    assert.deepEqual(
      steps.filter((s) => s.type === "intro" && CARD_IDS.has(s.key)),
      [],
    );
  });

  test("katakana still opens on its own card once hiragana is met", () => {
    const done = met([..."あいうえお"].map(kanaFact));
    const steps = lessonSteps([..."アイウエオ"].map(kanaFact), done);
    assert.equal(steps[0].type === "intro" ? steps[0].key : "", "track-katakana");
  });

  test("a caller with no history still gets no cards at all", () => {
    // The signature keeps history optional, and without it the walk is exactly
    // the items. Every existing caller and test depends on that.
    const steps = lessonSteps(GROUPS[0].facts);
    assert.deepEqual(
      steps.filter((s) => s.type === "intro"),
      [],
    );
  });
});
