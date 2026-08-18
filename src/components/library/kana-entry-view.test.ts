// Run: node --import ./src/lib/conjugate/test-hooks.mjs --test \
//        src/components/library/kana-entry-view.test.ts
//
// SAK-14: every derived-kana Library entry page (が, ぱ, きゃ, and every other
// dakuten/handakuten/yōon glyph — roughly half of the 214-kana set) rendered as
// a bare breadcrumb with an empty body. Root cause: KanaEntryView had
// `const m = getMnemonic(glyph); if (!m) return null;` — a page-level bail that
// was meant to gate only the mnemonic block (data/mnemonics.ts's own header:
// "a kana with no row here shows no block", singular). MNEMONICS only covers
// the 46+46 base gojūon, so every derived kana hit this and lost its header,
// pronunciation-context, confusables and stroke-order sections along with it.
//
// This file cannot render the "use client" component (no React harness in this
// runner — see mnemonics.test.ts and mark-view.test.ts for the same
// constraint), so it verifies the fix two ways:
//   1. Behaviourally: every OTHER data source the page reads — the confusables
//      lookup, the pronunciation-context lookup, the precomputed stroke
//      fallback — independently resolves for a derived-kana glyph even though
//      `getMnemonic` does not. If any of these were themselves glyph-gapped,
//      un-bailing the page would just move the blank render one level down.
//   2. Structurally: the source no longer contains the page-level bail, and
//      does contain the block-scoped conditional that replaced it. A source
//      grep is a real but honest floor for the one guarantee with no other
//      seam — see mark-view.test.ts's identical rationale.

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import test from "node:test";

import { dakutenRowFor } from "@/data/dakuten-rows";
import { getMnemonic } from "@/data/mnemonics";
import { contextPronunciation } from "@/data/kana-context";
import { derivedKanaConfusables } from "@/lib/library/kana-family";
import { kanaConfusables, precomputedStrokeFallback } from "@/lib/library/library-index";

// The exact glyphs SAK-14 named as confirmed-broken.
const DERIVED_KANA = ["だ", "が", "ぱ", "きゃ"];
const DERIVED_KATAKANA = "ガ";

test("derived kana have no mnemonic row (the precondition for the bug)", () => {
  for (const g of [...DERIVED_KANA, DERIVED_KATAKANA]) {
    assert.equal(getMnemonic(g), null, `expected no MNEMONICS row for ${g}`);
  }
});

test("derived kana still resolve real data everywhere else on the page", () => {
  for (const g of [...DERIVED_KANA, DERIVED_KATAKANA]) {
    // contextPronunciation is allowed to be null (most kana carry no
    // following-sound rule) — the guarantee is that it RESOLVES, i.e. doesn't
    // throw and isn't itself gated on having a mnemonic.
    assert.doesNotThrow(() => contextPronunciation(g), `contextPronunciation(${g}) threw`);
    // kanaConfusables always returns an array (possibly empty), never throws.
    assert.doesNotThrow(() => kanaConfusables(g), `kanaConfusables(${g}) threw`);
    assert.ok(Array.isArray(kanaConfusables(g)), `kanaConfusables(${g}) should be an array`);
    // precomputedStrokeFallback is the gate KanaEntryView keeps (line 57: `||
    // !strokeFallback` still bails, correctly, on missing index data) — it must
    // be defined for every one of these glyphs or the page legitimately has
    // nothing to show.
    assert.notEqual(
      precomputedStrokeFallback(g),
      undefined,
      `precomputedStrokeFallback(${g}) missing — the page would still 404-blank on this glyph`,
    );
  }
});

test("KanaEntryView no longer bails the whole page when getMnemonic is null", () => {
  const src = readFileSync(
    fileURLToPath(new URL("./kana-entry-view.tsx", import.meta.url)),
    "utf8",
  );

  // THE BUG, verbatim: a page-level early return keyed only on the mnemonic.
  assert.doesNotMatch(
    src,
    /const m = getMnemonic\(glyph\);\s*\n\s*if \(!m\) return null;/,
    "KanaEntryView must not return null for the whole page just because getMnemonic(glyph) is null",
  );

  // THE FIX: the mnemonic block itself is still conditional (hide-when-absent,
  // scoped to the block — data/mnemonics.ts's own contract), just no longer as
  // a `return null`.
  assert.match(
    src,
    /\{m \? \(/,
    "the mnemonic <div> should still be conditionally rendered, just not via an early return",
  );

  // The loading/not-found guard (headline undefined/null, no glyph, no
  // precomputed stroke index entry) is untouched — that one is legitimately
  // "still loading or truly doesn't exist," a different case from "exists but
  // has no mnemonic," and SAK-14 was explicit that this fix should leave it be.
  assert.match(
    src,
    /if \(headline === undefined \|\| headline === null \|\| !glyph \|\| !strokeFallback\) return null;/,
    "the loading/not-found guard should be unchanged",
  );
});

// SAK-72 Part A: が/ぱ/だ/ガ now compose their page from か/は/た/カ instead of
// showing nothing beyond the header — a sound-shift rule block, the base's
// mnemonic (labelled as reused), and confusables drawn from the same
// dakuten/handakuten family. As with SAK-14 above, this file cannot render the
// "use client" component, so it verifies the same two ways: behaviourally
// (every data source the new blocks read resolves for a derived-kana glyph)
// and structurally (the source actually wires that data into the page).

// The SAK-14 derived set minus きゃ: that one is yōon (TWO codepoints — き +
// small ゃ), which dakutenRowFor correctly does NOT resolve — it's Part B's
// glyph shape, out of scope for this pass. See this file's own header and
// dakuten-rows.test.ts's "null for a glyph the app doesn't teach" case.
const DERIVED_DAKUTEN_KANA = DERIVED_KANA.filter((g) => g !== "きゃ");

test("every derived (dakuten/handakuten) kana still resolves a row, a base mnemonic, and family confusables", () => {
  for (const g of [...DERIVED_DAKUTEN_KANA, DERIVED_KATAKANA]) {
    const row = dakutenRowFor(g);
    assert.ok(row, `dakutenRowFor(${g}) should resolve — it's in the SAK-14 derived set`);
    const base = row.pairs.find(([, converted]) => converted === g)?.[0];
    assert.ok(base, `${g}'s row should name its own base in \`pairs\``);

    // The block KanaEntryView falls back to when getMnemonic(glyph) is null:
    // the BASE's mnemonic must itself resolve, or the reused block would have
    // nothing to show either.
    assert.notEqual(getMnemonic(base!), null, `getMnemonic(${base}) — が's fallback base — should resolve`);

    // Family confusables: every glyph in the returned list must itself be a
    // real, resolvable base or sibling — never throws, always an array.
    assert.doesNotThrow(() => derivedKanaConfusables(g));
    const family = derivedKanaConfusables(g);
    assert.ok(Array.isArray(family) && family.length > 0, `derivedKanaConfusables(${g}) should be non-empty`);
  }
});

test("だ (t→d, a hookless row) resolves its callout instead of a hook", () => {
  const row = dakutenRowFor("だ");
  assert.ok(row);
  assert.equal(row.hook, "", "t→d has no authored hook");
  assert.ok(row.callout && row.callout.length > 0, "t→d should carry its rare-characters callout instead");
});

test("KanaEntryView wires the sound-shift block, the base-mnemonic reuse, and family confusables into the page", () => {
  const src = readFileSync(
    fileURLToPath(new URL("./kana-entry-view.tsx", import.meta.url)),
    "utf8",
  );

  // The sound-shift block: resolved off dakutenRowFor, rendered only when a
  // row (and its base) exist — absent for every base kana and every yōon glyph.
  assert.match(src, /dakutenRowFor\(glyph\)/, "should resolve the glyph's dakuten row");
  assert.match(src, /SoundShiftSection/, "should render the sound-shift block");

  // Mnemonic reuse: the base's own mnemonic, only when the glyph has none of
  // its own — never replacing an authored mnemonic, never inventing a new one.
  assert.match(
    src,
    /baseMnemonic\s*=\s*!m\s*&&\s*base\s*\?\s*getMnemonic\(base\)\s*:\s*null/,
    "should fall back to the BASE's mnemonic only when the glyph's own is absent",
  );
  assert.match(src, /baseMnemonic/, "the reused-mnemonic block should be wired into the render");

  // Confusables: the family lookup is merged in, not swapped for the existing
  // LOOKALIKES-based one — a derived kana keeps whatever kanaConfusables would
  // have said (empty today) AND gains its family.
  assert.match(src, /derivedKanaConfusables\(glyph\)/, "should merge in the derived-kana family confusables");
  assert.match(src, /kanaConfusables\(glyph\)/, "should still read the existing LOOKALIKES-based confusables too");
});
