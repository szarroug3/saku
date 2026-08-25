// Run: node --import ./src/lib/conjugate/test-hooks.mjs --test \
//        src/lib/library/reachable.test.ts
//
// SAK-30: the RELATED section on a Library entry page, and the "commonly mixed
// up with" call-out, were both cross-links drawn BEFORE the learner had any
// business seeing them — the Hiragana term card linked Katakana and Dakuten at
// lesson-1 card-2, か's "commonly mixed up with" showed カ before katakana had
// been introduced at all. These tests reproduce both examples verbatim off the
// real curriculum data (TERMS' own `related` array, LOOK_GROUP's real か/カ
// pair), not a hand-built stand-in, so a change to either table that breaks the
// gate's assumptions fails here too.
//
// SAK-186 UPDATE: か/カ (and 7 other same-sound hiragana/katakana pairs) were
// removed from LOOKALIKES entirely — they were the same mora in two scripts,
// not a genuine confusable, so か's "commonly mixed up with" no longer
// mentions カ at all (see characters.ts). That retires the confusables half of
// this file's own precondition: LOOKALIKES carries no cross-script pair any
// more, so the "commonly mixed up with a not-yet-reached script" scenario
// cannot happen via LOOK_GROUP today. `kanaGlyphReachable` itself is still
// exercised directly below (it also gates the Related section and the
// Hiragana term's related links, both still real, still cross-script), so the
// gate mechanism keeps real coverage — only its confusables-specific worked
// example is gone.

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { test } from "node:test";

import { kanaEntry, kanaFact } from "@/data/characters";
import { TERMS } from "@/data/terms";
import { kanaConfusables } from "@/lib/library/library-index";
import { conceptReachable, kanaGlyphReachable } from "@/lib/library/reachable";
import type { FactId, HistoryFile } from "@/types";

/** A learner who has done nothing at all. */
const BLANK: HistoryFile = { sessions: [], facts: {} };

/** A learner who has met exactly these facts, by the weakest record that
 * counts — "quiz me" (the same `seen` record track-intros.test.ts uses for
 * the identical purpose: enough to make a fact non-fresh, nothing more). */
function met(facts: readonly FactId[]): HistoryFile {
  return { sessions: [], facts: {}, seen: Object.fromEntries(facts.map((f) => [f, 1])) };
}

// ---------------------------------------------------------------------------
// か's "commonly mixed up with" showing カ before katakana has started.
//
// SAK-186: か's confusables no longer include カ at all (see the file header
// note above), so the "would show a not-yet-reached script" precondition this
// section used to verify off real LOOKALIKES data no longer holds — asserted
// directly below, replacing the old "か and カ are real shape neighbours"
// precondition test. `kanaGlyphReachable` itself is unaffected: it is a
// generic glyph-vs-history-track check that never read LOOKALIKES, so it is
// tested directly against カ as a glyph, and it still gates the Related
// section's dakuten/yōon links elsewhere on the same page.
// ---------------------------------------------------------------------------

test("SAK-186: か's confusables no longer include カ (same-sound cross-script pairs were removed)", () => {
  const lookalikes = kanaConfusables("か");
  assert.ok(
    !lookalikes.includes(kanaEntry("カ")),
    "カ must no longer be in か's LOOKALIKES-derived confusable list",
  );
});

test("SAK-186: none of the 8 removed same-sound pairs appear in each other's LOOK_GROUP confusables", () => {
  const pairs: Array<[string, string]> = [
    ["か", "カ"],
    ["や", "ヤ"],
    ["も", "モ"],
    ["り", "リ"],
    ["せ", "セ"],
    ["き", "キ"],
    ["に", "ニ"],
    ["へ", "ヘ"],
  ];
  for (const [hira, kata] of pairs) {
    assert.ok(
      !kanaConfusables(hira).includes(kanaEntry(kata)),
      `${hira}'s confusables must not include ${kata}`,
    );
    assert.ok(
      !kanaConfusables(kata).includes(kanaEntry(hira)),
      `${kata}'s confusables must not include ${hira}`,
    );
  }
});

test("SAK-30 example: カ does not gate as reachable before katakana starts", () => {
  assert.equal(kanaGlyphReachable("カ", BLANK), false);
  // Meeting hiragana facts alone must not open katakana.
  assert.equal(kanaGlyphReachable("カ", met([..."あいうえお"].map(kanaFact))), false);
});

test("SAK-30 example: カ gates as reachable once katakana has started, even having never met カ itself", () => {
  // The learner has met ア, never カ — a lookalike call-out that only ever
  // fired after the exact glyph was already met could never warn about a
  // mix-up before it happened, so the gate is the TRACK, not the glyph.
  const history = met([kanaFact("ア")]);
  assert.equal(kanaGlyphReachable("カ", history), true);
});

test("a base kana (あ) gates on its own script the same way", () => {
  assert.equal(kanaGlyphReachable("あ", BLANK), false);
  assert.equal(kanaGlyphReachable("あ", met([kanaFact("い")])), true);
});

// ---------------------------------------------------------------------------
// The Hiragana term card's RELATED section linking Katakana and Dakuten at
// lesson-1 card-2, before a single hiragana character had been taught.
// ---------------------------------------------------------------------------

const HIRAGANA_TERM = TERMS.find((t) => t.id === "hiragana");

test("the hiragana term really does relate to kana, katakana and dakuten (the precondition)", () => {
  assert.ok(HIRAGANA_TERM);
  assert.deepEqual(HIRAGANA_TERM.related, ["kana", "katakana", "dakuten"]);
});

/** What TermEntryView does with `term.relatedLinks` — filter each related id
 * through conceptReachable. Exercised directly here since the component
 * itself has no render harness in this test runner (see kana-entry-view.test.ts's
 * own note on that constraint); this is the exact predicate it calls. */
function reachableRelated(ids: readonly string[], history: HistoryFile): string[] {
  return ids.filter((id) => conceptReachable(id, history));
}

test("SAK-30 example: none of the hiragana term's related links show before hiragana starts", () => {
  assert.ok(HIRAGANA_TERM);
  assert.deepEqual(reachableRelated(HIRAGANA_TERM.related!, BLANK), []);
});

test("SAK-30 example: katakana and dakuten stay held back even once hiragana has started", () => {
  assert.ok(HIRAGANA_TERM);
  // Met only base hiragana — no katakana, no dakuten/handakuten glyph.
  const history = met([..."あいうえお"].map(kanaFact));
  const shown = reachableRelated(HIRAGANA_TERM.related!, history);
  assert.ok(shown.includes("kana"), "kana rides in with hiragana, its own first half");
  assert.ok(!shown.includes("katakana"), "katakana must stay held back");
  assert.ok(!shown.includes("dakuten"), "dakuten must stay held back");
});

test("SAK-30 example: katakana joins once the katakana track has started", () => {
  assert.ok(HIRAGANA_TERM);
  const history = met([...[..."あいうえお"].map(kanaFact), kanaFact("ア")]);
  const shown = reachableRelated(HIRAGANA_TERM.related!, history);
  assert.ok(shown.includes("katakana"));
});

test("SAK-30 example: dakuten joins once a dakuten kana has actually been met", () => {
  assert.ok(HIRAGANA_TERM);
  const history = met([...[..."あいうえお"].map(kanaFact), kanaFact("が")]);
  const shown = reachableRelated(HIRAGANA_TERM.related!, history);
  assert.ok(shown.includes("dakuten"));
  assert.ok(!shown.includes("katakana"), "dakuten opening must not also open katakana");
});

test("dakuten does not open on hiragana volume alone, only on an actual dakuten glyph", () => {
  // A learner who has met every base gojūon row but no voiced kana yet.
  const history = met(
    [..."あいうえおかきくけこさしすせそたちつてとなにぬねのまみむめもやゆよらりるれろわをん"].map(
      kanaFact,
    ),
  );
  assert.equal(conceptReachable("dakuten", history), false);
});

test("unrelated/unknown concept ids are never gated (romaji, jlpt, …)", () => {
  assert.equal(conceptReachable("romaji", BLANK), true);
  assert.equal(conceptReachable("jlpt", BLANK), true);
});

test("handakuten gates independently of dakuten", () => {
  // ば (dakuten) met, ぱ (handakuten) not.
  const history = met([kanaFact("ば")]);
  assert.equal(conceptReachable("dakuten", history), true);
  assert.equal(conceptReachable("handakuten", history), false);
});

// ---------------------------------------------------------------------------
// SAK-30 CORRECTION: the gate above is fine — it was wired into the wrong call
// sites. Sam: "the library should always show commonly mixed up with and
// related links regardless of known or unknown. only lessons should gate."
// She confirmed this on か's own Library page specifically, where "commonly
// mixed up with" had gone missing entirely (should always show カ once
// katakana exists as a concept at all) while it correctly showed during the
// actual lesson card. KanaEntryView, TermEntryView and KeigoEntryView are
// each reused as BOTH the standalone Library page and the in-lesson teach
// walk, so a `gateToReachable` prop (default false — "show everything", the
// Library page's own behavior) now threads through, with only the teach
// walk's own call sites turning it on. None of these views have a render
// harness in this test runner (see kana-entry-view.test.ts's own note on that
// constraint), so — same as that file — this is verified structurally: the
// prop exists, defaults to ungated, and each render-time gate check is
// conditioned on it; and that the Library route never passes it while the
// teach-walk call sites do.
// ---------------------------------------------------------------------------

function src(relPath: string): string {
  return readFileSync(fileURLToPath(new URL(relPath, import.meta.url)), "utf8");
}

test("KanaEntryView: gateToReachable defaults to false and gates both confusables and related links on it", () => {
  const s = src("../../components/library/kana-entry-view.tsx");
  assert.match(s, /gateToReachable\s*=\s*false/, "gateToReachable must default to false (show everything)");
  assert.match(
    s,
    /if \(!gateToReachable\) return true;/,
    "the confusables filter must short-circuit to 'show everything' when ungated",
  );
  assert.match(
    s,
    /!gateToReachable \|\| kanaGlyphReachable\(base, history\)/,
    "the base-kana related link must only gate when gateToReachable is true",
  );
  assert.match(
    s,
    /!gateToReachable \|\| conceptReachable\(row\.markName, history\)/,
    "the mark related link must only gate when gateToReachable is true",
  );
});

test("TermEntryView: gateToReachable defaults to false and only filters relatedLinks when true", () => {
  const s = src("../../components/library/term-entry-view.tsx");
  assert.match(s, /gateToReachable\s*=\s*false/, "gateToReachable must default to false (show everything)");
  assert.match(
    s,
    /gateToReachable\s*\n?\s*\?\s*term\.relatedLinks\.filter/,
    "relatedLinks must only be filtered through conceptReachable when gateToReachable is true",
  );
});

test("KeigoEntryView: gateToReachable defaults to false and only gates the keigo-registers link when true", () => {
  const s = src("../../components/library/keigo-entry-view.tsx");
  assert.match(s, /gateToReachable\s*=\s*false/, "gateToReachable must default to false (show everything)");
  assert.match(
    s,
    /registers && \(!gateToReachable \|\| conceptReachable\("keigo-registers", history\)\)/,
    "the keigo-registers related link must only gate when gateToReachable is true",
  );
});

test("the Library route never passes gateToReachable — it always shows everything", () => {
  const s = src("../../app/library/[...entry]/page.tsx");
  assert.doesNotMatch(
    s,
    /gateToReachable/,
    "the standalone Library page must never opt into the lesson gate",
  );
});

test("the teach walk turns gating on for all three reused views", () => {
  const teachWalk = src("../../components/session/teach-walk.tsx");
  assert.match(
    teachWalk,
    /<TermEntryView[^>]*gateToReachable/,
    "teach-walk's TermEntryView call must pass gateToReachable",
  );

  const teachItemView = src("../../components/session/teach-item-view.tsx");
  assert.match(
    teachItemView,
    /<KanaEntryView[^>]*gateToReachable/,
    "teach-item-view's KanaEntryView call must pass gateToReachable",
  );
  assert.match(
    teachItemView,
    /<KeigoEntryView[^>]*gateToReachable/,
    "teach-item-view's KeigoEntryView call must pass gateToReachable",
  );

  // The live adapters teach-item-view.tsx renders through must forward the
  // flag to the shared renderer rather than swallowing it.
  const liveAdapters = src("../../components/library/live-item-entry-views.tsx");
  assert.match(
    liveAdapters,
    /gateToReachable=\{gateToReachable\}/,
    "live-item-entry-views.tsx must forward gateToReachable to the shared renderers",
  );
});
