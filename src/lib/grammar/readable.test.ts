// Run:
//   node --import ./src/lib/conjugate/test-hooks.mjs --test src/lib/grammar/readable.test.ts
//
// THE GATE: a selection item is offered only when every content word in its
// sentence is one the learner knows.
//
// "only include things with words you know. you can't expect me to fill in a
// blank in a sentence i can't read" — the owner. 65.8% of items carried a word
// past beginner rank 2,000 before this existed.
//
// What is worth pinning here is not that the predicate returns booleans. It is
// (a) that the rule is ALL, not most — one unknown word blocks the item, and
// there is no threshold to drift; (b) that "known" is the app's one notion of
// known, so a CLAIM unlocks a sentence exactly as a lesson does; and (c) that
// the gate closing is not the same thing as the question disappearing.

import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { STOCK_NAMES, lemmaKnown, readableBy, readerFor, wordKnown } from "./readable.ts";
import { isBlankOnly, selection } from "./questions.ts";
import { RECIPES } from "../../data/grammar/recipes.ts";
import { examplesFor, type Example } from "../../data/grammar/corpus.ts";
import { VOCAB, wordMeaningFactId } from "../../data/vocab.ts";
import type { HistoryFile } from "../../types/index.ts";

const NOW = 1_700_000_000_000;

/** A learner who has CLAIMED these words and nothing else. */
function claiming(...kebs: string[]): HistoryFile {
  return {
    sessions: [],
    facts: {},
    claims: Object.fromEntries(kebs.map((k) => [wordMeaningFactId(k), NOW])),
  };
}

/** A learner who has been TESTED on these words — the other route to known. */
function tested(...kebs: string[]): HistoryFile {
  return {
    sessions: [],
    facts: Object.fromEntries(
      kebs.map((k) => [
        wordMeaningFactId(k),
        { seen: 1, missed: 0, slow: 0, firstTry: 1, correct: 1, lastTested: NOW, stability: 30 },
      ]),
    ),
  };
}

const NOBODY: HistoryFile = { sessions: [], facts: {} };

/** A synthetic example, so the ALL-vs-MOST rule is testable without hunting the
 * corpus for a sentence with exactly the lemmas a case wants. */
function example(v: string[]): Example {
  return { id: 1, jp: "…", en: "…", n: v.length, v, p: [], sp: {} };
}

describe("known is the app's known, not a second one", () => {
  test("a CLAIMED word counts — 'I already know this' unlocks sentences", () => {
    assert.equal(wordKnown("水", claiming("水")), true);
    assert.equal(wordKnown("水", NOBODY), false);
  });

  test("a TESTED word counts too", () => {
    assert.equal(wordKnown("水", tested("水")), true);
  });

  test("a lemma resolves by reading as well as by spelling", () => {
    // Tatoeba's tokeniser emits みる where the vocabulary lists 見る — 126
    // occurrences of it. Learning 見る has to make みる readable, or the gate
    // marks a word she was taught this morning unknown.
    assert.equal(lemmaKnown("みる", claiming("見る")), true);
    assert.equal(lemmaKnown("みる", NOBODY), false);
  });

  test("a lemma the vocabulary does not contain is NOT known", () => {
    // The intended answer, not a gap: it is a word the app can never teach, so
    // it is exactly the kind of word that makes a sentence unreadable.
    assert.equal(lemmaKnown("斯く斯く云々", claiming("水")), false);
  });
});

describe("the rule is ALL the content words, and there is no dial", () => {
  test("every lemma known admits the sentence", () => {
    assert.equal(readableBy(example(["水", "飲む"]), claiming("水", "飲む")), true);
  });

  test("ONE unknown lemma blocks it — 'most of it' is not readable", () => {
    assert.equal(readableBy(example(["水", "飲む"]), claiming("水")), false);
    // Nine known out of ten is still a sentence with a word she cannot read.
    const nine = ["一", "二", "三", "四", "五", "六", "七", "八", "九"];
    assert.equal(readableBy(example([...nine, "斯く斯く云々"]), claiming(...nine)), false);
  });

  test("a sentence with no content lemmas is readable — nothing in it is unknown", () => {
    assert.equal(readableBy(example([]), NOBODY), true);
  });

  test("the memoised reader agrees with the direct predicate", () => {
    const h = claiming("水", "飲む");
    const reader = readerFor(h);
    for (const v of [["水"], ["水", "飲む"], ["水", "斯く斯く云々"], []]) {
      assert.equal(reader(example(v)), readableBy(example(v), h), v.join("+"));
    }
  });
});

describe("Tatoeba's stock cast is always known", () => {
  test("トム, ボストン and メアリー never block a sentence", () => {
    for (const name of STOCK_NAMES) {
      assert.equal(lemmaKnown(name, NOBODY), true, name);
    }
    assert.equal(readableBy(example(["トム", "水"]), claiming("水")), true);
  });

  test("they are not in the vocabulary, which is WHY they cannot be blockers", () => {
    // The argument, as an assertion: no lesson teaches トム, so as a blocker it
    // is permanent — those items could never open, however much she studies.
    const spellings = new Set(VOCAB.flatMap((w) => [w.keb, w.reb]));
    for (const name of STOCK_NAMES) {
      assert.equal(spellings.has(name), false, `${name} is teachable after all`);
    }
  });

  test("the allowlist is the measured three, not 'any katakana word'", () => {
    // ダメ and タバコ are also katakana and also missing from the vocabulary,
    // and they are real words she has not met. A broader rule would wave them
    // through and re-open the hole this file closes.
    assert.equal(STOCK_NAMES.size, 3);
    assert.equal(lemmaKnown("ダメ", NOBODY), false);
    assert.equal(lemmaKnown("タバコ", NOBODY), false);
  });
});

describe("a selection board never shows the same label twice", () => {
  test("no item, for any pattern, offers two choices reading alike", () => {
    // Caught on screen, not by a test: トムが行かない＿＿＿行かない。 shipped with
    // 〜て on two separate buttons. The gloss test passed them — distinct
    // glosses, identical pattern text — so only the rendered label catches it.
    let boards = 0;
    for (const r of RECIPES) {
      for (const ex of examplesFor(r.id)) {
        const q = selection(ex, r.id, 4);
        if (!q) continue;
        boards++;
        const labels = q.choices.map((c) => c.pattern);
        assert.equal(
          new Set(labels).size,
          labels.length,
          `${r.id} #${ex.id}: ${labels.join(", ")}`,
        );
      }
    }
    assert.ok(boards > 1000, "the sweep must actually have swept something");
  });
});

describe("frames that are nothing but the blank are gone", () => {
  test("isBlankOnly recognises the shape, punctuation aside", () => {
    assert.equal(isBlankOnly("＿＿＿。"), true);
    assert.equal(isBlankOnly("＿＿＿"), true);
    assert.equal(isBlankOnly("彼は＿＿＿。"), false);
  });

  test("no pattern can produce one, anywhere in the corpus", () => {
    // The count that used to ship: 114 items whose Japanese was ＿＿＿。 and
    // whose every scrap of information was in the English line. Asserted as
    // ZERO now, and swept over the whole corpus rather than a sample, because
    // "we removed most of them" is not the claim.
    let offenders = 0;
    for (const r of RECIPES) {
      for (const ex of examplesFor(r.id)) {
        const q = selection(ex, r.id, 4);
        if (q && isBlankOnly(q.frame)) offenders++;
      }
    }
    assert.equal(offenders, 0);
  });
});
