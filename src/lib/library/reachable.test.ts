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

import assert from "node:assert/strict";
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
// ---------------------------------------------------------------------------

test("か and カ are real shape neighbours (the precondition for this example)", () => {
  const lookalikes = kanaConfusables("か");
  assert.ok(
    lookalikes.includes(kanaEntry("カ")),
    "カ must be in か's real lookalike list for this ticket's example to mean anything",
  );
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
