// Run: node --import ./src/lib/conjugate/test-hooks.mjs --test \
//        src/components/lesson/phase-intro-view.test.ts
//
// SAK-38: NO FURIGANA OVER AN ALREADY-ALL-KANA WORD
// ===================================================================
// Three spots in this file print a worked word/number next to its reading in
// parentheses — furigana in this app's boxless style: AnchoredIntroExamples
// and IntroExamples (both keyed on IntroExample.to/.reading) and
// IntroCountTable (keyed on CountRow.word/.reading — the number/counter track,
// whose forms are frequently already all kana: ひとつ, ふたり, …). Each is
// gated on the shared `hasKanji` helper (romaji.ts) rather than shown
// whenever a `reading` happens to be present. There is no renderer in this
// harness (see mark-view.test.ts), so the guard is pinned structurally by
// source.

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, test } from "node:test";

import { hasKanji } from "../../lib/romaji.ts";

describe("worked-example readings are suppressed for all-kana results (SAK-38)", () => {
  const SRC = readFileSync(new URL("./phase-intro-view.tsx", import.meta.url), "utf8");

  test("imports the shared hasKanji helper rather than re-deriving the check", () => {
    assert.match(SRC, /import \{ hasKanji \} from "@\/lib\/romaji";/);
  });

  test("AnchoredIntroExamples gates its reading parenthetical on hasKanji(ex.to)", () => {
    assert.match(
      SRC,
      /\{ex\.reading && hasKanji\(ex\.to\) \? \(\s*<span[^>]*>\(\{ex\.reading\}\)<\/span>\s*\) : null\}/,
    );
  });

  test("IntroExamples gates its reading parenthetical on hasKanji(ex.to)", () => {
    assert.match(
      SRC,
      /\{ex\.reading && hasKanji\(ex\.to\) \? \(\s*<span className=\{hasAccent[^}]*\}>\(\{ex\.reading\}\)<\/span>\s*\) : null\}/,
    );
  });

  test("IntroCountTable gates its parenthetical reading block on hasKanji(row.word)", () => {
    assert.match(SRC, /\{hasKanji\(row\.word\) \? \(\s*<span className="text-text-muted">/);
  });

  test("a real all-kana counted form (ひとつ) is exactly the case the guard exists for", () => {
    assert.equal(hasKanji("ひとつ"), false);
    assert.equal(hasKanji("十一"), true);
  });
});
