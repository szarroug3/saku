// Run: node --import ./src/lib/conjugate/test-hooks.mjs --test \
//        src/lib/lesson-roles.test.ts
//
// THE BUG
// =======
// The lesson view branched on `LessonItem.kind`, and an item carries exactly one
// kind. 人 is a radical AND a kanji AND a word, its badge said so, and the body
// of its lesson showed the kanji material alone: the readings it takes inside
// longer words, and nothing at all about being ひと-shaped material you can say
// on its own. The speaker was gated the same way (`kind === "kana" || kind ===
// "word"`), so the one screen whose subject is a pronounceable word offered no
// way to hear it.
//
// These tests pin the two decisions that fix it — which roles a step plays, and
// which sections those roles earn — and, just as importantly, that a step which
// really is one thing (a kana, a plain kanji, a two-character word, a grammar
// pattern) comes out exactly as it did before roles were a set.

import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { kanaEntry } from "@/data/characters";
import { kanjiEntry } from "@/data/kanji";
import { patternEntry } from "@/data/grammar";
import { radicalEntry } from "@/data/radicals";
import { vocabRow, wordEntry } from "@/data/vocab";
import type { LessonItem, LessonKind } from "@/lib/lesson-items";
import {
  canHearItem,
  headwordSubtitle,
  lessonRoles,
  lessonSections,
  lessonWord,
  roleHasSections,
  wordTypeOf,
} from "@/lib/lesson-roles";
import type { EntryId } from "@/types";

function step(entry: EntryId, glyph: string, kind: LessonKind): LessonItem {
  return { entry, glyph, kind, facts: [] };
}

/** 人 as the curriculum hands it over: one step, on the kanji track, for a
 * character that is also a radical and also a word. */
const FOLDED = step(kanjiEntry("人"), "人", "kanji");
/** The same character reached from the radical track, which the combined
 * curriculum does for shapes it teaches early (火). */
const RADICAL_SIDE = step(radicalEntry("人"), "人", "radical");

describe("lessonRoles — every role the step teaches, not just the track it came on", () => {
  test("人 plays all three, whichever track the step arrived on", () => {
    assert.deepEqual(lessonRoles(FOLDED), ["radical", "kanji", "word"]);
    assert.deepEqual(lessonRoles(RADICAL_SIDE), ["radical", "kanji", "word"]);
  });

  test("a kanji that is neither a radical nor a word plays one role", () => {
    assert.deepEqual(lessonRoles(step(kanjiEntry("乞"), "乞", "kanji")), ["kanji"]);
  });

  test("a two-character word keeps the word role the tables cannot see", () => {
    assert.deepEqual(lessonRoles(step(wordEntry("学生"), "学生", "word")), ["word"]);
  });

  test("kana and grammar play none", () => {
    assert.deepEqual(lessonRoles(step(kanaEntry("あ"), "あ", "kana")), []);
    assert.deepEqual(lessonRoles(step(patternEntry("te-kara"), "〜てから", "grammar")), []);
  });
});

describe("lessonSections — a section per role, word first", () => {
  test("人 teaches its word sense, its readings and what it builds", () => {
    const sections = lessonSections(FOLDED);
    assert.ok(sections.includes("word-sense"), "the word's sound and meaning");
    assert.ok(sections.includes("kanji-readings"), "the in-word readings");
    assert.ok(sections.includes("radical-kanji"), "the kanji built on the shape");
    assert.ok(
      sections.indexOf("word-sense") < sections.indexOf("kanji-readings"),
      "the word comes first, as the badge's own sentence orders it",
    );
  });

  test("the readings survive the fold: they are found by glyph, not by the step's entry", () => {
    assert.ok(lessonSections(RADICAL_SIDE).includes("kanji-readings"));
  });

  test("a plain kanji is unchanged: parts, readings, how it's written", () => {
    assert.deepEqual(lessonSections(step(kanjiEntry("明"), "明", "kanji")), [
      "kanji-parts",
      "kanji-readings",
      "how-its-written",
    ]);
  });

  test("a two-character word is unchanged, and gains no word-sense panel", () => {
    const sections = lessonSections(step(wordEntry("食べる"), "食べる", "word"));
    assert.deepEqual(sections, ["word-forms", "word-readings", "word-example"]);
    assert.ok(!sections.includes("word-sense"), "its header already says both");
  });

  test("a kana gets the stroke section and nothing else", () => {
    assert.deepEqual(lessonSections(step(kanaEntry("あ"), "あ", "kana")), [
      "how-its-written",
    ]);
  });

  test("a grammar pattern gets the three pattern sections and no stroke order", () => {
    assert.deepEqual(lessonSections(step(patternEntry("te-kara"), "〜てから", "grammar")), [
      "grammar-build",
      "grammar-example",
      "grammar-family",
    ]);
  });

  test("transitivity and keigo have their own card, so they claim no sections", () => {
    assert.deepEqual(lessonSections(step("x" as EntryId, "上がる／上げる", "transitivity")), []);
    assert.deepEqual(lessonSections(step("y" as EntryId, "召し上がる", "keigo")), []);
  });
});

describe("roleHasSections — a role heading only over material that is there", () => {
  test("人 has something to show for each of its three roles", () => {
    const sections = lessonSections(FOLDED);
    for (const role of ["word", "kanji", "radical"] as const) {
      assert.ok(roleHasSections(role, sections), `${role} has sections`);
    }
  });

  test("a role with no sections gets no heading", () => {
    const sections = lessonSections(step(kanjiEntry("乞"), "乞", "kanji"));
    assert.equal(roleHasSections("kanji", sections), true);
    assert.equal(roleHasSections("radical", sections), false);
    assert.equal(roleHasSections("word", sections), false);
  });
});

describe("lessonWord — the word lives under its own entry", () => {
  test("a folded character reaches the same row the words track would teach", () => {
    assert.equal(lessonWord(FOLDED), vocabRow("人"));
    assert.equal(lessonWord(FOLDED), lessonWord(step(wordEntry("人"), "人", "word")));
  });

  test("and it carries a reading, which is what the lesson was missing", () => {
    assert.ok((lessonWord(FOLDED)?.reb ?? "").length > 0);
  });

  test("a kanji that is no word reaches nothing", () => {
    assert.equal(lessonWord(step(kanjiEntry("乞"), "乞", "kanji")), undefined);
  });
});

describe("canHearItem — pronounceable, whichever track it came on", () => {
  test("a folded character is a word, so it can be heard", () => {
    assert.equal(canHearItem(FOLDED), true);
    assert.equal(canHearItem(RADICAL_SIDE), true);
  });

  test("kana and words are still audible, meanings and patterns still silent", () => {
    assert.equal(canHearItem(step(kanaEntry("あ"), "あ", "kana")), true);
    assert.equal(canHearItem(step(wordEntry("学生"), "学生", "word")), true);
    assert.equal(canHearItem(step(kanjiEntry("乞"), "乞", "kanji")), false);
    assert.equal(canHearItem(step(patternEntry("te-kara"), "〜てから", "grammar")), false);
  });
});

describe("headwordSubtitle — one honest line for a character that is several things", () => {
  test("a character with a kanji card leads with the character's meaning", () => {
    assert.equal(headwordSubtitle(FOLDED), "person");
    assert.equal(headwordSubtitle(RADICAL_SIDE), "person");
  });

  test("a word that is only a word keeps its reading and its glosses", () => {
    assert.equal(headwordSubtitle(step(wordEntry("食べる"), "食べる", "word")), "たべる: to eat");
  });

  test("a kana keeps its reading, a pattern its meaning", () => {
    assert.equal(headwordSubtitle(step(kanaEntry("あ"), "あ", "kana")), "a");
    assert.ok(headwordSubtitle(step(patternEntry("te-kara"), "〜てから", "grammar")).length > 0);
  });
});

describe("wordTypeOf — the tail cases the vocabulary really holds", () => {
  test("人's only vocabulary row is a suffix, and says so", () => {
    assert.equal(wordTypeOf(vocabRow("人")!), "suffix");
  });

  test("the everyday four are untouched", () => {
    assert.equal(wordTypeOf(vocabRow("食べる")!), "verb");
    assert.equal(wordTypeOf(vocabRow("学生")!), "noun");
    assert.equal(wordTypeOf(vocabRow("山")!), "noun");
    assert.equal(wordTypeOf(vocabRow("何")!), "adverb");
  });
});
