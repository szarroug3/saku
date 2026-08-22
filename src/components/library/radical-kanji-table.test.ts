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
// WHO CALLS IT NOW. The stepped lesson used to, capped at 5. It does not any
// more: on the step where a shape is first met, a list of the kanji built on it
// is 22 characters the reader has not learned, and the trim moved that catalogue
// to the Library alone. So the callers are the two Library surfaces, the kanji
// entry's "seen as a part of" and the radical entry's table at cap 30, and the
// wiring pinned below is theirs.

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

    // 乞 (very early) leads; 七 (much later) is not first even though it is a
    // common kanji — a frequency or raw sort would not guarantee this.
    assert.equal(sorted[0], "乞");
    assert.ok(sorted.indexOf("乞") < sorted.indexOf("七"));
  });
});

describe("the radical table is isolated from primitive pages", () => {
  const table = read("./radical-kanji-table.tsx");
  const uses = read("./component-uses.tsx");
  // The teach walk's item view is TeachItemView now (it dispatches to the shared
  // *-entry-view components); the old LessonItemView is gone.
  const lesson = read("../session/teach-item-view.tsx");
  // The redesigned radical reference page is CharacterEntryView; its "used as a
  // part in" list is off usedAsPartIn now, not ComponentUses/RadicalKanjiTable.
  const characterView = read("./character-entry-view.tsx");
  const characterContent = read("../../lib/library/character-entry-content.ts");

  test("the table sorts on the curriculum index", () => {
    assert.match(table, /orderRow\(/);
  });

  test("ComponentUses uses the content-free precomputed component relation", () => {
    assert.doesNotMatch(uses, /<RadicalKanjiTable/);
    // SAK-104: the direct library-index import moved server-side — the
    // client component now fetches its one combined payload through the
    // Server Action wrapper (getComponentUses in server-lookups.ts, itself
    // backed by usedAsPartIn/knownWordsUsing from library-index.ts) instead
    // of importing the ~9.5MB dictionary into the client bundle directly.
    assert.doesNotMatch(uses, /@\/lib\/library\/library-index/);
    assert.match(uses, /@\/lib\/library\/server-lookups/);
  });

  test("the stepped lesson mounts it nowhere", () => {
    // The JSX, not the name: the view's own header explains where the table
    // went, and that sentence has to be allowed to name it.
    assert.doesNotMatch(lesson, /<RadicalKanjiTable/);
    assert.doesNotMatch(lesson, /from "@\/components\/library\/radical-kanji-table"/);
  });

  test("the Library radical entry still lists the kanji built on the shape", () => {
    // The redesign shows this as a "used as a part in" list in CharacterEntryView
    // (capped in the view, the approved gallery behaviour) rather than the old
    // 30-row ComponentUses table. The invariant that survives: a radical page
    // still joins up the kanji written with it.
    assert.match(characterView, /payload\.usedIn/);
    assert.match(characterContent, /usedAsPartIn/);
  });
});
