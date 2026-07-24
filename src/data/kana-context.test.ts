import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { contextPronunciation } from "./kana-context.ts";

describe("kana that change sound by what follows", () => {
  test("ん carries the m / ng / n / final-nasal rules", () => {
    const ctx = contextPronunciation("ん");
    assert.ok(ctx, "ん should have context rules");
    const rules = ctx.rules;
    // The four environments, identified by their triggering sound and result.
    const m = rules.find((r) => /b, p, or m/.test(r.when));
    assert.ok(m, "the b/p/m rule should be present");
    assert.equal(m.sounds, "m");
    assert.match(m.example, /shimbun/);

    const ng = rules.find((r) => /k or g/.test(r.when));
    assert.ok(ng, "the k/g rule should be present");
    assert.match(ng.sounds, /ng/);
    assert.match(ng.example, /ringo/);

    const n = rules.find((r) => /t, d, n, s, z, or r/.test(r.when));
    assert.ok(n, "the t/d/n/s/z/r rule should be present");
    assert.equal(n.sounds, "n");

    const nasal = rules.find((r) => /end of a word/.test(r.when));
    assert.ok(nasal, "the word-final / pre-vowel rule should be present");
  });

  test("っ geminates — it doubles the following consonant", () => {
    const ctx = contextPronunciation("っ");
    assert.ok(ctx, "っ should have context rules");
    assert.equal(ctx.rules.length, 1);
    assert.match(ctx.rules[0].sounds, /doubled/);
    assert.match(ctx.rules[0].example, /gakkou/);
  });

  test("katakana shares hiragana's rules", () => {
    assert.deepEqual(contextPronunciation("ン"), contextPronunciation("ん"));
    assert.deepEqual(contextPronunciation("ッ"), contextPronunciation("っ"));
  });

  test("a plain kana returns null", () => {
    for (const c of "かあさたなはまやらわきしちにひみ") {
      assert.equal(contextPronunciation(c), null, `${c} should have no context rules`);
    }
  });

  test("homophones and particle-readings are NOT context rules", () => {
    // ぢ/づ sound like じ/ず everywhere (a note, not a following-sound rule);
    // は/へ change by grammatical role, not by the next sound.
    for (const c of "ぢづじずはへ") {
      assert.equal(contextPronunciation(c), null, `${c} should not carry context rules`);
    }
  });
});
