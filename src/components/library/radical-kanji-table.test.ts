// Run: node --import ./src/lib/conjugate/test-hooks.mjs --test \
//        src/components/library/radical-kanji-table.test.ts
//
// WHAT THIS TEST IS FOR
// =====================
// A radical's kanji are shown as a TABLE ordered by the CURRICULUM order the
// kanji track teaches in — not the raw index order KRADFILE happens to store,
// and not by frequency. The sort key is `orderRow(c).i`. If that key is dropped
// the table still renders, just in the wrong order, so the order is pinned here
// against the data. The two callers (the radical lesson card, cap 5; the radical
// Library entry, cap 30) must share this one component rather than author the
// table twice, so the wiring is pinned too.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { orderRow } from "../../data/kanji.ts";
import { usedAsPartIn } from "../../lib/library/components.ts";

const read = (rel: string) =>
  readFileSync(fileURLToPath(new URL(rel, import.meta.url)), "utf8");

const learningOrder = (glyph: string) =>
  [...usedAsPartIn(glyph)].sort(
    (a, b) => (orderRow(a)?.i ?? Infinity) - (orderRow(b)?.i ?? Infinity),
  );

describe("a radical's kanji are ordered by curriculum, not raw index", () => {
  test("乙 sorts to teaching order, and it differs from the stored order", () => {
    const raw = usedAsPartIn("乙");
    const sorted = learningOrder("乙");
    assert.ok(raw.length >= 3, "乙 should have several kanji");

    // Non-decreasing in the curriculum index — the whole point of the sort.
    const idx = sorted.map((c) => orderRow(c)?.i ?? Infinity);
    for (let i = 1; i < idx.length; i += 1) {
      assert.ok(idx[i - 1] <= idx[i], `out of order at ${i}: ${idx.join(",")}`);
    }

    // 乞 (very early) leads; 電 (much later) is not first even though it is a
    // common kanji — a frequency or raw sort would not guarantee this.
    assert.equal(sorted[0], "乞");
    assert.ok(sorted.indexOf("乞") < sorted.indexOf("電"));
  });
});

describe("one table, shared by both callers with different caps", () => {
  const table = read("./radical-kanji-table.tsx");
  const uses = read("./component-uses.tsx");
  const lesson = read("../lesson/lesson-item-view.tsx");
  const entry = read("../../app/library/[entry]/page.tsx");

  test("the table sorts on the curriculum index", () => {
    assert.match(table, /orderRow\(/);
  });

  test("ComponentUses renders the table for the radical (asTable) branch", () => {
    assert.match(uses, /<RadicalKanjiTable/);
    assert.match(uses, /asTable/);
  });

  test("the lesson card mounts the shared table capped at 5", () => {
    assert.match(lesson, /<RadicalKanjiTable/);
    assert.match(lesson, /cap=\{5\}/);
  });

  test("the Library radical entry uses the table capped at 30", () => {
    assert.match(entry, /asTable/);
    assert.match(entry, /tableCap=\{30\}/);
  });
});
