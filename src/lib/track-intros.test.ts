// Run: node --import ./src/lib/conjugate/test-hooks.mjs --test src/lib/track-intros.test.ts
//
// WHAT THESE TESTS ARE FOR
// ========================
// A track intro is the first thing a learner sees in a track, so every way it
// can be wrong is a way the FIRST screen of something is wrong, and none of them
// throws:
//
//   1. A track that can unlock with no card, or with two. Both are silent. One
//      leaves the track's vocabulary undefined (the bug this was built for); the
//      other reads as the app introducing itself twice.
//   2. The card landing after the first lesson instead of before it, which is
//      exactly the failure it exists to prevent — the word used before it is
//      taught.
//   3. The card coming back. It is an introduction; a second showing says the
//      app is not tracking what it has told you.
//
// Written against the real data and the real curriculum, deliberately: the thing
// under test is that the cards are wired to tracks the app actually has.

import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { CHAR_INDEX, kanaFact } from "../data/characters.ts";
import { COUNTER_CURRICULUM, counterMeaningFactId } from "../data/counters.ts";
import { KEIGO_SETS, keigoWordFactId } from "../data/keigo.ts";
import { patternMeaningFactId } from "../data/grammar/index.ts";
import { meaningFactId } from "../data/kanji.ts";
import { PHASE_INTROS } from "../data/phase-intros.ts";
import { radicalMeaningFactId } from "../data/radicals.ts";
import { TRACK_INTROS, TRACK_ORDER, type TrackId } from "../data/track-intros.ts";
import { wordMeaningFactId } from "../data/vocab.ts";
import { CURRICULUM_PATTERNS } from "./grammar-lesson.ts";
import { lessonSteps } from "./lesson-steps.ts";
import { RADICAL_TEACHING_ORDER } from "./radical-order.ts";
import { startedTracks, trackOf } from "./track-open.ts";
import { CURRICULUM_WORDS } from "./word-lesson.ts";
import type { FactId, HistoryFile } from "../types/index.ts";

/** A learner who has done nothing at all. */
const BLANK: HistoryFile = { sessions: [], facts: {} };

/** A learner who has met exactly these facts, by the weakest record that counts
 * — "quiz me". Enough to make them non-fresh, which is the whole gate. */
function met(facts: readonly FactId[]): HistoryFile {
  return {
    sessions: [],
    facts: {},
    seen: Object.fromEntries(facts.map((f) => [f, 1])),
  };
}

/**
 * One representative teach set per track, and the card it must open with.
 *
 * The kana entries are the literal first lesson of each script (its vowel row).
 * The other four are the first item of that track's own teaching order, which is
 * what its first lesson is built from.
 */
const SAMPLE: Readonly<Record<TrackId, FactId[]>> = {
  hiragana: [...
    "あいうえお"].map(kanaFact),
  katakana: [..."アイウエオ"].map(kanaFact),
  radical: [radicalMeaningFactId(RADICAL_TEACHING_ORDER[0].glyph)],
  kanji: [meaningFactId("人")],
  word: [wordMeaningFactId(CURRICULUM_WORDS[0].keb)],
  grammar: [patternMeaningFactId(CURRICULUM_PATTERNS[0].id)],
  // The first item of the counters track is 〜つ (ひとつ), the escape hatch it
  // opens on — see COUNTER_CURRICULUM.
  counters: [counterMeaningFactId(COUNTER_CURRICULUM[0])],
  // The first set of the keigo track is the eat / drink pair (召し上がる /
  // いただく), the canonical honorific-vs-humble contrast — see KEIGO_SETS.
  keigo: KEIGO_SETS[0].words.map((w) => keigoWordFactId(KEIGO_SETS[0], w)),
};

/**
 * The lesson AFTER the opening one, per track. The point the card must be gone.
 *
 * Deliberately a different teach set rather than the same one again: re-teaching
 * a track's first lesson DOES show its card again, on purpose (see the header of
 * track-open.ts), so re-running SAMPLE would be testing the opposite rule.
 */
const SECOND: Readonly<Record<TrackId, FactId[]>> = {
  hiragana: [..."かきくけこ"].map(kanaFact),
  katakana: [..."カキクケコ"].map(kanaFact),
  radical: [radicalMeaningFactId(RADICAL_TEACHING_ORDER[1].glyph)],
  kanji: [meaningFactId("大")],
  word: [wordMeaningFactId(CURRICULUM_WORDS[1].keb)],
  grammar: [patternMeaningFactId(CURRICULUM_PATTERNS[1].id)],
  counters: [counterMeaningFactId(COUNTER_CURRICULUM[1])],
  // A different set (the say group) — re-teaching the first would show its card
  // again on purpose, which is the opposite rule.
  keigo: KEIGO_SETS[1].words.map((w) => keigoWordFactId(KEIGO_SETS[1], w)),
};

describe("every track that can unlock has exactly one intro", () => {
  test("the table covers every track, and nothing else", () => {
    assert.deepEqual([...TRACK_ORDER].sort(), Object.keys(TRACK_INTROS).sort());
  });

  test("each track names exactly one card", () => {
    for (const track of TRACK_ORDER) {
      const intro = TRACK_INTROS[track];
      assert.ok(intro, `no intro for ${track}`);
      // One card per track — not an array, and never a second entry pointing at
      // the same track under another key.
      const owners = TRACK_ORDER.filter((t) => TRACK_INTROS[t].id === intro.id);
      assert.deepEqual(owners, [track], `${intro.id} is claimed by more than one track`);
    }
  });

  test("no track card shares an id with a phase card", () => {
    const phase = new Set(PHASE_INTROS.map((p) => p.id));
    for (const track of TRACK_ORDER) {
      assert.ok(
        !phase.has(TRACK_INTROS[track].id),
        `${TRACK_INTROS[track].id} collides with a phase intro`,
      );
    }
  });

  test("each card does its three jobs: what it is, how it helps, why now", () => {
    for (const track of TRACK_ORDER) {
      const intro = TRACK_INTROS[track];
      assert.ok(intro.title.length > 0, `${track} has no title`);
      // Three jobs, so at least three paragraphs. Counted rather than read: a
      // test cannot judge whether prose answers "why now", but it can catch a
      // card that was cut down to a definition and lost the other two.
      assert.ok(
        intro.body.length >= 3,
        `${track} has ${intro.body.length} paragraphs, too few for three jobs`,
      );
      // The eyebrow is overridden on purpose: "Before you go on" is a lie on a
      // card that nothing has gone before.
      assert.ok(intro.eyebrow, `${track} left the default eyebrow`);
    }
  });
});

describe("a track intro comes before that track's first lesson", () => {
  for (const track of TRACK_ORDER) {
    test(`${track}: the card is step ONE of the opening lesson`, () => {
      const steps = lessonSteps(SAMPLE[track], BLANK);
      assert.ok(steps.length > 0, `${track} produced no steps`);
      assert.equal(steps[0].type, "intro");
      assert.equal(
        steps[0].type === "intro" ? steps[0].intro.id : "",
        TRACK_INTROS[track].id,
      );
    });
  }

  test("hiragana's card is the very first thing in the app", () => {
    // The whole reason this exists: あ is the first character anyone is shown,
    // and before this the first screen used "kana" and expected romaji without
    // having said what either word means.
    const steps = lessonSteps(SAMPLE.hiragana, BLANK);
    assert.equal(steps[0].type === "intro" && steps[0].intro.id, "track-hiragana");
    // And it introduces both of the words the beginner probe flagged hardest.
    const prose = TRACK_INTROS.hiragana.body.map((p) => `${p.lead ?? ""} ${p.text}`).join(" ");
    assert.match(prose, /\bkana\b/i);
    assert.match(prose, /\bromaji\b/i);
  });
});

describe("a track intro shows once and does not come back", () => {
  for (const track of TRACK_ORDER) {
    test(`${track}: the second lesson of the track has no card`, () => {
      // The learner met the opening lesson. Anything taught after it in the same
      // track is past the introduction.
      const after = met(SAMPLE[track]);
      const steps = lessonSteps(SECOND[track], after);
      const intros = steps.filter(
        (s) => s.type === "intro" && s.intro.id === TRACK_INTROS[track].id,
      );
      assert.equal(intros.length, 0, `${track} introduced itself twice`);
    });
  }

  test("one item of a track is enough to have started it", () => {
    // The gate is "any record at all", not "the whole opening lesson", so a
    // learner who claimed a single character is not introduced to the script
    // afterwards.
    const oneKana = met([kanaFact("あ")]);
    const steps = lessonSteps(SECOND.hiragana, oneKana);
    assert.ok(
      steps.every((s) => s.type !== "intro" || s.intro.id !== "track-hiragana"),
    );
  });

  test("a lesson that opens a track shows its card once, not once per item", () => {
    // The hiragana vowel row is five characters. One card, not five.
    const steps = lessonSteps(SAMPLE.hiragana, BLANK);
    const cards = steps.filter(
      (s) => s.type === "intro" && s.intro.id === "track-hiragana",
    );
    assert.equal(cards.length, 1);
  });

  test("meeting one track does not introduce another", () => {
    // Having done hiragana says nothing about katakana, and must not suppress
    // its card — the two scripts are separate tracks on purpose.
    const done = met(SAMPLE.hiragana);
    const steps = lessonSteps(SAMPLE.katakana, done);
    assert.equal(steps[0].type === "intro" && steps[0].intro.id, "track-katakana");
  });
});

describe("the gate reads history, and only history", () => {
  test("a blank learner has started nothing", () => {
    assert.equal(startedTracks(BLANK, new Set()).size, 0);
  });

  test("the lesson's own facts do not count as having started its track", () => {
    // The words track marks its facts seen on Start (see startWordLesson in
    // app/page.tsx), so by the time the walk renders they are already in
    // history. Counting them would make the track "already started" at the exact
    // moment it started, and the card would never fire.
    const facts = SAMPLE.word;
    const history = met(facts);
    assert.ok(!startedTracks(history, new Set(facts)).has("word"));
    assert.ok(startedTracks(history, new Set()).has("word"));
  });

  test("the two kana scripts are told apart by the data file, not by the id", () => {
    assert.equal(trackOf("kana", "あ"), "hiragana");
    assert.equal(trackOf("kana", "ア"), "katakana");
    // A character the app no longer ships resolves to nothing rather than
    // guessing a script.
    assert.equal(CHAR_INDEX["漢"], undefined);
    assert.equal(trackOf("kana", "漢"), null);
  });

  test("a subject with no opening card resolves to no track", () => {
    // Transitivity keeps its own card in phase-intros.ts; a second one here
    // would introduce the track twice. See TRACK_INTROS.
    assert.equal(trackOf("transitivity", "開く"), null);
    assert.equal(trackOf(undefined, "あ"), null);
  });
});

describe("a caller with no history gets the walk it always got", () => {
  test("omitting history emits no track cards at all", () => {
    // The signature is optional so every existing caller and test is unchanged.
    const steps = lessonSteps(SAMPLE.hiragana);
    assert.ok(
      steps.every((s) => s.type !== "intro" || !s.intro.id.startsWith("track-")),
    );
    assert.equal(steps.length, 5);
  });
});

describe("the drafts obey the voice rules even while they are drafts", () => {
  const strings = TRACK_ORDER.flatMap((t) => {
    const intro = TRACK_INTROS[t];
    return [
      intro.title,
      intro.eyebrow ?? "",
      ...intro.body.flatMap((p) => [p.lead ?? "", p.text]),
    ];
  });

  test("no em dash in anything a learner reads", () => {
    for (const s of strings) {
      assert.ok(!s.includes("—"), `em dash in learner copy: ${s}`);
    }
  });

  test("a learner never 'meets' a word — they learn or encounter one", () => {
    for (const s of strings) {
      assert.ok(!/\bmet a word\b|\bmeet a word\b/i.test(s), `"meet a word" in: ${s}`);
    }
  });

  test("kana rows are rows, never columns", () => {
    for (const s of strings) {
      assert.ok(!/\bcolumn\b/i.test(s), `"column" in: ${s}`);
    }
  });
});
