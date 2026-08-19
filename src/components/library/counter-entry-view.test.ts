// Run: node --import ./src/lib/conjugate/test-hooks.mjs --test \
//        src/components/library/counter-entry-view.test.ts
//
// SAK-35: the audit found every counted-form card ("How you say it") showing
// identical boilerplate — "A counting word joins a number to the thing you
// count..." plus the word and gloss again — with nothing specific to that
// counter, no mention of irregular readings, no example. Investigation found
// the counter category pages (人, 本, 匹, …) ALREADY show real, distinct,
// counter-specific irregular content — counterIrregulars()-derived prose,
// wired into CounterEntryView's "How it's built" section via
// NumberConstructionView(construction.body). That part was NOT a bug: Sam's
// recollection that "we already did that with the irregular readings" is
// correct, and it still renders. See number-construction.test.ts's
// "the counter pages split by the engine's irregular counts" for that half.
//
// The one genuine gap: 二十歳 — a memorised counted FORM (@/data/counters) that
// IS irregular (はたち, not the plain 二十 + さい) — sat on a page with no way to
// reach 〜歳's page, which already explains exactly that irregularity in its
// own authored prose. This file verifies the fix: CounterEntryView now links a
// counted form to its counter's construction page via
// numberConstructionForCounterGlyph, reusing that existing prose rather than
// authoring anything new.
//
// This file cannot render the "use client" component (no React harness in
// this runner — see kana-entry-view.test.ts and mark-view.test.ts for the
// same constraint), so it verifies the fix two ways, the same pattern those
// files use: behaviourally (every data source the new block reads resolves
// correctly) and structurally (the source actually wires it into the page).

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import test, { describe } from "node:test";

import { COUNTER_CURRICULUM, counterEntry, counterForm, isBareNumber } from "@/data/counters";
import { numberConstructionForCounterGlyph } from "@/data/number-construction";

const nijussai = COUNTER_CURRICULUM.find((f) => f.key === "counter:sai:20")!;
const hitotsu = COUNTER_CURRICULUM.find((f) => f.key === "counter:tsu:1")!;

describe("the data behind 二十歳's Related link resolves correctly", () => {
  test("二十歳 is a real counted form, not a bare number", () => {
    assert.ok(nijussai, "counter:sai:20 should exist in the curriculum");
    assert.equal(nijussai.glyph, "二十歳");
    assert.equal(nijussai.reading, "はたち");
    assert.equal(nijussai.counter, "歳");
    assert.equal(isBareNumber(nijussai), false);
  });

  test("counterForm(counterEntry(二十歳)) round-trips — the same lookup CounterEntryView uses", () => {
    const entry = counterEntry(nijussai);
    assert.equal(counterForm(entry), nijussai);
  });

  test("二十歳's counter (歳) resolves a construction page that already names はたち as irregular", () => {
    const page = numberConstructionForCounterGlyph(nijussai.counter);
    assert.ok(page, "〜歳 should resolve for 二十歳's counter glyph");
    assert.equal(page!.id, "sai");
    const prose = page!.body.map((p) => p.text).join(" ");
    assert.match(prose, /二十歳/);
    assert.match(prose, /はたち/);
  });

  test("ひとつ (native 〜つ) correctly finds no construction page to link to", () => {
    assert.equal(hitotsu.counter, "つ");
    assert.equal(
      numberConstructionForCounterGlyph(hitotsu.counter),
      undefined,
      "〜つ is native memorisation, so RelatedSection should render nothing on ひとつ's page",
    );
  });

  test("a bare number's counter is empty, so it never looks up a construction page", () => {
    // Every current bare number would have counter === "" (isBareNumber gate);
    // COUNTER_CURRICULUM ships none today (the Sino numbers are taught by the
    // words track — see counters.ts's own note), but the guard must hold
    // structurally regardless of what's in the curriculum.
    const bare = COUNTER_CURRICULUM.filter((f) => isBareNumber(f));
    for (const f of bare) {
      assert.equal(f.counter, "");
    }
  });
});

test("CounterEntryView wires a counted form's Related link off numberConstructionForCounterGlyph", () => {
  const src = readFileSync(fileURLToPath(new URL("./counter-entry-view.tsx", import.meta.url)), "utf8");

  assert.match(
    src,
    /numberConstructionForCounterGlyph\(form\.counter\)/,
    "should look up the counted form's counter's construction page",
  );
  assert.match(src, /RelatedSection/, "should render the shared RelatedSection component");
  assert.match(src, /relatedLinks/, "should compute a relatedLinks list to feed it");

  // The lookup must be gated on the form being a real counted form (not a bare
  // number) — isBareNumber is the same guard the "How you say it" Lead already
  // uses to pick its own boilerplate variant.
  assert.match(
    src,
    /form && !isBareNumber\(form\)/,
    "the Related lookup should be gated on form && !isBareNumber(form)",
  );

  // The generic "How you say it" boilerplate is UNCHANGED and still present —
  // this fix is additive (a link to existing counter-specific content), not a
  // rewrite of the generic line, which is correct for the forms that carry no
  // irregular content of their own (every 〜つ word).
  assert.match(
    src,
    /A counting word joins a number to the thing you count, and you say the two as one word\./,
  );
});
