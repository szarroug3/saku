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
import { kanjiTeachOrder, meaningFactId as kanjiMeaningFactId } from "../data/kanji.ts";
import { radicalMeaningFactId } from "../data/radicals.ts";
import { TRACK_INTROS } from "../data/track-intros.ts";
import { ROLE_ORDER } from "./character-role.ts";
import { CURRICULUM_SEQUENCE } from "./curriculum-order.ts";
import { characterRoles } from "./character-role.ts";
import {
  curriculum,
  lessonWords,
  nextCurriculumLesson,
  type CurriculumLessonItem,
} from "./curriculum-lesson.ts";
import { RADICAL_TEACHING_ORDER } from "./radical-order.ts";
import { LESSON_RANGE_DEFAULT } from "./lesson-sizing.ts";
import { lessonSteps } from "./lesson-steps.ts";
import { CONCEPT_CARD_IDS } from "./intro-shown.ts";
import { SPINE_ANCHORS, spineIntroPlan } from "./spine-intros.ts";
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
  radical: (roles) => roles.includes("radical"),
  word: (roles, glyph) =>
    roles.includes("word") && !roles.includes("kanji") && /\p{Script=Han}/u.test(glyph),
};

/** The anchor for one role, by name. */
function anchorFor(role: "radical" | "kanji" | "word") {
  const anchor = SPINE_ANCHORS.find((a) => a.role === role);
  assert.ok(anchor, `${role} has no anchor`);
  return anchor;
}

/** The intro ids a walk of this lesson emits, in order. `shown` is the record of
 * cards already read, which is what the once-ever guarantee now rests on. */
function introsOf(
  facts: readonly FactId[],
  history: HistoryFile,
  shown: ReadonlySet<string> = new Set(),
): string[] {
  return lessonSteps(facts, history, shown)
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
  return startFacts(group.facts, group.items);
}

/** The same write, for a lesson narrowed to what is still fresh: what
 * startCurriculumLesson puts in history before the walk renders. */
function startFacts(
  facts: readonly FactId[],
  cards: readonly CurriculumLessonItem[],
): FactId[] {
  return [...facts, ...readingsProvedBy(lessonWords(cards))];
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

  test("the radical card is the first character that plays the role at all", () => {
    // Including a character that is also a kanji and a word. The card used to
    // wait for a shape that is ONLY a piece, which reads better and arrives too
    // late: the first lesson's tile says "Radical · Kanji · Word" before anything
    // has said what a radical is, and a term shown before its definition is what
    // these cards exist to prevent.
    const anchor = anchorFor("radical");
    const first = CURRICULUM_SEQUENCE.find((it) => it.roles.includes("radical"))!;
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

  test("the kanji and radical cards share their anchor, and say so in order", () => {
    // The opening character is both, so both cards are due ahead of it. Two
    // explanations stacked is the price of never showing a label first.
    assert.equal(anchorFor("kanji").glyph, anchorFor("radical").glyph);
    assert.notEqual(anchorFor("word").glyph, anchorFor("kanji").glyph);
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

  test("a walk of material that plays no role owes no card", () => {
    const kana = [
      { kind: "kana", glyph: "あ" },
      { kind: "kana", glyph: "い" },
    ];
    assert.equal(spineIntroPlan(kana, BLANK, new Set(), new Set()).size, 0);
  });

  test("a step of another subject never triggers a card, whatever its glyph", () => {
    // A keigo verb and a counter can be written exactly like a curriculum word.
    // A keigo lesson is not where the app explains what a word is, so the plan
    // looks at the step's KIND and not only at its spelling.
    const wordGlyph = anchorFor("word").glyph;
    const asKeigo = [{ kind: "keigo", glyph: wordGlyph }];
    assert.equal(spineIntroPlan(asKeigo, BLANK, new Set(), new Set()).size, 0);
    // The identical glyph, stepping as the word it is, does owe the card.
    const asWord = [{ kind: "word", glyph: wordGlyph }];
    assert.equal(spineIntroPlan(asWord, BLANK, new Set(), new Set()).size, 1);
  });

  test("a card already shown is never planned again", () => {
    const walk = GROUPS[0].items.map((it) => ({ kind: "kanji", glyph: it.glyph }));
    const all = new Set(SPINE_ANCHORS.map((a) => a.intro.id));
    assert.equal(spineIntroPlan(walk, BLANK, new Set(), all).size, 0);
  });

  test("the ids intro-shown.ts remembers are exactly the cards' own", () => {
    // intro-shown.ts spells the ids out rather than importing the card data, so
    // that the Settings reset path does not drag the phase-intro table into its
    // bundle. This is the line that stops the two drifting.
    assert.deepEqual(
      [...CONCEPT_CARD_IDS].sort(),
      SPINE_ANCHORS.map((a) => a.intro.id).sort(),
    );
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

  test("they are due at the same character, so the emitted order decides", () => {
    assert.equal(kanji.glyph, radical.glyph);
    // CARD_ORDER runs down the hierarchy, so the card for the thing above comes
    // out first. If that ever flipped, a learner would be told what kanji are
    // built from before being told what a kanji is.
    const plan = spineIntroPlan(
      [{ kind: "kanji", glyph: kanji.glyph }],
      BLANK,
      new Set(),
      new Set(),
    );
    assert.deepEqual(
      (plan.get(0) ?? []).map((i) => i.id),
      [kanji.intro.id, radical.intro.id],
    );
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

// ONCE EVER IS THE CARD'S OWN RECORD, NOT A READING OF THE CURRICULUM.
// =====================================================================
// So these walk the progression the way the app runs it: the learner reads the
// cards a lesson shows, that is written down (markConceptCardsShown, on the way
// out of the walk), and the next lesson is planned against it.
describe("a card does not come back", () => {
  test("walking the progression fires each card exactly once", () => {
    // Bounded to a long prefix, because the gate re-reads the whole of history on
    // every step. The stretch covers every anchor several times over.
    const fired = new Map<string, number>();
    const shown = new Set<string>();
    const seen = new Set<FactId>();
    for (const g of GROUPS.slice(0, 300)) {
      const history = met([...seen, ...factsWrittenOnStart(g)]);
      for (const id of introsOf(g.facts, history, shown)) {
        if (!CARD_IDS.has(id)) continue;
        fired.set(id, (fired.get(id) ?? 0) + 1);
        shown.add(id);
      }
      for (const f of factsWrittenOnStart(g)) seen.add(f);
    }
    for (const anchor of SPINE_ANCHORS) {
      assert.equal(fired.get(anchor.intro.id), 1, `${anchor.role} fired wrongly`);
    }
  });

  test("re-walking the very lesson that showed a card does not show it again", () => {
    // The old gate excluded the teach set, so re-teaching an opening lesson
    // replayed its cards. Reading the card is what is remembered now, and a
    // lesson taken twice is still one reading.
    const first = GROUPS[0];
    const history = met(factsWrittenOnStart(first));
    const shown = new Set(introsOf(first.facts, history).filter((id) => CARD_IDS.has(id)));
    assert.ok(shown.size > 0, "the first lesson shows no card");
    assert.deepEqual(
      introsOf(first.facts, history, shown).filter((id) => CARD_IDS.has(id)),
      [],
    );
  });

  test("a later lesson that teaches the same role shows nothing", () => {
    const shown = new Set(CARD_IDS);
    for (const anchor of SPINE_ANCHORS) {
      const later = GROUPS.findLastIndex((g) =>
        g.items.some((it) => it.roles.includes(anchor.role)),
      );
      const history = met(GROUPS.slice(0, later + 1).flatMap(factsWrittenOnStart));
      assert.ok(
        !introsOf(GROUPS[later].facts, history, shown).includes(anchor.intro.id),
        `${anchor.role} introduced itself twice`,
      );
    }
  });
});

// THE BUG THE OWNER HIT, AND THE ONE THESE TESTS COULD NOT SEE BEFORE.
// ====================================================================
// She has been using the app throughout the redesign, so her account carries
// progress from the OLD separate radical track. 亅 is the seventh shape that
// track taught. An item already learned is filtered out of its lesson
// (nextCurriculumLesson hands back only what is still fresh), so her first lesson
// is 人 一 丁 with no 亅 in it at all, and a card pinned to 亅 had nothing to fire
// against. Every earlier test here started from an empty or synthetic history and
// so could never reach that state.
describe("a learner carrying progress from the old separate tracks", () => {
  /** The old radical track, as far as its first twenty shapes. Exactly the shape
   * of history the app used to write, and enough to cover 亅. */
  const OLD_RADICALS = RADICAL_TEACHING_ORDER.slice(0, 20).map((r) =>
    radicalMeaningFactId(r.glyph),
  );
  const priorProgress = met(OLD_RADICALS);

  test("her old radical progress really does thin out the first lesson", () => {
    // Asserted, not assumed. The old separate radical track taught shapes the
    // spine now folds into its opening lesson, so a learner who did any of it
    // gets a first lesson with pieces already missing. That is what removed the
    // card's old anchor, and it is why the anchor is a folded character now: one
    // that carries several facts survives the filter.
    const lesson = nextCurriculumLesson(priorProgress, LESSON_RANGE_DEFAULT)!;
    assert.ok(
      lesson.cards.length < lesson.group.items.length,
      "nothing was filtered out, so this pins nothing",
    );
    const radical = anchorFor("radical");
    assert.ok(
      lesson.cards.some((it) => it.glyph === radical.glyph),
      "the radical anchor did not survive the filter",
    );
  });

  test("the radical card still fires, on the character that carries the role", () => {
    const lesson = nextCurriculumLesson(priorProgress, LESSON_RANGE_DEFAULT)!;
    const history = met([...OLD_RADICALS, ...startFacts(lesson.facts, lesson.cards)]);
    const steps = lessonSteps(lesson.facts, history, new Set());
    const ids = steps.filter((s) => s.type === "intro").map((s) => s.key);
    assert.ok(ids.includes("track-radical"), "the radical card is still missing");
    // And ahead of an item that plays the radical role, so the label the card
    // explains is on the screen right after it.
    const cardAt = ids.indexOf("track-radical");
    const stepAt = steps.findIndex((s) => s.type === "intro" && s.key === "track-radical");
    assert.ok(cardAt >= 0 && stepAt >= 0);
    const after = steps.slice(stepAt + 1).find((s) => s.type === "item");
    assert.ok(after && after.type === "item");
    assert.ok(
      characterRoles(after.item.glyph).includes("radical"),
      `${after.item.glyph} plays no radical role`,
    );
  });

  test("the kanji card fires too, and before the radical card", () => {
    const lesson = nextCurriculumLesson(priorProgress, LESSON_RANGE_DEFAULT)!;
    const history = met([...OLD_RADICALS, ...startFacts(lesson.facts, lesson.cards)]);
    const ids = introsOf(lesson.facts, history).filter((id) => CARD_IDS.has(id));
    assert.deepEqual(ids, ["track-kanji", "track-radical"]);
  });

  test("having read them once, they do not come back", () => {
    const lesson = nextCurriculumLesson(priorProgress, LESSON_RANGE_DEFAULT)!;
    const history = met([...OLD_RADICALS, ...startFacts(lesson.facts, lesson.cards)]);
    const shown = new Set(introsOf(lesson.facts, history).filter((id) => CARD_IDS.has(id)));
    assert.deepEqual(
      introsOf(lesson.facts, history, shown).filter((id) => CARD_IDS.has(id)),
      [],
    );
  });

  test("a folded anchor survives prior progress in any one of its roles", () => {
    // Why anchoring on a folded character is the robust choice, and the reason
    // the kanji card kept working through two rounds of this bug while the
    // radical card did not. A lesson keeps any item with anything left in it, and
    // a character playing three roles has three chances to still be fresh. Prior
    // kanji progress alone does not take it away.
    const kanji = anchorFor("kanji");
    const radical = anchorFor("radical");
    const prior = met([
      ...OLD_RADICALS,
      ...kanjiTeachOrder("everyday").slice(0, 30).map(kanjiMeaningFactId),
    ]);
    const lesson = nextCurriculumLesson(prior, LESSON_RANGE_DEFAULT)!;
    for (const anchor of [kanji, radical]) {
      assert.ok(
        lesson.cards.some((it) => it.glyph === anchor.glyph),
        `the ${anchor.role} anchor did not survive`,
      );
    }
  });

  test("and every card fires even once its anchor is well past", () => {
    // The general case, and the one a learner reaches by any route: someone who
    // got several lessons in without the cards ever running. Each anchor is
    // behind them, so each card has to ride whatever carries its role next.
    const done = GROUPS.slice(0, 6).flatMap(factsWrittenOnStart);
    const lesson = nextCurriculumLesson(met(done), LESSON_RANGE_DEFAULT)!;
    for (const anchor of SPINE_ANCHORS) {
      assert.ok(
        !lesson.cards.some((it) => it.glyph === anchor.glyph),
        `${anchor.role}'s anchor is still here, so this pins nothing`,
      );
    }
    const history = met([...done, ...startFacts(lesson.facts, lesson.cards)]);
    const fired = introsOf(lesson.facts, history).filter((id) => CARD_IDS.has(id));
    // Every card whose role this lesson teaches at all, and nothing else.
    const owed = SPINE_ANCHORS.filter((a) =>
      lesson.cards.some((it) => it.roles.includes(a.role)),
    ).map((a) => a.intro.id);
    // As a set: WHICH cards fire is the point here, and their order follows the
    // items they landed on, which the tests above pin.
    assert.deepEqual([...fired].sort(), [...owed].sort());
    assert.ok(owed.length > 0, "this lesson teaches no role at all");
  });
});

// The sequence ends on two tails: the jouyou kanji no curriculum word is written
// with, then the radical-only shapes nothing at all is built from. A learner who
// gets there has read every card long ago.
describe("the orphan tails introduce nothing", () => {
  const tail = GROUPS.slice(-40);
  const shown = new Set(CARD_IDS);

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
    const before = GROUPS.slice(0, GROUPS.indexOf(orphan) + 1).flatMap(factsWrittenOnStart);
    assert.deepEqual(
      introsOf(orphan.facts, met(before), shown).filter((id) => CARD_IDS.has(id)),
      [],
    );
  });

  test("but a learner who never read the radical card gets it there", () => {
    // The once-ever gate is the card's own record, so someone who reached the
    // orphan tail without ever seeing the explanation still gets it, ahead of a
    // shape that is nothing but a radical. A card never read is not outgrown.
    const orphan = tail.find((g) =>
      g.items.every((it) => it.roles.length === 1 && it.roles[0] === "radical"),
    )!;
    const before = GROUPS.slice(0, GROUPS.indexOf(orphan) + 1).flatMap(factsWrittenOnStart);
    assert.ok(
      introsOf(orphan.facts, met(before), new Set()).includes("track-radical"),
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
