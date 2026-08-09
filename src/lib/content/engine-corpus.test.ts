// Run: node --import ./src/lib/conjugate/test-hooks.mjs --test src/lib/content/engine-corpus.test.ts
//
// The synthetic scheduler.test.ts proves the ALGORITHM. This proves the three
// real parts compose on REAL data: buildItem's prereq edges, resolveItem's
// corpus map, and planLesson's ordering. It's the §4 prereq-monotonicity
// invariant checked against the actual kanji DAG, not hand-built items — the
// class of bug a mismatch between builtPieceEntryId and the resolve map would
// hide.

import assert from "node:assert/strict";
import test from "node:test";

import { planLesson } from "./scheduler.ts";
import { resolveItem } from "./resolve.ts";
import { kanjiEntry } from "@/data/kanji";
import type { ContentItem } from "./item";

const roomy = { min: 100, max: 100 }; // never caps — we want the whole cascade
const cost1 = () => 1;

test("engine × corpus — every emitted item follows its resolvable prereqs", () => {
  // Compounds whose components are themselves kanji, so the edges resolve:
  // 森→木, 明→日·月, 三→一. planLesson pulls each component ahead of its user.
  const order = ["森", "明", "三"].map((g) => resolveItem(kanjiEntry(g))!);
  assert.ok(order.every(Boolean), "the seed kanji are in the corpus");

  const out = planLesson(order, resolveItem, () => true, cost1, roomy);
  const at = new Map(out.map((it, i) => [it.entry, i]));

  for (const it of out) {
    for (const p of it.prereqs) {
      if (at.has(p)) {
        assert.ok(
          at.get(p)! < at.get(it.entry)!,
          `${p} must be taught before ${it.entry}`,
        );
      }
    }
  }

  // Prove the cross-item pull actually fired on real edges (not a vacuous pass).
  assert.ok(at.has(kanjiEntry("木")), "森 pulled its component 木 into the lesson");
  assert.ok(
    at.get(kanjiEntry("木"))! < at.get(kanjiEntry("森"))!,
    "木 is taught before 森",
  );
  assert.ok(at.has(kanjiEntry("一")), "三 pulled its component 一");
});

test("engine × corpus — a component already learned is not re-taught", () => {
  const order = [resolveItem(kanjiEntry("森"))!];
  const learned = (i: ContentItem) => i.glyph !== "木"; // 木 already known
  const out = planLesson(order, resolveItem, learned, cost1, roomy);
  const glyphs = out.map((i) => i.glyph);
  assert.ok(glyphs.includes("森"), "森 is still taught");
  assert.ok(!glyphs.includes("木"), "its known component 木 is skipped, not re-taught");
});
