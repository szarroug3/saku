// Run: node --import ./src/lib/conjugate/test-hooks.mjs --test \
//        src/components/library/verbpair-entry-view.test.ts
//
// SAK-38: NO FURIGANA OVER AN ALREADY-ALL-KANA WORD
// ===================================================================
// Each side of a verb pair (happens/doIt) prints its word next to its own
// reading — furigana in this app's boxless style. Every verb pair in today's
// data happens to be written in kanji, but the component must not assume
// that always holds, so the reading is gated on the shared `hasKanji` helper
// (romaji.ts) rather than shown unconditionally. There is no renderer in this
// harness (see mark-view.test.ts / keigo-entry-view.test.ts), so the guard is
// pinned structurally by source.

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, test } from "node:test";

describe("the reading is suppressed for an all-kana verb (SAK-38)", () => {
  const SRC = readFileSync(new URL("./verbpair-entry-view.tsx", import.meta.url), "utf8");

  test("imports the shared hasKanji helper rather than re-deriving the check", () => {
    assert.match(SRC, /import \{ hasKanji \} from "@\/lib\/romaji";/);
  });

  test("the reading span is gated on hasKanji(s.m.word), not rendered unconditionally", () => {
    assert.match(SRC, /\{hasKanji\(s\.m\.word\) \? \(\s*<span[^>]*>\{s\.m\.reading\}<\/span>\s*\) : null\}/);
  });

  test("the word itself still renders unconditionally", () => {
    assert.match(SRC, /\{s\.m\.word\}/);
  });
});
