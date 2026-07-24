// Run: node --import ./src/lib/conjugate/test-hooks.mjs --test \
//        src/lib/library/ranged-groups.test.ts
//
// WHAT THIS TEST IS FOR
// =====================
// `rangedGroups` is the one cut the words and radicals shelves now take: order
// the subject in teaching order, then break it into ranges. Two things must hold
// or the shelf lies. The CHUNKING must tile the whole ordered list — no gap, no
// overlap, no duplicate, and a label that names the real span — because a shelf
// headed "51–100" that skips a word is worse than no label. The ORDER must be the
// teaching order it claims: `wordRank` ascends by beginnerRank (the bug it
// replaces opened the words shelf with あべこべ), and both ranks push an item the
// order does not place to the very END, never rank 0.

import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { KANJI_SUBJECT } from "../../data/kanji.ts";
import { vocabRow } from "../../data/vocab.ts";
import { curriculumPosition } from "../curriculum-order.ts";
import { curriculumRank, GROUP_SIZE, rangedGroups, wordRank } from "./ranged-groups.ts";
import { type LibEntry } from "./entries.ts";
import type { EntryId } from "../../types/index.ts";

/** A stand-in entry. `rangedGroups` reads `.id` and hands the whole entry to the
 * rank function, which reads `.glyph`; the rest is filler for the type. */
function entry(id: string, glyph = id): LibEntry {
  return {
    id: id as EntryId,
    kind: KANJI_SUBJECT,
    glyph,
    readings: [],
    meanings: [],
    sub: "",
    weight: 0,
  };
}

/** `n` entries whose ids are `${prefix}-0 … ${prefix}-(n-1)`. */
function entries(prefix: string, n: number): LibEntry[] {
  return Array.from({ length: n }, (_, i) => entry(`${prefix}-${i}`));
}

/** A real word entry: its glyph is a real keb, so `wordRank` finds a rank. */
function word(keb: string): LibEntry {
  return entry(`w:${keb}`, keb);
}

describe("rangedGroups chunks an ordered list into labelled ranges", () => {
  // Rank by a number embedded in the id, so the sort is observable.
  const byTail = (e: LibEntry) => Number(e.id.split("-")[1]);

  test("full ranges are labelled by their 1-based span", () => {
    const groups = rangedGroups(entries("x", 120), byTail, 50);
    assert.deepEqual(
      groups.map((g) => g.label),
      ["1–50", "51–100", "101–120"],
      "two full ranges then a short tail that names its real end",
    );
    assert.deepEqual(
      groups.map((g) => g.entries.length),
      [50, 50, 20],
    );
  });

  test("the ranges tile the whole list — no gap, no overlap, no duplicate", () => {
    const all = entries("x", 137);
    const groups = rangedGroups(all, byTail, GROUP_SIZE);
    const flat = groups.flatMap((g) => g.entries.map((e) => e.id));
    assert.equal(flat.length, all.length, "every entry lands in exactly one range");
    assert.equal(new Set(flat).size, all.length, "no id appears twice");
    assert.deepEqual(
      flat,
      all.map((e) => e.id),
      "and in rank order (the ids already ascend by their tail)",
    );
    assert.ok(
      groups.every((g) => g.entries.length > 0),
      "no empty range",
    );
  });

  test("it sorts by rank before chunking, whatever order the input is in", () => {
    const shuffled = [entry("x-2"), entry("x-0"), entry("x-1")];
    const groups = rangedGroups(shuffled, byTail, 2);
    assert.deepEqual(
      groups.flatMap((g) => g.entries.map((e) => e.id)),
      ["x-0", "x-1", "x-2"],
    );
  });

  test("ties fall back to input order, so the cut is stable", () => {
    const flat = ["a", "b", "c", "d"].map((id) => entry(id));
    const groups = rangedGroups(flat, () => 0, 2); // every rank equal
    assert.deepEqual(
      groups.flatMap((g) => g.entries.map((e) => e.id)),
      ["a", "b", "c", "d"],
    );
  });

  test("an empty subject makes no ranges", () => {
    assert.deepEqual(rangedGroups([], byTail), []);
  });
});

describe("wordRank is the beginner's teaching order", () => {
  test("ascending by beginnerRank, whatever order the words arrive in", () => {
    const kebs = ["電話", "何", "行く", "言う", "あなた"];
    const shuffled = kebs.map(word);
    assert.ok(
      shuffled.every((e) => typeof vocabRow(e.glyph)?.beginnerRank === "number"),
      "the fixture must be real vocab, or this pins nothing",
    );
    const out = [...shuffled].sort((a, b) => wordRank(a) - wordRank(b));
    const ranks = out.map((e) => vocabRow(e.glyph)!.beginnerRank);
    assert.deepEqual(ranks, [...ranks].sort((a, b) => a - b), "ascending");
  });

  test("an unranked word sorts LAST, never first", () => {
    // 何 is rank 1 — the very front. A made-up glyph has no row, so read as rank
    // 0 it would displace 何 and open the shelf, the original あべこべ bug.
    const groups = rangedGroups([word("何"), entry("w:none", "＊not-a-word＊")], wordRank, 50);
    const flat = groups.flatMap((g) => g.entries.map((e) => e.glyph));
    assert.equal(flat[0], "何");
    assert.equal(flat[flat.length - 1], "＊not-a-word＊");
  });
});

describe("curriculumRank is the curriculum spine's order", () => {
  test("a glyph the spine teaches ranks at its spine position", () => {
    // 人 is item 1 of the spine (see curriculum-order.ts). Whatever its exact
    // index, curriculumRank must equal curriculumPosition, not lose it.
    const p = curriculumPosition("人");
    assert.ok(p >= 0, "人 must be in the spine, or this pins nothing");
    assert.equal(curriculumRank(entry("kanji:人", "人")), p);
  });

  test("a glyph the spine does not teach sorts last", () => {
    assert.equal(curriculumPosition("＊not-a-glyph＊"), -1);
    assert.equal(curriculumRank(entry("x", "＊not-a-glyph＊")), Number.POSITIVE_INFINITY);
  });

  test("ordering a mix puts the taught glyph before the untaught one", () => {
    const groups = rangedGroups(
      [entry("x", "＊not-a-glyph＊"), entry("kanji:人", "人")],
      curriculumRank,
      50,
    );
    const flat = groups.flatMap((g) => g.entries.map((e) => e.glyph));
    assert.deepEqual(flat, ["人", "＊not-a-glyph＊"]);
  });
});
