// Run: node --import ./src/lib/conjugate/test-hooks.mjs --test \
//        src/components/library/mark-view.test.ts
//
// A SCRIPT-NEUTRAL MARK GETS NO LABEL, NOT AN EMPTY ONE
// =====================================================
// Five marks are taught once per script and their intro carries setId "hiragana"
// or "katakana", which the page prints as "In hiragana" / "In katakana". The
// four reading-rule marks (々, rendaku, punctuation, okurigana) carry
// script-neutral intros whose setId is "" (NO_SCRIPT). The bug this guards is
// quiet: a scriptLabel that returned setId as a fallback would hand "" to <Lbl>,
// which renders a stray empty pill above the card rather than nothing.
//
// WHY A SOURCE-SHAPE TEST
// =======================
// MarkView is a React component and there is no renderer in this harness (the
// same reason drill-hint.test.ts and lesson-item-view.test.ts read the source).
// scriptLabel is pure, so what is pinned is that it maps "" to null and that the
// render only emits <Lbl> when the label is truthy.

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, test } from "node:test";

import { MARKS } from "@/data/marks";

const SRC = readFileSync(new URL("./mark-view.tsx", import.meta.url), "utf8");

describe("a script-neutral mark renders no script label", () => {
  test("scriptLabel maps the empty set id to null, not to \"\"", () => {
    // The empty string is handled explicitly and yields null; without this line
    // it would fall through to `return setId` and print an empty label.
    assert.match(
      SRC,
      /if \(setId === ""\) return null;/,
      "scriptLabel must return null for the script-neutral (\"\") set id",
    );
  });

  test("the render only emits a label when scriptLabel gave one", () => {
    // A guarded <Lbl>: the label is computed once and rendered only when truthy,
    // so a null (script-neutral) label draws no element at all.
    assert.match(SRC, /const label = scriptLabel\(intro\.setId\);/);
    assert.match(SRC, /\{label \? <Lbl>\{label\}<\/Lbl> : null\}/);
  });

  test("exactly the four reading-rule marks are script-neutral", () => {
    // The data side of the same guarantee, so the source-shape test above is
    // pinning behaviour that some mark actually exercises.
    const neutral = MARKS.filter((m) => m.intros.some((i) => i.setId === ""));
    assert.deepEqual(
      neutral.map((m) => m.id),
      ["iteration-mark", "rendaku", "punctuation", "okurigana"],
    );
    for (const m of neutral) {
      assert.ok(
        m.intros.every((i) => i.setId === ""),
        `${m.id} mixes a script-neutral intro with a script-bound one`,
      );
    }
  });
});
