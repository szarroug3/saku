// Run: node --import ./src/lib/conjugate/test-hooks.mjs --test \
//        src/lib/library/known-mark.test.ts
//
// WHAT THIS TEST IS FOR
// ===============================
// The Library's Known/Not-known FILTER (library-page.tsx's `keep`) needs one
// definition of "known" that never quietly drifts from standing.ts's own —
// `isEntryKnownForDisplay` is that one function: `entryIsKnown(entryStanding(
// knownFactsOf(entry), …))`, wrapped once so the filter never re-derives it.
//
// A per-tile "known" dot (SAK-63) briefly called this same function from a
// second site (entry-tile.tsx's KnownDot); the owner asked for the dot to be
// removed entirely, so that second call site is gone and this file no longer
// tests it — see entry-tile.tsx's file header for the removal.
//
// So this file checks two different things:
//
//   1. BEHAVIOUR — isEntryKnownForDisplay agrees with entryIsKnown/entryStanding
//      run directly, for the same shapes standing.test.ts already covers (never
//      seen, claimed, multi-fact partial vs whole, the kanji meaning-only case).
//      If this module ever grew its own threshold or its own accuracy math
//      instead of delegating, these would drift from standing.test.ts's cases.
//
//   2. WIRING — the filter's own call site (library-page.tsx's `keep`) goes
//      through THIS function and standing.ts's real exports, not a re-derived
//      formula. A source-text check, in the spirit of mark-view.test.ts's guard
//      on <Lbl>'s truthy check: cheaper than a render test (this repo has no
//      React Testing Library set up — see the total absence of
//      "@testing-library/react" under src/), and it catches the actual failure
//      mode (someone inlines `standing >= 80 ? …` on a tile instead of calling
//      this function).

import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { KANA_SUBJECT } from "@/data/characters";
import { KANJI_SUBJECT, meaningFactId } from "@/data/kanji";
import { factsOf } from "@/lib/facts";
import type { Claims } from "@/lib/claims";
import { knownFactsOf, LIB_ENTRIES } from "@/lib/library/library-index";
import { isEntryKnownForDisplay, isKnownForDisplay } from "@/lib/library/known-mark";
import { entryIsKnown, entryStanding } from "@/lib/library/standing";
import type { EntryId, FactAggregate, FactId } from "@/types";

const NOW = Date.UTC(2026, 0, 1);
const JUST_NOW = NOW - 1000;

const NO_FACTS: Record<FactId, FactAggregate> = {};
const NO_CLAIMS: Claims = {};

const kana = LIB_ENTRIES.find((e) => e.kind === KANA_SUBJECT)!;
const kanji = LIB_ENTRIES.find(
  (e) => e.kind === KANJI_SUBJECT && factsOf(e.id).length > 1,
)!;

function claimAll(entryId: EntryId): Claims {
  const claims: Claims = {};
  for (const f of factsOf(entryId)) claims[f] = JUST_NOW;
  return claims;
}

describe("isEntryKnownForDisplay — the grid mark agrees with entryIsKnown/entryStanding", () => {
  test("a never-seen entry is NOT known", () => {
    assert.equal(
      isEntryKnownForDisplay(kana, NO_FACTS, NO_CLAIMS, NOW),
      false,
    );
  });

  test("a claimed single-fact entry IS known — matches the filter's own case", () => {
    assert.equal(
      isEntryKnownForDisplay(kana, NO_FACTS, claimAll(kana.id), NOW),
      true,
    );
  });

  test("a multi-fact entry needs EVERY fact claimed, not just some", () => {
    const facts = factsOf(kanji.id);
    assert.ok(facts.length > 1, "need a multi-fact entry for this case");

    const partial: Claims = {};
    for (const f of facts.slice(1)) partial[f] = JUST_NOW;
    assert.equal(isEntryKnownForDisplay(kanji, NO_FACTS, partial, NOW), false);

    assert.equal(
      isEntryKnownForDisplay(kanji, NO_FACTS, claimAll(kanji.id), NOW),
      true,
    );
  });

  test("a kanji known ONLY on its meaning fact still marks known — knownFactsOf's call, not this function's", () => {
    const claims: Claims = { [meaningFactId(kanji.glyph)]: JUST_NOW };
    assert.equal(isEntryKnownForDisplay(kanji, NO_FACTS, claims, NOW), true);
  });

  test("agrees with entryIsKnown(entryStanding(knownFactsOf(entry), …)) on random real entries", () => {
    // Not a re-implementation check by construction (isEntryKnownForDisplay IS
    // this call, wrapped) — this guards against a future edit that quietly
    // changes the wrapper's arguments (wrong facts pooled, claims/facts
    // swapped, a stale `now`) without changing what it visibly returns for
    // the simple cases above.
    const claims = claimAll(kana.id);
    for (const entry of LIB_ENTRIES.slice(0, 25)) {
      const expected = entryIsKnown(
        entryStanding(knownFactsOf(entry), NO_FACTS, claims, NOW),
      );
      assert.equal(isEntryKnownForDisplay(entry, NO_FACTS, claims, NOW), expected);
    }
  });

  test("isKnownForDisplay (pre-fetched knownFacts) agrees with isEntryKnownForDisplay (bare entry)", () => {
    // library-page.tsx's real call site (see the wiring describe below) only
    // ever has an entry's knownFacts already resolved, never the bare entry —
    // this is what pins the two entry points to the one chain rather than
    // trusting the shared implementation detail alone.
    for (const entry of LIB_ENTRIES.slice(0, 25)) {
      const claims = claimAll(entry.id);
      assert.equal(
        isKnownForDisplay(knownFactsOf(entry), NO_FACTS, claims, NOW),
        isEntryKnownForDisplay(entry, NO_FACTS, claims, NOW),
      );
    }
  });
});

// ---------- wiring: the real call sites go through this function ----------

function readSrc(relPath: string): string {
  return readFileSync(
    fileURLToPath(new URL(`../../${relPath}`, import.meta.url)),
    "utf8",
  );
}

describe("wiring — the Known/Not-known filter is drawn through known-mark.ts, not a new formula", () => {
  test("library-page.tsx's filter calls isKnownForDisplay, not entryIsKnown/entryStanding directly", () => {
    const src = readSrc("components/library/library-page.tsx");
    // Not isEntryKnownForDisplay: that entry point calls the guarded
    // knownFactsOf internally (library-index.ts, SAK-104's ~9.5MB dictionary
    // kept server-only), and library-page.tsx already has an entry's known
    // facts pre-fetched (server-lookups.ts's BrowseEntry/withKnown) — it uses
    // isKnownForDisplay, the shared back half of the same chain, instead. See
    // known-mark.ts's own header for why there are two entry points.
    assert.match(
      src,
      /import\s*\{\s*isKnownForDisplay\s*\}\s*from\s*"@\/lib\/library\/known-mark"/,
      "library-page.tsx must import the shared known-mark helper",
    );
    // The Known/Not-known branch of `keep` resolves through it.
    const calls = src.match(/isKnownForDisplay\(/g) ?? [];
    assert.ok(
      calls.length >= 1,
      "expected isKnownForDisplay to be called by the filter's keep",
    );
    // No stray re-derivation via the raw standing chain elsewhere in the file.
    assert.doesNotMatch(
      src,
      /entryIsKnown\(\s*entryStanding\(/,
      "library-page.tsx should route through isKnownForDisplay rather than re-inlining entryIsKnown(entryStanding(...))",
    );
  });
});
