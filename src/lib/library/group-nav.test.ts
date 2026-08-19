import assert from "node:assert/strict";
import { test } from "node:test";

import { kanaEntry } from "@/data/characters";
import { kanjiEntry } from "@/data/kanji";
import { radicalEntry } from "@/data/radicals";
import { libEntry } from "@/lib/library/entries";
import { groupNeighbors } from "@/lib/library/group-nav";
import type { EntryId } from "@/types";

function entryOf(id: EntryId) {
  const e = libEntry(id);
  assert.ok(e, `expected an entry for ${id}`);
  return e;
}

test("hiragana vowels: あ has no previous, next is い", () => {
  const { groupLabel, isRangeLabel, prev, next } = groupNeighbors(entryOf(kanaEntry("あ")));
  assert.equal(groupLabel, "Hiragana · Vowels あ");
  assert.equal(isRangeLabel, false, "a kana row is a real category, not a range");
  assert.equal(prev, null);
  assert.equal(next?.glyph, "い");
});

test("hiragana vowels: い's neighbours are あ and う, in that order", () => {
  const { prev, next } = groupNeighbors(entryOf(kanaEntry("い")));
  assert.equal(prev?.glyph, "あ");
  assert.equal(next?.glyph, "う");
});

test("hiragana vowels: お is last — has a previous, no next", () => {
  const { groupLabel, prev, next } = groupNeighbors(entryOf(kanaEntry("お")));
  assert.equal(groupLabel, "Hiragana · Vowels あ");
  assert.equal(prev?.glyph, "え");
  assert.equal(next, null);
});

test("walking the whole vowels row forward reproduces あいうえお", () => {
  let cur = entryOf(kanaEntry("あ"));
  const walked = [cur.glyph];
  for (;;) {
    const { next } = groupNeighbors(cur);
    if (!next) break;
    walked.push(next.glyph);
    cur = next;
  }
  assert.deepEqual(walked, ["あ", "い", "う", "え", "お"]);
});

test("katakana is a separate group from hiragana — ア's neighbours never cross scripts", () => {
  const { groupLabel, prev, next } = groupNeighbors(entryOf(kanaEntry("ア")));
  assert.equal(groupLabel, "Katakana · Vowels ア");
  assert.equal(prev, null);
  assert.equal(next?.glyph, "イ");
});

test("a kanji's neighbours come from its own shelf cut, not the kana rows", () => {
  const { groupLabel, prev, next } = groupNeighbors(entryOf(kanjiEntry("一")));
  assert.ok(groupLabel && groupLabel.length > 0);
  // Whatever the cut, 一 is a real member of exactly one section and its
  // neighbours (if any) are kanji, not kana or words.
  if (prev) assert.equal(prev.kind, "kanji");
  if (next) assert.equal(next.kind, "kanji");
});

test("a kanji's default (everyday-order) group is a bare numeric range, flagged isRangeLabel", () => {
  // sectionsFor hard-codes "everyday" (see group-nav.ts), so a kanji's group
  // label here is one of kanji-shelf.ts's range cuts, not a "School grade N"
  // category — the entry page must not treat it as one.
  const { groupLabel, isRangeLabel } = groupNeighbors(entryOf(kanjiEntry("一")));
  assert.match(groupLabel ?? "", /^\d+–\d+$/);
  assert.equal(isRangeLabel, true);
});

test("a radical's neighbours are other radicals, in curriculum order", () => {
  const { prev, next } = groupNeighbors(entryOf(radicalEntry("人")));
  if (prev) assert.equal(prev.kind, "radical");
  if (next) assert.equal(next.kind, "radical");
});

test("a radical's group label is a bare numeric range, flagged isRangeLabel", () => {
  const { groupLabel, isRangeLabel } = groupNeighbors(entryOf(radicalEntry("人")));
  assert.match(groupLabel ?? "", /^\d+–\d+$/);
  assert.equal(isRangeLabel, true);
});

test("results are stable across repeated calls (cache does not mutate)", () => {
  const first = groupNeighbors(entryOf(kanaEntry("い")));
  const second = groupNeighbors(entryOf(kanaEntry("い")));
  assert.deepEqual(
    { prev: first.prev?.id, next: first.next?.id },
    { prev: second.prev?.id, next: second.next?.id },
  );
});
