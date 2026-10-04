// Every pattern span in the corpus ends where its last word does (SAK-507).
//
// grammar.py used to end a span on the signature's last token. 〜てはいけない
// is て + は + 行く, so 信用してはいけないよ was marked してはいけ and the
// lesson showed ない in plain text after it. 2,309 spans were cut that way.
// match_all now runs a span on to the end of the word (word_end in
// scripts/ingest/grammar.py), and scripts/ingest/grammar_respan.py re-cut the
// committed corpus. CI has no tokenizer, so this test reads the text instead.
// A cut span is followed by the piece that finishes its word: ない or なかっ
// after いけ, ます or ませ after あり, た after しまっ, て after おい, なさい
// after おき, ば after おけ, たい after もらい.

import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { corpus } from "./corpus.ts";

/** Text that cannot start a word of its own, only finish the one before it.
 * た is left out before く, い, だ, ど, ま and た, which start other words
 * (たくさん, たどる, たまる, たたむ). ば is left out before っ (ばっかり). */
const FINISHES_A_WORD = /^(ない|なかっ|なく|なけれ|ます|ませ|まし|た(?![くいぃだどまた])|て|ば(?!っ)|なさい|たい)/;

/** Spans the text test flags that are not cut, and why. */
const NOT_CUT: Readonly<Record<string, string>> = {
  // はずない is はずがない with が left out. はず is a noun, so ない is a word of
  // its own after it.
  "10682570:hazu": "はず is a noun and ない after it is a separate word",
};

/** A particle ends a word, so what follows it starts a new one (帽子を|なくして). */
const ENDS_IN_A_PARTICLE = /[をへ]$/;

describe("a pattern span ends where its last word does", () => {
  test("no span stops before the piece that finishes its word", () => {
    const cut: string[] = [];
    for (const ex of corpus()) {
      for (const [pattern, [start, end]] of Object.entries(ex.sp)) {
        const span = ex.jp.slice(start, end);
        if (ENDS_IN_A_PARTICLE.test(span) || NOT_CUT[`${ex.id}:${pattern}`]) continue;
        if (FINISHES_A_WORD.test(ex.jp.slice(end))) cut.push(`${ex.id}:${pattern} ${span}|${ex.jp.slice(end)}`);
      }
    }
    assert.deepEqual(cut, [], `${cut.length} spans stop inside a word. Run scripts/ingest/grammar_respan.py`);
  });

  test("every exception is still in the corpus and still flagged", () => {
    for (const key of Object.keys(NOT_CUT)) {
      const [id, pattern] = key.split(":");
      const ex = corpus().find((e) => e.id === Number(id));
      const sp = ex?.sp[pattern!];
      assert.ok(ex && sp, `${key} is not in the corpus; take it out of NOT_CUT`);
      assert.match(ex.jp.slice(sp[1]), FINISHES_A_WORD, `${key} is no longer flagged; take it out of NOT_CUT`);
    }
  });

  test("the 〜てはいけない sentence on the card marks してはいけない", () => {
    const ex = corpus().find((e) => e.id === 75373);
    assert.ok(ex, "75373 is not in the corpus");
    const [start, end] = ex.sp["te-prohibition"]!;
    assert.equal(ex.jp.slice(start, end), "してはいけない");
  });

  test("every 〜てはいけない span ends in いけない or a form of it", () => {
    const short: string[] = [];
    for (const ex of corpus()) {
      const sp = ex.sp["te-prohibition"];
      if (!sp) continue;
      const span = ex.jp.slice(sp[0], sp[1]);
      if (!/(いけ|行け|いか)(ない|なかった|ません|ん)$/.test(span)) short.push(`${ex.id} ${span}`);
    }
    assert.deepEqual(short, []);
  });
});
