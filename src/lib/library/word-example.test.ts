// Run:
//   node --import ./src/lib/conjugate/test-hooks.mjs --test src/lib/library/word-example.test.ts
//
// Two things are being defended here. The first is that the picker is a TOTAL
// order: the word page renders on every navigation and a sentence that changes
// between two renders of the same word is a page that cannot be trusted about
// anything else. The second is that the generated artifact still contains what
// it was measured to contain — the file is committed, so a regeneration that
// quietly halved it would otherwise ship.

import assert from "node:assert/strict";
import { describe, test } from "node:test";

import {
  UNRANKED,
  WRONG_SENSE_EXAMPLES,
  chooseExample,
  hardestRank,
  indexByWord,
} from "./word-example";
import type { Example } from "../../data/grammar/corpus";
import { CORPUS } from "../../data/grammar/corpus";
import { VOCAB } from "../../data/vocab";
import { EXAMPLE_COUNT, exampleFor } from "../../data/word-examples";

function ex(id: number, v: readonly string[], n = v.length): Example {
  return { id, jp: "…", en: "…", n, v, p: [], sp: {} };
}

/** The three-word vocabulary the synthetic cases below are ranked against. */
const RANKS = new Map([
  ["食べる", 10],
  ["犬", 50],
  ["寡婦", 9000],
]);
const rankOf = (l: string) => RANKS.get(l);

describe("hardestRank", () => {
  test("is the rank of the hardest OTHER word", () => {
    assert.equal(hardestRank(ex(1, ["食べる", "犬"]), "食べる", rankOf), 50);
  });

  test("excludes the target, so a rare word does not mask its own sentence", () => {
    // 寡婦 is rank 9000. If it counted, both of these would score 9000 and the
    // ranking would collapse to the tie-break.
    assert.equal(hardestRank(ex(1, ["寡婦", "犬"]), "寡婦", rankOf), 50);
    assert.equal(hardestRank(ex(2, ["寡婦", "食べる"]), "寡婦", rankOf), 10);
  });

  test("an unlisted lemma is harder than any listed word", () => {
    assert.equal(hardestRank(ex(1, ["食べる", "トム"]), "食べる", rankOf), UNRANKED);
    assert.ok(UNRANKED > VOCAB.length, "UNRANKED must exceed every beginnerRank");
  });

  test("a sentence of nothing but the target scores 0, not UNRANKED", () => {
    assert.equal(hardestRank(ex(1, ["食べる"]), "食べる", rankOf), 0);
  });
});

describe("chooseExample", () => {
  test("prefers the sentence whose hardest word is commoner", () => {
    const easy = ex(900, ["食べる", "犬"]);
    const hard = ex(100, ["食べる", "寡婦"]);
    // The harder one is shorter AND has the lower id, so it wins on both
    // tie-breaks. Commonness must still beat it.
    assert.equal(chooseExample([hard, easy], "食べる", rankOf)?.id, 900);
    assert.equal(chooseExample([easy, hard], "食べる", rankOf)?.id, 900);
  });

  test("a proper noun loses to a ranked word, rather than scoring as free", () => {
    const named = ex(1, ["食べる", "トム"]);
    const known = ex(2, ["食べる", "寡婦"]);
    assert.equal(chooseExample([named, known], "食べる", rankOf)?.id, 2);
  });

  test("ties on hardness break on the shorter sentence", () => {
    const long = ex(1, ["食べる", "犬"], 12);
    const short = ex(2, ["食べる", "犬"], 4);
    assert.equal(chooseExample([long, short], "食べる", rankOf)?.id, 2);
  });

  test("ties on hardness and length break on the Tatoeba id", () => {
    const a = ex(77, ["食べる", "犬"], 5);
    const b = ex(12, ["食べる", "犬"], 5);
    assert.equal(chooseExample([a, b], "食べる", rankOf)?.id, 12);
    assert.equal(chooseExample([b, a], "食べる", rankOf)?.id, 12);
  });

  test("is deterministic under any input order", () => {
    const pool = [
      ex(5, ["食べる", "犬"], 6),
      ex(3, ["食べる", "犬"], 6),
      ex(4, ["食べる", "寡婦"], 2),
      ex(9, ["食べる", "トム"], 1),
      ex(8, ["食べる", "犬"], 9),
    ];
    const first = chooseExample(pool, "食べる", rankOf)!.id;
    assert.equal(first, 3);
    for (let i = 0; i < pool.length; i++) {
      const rotated = [...pool.slice(i), ...pool.slice(0, i)];
      assert.equal(chooseExample(rotated, "食べる", rankOf)!.id, first);
    }
    assert.equal(chooseExample([...pool].reverse(), "食べる", rankOf)!.id, first);
  });

  test("no candidates is null, not a thrown error or a placeholder", () => {
    assert.equal(chooseExample([], "食べる", rankOf), null);
  });
});

describe("the generated artifact", () => {
  const index = indexByWord(CORPUS);

  test("covers exactly the words the corpus can cover", () => {
    const covered = VOCAB.filter((w) => index.has(w.keb)).length;
    // Was 2,692 before the confound audit (see data/grammar/corpus-audit.ts)
    // removed 142 sentences from the corpus. 14 words lost their only example
    // with them; the cost is recorded here rather than absorbed silently.
    assert.equal(covered, 2678, "corpus coverage moved; remeasure before editing this");
    // Four of those words (タイ, ビル, パー, ホーム) have a corpus sentence but
    // EVERY one teaches the wrong sense of the word, so the wrong-sense filter
    // leaves them without an example — better than a false one (task-20 item 3).
    const fullyExcluded = Object.entries(WRONG_SENSE_EXAMPLES).filter(([w, ids]) => {
      const c = index.get(w) ?? [];
      return c.length > 0 && c.every((ex) => ids.includes(ex.id));
    }).length;
    assert.equal(fullyExcluded, 4);
    assert.equal(EXAMPLE_COUNT, covered - fullyExcluded);
    assert.equal(EXAMPLE_COUNT, 2674);
  });

  test("covers most of the words a beginner meets first", () => {
    const first500 = [...VOCAB]
      .sort((a, b) => a.beginnerRank - b.beginnerRank)
      .slice(0, 500);
    assert.equal(first500.filter((w) => exampleFor(w.keb) !== null).length, 393);
  });

  test("a word with no corpus sentence yields null", () => {
    // 沿う has no sentence spelling it 沿う; the corpus only has そう, which is
    // deliberately not matched — see the module header.
    assert.equal(exampleFor("沿う"), null);
    assert.equal(exampleFor("この単語は存在しない"), null);
  });

  test("every row is a real sentence containing its word", () => {
    // `Example.v` holds LEMMAS, so the sentence carries the word INFLECTED:
    // くすぐる is in くすぐらないで, 演ずる is in 演じている. 565 of the 2,678
    // rows do not contain their dictionary form literally and every one of them
    // is a conjugation, not a mismatch. What survives inflection in all 2,678 is
    // the head character, so that is what is checked; the literal count is
    // pinned below it so a genuine mis-index still has something to trip.
    let literal = 0;
    for (const w of VOCAB) {
      const got = exampleFor(w.keb);
      if (got === null) continue;
      if (got.jp.includes(w.keb)) literal++;
      // する is the one word with no stable head: it inflects to し, さ and せ
      // and keeps none of its dictionary spelling. It is the language's
      // irregular verb, not a broken row — 何がしたい？ is a する sentence.
      if (w.keb === "する") continue;
      assert.ok(got.jp.includes(w.keb[0]), `${w.keb}: sentence is not about this word`);
      assert.ok(got.en.length > 0, `${w.keb}: empty translation`);
      assert.ok(Number.isInteger(got.id) && got.id > 0, `${w.keb}: bad Tatoeba id`);
    }
    assert.equal(literal, 2109);
  });

  test("agrees with the chooser it was generated by", () => {
    const rank = new Map(VOCAB.map((w) => [w.keb, w.beginnerRank]));
    for (const w of VOCAB) {
      const candidates = index.get(w.keb);
      const got = exampleFor(w.keb);
      if (!candidates) {
        assert.equal(got, null, `${w.keb}: row with no candidates`);
        continue;
      }
      const want = chooseExample(candidates, w.keb, (l) => rank.get(l));
      // A word all of whose candidates are wrong-sense-banned has candidates but
      // no legal pick — the artifact must omit it, not carry a banned row.
      if (!want) {
        assert.equal(got, null, `${w.keb}: shipped a row the chooser now refuses`);
        continue;
      }
      assert.equal(got?.id, want.id, `${w.keb}: artifact is stale`);
      assert.equal(got?.jp, want.jp);
      assert.equal(got?.en, want.en);
    }
  });

  test("wrong-sense examples are excluded, and a correct one takes over (item 3)", () => {
    // グラス is a drinking glass; sentence 9776863 mistranslates it as the
    // material ("Glass is breakable"). Three other グラス sentences are correct,
    // so the filter swaps to one of them rather than dropping the word.
    const g = exampleFor("グラス");
    assert.ok(g, "グラス lost its example entirely");
    assert.notEqual(g!.id, 9776863, "グラス still shows the material-sense sentence");
    assert.ok(!/glass is breakable/i.test(g!.en), `グラス still glossed '${g!.en}'`);
    assert.ok(g!.jp.includes("グラス"));

    // タイ (sea bream), ビル (building), パー (paper), ホーム (platform): every
    // corpus sentence teaches a different word, so each is left without one.
    for (const w of ["タイ", "ビル", "パー", "ホーム"]) {
      assert.equal(exampleFor(w), null, `${w} still ships a wrong-sense example`);
    }

    // No shipped example is ever a banned id.
    for (const [w, ids] of Object.entries(WRONG_SENSE_EXAMPLES)) {
      const got = exampleFor(w);
      if (got) assert.ok(!ids.includes(got.id), `${w} shipped banned id ${got.id}`);
    }
  });
});
