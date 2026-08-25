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

import { kanaEntry } from "@/data/characters";
import { dakutenRowFor } from "@/data/dakuten-rows";
import { markEntry } from "@/data/marks";
import { getMnemonic } from "@/data/mnemonics";
import { contextPronunciation } from "@/data/kana-context";
import { COMBO_H, COMBO_K } from "@/data/phase-intros";
import { termEntry } from "@/data/terms";
import { yoonRowFor } from "@/data/yoon-rows";
import { entryHref } from "@/lib/library/href";
import { derivedKanaConfusables, fullSizeOf, yoonConfusables } from "@/lib/library/kana-family";
import { kanaConfusables, libEntry, precomputedStrokeFallback } from "@/lib/library/library-index";

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
// showing nothing beyond the header — a sound-shift rule block and confusables
// drawn from the same dakuten/handakuten family. As with SAK-14 above, this
// file cannot render the "use client" component, so it verifies the same two
// ways: behaviourally (every data source the new blocks read resolves for a
// derived-kana glyph) and structurally (the source actually wires that data
// into the page).
//
// CORRECTION (same ticket, live-review pass): the base's mnemonic is no
// longer reused on a derived kana's page at all — see this file's header for
// why. `getMnemonic(base)` still resolves to real data below (that data source
// hasn't gone anywhere), it is just no longer read by KanaEntryView.

// The SAK-14 derived set minus きゃ: that one is yōon (TWO codepoints — き +
// small ゃ), which dakutenRowFor correctly does NOT resolve — it's a different
// glyph shape, covered separately below by yoonRowFor and the Part B tests.
// See this file's own header and dakuten-rows.test.ts's "null for a glyph the
// app doesn't teach" case.
const DERIVED_DAKUTEN_KANA = DERIVED_KANA.filter((g) => g !== "きゃ");

test("every derived (dakuten/handakuten) kana still resolves a row and family confusables", () => {
  for (const g of [...DERIVED_DAKUTEN_KANA, DERIVED_KATAKANA]) {
    const row = dakutenRowFor(g);
    assert.ok(row, `dakutenRowFor(${g}) should resolve — it's in the SAK-14 derived set`);
    const base = row.pairs.find(([, converted]) => converted === g)?.[0];
    assert.ok(base, `${g}'s row should name its own base in \`pairs\``);

    // getMnemonic(base) still resolves — the data source is untouched — but
    // KanaEntryView no longer reads it (see the "no mnemonic block" test
    // below). Checked here only to confirm this correction didn't quietly
    // break mnemonics.ts itself.
    assert.notEqual(getMnemonic(base!), null, `getMnemonic(${base}) should still resolve as data`);

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

test("KanaEntryView wires the sound-shift block and family confusables into the page, with no base-mnemonic reuse", () => {
  const src = readFileSync(
    fileURLToPath(new URL("./kana-entry-view.tsx", import.meta.url)),
    "utf8",
  );

  // The sound-shift block: resolved off dakutenRowFor, rendered only when a
  // row (and its base) exist — absent for every base kana and every yōon glyph.
  assert.match(src, /dakutenRowFor\(glyph\)/, "should resolve the glyph's dakuten row");
  assert.match(src, /SoundShiftSection/, "should render the sound-shift block");

  // Correction: no base-mnemonic reuse identifier anywhere in the file any
  // more, on either derived path — Sam asked for the whole block gone, not
  // relabelled or hidden behind a flag.
  assert.doesNotMatch(src, /baseMnemonic/, "the base-mnemonic reuse must be fully removed, not just unreachable");
  assert.doesNotMatch(src, /yoonBaseMnemonic/, "the yōon base-mnemonic reuse must be fully removed too");
  assert.doesNotMatch(
    src,
    /same shape, only the sound changes/,
    "the reused-mnemonic label copy must be gone from the source",
  );

  // Confusables: the family lookup is merged in, not swapped for the existing
  // LOOKALIKES-based one — a derived kana keeps whatever the LOOKALIKES lookup
  // would have said (empty today) AND gains its family. The LOOKALIKES call
  // itself moved server-side (SAK-104: getKanaAux's kanaConfusableIds, backed
  // by kanaConfusables in library-index.ts) rather than a direct client call.
  assert.match(src, /derivedKanaConfusables\(glyph\)/, "should merge in the derived-kana family confusables");
  assert.match(
    src,
    /aux\?\.kanaConfusableIds/,
    "should still read the existing LOOKALIKES-based confusables too, via the server-fetched aux",
  );
});

test("が's Related links resolve to real entries — か and the Dakuten mark page", () => {
  const row = dakutenRowFor("が")!;
  const base = row.pairs.find(([, converted]) => converted === "が")?.[0];
  assert.equal(base, "か");
  assert.ok(libEntry(kanaEntry(base!)), "か should be a real, resolvable entry");

  // row.markName ("dakuten") is markEntry's own id — no separate mapping.
  assert.equal(row.markName, "dakuten");
  const markLink = libEntry(markEntry(row.markName));
  assert.ok(markLink, "the Dakuten mark page should be a real, resolvable entry");
  assert.equal(entryHref(markEntry("dakuten")), entryHref(markEntry(row.markName)));
});

test("ぱ's Related links point at は and Handakuten specifically, not Dakuten", () => {
  const row = dakutenRowFor("ぱ")!;
  assert.equal(row.markName, "handakuten");
  assert.ok(libEntry(markEntry("handakuten")), "the Handakuten mark page should resolve");
});

// SAK-72 Part B: きゃ/しゅ/キャ and every other yōon combo now compose their
// page too — a "Composition" rule block (reusing COMBO_H/COMBO_K's own prose,
// not a retyped hook) and confusables drawn from base + full-size small kana +
// siblings. Same two-way verification as Part A above: behavioural (every
// data source the new blocks read resolves for a yōon glyph) and structural
// (the source actually wires that data into the page).
//
// CORRECTION (same ticket, live-review pass): no base-mnemonic reuse and no
// stroke-order section at all for a yōon combo — see this file's header.

const YOON_SAMPLES = ["きゃ", "しゅ", "ちょ"];
const YOON_KATAKANA = "キャ";

test("every yōon kana resolves a row and family confusables", () => {
  for (const g of [...YOON_SAMPLES, YOON_KATAKANA]) {
    const row = yoonRowFor(g);
    assert.ok(row, `yoonRowFor(${g}) should resolve`);
    assert.equal(`${row.base}${row.small}`, g, `${g}'s row should reassemble from base+small`);

    // Family confusables: base + full-size small kana + siblings, never throws.
    assert.doesNotThrow(() => yoonConfusables(g));
    const family = yoonConfusables(g);
    assert.ok(Array.isArray(family) && family.length > 0, `yoonConfusables(${g}) should be non-empty`);
  }
});

test("dakutenRowFor never resolves a yōon glyph, and yoonRowFor never resolves a dakuten one — mutually exclusive", () => {
  for (const g of YOON_SAMPLES) {
    assert.equal(dakutenRowFor(g), null, `${g} is yōon, not a dakuten/handakuten conversion`);
  }
  for (const g of DERIVED_DAKUTEN_KANA) {
    assert.equal(yoonRowFor(g), null, `${g} is dakuten/handakuten, not a yōon combo`);
  }
});

test("COMBO_H and COMBO_K each carry the 'size is the whole tell' paragraph ComboSection reuses", () => {
  for (const intro of [COMBO_H, COMBO_K]) {
    const para = intro.body.find((p) => p.lead === "The size is the whole tell.");
    assert.ok(para, `${intro.id} should have the size-distinguishes-kya-from-kiya paragraph`);
    assert.ok(para.text.length > 0);
  }
});

test("KanaEntryView wires the composition block and yōon confusables into the page, with no base-mnemonic reuse", () => {
  const src = readFileSync(
    fileURLToPath(new URL("./kana-entry-view.tsx", import.meta.url)),
    "utf8",
  );

  // The composition block: resolved off yoonRowFor, rendered only when a row
  // exists — absent for every base kana and every dakuten/handakuten glyph.
  assert.match(src, /yoonRowFor\(glyph\)/, "should resolve the glyph's yōon row");
  assert.match(src, /ComboSection/, "should render the composition block");
  // Reuses the existing prose rather than authoring new per-glyph copy.
  assert.match(src, /COMBO_H/, "should reuse COMBO_H's prose for hiragana combos");
  assert.match(src, /COMBO_K/, "should reuse COMBO_K's prose for katakana combos");

  // Confusables: yoonConfusables is merged in alongside the dakuten family and
  // the base LOOKALIKES lookup — never swapped for either. The LOOKALIKES call
  // itself moved server-side (SAK-104: getKanaAux's kanaConfusableIds, backed
  // by kanaConfusables in library-index.ts) rather than a direct client call.
  assert.match(src, /yoonConfusables\(glyph\)/, "should merge in yōon confusables");
  assert.match(src, /derivedKanaConfusables\(glyph\)/, "should still merge in the dakuten family confusables too");
  assert.match(
    src,
    /aux\?\.kanaConfusableIds/,
    "should still read the existing LOOKALIKES-based confusables too, via the server-fetched aux",
  );
});

test("きゃ's Related links resolve to real entries — き, full-size や (not small ゃ), and the Yōon term page", () => {
  const row = yoonRowFor("きゃ")!;
  assert.equal(row.base, "き");
  assert.equal(row.small, "ゃ");
  assert.ok(libEntry(kanaEntry(row.base)), "き should be a real, resolvable entry");

  const fullSize = fullSizeOf(row.small);
  assert.equal(fullSize, "や", "きゃ's small ゃ should map to full-size や, not stay small");
  assert.ok(libEntry(kanaEntry(fullSize!)), "や should be a real, resolvable entry");
  assert.notEqual(fullSize, row.small, "the Related link must point at や, never at the small ゃ itself");

  assert.ok(libEntry(termEntry("yoon")), "the Yōon term page should be a real, resolvable entry");
});

test("キャ (katakana yōon) resolves its full-size link off ャ → ヤ, not the hiragana table directly", () => {
  const row = yoonRowFor("キャ")!;
  const fullSize = fullSizeOf(row.small);
  assert.equal(fullSize, "ヤ");
  assert.ok(libEntry(kanaEntry(fullSize!)));
});

test("KanaEntryView renders a Related section fed by row/yoonRow, absent for a base kana", () => {
  const src = readFileSync(
    fileURLToPath(new URL("./kana-entry-view.tsx", import.meta.url)),
    "utf8",
  );

  assert.match(src, /RelatedSection/, "should render the shared RelatedSection component");
  assert.match(src, /relatedLinks/, "should compute a relatedLinks list to feed it");
  // Built off markEntry/termEntry for the two derived paths, not new UI.
  assert.match(src, /markEntry\(row\.markName\)/, "dakuten/handakuten should link to the mark's own page");
  assert.match(src, /termEntry\("yoon"\)/, "yōon should link to the Yōon term page");
  assert.match(src, /fullSizeOf\(yoonRow\.small\)/, "yōon should link to the full-size small kana");
});

test("KanaEntryView drops the stroke-order section entirely for a yōon combo, but not for a dakuten/handakuten or base kana", () => {
  const src = readFileSync(
    fileURLToPath(new URL("./kana-entry-view.tsx", import.meta.url)),
    "utf8",
  );

  // HowItsWritten is gated on `yoonRow` (hidden when non-null) — NOT gated on
  // `row`, so が/ぱ keep their real single-glyph stroke diagram unchanged.
  assert.match(
    src,
    /\{yoonRow \? null : \(/,
    "the stroke-order section should be conditionally skipped for a yōon combo",
  );
  assert.doesNotMatch(
    src,
    /\{row \? null : \(/,
    "the stroke-order section must not be gated on `row` — a dakuten/handakuten kana keeps its diagram",
  );
  // Nothing composed any more: the two-glyph compose helper and its
  // svg-path.ts primitives are gone from this file and from the codebase.
  assert.doesNotMatch(src, /composeGlyphStrokes/, "the composed-diagram call must be gone");
});

// SAK-179: ん's page showed a "Heads up." note TWICE — a short one right under
// the analogy line, from `Mnemonic.approximate` in mnemonics.ts, and a longer
// one much further down the page, from kana-context.ts's own standalone
// section. Both described the same rule (ん borrows the sound that follows
// it). Consolidated into one: `approximate` is dropped from ん/ン (mnemonics.ts
// keeps it for every other kana that still uses it for its original,
// different purpose — an English-approximation caveat, not a following-sound
// rule), and the context rules now render exactly once, through
// MnemonicView's own `soundNote` slot (built for this, per that component's
// own doc, and previously unused by any caller).

test("ん/ン no longer carry Mnemonic.approximate — the context rules already cover the same ground", () => {
  for (const g of ["ん", "ン"]) {
    const m = getMnemonic(g);
    assert.ok(m, `${g} should still have a mnemonic`);
    assert.equal(
      m!.approximate,
      undefined,
      `${g}'s approximate field should be gone — it duplicated kana-context.ts's own rules`,
    );
    assert.ok(contextPronunciation(g), `${g} should still carry its context rules`);
  }
});

test("っ/ッ carry context rules but no mnemonic of their own — the page's no-mnemonic fallback is for them", () => {
  for (const g of ["っ", "ッ"]) {
    assert.equal(getMnemonic(g), null, `${g} has no MNEMONICS row — the sokuon isn't a taught base kana`);
    assert.ok(contextPronunciation(g), `${g} should still carry its context rules`);
  }
});

test("KanaEntryView renders the context rules exactly once — via MnemonicView's soundNote when a mnemonic exists, or a standalone fallback only when it doesn't", () => {
  const src = readFileSync(
    fileURLToPath(new URL("./kana-entry-view.tsx", import.meta.url)),
    "utf8",
  );

  // THE BUG, verbatim: a standalone JSX block rendered whenever `context` was
  // non-null on its own, with no regard for whether MnemonicView (via
  // `m.approximate`) was already showing a heads-up note for the same glyph.
  // That is exactly how ん/ン ended up with two.
  assert.doesNotMatch(
    src,
    /\{context \? \(/,
    "the standalone context block must no longer render unconditionally whenever `context` is non-null",
  );

  // THE FIX, part one: the context rules are threaded into MnemonicView's
  // soundNote slot, so a glyph with its own mnemonic (ん/ン) shows them in
  // that one spot, right under the analogy line — matching where は/へ's own
  // particle-reading note renders.
  assert.match(src, /soundNote=\{soundNote/, "MnemonicView should receive the context rules as soundNote");

  // THE FIX, part two: the standalone fallback survives only for a context
  // kana with NO mnemonic to carry the slot (っ/ッ — see the test above), and
  // is explicitly gated on the mnemonic's absence, not just context's
  // presence — so it can never double up with the MnemonicView block for the
  // same glyph.
  assert.match(
    src,
    /\{!m && soundNote \? \(/,
    "the standalone fallback must be gated on the absence of a mnemonic (`!m`), not just the presence of context",
  );
});
