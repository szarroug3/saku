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
// scriptLabel is now a pure function in @/data/marks (extracted from
// mark-view.tsx, which cannot be rendered in this harness), so its mapping is
// tested BEHAVIOURALLY here rather than by a regex over the component source.
// One structural line remains — that the view guards <Lbl> on a truthy label —
// because there is no seam for "did the component render an element"; the source
// grep is the honest floor for that one coupling.

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, test } from "node:test";

import { MARKS, scriptLabel } from "@/data/marks";

describe("scriptLabel maps an intro's set id to its pill text", () => {
  test("a script-bound set id becomes 'In <script>'", () => {
    assert.equal(scriptLabel("hiragana"), "In hiragana");
    assert.equal(scriptLabel("katakana"), "In katakana");
  });

  test("the script-neutral set id ('') becomes null, NOT '' — no empty pill", () => {
    assert.equal(scriptLabel(""), null);
    // The whole point: null is falsy AND is not the empty string, so the guarded
    // <Lbl> renders nothing. An empty-string fallback would have drawn a pill.
    assert.notEqual(scriptLabel(""), "");
  });

  test("an unshipped set id is returned as-is, not guessed or blanked", () => {
    assert.equal(scriptLabel("mystery"), "mystery");
  });
});

describe("the render only emits a label when scriptLabel gave one", () => {
  const SRC = readFileSync(new URL("./mark-view.tsx", import.meta.url), "utf8");
  test("<Lbl> is guarded on the computed label being truthy", () => {
    // No renderer in this harness, so this one coupling — "compute the label,
    // draw the element only when truthy" — is pinned at the call site.
    assert.match(SRC, /const label = scriptLabel\(intro\.setId\);/);
    assert.match(SRC, /\{label \? <Lbl>\{label\}<\/Lbl> : null\}/);
  });
});

describe("exactly the four reading-rule marks are script-neutral", () => {
  test("the data side of the same guarantee, so the mapping guards a real case", () => {
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
      // And each of those neutral intros maps to no label — the behaviour that
      // keeps the empty pill off these four cards specifically.
      for (const i of m.intros) assert.equal(scriptLabel(i.setId), null);
    }
  });
});
