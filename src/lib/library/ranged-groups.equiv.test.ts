// THE SAFETY NET for ranged-groups.ts's content-free curriculumPosition — it
// must match curriculum-order.ts's live curriculumPosition exactly (via
// CURRICULUM_GLYPHS, /learn's Phase-1 precompute), since the words shelf's
// climb order depends on it.

import { test } from "node:test";
import assert from "node:assert/strict";

import { curriculumPosition as liveCurriculumPosition } from "@/lib/curriculum-order";
import { CURRICULUM_GLYPHS } from "@/lib/content/learn-index";
import { curriculumRank } from "@/lib/library/ranged-groups";
import type { LibEntry } from "@/lib/library/entries";

const UNRANKED = Number.POSITIVE_INFINITY;

function entryFor(glyph: string): LibEntry {
  return { id: "kanji:x", kind: "kanji", glyph, readings: [], meanings: [], sub: "", weight: 0 } as unknown as LibEntry;
}

test("curriculumRank agrees with the live curriculumPosition for every curriculum glyph", () => {
  for (const glyph of CURRICULUM_GLYPHS) {
    const live = liveCurriculumPosition(glyph);
    const pre = curriculumRank(entryFor(glyph));
    assert.equal(pre, live === -1 ? UNRANKED : live, `glyph ${glyph}`);
  }
});

test("curriculumRank is UNRANKED for a glyph the curriculum doesn't teach", () => {
  assert.equal(curriculumRank(entryFor("〜")), UNRANKED);
  assert.equal(liveCurriculumPosition("〜"), -1);
});
