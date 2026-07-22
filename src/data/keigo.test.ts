// Run: node --import ./src/lib/conjugate/test-hooks.mjs --test src/data/keigo.test.ts
//
// THE CORRECTNESS BAR IS ABSOLUTE (owner's ruling, task 12)
// ========================================================
// A wrong honorific/humble pairing teaches a false belief that is worse than not
// knowing — calling いただく the honorific would have a learner lower the person
// they meant to raise. So the core of this file is an INDEPENDENT copy of the
// pinned table: the plain verb, its honorific form, and its humble form, spelled
// out here so an edit to src/data/keigo.ts that corrupts a pairing fails loudly
// rather than shipping. The owner verifies the Japanese; these tests make sure a
// later refactor cannot silently move a word from one register to the other.

import assert from "node:assert/strict";
import { describe, test } from "node:test";

import {
  KEIGO_SETS,
  KEIGO_SUBJECT,
  KEIGO_ENTRIES,
  KEIGO_FACTS,
  keigoDistractors,
  keigoSetEntry,
  keigoWordFactId,
  keigoWordInfo,
  recognitionGloss,
  type Register,
} from "./keigo.ts";
import { vocabRow } from "./vocab.ts";
import { factInfo } from "../lib/facts.ts";

/**
 * THE PIN. plain verb(s) → honorific form(s) → humble form(s), verified against a
 * reference. This is the table from the task, independently restated. Every entry
 * here must match KEIGO_SETS exactly and be assigned to exactly the register named.
 */
const PINNED: Record<
  string,
  { plain: string[]; honorific: string[]; humble: string[] }
> = {
  eat: { plain: ["食べる", "飲む"], honorific: ["召し上がる"], humble: ["いただく"] },
  say: { plain: ["言う"], honorific: ["おっしゃる"], humble: ["申す", "申し上げる"] },
  do: { plain: ["する"], honorific: ["なさる"], humble: ["いたす"] },
  "go-come-be": {
    plain: ["行く", "来る", "いる"],
    honorific: ["いらっしゃる"],
    humble: ["参る", "おる"],
  },
  see: { plain: ["見る"], honorific: ["ご覧になる"], humble: ["拝見する"] },
  "give-me": { plain: ["くれる"], honorific: ["くださる"], humble: [] },
  receive: { plain: ["もらう"], honorific: [], humble: ["いただく"] },
  know: { plain: ["知る"], honorific: ["ご存知だ"], humble: ["存じる", "存じ上げる"] },
  welcome: { plain: [], honorific: ["いらっしゃいませ"], humble: [] },
};

function wordsOfRegister(setId: string, register: Register): string[] {
  const set = KEIGO_SETS.find((s) => s.id === setId);
  assert.ok(set, `no set ${setId}`);
  return set.words.filter((w) => w.register === register).map((w) => w.word);
}

describe("the pinned honorific/humble table maps plain to each register correctly", () => {
  test("every set in the data is one the table pins, and vice versa", () => {
    assert.deepEqual(
      KEIGO_SETS.map((s) => s.id).sort(),
      Object.keys(PINNED).sort(),
    );
  });

  for (const [id, want] of Object.entries(PINNED)) {
    test(`${id}: plain, honorific and humble are exactly as pinned`, () => {
      const set = KEIGO_SETS.find((s) => s.id === id)!;
      assert.deepEqual(
        set.plain.map((p) => p.keb),
        want.plain,
        `${id}: plain verbs drifted`,
      );
      assert.deepEqual(
        wordsOfRegister(id, "honorific"),
        want.honorific,
        `${id}: honorific side drifted`,
      );
      assert.deepEqual(
        wordsOfRegister(id, "humble"),
        want.humble,
        `${id}: humble side drifted`,
      );
    });
  }

  test("the two registers never share a word within a set", () => {
    // The one mistake this table exists to prevent: a word tagged both ways, or
    // the honorific and humble columns colliding on one form.
    for (const set of KEIGO_SETS) {
      const hon = new Set(
        set.words.filter((w) => w.register === "honorific").map((w) => w.word),
      );
      for (const w of set.words) {
        if (w.register === "humble") {
          assert.ok(!hon.has(w.word), `${set.id}: ${w.word} is in both registers`);
        }
      }
    }
  });

  test("いただく is HUMBLE in both sets it appears in, never honorific", () => {
    // The canonical trap: いただく is the humble of both 食べる/飲む and もらう. A
    // refactor that mis-tagged either would be caught by the per-set pin above,
    // but it is called out by name here because it is the one word most likely to
    // be moved to the wrong register.
    for (const set of KEIGO_SETS) {
      for (const w of set.words) {
        if (w.word === "いただく") {
          assert.equal(w.register, "humble", `${set.id}: いただく is not humble`);
        }
      }
    }
  });
});

describe("the track is its own subject, and いらっしゃる was added to vocab", () => {
  test("every keigo fact carries the keigo subject, not word", () => {
    assert.equal(KEIGO_SUBJECT, "keigo");
    for (const f of KEIGO_FACTS) {
      assert.equal(f.subject, KEIGO_SUBJECT, `${f.id} is not a keigo fact`);
    }
  });

  test("いらっしゃる exists in the vocabulary", () => {
    // The core keigo verb, missing from the JMdict cut and added by hand — the
    // task's explicit requirement. It must be a real word the app can teach.
    const row = vocabRow("いらっしゃる");
    assert.ok(row, "いらっしゃる is not in VOCAB");
    assert.equal(row.keb, "いらっしゃる");
    assert.equal(row.reb, "いらっしゃる");
  });

  test("いらっしゃる is also the honorific form in the go/come/be set", () => {
    const set = KEIGO_SETS.find((s) => s.id === "go-come-be")!;
    const hon = set.words.filter((w) => w.register === "honorific");
    assert.deepEqual(hon.map((w) => w.word), ["いらっしゃる"]);
  });
});

describe("facts, glosses and lookups", () => {
  test("every keigo word mints exactly one recognition fact, registered", () => {
    let n = 0;
    for (const set of KEIGO_SETS) {
      for (const w of set.words) {
        n++;
        const id = keigoWordFactId(set, w);
        assert.ok(factInfo(id), `${id} not in the fact registry`);
        const info = keigoWordInfo(id);
        assert.ok(info, `${id} has no keigo info`);
        assert.equal(info.word.word, w.word);
        assert.equal(info.set.id, set.id);
      }
    }
    assert.equal(KEIGO_FACTS.length, n);
  });

  test("a verb set's gloss carries the register; a set phrase does not", () => {
    const meshi = KEIGO_SETS.find((s) => s.id === "eat")!;
    const hon = meshi.words.find((w) => w.register === "honorific")!;
    assert.equal(recognitionGloss(meshi, hon), "eat / drink (honorific)");
    const hum = meshi.words.find((w) => w.register === "humble")!;
    assert.equal(recognitionGloss(meshi, hum), "eat / drink (humble)");

    const welcome = KEIGO_SETS.find((s) => s.id === "welcome")!;
    const phrase = welcome.words[0];
    // A formulaic phrase has no register tag — there is no plain verb to contrast.
    assert.ok(!recognitionGloss(welcome, phrase).includes("(honorific)"));
  });

  test("KEIGO_ENTRIES is exactly one entry per set", () => {
    assert.equal(KEIGO_ENTRIES.size, KEIGO_SETS.length);
    for (const set of KEIGO_SETS) {
      assert.ok(KEIGO_ENTRIES.has(keigoSetEntry(set)), `${set.id} not labelled`);
    }
  });
});

describe("distractors force the register contrast and never repeat an answer", () => {
  test("召し上がる's sharpest distractor is いただく — same action, opposite register", () => {
    const eat = KEIGO_SETS.find((s) => s.id === "eat")!;
    const hon = eat.words.find((w) => w.register === "honorific")!;
    const hum = eat.words.find((w) => w.register === "humble")!;
    const ds = keigoDistractors(keigoWordFactId(eat, hon));
    assert.equal(ds[0], keigoWordFactId(eat, hum), "the humble partner is not first");
  });

  test("no distractor shares the asked fact's gloss (no second right answer)", () => {
    // 申す and 申し上げる are both 'say (humble)': offering one against the other
    // would be two correct buttons. Every distractor must differ in gloss.
    for (const set of KEIGO_SETS) {
      for (const w of set.words) {
        const fact = keigoWordFactId(set, w);
        const asked = keigoWordInfo(fact)!.gloss;
        for (const d of keigoDistractors(fact)) {
          assert.notEqual(d, fact, "asked fact offered as its own distractor");
          assert.notEqual(
            keigoWordInfo(d)!.gloss,
            asked,
            `${d} shares a gloss with ${fact}`,
          );
        }
      }
    }
  });
});
