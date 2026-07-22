// Run: node --import ./src/lib/conjugate/test-hooks.mjs --test \
//        src/lib/library/components.test.ts
//
// WHAT THESE TESTS ARE FOR
// ========================
// The component index is the first thing in the Library built by INVERTING a
// relation, and an inverted index fails silently: a dropped row or a
// double-counted duplicate still renders a plausible-looking page, and the only
// way to notice is that a number is wrong. So the counts are pinned against the
// data, in both directions.
//
// The other three are the claims the radical pages make on screen:
//   - a primitive has no meaning ANYWHERE, so a page may never print one;
//   - "words you know" means the app's one definition of known, claims included;
//   - the cap on a huge list reports the right remainder — 口's 104 must not
//     become "79 more" because the visible slice was counted wrong.

import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { isPrimitive, PRIMITIVE_STROKES, primitiveStrokes } from "../../data/components.ts";
import { KANJI, kanjiRow, meaningFactId } from "../../data/kanji.ts";
import { wordMeaningFactId } from "../../data/vocab.ts";
import {
  allComponents,
  COMPONENT_USE_CAP,
  knownWordsUsing,
  usedAsPartIn,
} from "./components.ts";
import type { FactId, HistoryFile } from "../../types/index.ts";

const AT = Date.UTC(2026, 0, 1);

function history(over: Partial<HistoryFile> = {}): HistoryFile {
  return { sessions: [], facts: {}, claims: {}, ...over };
}

function claiming(facts: readonly FactId[]): HistoryFile {
  const claims: Record<string, number> = {};
  for (const f of facts) claims[f] = AT;
  return history({ claims: claims as HistoryFile["claims"] });
}

describe("the index covers every component the depth-1 decomposition attests", () => {
  test("844 distinct components across the 2,136 jōyō kanji", () => {
    assert.equal(KANJI.length, 2136);
    assert.equal(allComponents().length, 844);
  });

  test("482 are kanji, 362 are primitives, and that is the whole set", () => {
    const prim = allComponents().filter((c) => !kanjiRow(c));
    assert.equal(prim.length, 362);
    assert.equal(allComponents().length - prim.length, 482);
    // The primitive set and the stroke map are the SAME 362. A component with no
    // stroke count would render "? strokes"; a stroke count for a non-component
    // would be a page reachable from nowhere.
    assert.deepEqual(new Set(prim), new Set(PRIMITIVE_STROKES.keys()));
    for (const c of prim) assert.ok(isPrimitive(c));
  });

  test("the counts match a straight recount of the data", () => {
    // Recomputed here the naive way — one pass, deduped per kanji — so the
    // index cannot agree with itself.
    const counts = new Map<string, number>();
    for (const k of KANJI) {
      for (const c of new Set(k.comps)) counts.set(c, (counts.get(c) ?? 0) + 1);
    }
    for (const [c, n] of counts) assert.equal(usedAsPartIn(c).length, n, c);
  });

  test("the big ones, by name", () => {
    // Direct-component counts, so much smaller than the old flat KRADFILE index:
    // 口 is a DIRECT part of 104 kanji, not the 381 it was nested inside. And the
    // stroke-artefacts ノ and ｜ are gone — KanjiVG does not cut a lone stroke out
    // as a component, so they are no longer in the index at all.
    assert.equal(usedAsPartIn("氵").length, 115);
    assert.equal(usedAsPartIn("口").length, 104);
    assert.equal(usedAsPartIn("木").length, 101);
    assert.equal(usedAsPartIn("亻").length, 95);
    assert.equal(usedAsPartIn("日").length, 61);
    assert.equal(usedAsPartIn("ノ").length, 0);
    assert.equal(usedAsPartIn("｜").length, 0);
  });

  test("a kanji is never listed as a part of itself", () => {
    for (const c of allComponents()) {
      assert.ok(!usedAsPartIn(c).includes(c), c);
    }
  });

  test("nothing is built from a stranger, or from an unused kanji", () => {
    assert.deepEqual(usedAsPartIn("Z"), []);
    // 鬱 is a direct part of no other jōyō kanji — the page drops the section
    // rather than printing an empty heading.
    assert.equal(usedAsPartIn("鬱").length, 0);
  });

  test("the list is deduped — 品's three 口 count once", () => {
    const uses = usedAsPartIn("口");
    assert.equal(new Set(uses).size, uses.length);
  });
});

describe("a primitive has no meaning, anywhere", () => {
  test("none of the 362 has a KANJIDIC2 row to take a meaning from", () => {
    for (const c of PRIMITIVE_STROKES.keys()) {
      assert.equal(kanjiRow(c), undefined, c);
    }
  });

  test("every primitive has a stroke count, which is all a page may say", () => {
    for (const c of PRIMITIVE_STROKES.keys()) {
      const n = primitiveStrokes(c);
      assert.ok(typeof n === "number" && n > 0, c);
    }
    assert.equal(primitiveStrokes("亻"), 2);
    assert.equal(primitiveStrokes("匕"), 2);
  });

  test("a stranger is not a primitive and has no page", () => {
    assert.ok(!isPrimitive("木"));
    assert.ok(!isPrimitive("Z"));
    assert.equal(primitiveStrokes("木"), undefined);
  });

  test("the 482 that ARE kanji do have meanings — the other half of the split", () => {
    const kanjiComponents = allComponents().filter((c) => kanjiRow(c));
    assert.equal(kanjiComponents.length, 482);
    for (const c of kanjiComponents) {
      assert.ok((kanjiRow(c)?.meanings.length ?? 0) > 0, c);
    }
  });
});

describe("words you know that use a component", () => {
  // 日 is a part of 210 kanji, among them 時. 時間 is written with it.
  const TOKI: FactId = wordMeaningFactId("時間");

  test("an empty history knows no words", () => {
    assert.deepEqual(knownWordsUsing("日", history()), []);
  });

  test("a CLAIM counts exactly as a lesson does", () => {
    const known = knownWordsUsing("日", claiming([TOKI]));
    assert.ok(known.includes("時間"), "a claimed word is a known word");
  });

  test("only words whose kanji actually contain the component", () => {
    const known = knownWordsUsing("日", claiming([TOKI]));
    for (const w of known) {
      assert.ok(
        [...w].some((ch) => usedAsPartIn("日").includes(ch)),
        w,
      );
    }
  });

  test("knowing the KANJI is not knowing a word — the section stays empty", () => {
    // The kanji track teaches 時's meaning; that is not a word, and this
    // section is about the reader's vocabulary.
    assert.deepEqual(knownWordsUsing("日", claiming([meaningFactId("時")])), []);
  });

  test("a component nothing is built from has no words either", () => {
    assert.deepEqual(knownWordsUsing("鬱", claiming([TOKI])), []);
  });

  test("the words come back in teaching order and are not duplicated", () => {
    const known = knownWordsUsing(
      "日",
      claiming([TOKI, wordMeaningFactId("時計"), wordMeaningFactId("時々")]),
    );
    assert.equal(new Set(known).size, known.length);
  });
});

describe("the cap on a huge list reports the right remainder", () => {
  test("口: 24 painted, 80 named", () => {
    const uses = usedAsPartIn("口");
    assert.equal(COMPONENT_USE_CAP, 24);
    assert.equal(uses.slice(0, COMPONENT_USE_CAP).length, 24);
    assert.equal(uses.length - COMPONENT_USE_CAP, 80);
  });

  test("氵: 115, so 91 more", () => {
    assert.equal(usedAsPartIn("氵").length - COMPONENT_USE_CAP, 91);
  });

  test("a short list is painted whole and reports no remainder", () => {
    const small = allComponents().find((c) => usedAsPartIn(c).length < COMPONENT_USE_CAP);
    assert.ok(small);
    const uses = usedAsPartIn(small);
    assert.equal(uses.slice(0, COMPONENT_USE_CAP).length, uses.length);
    assert.ok(uses.length - COMPONENT_USE_CAP <= 0);
  });
});
