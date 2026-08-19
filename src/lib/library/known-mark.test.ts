// Run: node --import ./src/lib/conjugate/test-hooks.mjs --test \
//        src/lib/library/known-mark.test.ts
//
// WHAT THIS TEST IS FOR (SAK-63)
// ===============================
// The Library grid now paints a small "known" dot on an entry's tile/row (see
// entry-tile.tsx's KnownDot). Its whole promise — matching the Known/Not known
// FILTER's promise in standing.test.ts — is that it is not a second, silently
// divergent definition of "known": it is `entryIsKnown(entryStanding(...))`,
// the exact chain the filter runs, wrapped once so both call sites share it.
//
// So this file checks two different things:
//
//   1. BEHAVIOUR — isEntryKnownForDisplay agrees with entryIsKnown/entryStanding
//      run directly, for the same shapes standing.test.ts already covers (never
//      seen, claimed, multi-fact partial vs whole, the kanji meaning-only case).
//      If this module ever grew its own threshold or its own accuracy math
//      instead of delegating, these would drift from standing.test.ts's cases.
//
//   2. WIRING — the actual call sites (library-page.tsx's grid predicate,
//      entry-tile.tsx's KnownDot) go through THIS function and standing.ts's
//      real exports, not a re-derived formula. A source-text check, in the
//      spirit of mark-view.test.ts's guard on <Lbl>'s truthy check: cheaper
//      than a render test (this repo has no React Testing Library set up —
//      see the total absence of "@testing-library/react" under src/), and it
//      catches the actual failure mode (someone inlines
//      `standing >= 80 ? …` on a tile instead of calling this function).

import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { KANA_SUBJECT } from "@/data/characters";
import { KANJI_SUBJECT, meaningFactId } from "@/data/kanji";
import { factsOf } from "@/lib/facts";
import type { Claims } from "@/lib/claims";
import { knownFactsOf, LIB_ENTRIES } from "@/lib/library/library-index";
import { isEntryKnownForDisplay } from "@/lib/library/known-mark";
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
});

// ---------- wiring: the real call sites go through this function ----------

function readSrc(relPath: string): string {
  return readFileSync(
    fileURLToPath(new URL(`../../${relPath}`, import.meta.url)),
    "utf8",
  );
}

describe("wiring — the grid mark is drawn through isEntryKnownForDisplay, not a new formula", () => {
  test("library-page.tsx's grid predicate calls isEntryKnownForDisplay, not entryIsKnown/entryStanding directly", () => {
    const src = readSrc("components/library/library-page.tsx");
    assert.match(
      src,
      /import\s*\{\s*isEntryKnownForDisplay\s*\}\s*from\s*"@\/lib\/library\/known-mark"/,
      "library-page.tsx must import the shared known-mark helper",
    );
    // The always-on grid predicate (independent of the Known/Not known filter)
    // and the filter's own known/unknown branch both resolve through it.
    const calls = src.match(/isEntryKnownForDisplay\(/g) ?? [];
    assert.ok(
      calls.length >= 2,
      "expected isEntryKnownForDisplay to be called at least twice (the filter's keep, and the grid's known predicate)",
    );
    // No stray re-derivation via the raw standing chain elsewhere in the file.
    assert.doesNotMatch(
      src,
      /entryIsKnown\(\s*entryStanding\(/,
      "library-page.tsx should route through isEntryKnownForDisplay rather than re-inlining entryIsKnown(entryStanding(...))",
    );
  });

  test("entry-tile.tsx's KnownDot is painted from a `known` boolean prop, not a re-derived standing", () => {
    const src = readSrc("components/library/entry-tile.tsx");
    assert.match(
      src,
      /function KnownDot/,
      "expected a KnownDot component",
    );
    assert.match(
      src,
      /known\s*=\s*false/,
      "EntryTile/EntryRow should default `known` to false rather than computing it themselves",
    );
    // entry-tile.tsx must not import standing.ts itself — it only ever
    // receives the already-resolved boolean from its caller.
    assert.doesNotMatch(
      src,
      /from ["']@\/lib\/library\/standing["']/,
      "entry-tile.tsx should not import standing.ts directly — known-ness is computed once, upstream",
    );
  });

  test("the known mark uses the app's `success` tone, the same tone standing.ts spends on solid/known elsewhere", () => {
    const src = readSrc("components/library/entry-tile.tsx");
    assert.match(
      src,
      /bg-success/,
      "the known dot should paint with the shared success token, not a bespoke colour",
    );
  });
});
