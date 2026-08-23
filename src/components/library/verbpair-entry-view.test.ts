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
//
// SAK-170: the furigana reading (and, for an all-kana verb, the primary word
// text itself) now renders through PitchReading instead of a plain <span>
// whenever wordPitch(s.m.word) resolves — 131 of the 138 verb-pair members
// (~95%) carry a verified downstep against src/data/generated/pitch.json, so
// this is a real, common branch, not a rare edge case. The hasKanji gate
// itself is unchanged; only the two REGEXES below were widened to match the
// pitch/no-pitch ternary now inside that gate.

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, test } from "node:test";

describe("the reading is suppressed for an all-kana verb (SAK-38)", () => {
  const SRC = readFileSync(new URL("./verbpair-entry-view.tsx", import.meta.url), "utf8");

  test("imports the shared hasKanji helper rather than re-deriving the check", () => {
    assert.match(SRC, /import \{ hasKanji \} from "@\/lib\/romaji";/);
  });

  test("the furigana reading is gated on hasKanji(s.m.word), not rendered unconditionally", () => {
    assert.match(
      SRC,
      /\{hasKanji\(s\.m\.word\) \? \(\s*pitch !== null \? \(\s*<PitchReading[\s\S]*?reading=\{s\.m\.reading\}[\s\S]*?\/>\s*\) : \(\s*<span[^>]*>\{s\.m\.reading\}<\/span>\s*\)\s*\) : null\}/,
    );
  });

  test("the word itself still renders unconditionally", () => {
    assert.match(SRC, /\{s\.m\.word\}/);
  });
});

describe("exact-pitch audio wiring (SAK-170)", () => {
  const SRC = readFileSync(new URL("./verbpair-entry-view.tsx", import.meta.url), "utf8");

  test("imports wordPitch and PitchReading, the same downstep-exact pattern character-entry-view.tsx uses", () => {
    assert.match(SRC, /import \{ wordPitch \} from "@\/data\/pitch";/);
    assert.match(SRC, /import \{ PitchReading \} from "@\/components\/library\/pitch-mark";/);
  });

  test("HearButton is passed the verified downstep, not left generic", () => {
    assert.match(SRC, /<HearButton glyph=\{s\.m\.reading\} downstep=\{pitch \?\? undefined\} \/>/);
  });
});
