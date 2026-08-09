// Run: node --import ./src/lib/conjugate/test-hooks.mjs --test src/lib/content/resolve.test.ts

import assert from "node:assert/strict";
import test from "node:test";

import { resolveItem } from "./resolve.ts";
import { kanjiEntry } from "@/data/kanji";
import { wordEntry } from "@/data/vocab";

test("resolveItem — a kanji prereq resolves to its kanji item", () => {
  const item = resolveItem(kanjiEntry("三"));
  assert.ok(item, "三 is in the kanji corpus");
  assert.equal(item!.glyph, "三");
  assert.equal(item!.kind, "kanji");
});

test("resolveItem — a prereq edge from another item lands on a real item", () => {
  // 三's Built-from prereq is the kanji 一; the scheduler follows that edge here.
  const san = resolveItem(kanjiEntry("三"))!;
  assert.ok(san.prereqs.includes(kanjiEntry("一")), "三 needs 一");
  const one = resolveItem(kanjiEntry("一"));
  assert.ok(one, "and that edge resolves to the kanji 一's item");
  assert.equal(one!.glyph, "一");
});

test("resolveItem — a non-kanji entry is not (yet) in the corpus", () => {
  // The word entry shares the glyph 三 but is a different entry; only kanji are
  // indexed today. Undefined, not a wrong hit.
  assert.equal(resolveItem(wordEntry("三")), undefined);
});
