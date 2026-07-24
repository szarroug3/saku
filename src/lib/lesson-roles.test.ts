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
//
// AND THEN THE TRIM
// =================
// Delivering all three roles' material at once made the folded step a wall, so
// two of its sections moved out to the Library: the readings the kanji takes
// inside words, and the kanji built on the shape. The suite below pins the
// smaller lesson AND the fact that the Library still carries what left, because
// "we stopped showing it" and "we lost it" look identical from the lesson's side.

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, test } from "node:test";

import { kanaEntry } from "@/data/characters";
import { kanjiEntry } from "@/data/kanji";
import { patternEntry } from "@/data/grammar";
import { radicalEntry } from "@/data/radicals";
import { vocabRow, wordEntry } from "@/data/vocab";
import type { LessonItem, LessonKind } from "@/lib/lesson-items";
import { usedAsPartIn } from "@/lib/library/components";
import { libEntry, readingRowsOf } from "@/lib/library/entries";
import {
  canHearItem,
  headwordSubtitle,
  kanjiEntryOf,
  kanjiMeanings,
  lessonRoles,
  lessonSections,
  lessonWord,
  roleHasSections,
  strokeFallbackOf,
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

describe("lessonSections — a section per role, up the ladder", () => {
  test("人 teaches the shape, then the character, then the word, then how it's drawn", () => {
    assert.deepEqual(lessonSections(FOLDED), [
      "radical-note",
      "kanji-meaning",
      "word-sense",
      "word-readings",
      "word-example",
      "how-its-written",
    ]);
  });

  test("THE ORDER FLIPPED: radicals build kanji, kanji build words, and the page says it that way round now", () => {
    const got = lessonSections(FOLDED);
    assert.ok(
      got.indexOf("radical-note") < got.indexOf("kanji-meaning"),
      "the shape comes before the character built on it",
    );
    assert.ok(
      got.indexOf("kanji-meaning") < got.indexOf("word-sense"),
      "the character comes before the word it makes",
    );
  });

  test("the trim holds: no readings table, no list of kanji built on the shape", () => {
    for (const s of lessonSections(FOLDED)) {
      assert.notEqual(s as string, "kanji-readings");
      assert.notEqual(s as string, "radical-kanji");
    }
  });

  test("the character's material survives the fold: it is found by glyph, not by the step's entry", () => {
    assert.deepEqual(lessonSections(RADICAL_SIDE), lessonSections(FOLDED));
    assert.deepEqual(kanjiMeanings(RADICAL_SIDE), ["person"]);
  });

  test("every role a folded character plays still has a block on the page", () => {
    const sections = lessonSections(FOLDED);
    for (const role of ["word", "kanji", "radical"] as const) {
      assert.ok(roleHasSections(role, sections), `${role} still claims a block`);
    }
  });

  test("a plain kanji keeps its meaning and its parts and its strokes, and loses its readings", () => {
    assert.deepEqual(lessonSections(step(kanjiEntry("明"), "明", "kanji")), [
      "kanji-meaning",
      "kanji-parts",
      "how-its-written",
    ]);
  });

  test("A SINGLE-ROLE KANJI NOW KEEPS ITS DEFINITION, because its heading is the only label left", () => {
    // It used to be suppressed: the definition is also on the headword line, and
    // the badge in the corner already said "Kanji". The badge is gone, so the
    // block under the "Kanji" heading has to have something in it, and the
    // definition is the thing the trim left standing.
    assert.deepEqual(lessonSections(step(kanjiEntry("乞"), "乞", "kanji")), [
      "kanji-meaning",
      "how-its-written",
    ]);
  });

  test("a radical that is no kanji still gets its line, so its heading is not bare", () => {
    const sections = lessonSections(step(radicalEntry("亅"), "亅", "radical"));
    assert.deepEqual(sections, ["radical-note", "how-its-written"]);
    assert.equal(roleHasSections("radical", sections), true);
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

describe("roleHasSections — a block for every role the character plays, and no others", () => {
  test("人 has something to show for each of its three roles", () => {
    const sections = lessonSections(FOLDED);
    for (const role of ["radical", "kanji", "word"] as const) {
      assert.ok(roleHasSections(role, sections), `${role} has sections`);
    }
  });

  test("乞 claims the kanji block it plays and neither of the two it does not", () => {
    const sections = lessonSections(step(kanjiEntry("乞"), "乞", "kanji"));
    assert.equal(roleHasSections("kanji", sections), true);
    assert.equal(roleHasSections("radical", sections), false);
    assert.equal(roleHasSections("word", sections), false);
  });

  test("明 keeps a kanji block, and claims nothing it is not", () => {
    const sections = lessonSections(step(kanjiEntry("明"), "明", "kanji"));
    assert.equal(roleHasSections("kanji", sections), true);
    assert.equal(roleHasSections("radical", sections), false);
    assert.equal(roleHasSections("word", sections), false);
  });

  test("a kana and a pattern claim no role block at all", () => {
    for (const s of [
      step(kanaEntry("あ"), "あ", "kana"),
      step(patternEntry("te-kara"), "〜てから", "grammar"),
    ]) {
      const sections = lessonSections(s);
      for (const role of ["radical", "kanji", "word"] as const) {
        assert.equal(roleHasSections(role, sections), false);
      }
    }
  });
});

describe("the headings, and the badge they replaced", () => {
  const view = readFileSync(
    fileURLToPath(new URL("../components/lesson/lesson-item-view.tsx", import.meta.url)),
    "utf8",
  );
  const roleBlock = readFileSync(
    fileURLToPath(new URL("../components/lesson/role-block.tsx", import.meta.url)),
    "utf8",
  );

  test("the role badge is off the lesson header", () => {
    assert.doesNotMatch(view, /<RoleBadge/);
    assert.doesNotMatch(view, /ROLE_NOTE/);
  });

  test("the headings say the badge's own three nouns, and none of the old prose labels", () => {
    for (const title of ['title: "Radical"', 'title: "Kanji"', 'title: "Word"']) {
      assert.ok(roleBlock.includes(title), `${title} is the heading`);
    }
    // Only what is PRINTED: the file's own notes still name the old labels,
    // because saying what changed is why they are there.
    const printed = roleBlock.slice(roleBlock.indexOf("const ROLE_HEADING"));
    assert.doesNotMatch(printed, /As a word|As a kanji|As a building block/);
  });

  test("each heading leads with a line, so no role is a heading over nothing", () => {
    const leads = [...roleBlock.matchAll(/lead:\s*\n?\s*"([^"]+)"/g)].map((m) => m[1]);
    assert.equal(leads.length, 3, "one line per role");
    assert.equal(new Set(leads).size, 3, "and three different lines");
    for (const l of leads) assert.ok(l.length > 40, `"${l}" says something`);
  });
});

describe("the Library keeps what the lesson dropped", () => {
  const entryPage = readFileSync(
    fileURLToPath(new URL("../app/library/[...entry]/page.tsx", import.meta.url)),
    "utf8",
  );

  test("人's five in-word readings are still there to be read, off the same entry", () => {
    const shape = kanjiEntryOf(FOLDED);
    assert.ok(shape, "人 has a kanji entry");
    assert.equal(readingRowsOf(shape).length, 5);
  });

  test("and the 22 kanji built on the shape are still joined up", () => {
    assert.ok(usedAsPartIn("人").length > 10);
  });

  test("the entry page mounts both, so the reference is where they went", () => {
    assert.match(entryPage, /<KanjiReadings/);
    assert.match(entryPage, /<ComponentUses/);
  });

  test("the entry page's own material is untouched by the lesson's section list", () => {
    // The two views never shared a list: nothing under app/library asks
    // lessonSections, which is why the lesson could shrink on its own.
    assert.doesNotMatch(entryPage, /lessonSections/);
    assert.ok(libEntry(kanjiEntry("人"))?.meanings.length);
  });
});

describe("strokeFallbackOf — what 'how it's written' says with no diagram in", () => {
  test("THE BUG: 人 reached as a word gave up and said 'whole shape'", () => {
    // The old test was `item.kind === "kanji"`, and this step's kind is "word",
    // so both the parts branch and the count branch were skipped on a character
    // whose stroke count has been on file all along.
    const asWord = step(wordEntry("人"), "人", "word");
    assert.deepEqual(strokeFallbackOf(asWord), { show: "strokes", strokes: 2 });
  });

  test("and it is the same answer from every track, which is the whole point", () => {
    for (const s of [FOLDED, RADICAL_SIDE, step(wordEntry("人"), "人", "word")]) {
      assert.deepEqual(strokeFallbackOf(s), { show: "strokes", strokes: 2 });
    }
  });

  test("a kanji made of taught parts shows the breakdown on the lesson", () => {
    const got = strokeFallbackOf(step(kanjiEntry("明"), "明", "kanji"));
    assert.equal(got.show, "parts");
    assert.deepEqual(
      got.show === "parts" ? got.parts.map((p) => p.c) : [],
      ["日", "月"],
    );
  });

  test("the Library suppresses the breakdown and falls to the count", () => {
    assert.deepEqual(strokeFallbackOf(step(kanjiEntry("明"), "明", "kanji"), true), {
      show: "strokes",
      strokes: 8,
    });
  });

  test("a kana and a pattern have no count of their own, so they say nothing", () => {
    assert.deepEqual(strokeFallbackOf(step(kanaEntry("あ"), "あ", "kana")), {
      show: "whole",
    });
    assert.deepEqual(
      strokeFallbackOf(step(patternEntry("te-kara"), "〜てから", "grammar")),
      { show: "whole" },
    );
  });

  test("a multi-character word has no single shape either", () => {
    assert.deepEqual(strokeFallbackOf(step(wordEntry("学生"), "学生", "word")), {
      show: "whole",
    });
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
  test("人 is a noun, a suffix and a counter, and each sense says which", () => {
    const senses = vocabRow("人")!.senses;
    assert.deepEqual(
      senses.map((s) => [s.reb, wordTypeOf(s)]),
      [
        ["ひと", "noun"],
        ["じん", "suffix"],
        ["にん", "counter"],
      ],
    );
  });

  test("a counter tag under a noun is still a noun: 山 counts heaps and is a mountain", () => {
    assert.equal(vocabRow("山")!.pos[0], "counter");
    assert.equal(wordTypeOf(vocabRow("山")!), "noun");
  });

  test("the everyday four are untouched", () => {
    assert.equal(wordTypeOf(vocabRow("食べる")!), "verb");
    assert.equal(wordTypeOf(vocabRow("学生")!), "noun");
    assert.equal(wordTypeOf(vocabRow("山")!), "noun");
    assert.equal(wordTypeOf(vocabRow("何")!), "adverb");
  });
});
