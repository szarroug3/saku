// Run: node --import ./src/lib/conjugate/test-hooks.mjs --test \
//        src/components/library/keigo-entry-view.test.ts
//
// SAK-37: A FIXED PHRASE DOESN'T GET THE HONORIFIC/HUMBLE TEMPLATE
// ===================================================================
// いらっしゃいませ's own "Where you'll hear it" text says this is a fixed
// phrase you hear rather than conjugate. The "Polite forms" section used to
// print the generic register template right below that — "HONORIFIC · Use
// this form to raise another person when they take an action" — which
// contradicts what the card just told the learner. The fix suppresses that
// template (the register label AND its "use this form..." description) for
// any set flagged `formulaic`, while a normal honorific/humble set still gets
// it. There is no renderer in this harness (see mark-view.test.ts), so the
// component's guard is pinned structurally by source, and the data-side
// claim — which sets are actually formulaic — is verified behaviourally.

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, test } from "node:test";

import { KEIGO_SETS } from "../../data/keigo.ts";
import { hasKanji } from "../../lib/romaji.ts";

describe("only genuinely plain-verb-less sets are flagged formulaic", () => {
  test("welcome (いらっしゃいませ) is the only formulaic set today", () => {
    const formulaic = KEIGO_SETS.filter((s) => s.formulaic).map((s) => s.id);
    assert.deepEqual(formulaic, ["welcome"]);
  });

  test("every formulaic set has no plain verb to contrast against", () => {
    // The general rule the fix relies on: `formulaic` is reserved for sets
    // with nothing to conjugate, so suppressing the honorific/humble template
    // on them is never suppressing it on a real conjugated form.
    for (const set of KEIGO_SETS) {
      if (set.formulaic) {
        assert.deepEqual(set.plain, [], `${set.id} is formulaic but has a plain verb`);
      }
    }
  });

  test("every non-formulaic set does have a plain verb", () => {
    for (const set of KEIGO_SETS) {
      if (!set.formulaic) {
        assert.ok(set.plain.length > 0, `${set.id} has no plain verb but isn't formulaic`);
      }
    }
  });
});

describe("the honorific/humble template is guarded on the set NOT being formulaic", () => {
  const SRC = readFileSync(new URL("./keigo-entry-view.tsx", import.meta.url), "utf8");

  test("the register (and its template text) is computed as undefined for formulaic sets", () => {
    assert.match(SRC, /const reg = set\.formulaic \? undefined : REGISTER\[w\.register\];/);
  });

  test("both the register label and its description are guarded on `reg`, not rendered unconditionally", () => {
    assert.match(SRC, /\{reg \? \(\s*<p[^>]*>\s*\{reg\.label\}\s*<\/p>\s*\) : null\}/);
    assert.match(SRC, /\{reg \? \(\s*<p[^>]*>\{reg\.desc\}<\/p>\s*\) : null\}/);
  });

  test("the word itself (audio, glyph, reading) still renders unconditionally", () => {
    // The fix suppresses only the template text — いらっしゃいませ must still be
    // hearable and visible, since its own card says "learn it by ear".
    assert.match(SRC, /<HearButton glyph=\{w\.reading\} \/>/);
    assert.match(SRC, /\{w\.word\}/);
    assert.match(SRC, /\{w\.reading\}/);
  });

  test("the fixed-phrase explanation section is still gated on set.formulaic", () => {
    assert.match(SRC, /\{set\.formulaic \? \(/);
    assert.match(SRC, /It&rsquo;s a fixed phrase/);
  });
});

// SAK-38: NO FURIGANA OVER AN ALREADY-ALL-KANA WORD
// ===================================================================
// The formulaic set's own word, いらっしゃいませ, is written entirely in kana —
// exactly the case this ticket is about. Before this fix the reading span
// printed いらっしゃいませ a second time right beside itself. The fix gates
// that span on `hasKanji(w.word)`, the shared kanji-detection helper (romaji.ts),
// so a kana-only word's reading is dropped rather than duplicated, while a
// kanji-bearing polite form (召し上がる) still shows its reading as before.
describe("the reading span is suppressed for an all-kana word (SAK-38)", () => {
  const SRC = readFileSync(new URL("./keigo-entry-view.tsx", import.meta.url), "utf8");

  test("imports the shared hasKanji helper rather than re-deriving the check", () => {
    assert.match(SRC, /import \{ hasKanji \} from "@\/lib\/romaji";/);
  });

  test("the reading span is gated on hasKanji(w.word), not rendered unconditionally", () => {
    assert.match(SRC, /\{hasKanji\(w\.word\) \? \(\s*<span[^>]*>\{w\.reading\}<\/span>\s*\) : null\}/);
  });

  test("the formulaic word いらっしゃいませ is exactly the all-kana case the guard exists for", () => {
    const welcome = KEIGO_SETS.find((s) => s.id === "welcome")!;
    const [w] = welcome.words;
    assert.equal(w.word, "いらっしゃいませ");
    assert.equal(hasKanji(w.word), false, "the guard must suppress the reading for this word");
  });

  test("a real polite form (召し上がる) still passes the guard, so its reading keeps rendering", () => {
    const eat = KEIGO_SETS.find((s) => s.id === "eat");
    const honorific = eat?.words.find((w) => w.register === "honorific");
    assert.ok(honorific, "expected the eat set to have an honorific form");
    assert.ok(hasKanji(honorific!.word), `expected ${honorific!.word} to contain kanji`);
  });
});
