// Run: node --import ./src/lib/conjugate/test-hooks.mjs --test \
//        src/components/library/entry-tile.test.ts
//
// SAK-38: NO FURIGANA OVER AN ALREADY-ALL-KANA WORD
// ===================================================================
// Two shelf cells print a word next to its reading (furigana in this app's
// boxless style): PairCell (verb-pairs shelf) and KeigoCell (keigo shelf,
// which includes いらっしゃいませ — a real all-kana set that used to print its
// own reading redundantly beside itself). Both are gated on the shared
// `hasKanji` helper (romaji.ts) rather than showing the reading
// unconditionally. There is no renderer in this harness (see
// mark-view.test.ts), so the guard is pinned structurally by source.

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, test } from "node:test";

describe("shelf-cell readings are suppressed for all-kana words (SAK-38)", () => {
  const SRC = readFileSync(new URL("./entry-tile.tsx", import.meta.url), "utf8");

  test("imports the shared hasKanji helper rather than re-deriving the check", () => {
    assert.match(SRC, /import \{ hasKanji \} from "@\/lib\/romaji";/);
  });

  test("PairCell gates its reading span on hasKanji(side.word)", () => {
    assert.match(SRC, /\{hasKanji\(side\.word\) \? \(\s*<span[^>]*>\{side\.reading\}<\/span>\s*\) : null\}/);
  });

  test("KeigoCell drops words with no kanji from the joined reading line", () => {
    assert.match(SRC, /\.filter\(\(w\) => hasKanji\(w\.word\)\)/);
  });
});
