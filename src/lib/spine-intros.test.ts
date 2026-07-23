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

/**
 * What each card is ABOUT, written out here rather than read off the module, so
 * these tests check the rule instead of echoing it back.
 *
 * The kanji card is about a character taught as a kanji; the radical card about a
 * shape that is only ever a piece; the word card about a written form built out
 * of characters, which a one-character word is not.
 */
const ANCHOR_SHAPE: Record<
  "radical" | "kanji" | "word",
  (roles: readonly string[], glyph: string) => boolean
> = {
  kanji: (roles) => roles.includes("kanji"),
  radical: (roles) => roles.length === 1 && roles[0] === "radical",
  word: (roles, glyph) =>
    roles.includes("word") && !roles.includes("kanji") && /\p{Script=Han}/u.test(glyph),
};

/** The anchor for one role, by name. */
function anchorFor(role: "radical" | "kanji" | "word") {
  const anchor = SPINE_ANCHORS.find((a) => a.role === role);
  assert.ok(anchor, `${role} has no anchor`);
  return anchor;
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

describe("every role is anchored where its card has something to point at", () => {
  test("all three roles have a card, listed down the hierarchy", () => {
    // Words are what a learner is here for, kanji spell words, radicals build
    // kanji. The reverse of the label order, and a different job: see CARD_ORDER.
    assert.deepEqual(
      SPINE_ANCHORS.map((a) => a.role),
      [...ROLE_ORDER].reverse(),
    );
    assert.deepEqual(
      SPINE_ANCHORS.map((a) => a.intro.id),
      [...ROLE_ORDER].reverse().map((r) => TRACK_INTROS[r].id),
    );
  });

  test("the kanji card is the first item taught as a kanji", () => {
    const anchor = anchorFor("kanji");
    const first = CURRICULUM_SEQUENCE.find((it) => it.roles.includes("kanji"))!;
    assert.equal(anchor.glyph, first.glyph);
  });

  test("the radical card is the first shape that is ONLY a radical", () => {
    // The card's job is that "radical" describes what other kanji are built from
    // and says nothing about standing alone. On a character that is also a kanji
    // that point is invisible; on a shape that is only ever a part it is the
    // thing on screen.
    const anchor = anchorFor("radical");
    const item = CURRICULUM_SEQUENCE.find((it) => it.glyph === anchor.glyph)!;
    assert.deepEqual([...item.roles], ["radical"]);
    const first = CURRICULUM_SEQUENCE.find(
      (it) => it.roles.length === 1 && it.roles[0] === "radical",
    )!;
    assert.equal(anchor.glyph, first.glyph);
  });

  test("the word card is the first word spelled out of characters, not a fold", () => {
    // A one-character word is the kanji you were just taught wearing a second
    // label, and nothing has waited on anything yet. The card is about a word
    // waiting for its kanji, so it fires at the first written form built from
    // characters already in hand.
    const anchor = anchorFor("word");
    const item = CURRICULUM_SEQUENCE.find((it) => it.glyph === anchor.glyph)!;
    assert.ok(item.roles.includes("word"));
    assert.ok(!item.roles.includes("kanji"), "the word anchor is a folded kanji");
    assert.match(anchor.glyph, /\p{Script=Han}/u);
    const first = CURRICULUM_SEQUENCE.find(
      (it) =>
        it.roles.includes("word") &&
        !it.roles.includes("kanji") &&
        /\p{Script=Han}/u.test(it.glyph),
    )!;
    assert.equal(anchor.glyph, first.glyph);
  });

  test("no two cards share an anchor, so each lands on its own item", () => {
    const glyphs = SPINE_ANCHORS.map((a) => a.glyph);
    assert.equal(new Set(glyphs).size, glyphs.length);
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

describe("each card lands in its anchor's lesson, ahead of the anchor", () => {
  for (const anchor of SPINE_ANCHORS) {
    describe(anchor.role, () => {
      /** The one lesson holding the anchor, and the history a learner has when
       * they open it: everything Start wrote for every lesson up to and including
       * this one. */
      const at = GROUPS.findIndex((g) => g.items.some((it) => it.glyph === anchor.glyph));
      const historyAt = () =>
        met(GROUPS.slice(0, at + 1).flatMap(factsWrittenOnStart));

      test("exactly one lesson holds the anchor", () => {
        assert.ok(at >= 0, `no lesson holds ${anchor.role}'s anchor`);
        const holders = GROUPS.filter((g) =>
          g.items.some((it) => it.glyph === anchor.glyph),
        );
        assert.equal(holders.length, 1);
      });

      test("no earlier lesson teaches the role, so the card is not late", () => {
        // The anchor may sit behind items that carry the role incidentally (a
        // kanji that happens to also be a radical), but nothing before its lesson
        // may be the kind of thing the card is ABOUT.
        const earlier = GROUPS.slice(0, at).flatMap((g) => g.items);
        assert.ok(
          !earlier.some((it) => ANCHOR_SHAPE[anchor.role](it.roles, it.glyph)),
          `${anchor.role}'s card is late`,
        );
      });

      test("the card fires in that lesson, immediately ahead of the anchor item", () => {
        const steps = lessonSteps(GROUPS[at].facts, historyAt());
        const cardAt = steps.findIndex(
          (s) => s.type === "intro" && s.key === anchor.intro.id,
        );
        assert.ok(cardAt >= 0, `${anchor.role} card never fired`);
        const itemAt = steps.findIndex(
          (s) => s.type === "item" && s.item.glyph === anchor.glyph,
        );
        assert.ok(itemAt > cardAt, `${anchor.role} card lands after its anchor`);
        // Nothing but another card sits between the two: the explanation runs
        // straight into the thing it explains.
        for (let i = cardAt + 1; i < itemAt; i++) {
          assert.equal(steps[i].type, "intro", `an item splits ${anchor.role}'s card off`);
        }
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

// THE HIERARCHY, AND THE ORDER IT READS IN.
// =========================================
// Words are what a learner is here for, kanji are what words are written with,
// radicals are what kanji are drawn from. Each card introduces what the thing
// above it is built from, so the two that share the first lesson must read kanji
// first and radical second. That order falls out of where the anchors sit, which
// is exactly why it is pinned here: an anchor moved later must not silently
// invert them and leave a learner told about pieces of a thing nobody has named.
describe("the kanji card comes before the radical card", () => {
  const kanji = anchorFor("kanji");
  const radical = anchorFor("radical");

  test("the kanji anchor precedes the radical anchor in the sequence", () => {
    const at = (glyph: string) => CURRICULUM_SEQUENCE.findIndex((it) => it.glyph === glyph);
    assert.ok(at(kanji.glyph) < at(radical.glyph), "a radical is introduced first");
  });

  test("both are in the first lesson, kanji card first", () => {
    const lessonOf = (glyph: string) =>
      GROUPS.findIndex((g) => g.items.some((it) => it.glyph === glyph));
    assert.equal(lessonOf(kanji.glyph), lessonOf(radical.glyph));
    const g = GROUPS[lessonOf(kanji.glyph)];
    const ids = introsOf(g.facts, met(factsWrittenOnStart(g))).filter((id) =>
      CARD_IDS.has(id),
    );
    assert.deepEqual(ids, [kanji.intro.id, radical.intro.id]);
  });

  test("the kanji card is the very first thing in that lesson", () => {
    const at = GROUPS.findIndex((g) => g.items.some((it) => it.glyph === kanji.glyph));
    const steps = lessonSteps(GROUPS[at].facts, met(factsWrittenOnStart(GROUPS[at])));
    assert.equal(steps[0].type === "intro" ? steps[0].key : "", kanji.intro.id);
  });
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
      first.items.some((it) => it.glyph === a.glyph),
    ).map((a) => a.intro.id);
    assert.deepEqual(fired, owed);
    assert.ok(owed.length > 0, "the first lesson owes no card at all");
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
