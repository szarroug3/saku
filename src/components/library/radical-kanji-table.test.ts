// Run: node --import ./src/lib/conjugate/test-hooks.mjs --test \
//        src/components/library/radical-kanji-table.test.ts
//
// WHAT THIS TEST IS FOR
// =====================
// A radical's kanji are shown as a TABLE ordered by the CURRICULUM order the
// kanji track teaches in — not the raw index order KRADFILE happens to store,
// and not by frequency. The sort key is `orderRow(c).i`. If that key is dropped
// the table still renders, just in the wrong order, so the order is pinned here
// against the data.
//
// SAK-159: the old RadicalKanjiTable/ComponentUses rendering this fed is gone —
// the redesigned CharacterEntryView shows a radical's "used as a part in" list
// off `usedAsPartIn` directly (see character-entry-content.ts). The ordering
// invariant below still holds for that list, so it stays pinned here against
// the data even though the component it used to describe does not exist.

import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { orderRow } from "../../data/kanji.ts";
import { usedAsPartIn } from "../../lib/library/components.ts";

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

    // 乞 (very early) leads; 孔 (much later) is not first even though it is a
    // common kanji — a frequency or raw sort would not guarantee this. (七 used
    // to be the example here, but SAK-148 dropped the number kanji from every
    // component's "used in" list — see components.ts's isNumberKanji filter —
    // so 乙's list no longer includes it at all.)
    assert.equal(sorted[0], "乞");
    assert.ok(sorted.indexOf("乞") < sorted.indexOf("孔"));
  });
});
