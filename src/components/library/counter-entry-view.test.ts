// Run: node --import ./src/lib/conjugate/test-hooks.mjs --test \
//        src/components/library/counter-entry-view.test.ts
//
// SAK-35 found every counted-form card ("How you say it") showing identical
// boilerplate, with nothing specific to that counter. The counter category
// pages (人, 本, 匹, …) already show real, distinct, counter-specific
// irregular content — counterIrregulars()-derived prose, wired into
// CounterEntryView's "How it's built" section via NumberConstructionView.
// That part was NOT a bug and still renders (see number-construction.test.ts's
// "the counter pages split by the engine's irregular counts").
//
// The one genuine gap SAK-35 found was 二十歳 — a memorised counted FORM
// (@/data/counters) that IS irregular (はたち, not the plain 二十 + さい) — which
// sat on its own page with no way to reach 〜歳's page, which already explained
// exactly that irregularity in its own authored prose. SAK-35 closed that gap
// with a "Related" link from 二十歳's page out to 〜歳's.
//
// SAK-172 closed it differently, and this file now verifies THAT fix instead:
// 二十歳 no longer has a standalone page to carry a Related link FROM at all —
// はたち is now a genuine Irregular ROW on 〜歳's own page (pinned in
// number-construction.test.ts's "〜歳's Irregular table carries 二十歳/はたち"
// describe block), and 二十歳 aliases into 〜歳's page via searchAlso instead
// (src/data/counters.ts's COUNTER_TAIL_FORM_ALIASES, pinned in
// counters.test.ts and entries.test.ts). The Related section machinery this
// file used to verify was removed from counter-entry-view.tsx as dead code —
// every remaining counted form is a 〜つ native, which never had a construction
// page to link to in the first place. This file now verifies the removal: the
// source no longer references the machinery, and the underlying teach/quiz
// data (COUNTER_CURRICULUM's TAIL form) is untouched.
//
// This file cannot render the "use client" component (no React harness in
// this runner — see kana-entry-view.test.ts and mark-view.test.ts for the
// same constraint), so it verifies structurally, the same pattern those files
// use: reading the source and asserting what it does and does not reference.

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import test, { describe } from "node:test";

import { COUNTER_CURRICULUM, counterEntry, counterForm, isBareNumber } from "@/data/counters";

const nijussai = COUNTER_CURRICULUM.find((f) => f.key === "counter:sai:20")!;
const hitotsu = COUNTER_CURRICULUM.find((f) => f.key === "counter:tsu:1")!;

describe("はたち's underlying teach/quiz data is untouched by the Library display change", () => {
  test("二十歳 is still a real counted form in the curriculum, not a bare number", () => {
    assert.ok(nijussai, "counter:sai:20 should still exist in the curriculum");
    assert.equal(nijussai.glyph, "二十歳");
    assert.equal(nijussai.reading, "はたち");
    assert.equal(nijussai.counter, "歳");
    assert.equal(isBareNumber(nijussai), false);
  });

  test("counterForm(counterEntry(二十歳)) still round-trips — the same lookup CounterEntryView uses", () => {
    const entry = counterEntry(nijussai);
    assert.equal(counterForm(entry), nijussai);
  });
});

describe("CounterEntryView no longer carries the removed Related-section machinery", () => {
  const src = readFileSync(fileURLToPath(new URL("./counter-entry-view.tsx", import.meta.url)), "utf8");

  test("no reference to the removed numberConstructionForCounterGlyph join", () => {
    assert.doesNotMatch(
      src,
      /numberConstructionForCounterGlyph/,
      "the SAK-35 join was removed as dead code once 二十歳 lost its standalone page",
    );
  });

  test("no RelatedSection render or relatedLinks computation", () => {
    assert.doesNotMatch(src, /RelatedSection/);
    assert.doesNotMatch(src, /relatedLinks/);
    assert.doesNotMatch(src, /relatedConstruction/);
  });

  test("the generic 'How you say it' boilerplate is UNCHANGED and still present", () => {
    // This fix removed only the additive Related link; the generic line every
    // counted form's "How you say it" section shows is untouched.
    assert.match(
      src,
      /A counting word joins a number to the thing you count, and you say the two as one word\./,
    );
  });

  test("still gates the counted-form section on form && the isBareNumber check", () => {
    assert.match(src, /isBareNumber\(form\)/);
  });
});

test("ひとつ (native 〜つ) still has no construction-page link — it's a kana form, no counter changes it applies to", () => {
  assert.equal(hitotsu.counter, "つ");
});
