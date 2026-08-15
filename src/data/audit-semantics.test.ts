// Run: node --import ./src/lib/conjugate/test-hooks.mjs --test \
//        src/data/audit-semantics.test.ts
//
// SEMANTIC AUDIT GUARDS (data-integrity review)
// =============================================
// These pin correctness the existing keigo/transitivity suites leave implicit,
// and close the one gap the confusable/cross-script tables never had a test for.
// They are DELIBERATELY an independent restatement — a second author checking
// the same Japanese from scratch — so a refactor that "fixes" the data to match
// a bug cannot also silently rewrite the guard.
//
//   KEIGO REGISTER   a hand-checked sample of verb → register → plain-verb, so
//                    なさる can never drift to humble nor いたす to honorific.
//   TRANSITIVITY DIR the happens side is the one that HAPPENS (never JMdict vt)
//                    and the doIt side is the one someone DOES (never JMdict vi),
//                    plus a fully-spelled sample of directions.
//   LOOKALIKE REAL   every hand-authored and derived confusable char is a real
//                    kanji the app carries — the check confusable.ts's header
//                    claims exists but never had.
//   CROSS-SCRIPT     every cross-script pair is one taught kana + one real kanji,
//                    and the reverse index round-trips. Empty today; this guards
//                    anything added back.

import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { KEIGO_SETS, type Register } from "./keigo.ts";
import { VERB_PAIRS } from "./transitivity.ts";
import {
  LOOKALIKE_KANJI,
  DERIVED_CONFUSABLE,
} from "./confusable.ts";
import { CROSS_SCRIPT_LOOKALIKES, crossScriptLookalikes } from "./cross-script.ts";
import { kanjiRow } from "./kanji.ts";
import { vocabRow } from "./vocab.ts";
import { CHAR_INDEX } from "./characters.ts";

// ---------------------------------------------------------------------------
// KEIGO — register + plain-verb, restated by hand.
// ---------------------------------------------------------------------------

/**
 * A curated sample of the canonical keigo facts, each keyed by the keigo WORD to
 * its register and the plain verb it stands in for. Independently written from a
 * reference; the assertion below looks each word up in KEIGO_SETS and checks it
 * lands in the register named here and in a set whose plain verbs contain the
 * expected one.
 */
const KEIGO_REGISTER_SAMPLE: ReadonlyArray<{
  word: string;
  register: Register;
  plain: string;
}> = [
  { word: "召し上がる", register: "honorific", plain: "食べる" },
  { word: "いただく", register: "humble", plain: "食べる" }, // humble of eat/drink
  { word: "おっしゃる", register: "honorific", plain: "言う" },
  { word: "申す", register: "humble", plain: "言う" },
  { word: "申し上げる", register: "humble", plain: "言う" },
  { word: "なさる", register: "honorific", plain: "する" },
  { word: "いたす", register: "humble", plain: "する" },
  { word: "いらっしゃる", register: "honorific", plain: "行く" },
  { word: "参る", register: "humble", plain: "行く" },
  { word: "おる", register: "humble", plain: "いる" },
  { word: "ご覧になる", register: "honorific", plain: "見る" },
  { word: "拝見する", register: "humble", plain: "見る" },
  { word: "くださる", register: "honorific", plain: "くれる" },
  { word: "ご存知だ", register: "honorific", plain: "知る" },
  { word: "存じる", register: "humble", plain: "知る" },
  { word: "存じ上げる", register: "humble", plain: "知る" },
];

describe("keigo register sample is correct verb → register → plain verb", () => {
  for (const { word, register, plain } of KEIGO_REGISTER_SAMPLE) {
    test(`${word} is the ${register} form of ${plain}`, () => {
      const hits = KEIGO_SETS.flatMap((set) =>
        set.words
          .filter((w) => w.word === word)
          .map((w) => ({ set, register: w.register })),
      );
      assert.ok(hits.length > 0, `${word} is not in any keigo set`);
      // Every occurrence of this word must carry the register named. (いただく
      // appears in two sets — eat and receive — and is humble in both.)
      for (const hit of hits) {
        assert.equal(
          hit.register,
          register,
          `${word} in set ${hit.set.id} is ${hit.register}, want ${register}`,
        );
      }
      // At least one occurrence must stand in for the expected plain verb.
      const forPlain = hits.some((h) =>
        h.set.plain.some((p) => p.keb === plain),
      );
      assert.ok(
        forPlain,
        `${word} is not registered as replacing ${plain}`,
      );
    });
  }

  test("no keigo word is tagged both registers within its set", () => {
    for (const set of KEIGO_SETS) {
      const seen = new Map<string, Register>();
      for (const w of set.words) {
        const prior = seen.get(w.word);
        if (prior !== undefined) {
          assert.equal(prior, w.register, `${set.id}: ${w.word} split registers`);
        }
        seen.set(w.word, w.register);
      }
    }
  });
});

// ---------------------------------------------------------------------------
// TRANSITIVITY — direction, restated by hand.
// ---------------------------------------------------------------------------

describe("transitivity direction is consistent with the JMdict tags", () => {
  test("the happens side is never tagged vt, the doIt side never vi", () => {
    // The pairing is memorised, but the DIRECTION must agree with the checked
    // tags: the side that HAPPENS cannot be purely transitive, and the side
    // someone DOES cannot be purely intransitive. `split`/`ambi` are allowed on
    // either side (they carry both), but a bare vt on happens or vi on doIt is a
    // flipped pair.
    for (const p of VERB_PAIRS) {
      assert.notEqual(
        p.happens.jmdict,
        "vt",
        `${p.happens.word}/${p.doIt.word}: happens side tagged vt (flipped?)`,
      );
      assert.notEqual(
        p.doIt.jmdict,
        "vi",
        `${p.happens.word}/${p.doIt.word}: doIt side tagged vi (flipped?)`,
      );
    }
  });

  test("every pair member is spelled exactly as VOCAB teaches it, save one documented exception", () => {
    // Used to check the two members share a kanji stem instead (a heuristic:
    // most pairs are one stem with two tails). Retired because VOCAB itself
    // does not always carry a pair's kanji spelling as its own headword —
    // JMdict tags some verbs "usually written using kana alone" (つける, かかる,
    // かける are real VOCAB entries; 付ける/掛かる/掛ける are not), so a correctly-
    // spelled pair can legitimately share no kanji at all. Checking against
    // VOCAB directly is the stronger guard: it catches an actual mismatch
    // (blockedBy can never clear) rather than a proxy for one, and a genuinely
    // mispaired verb is still caught independently by transitivity-pattern.
    // test.ts's reading-based tail-shift classification, which does not care
    // about spelling either.
    //
    // The exceptions are the documented, permanently-unreachable content gaps
    // (a real, currently-unfixable content gap — see
    // interleaved-schedule.test.ts's reachability test, which is left failing
    // on purpose until these are actually fixed, not allowlisted quiet):
    // childbirth
    // — 産む ("bear a child") is deliberately NOT VOCAB's 生む ("produce/give
    // rise to"), different senses of one JMdict entry, pinned apart on purpose
    // by transitivity-facts.test.ts — and 濡れる/濡らす, which VOCAB carries
    // under no spelling at all (confirmed: zero hits for ぬれる/ぬらす/濡れる/
    // 濡らす in src/data/generated/vocab.json).
    const EXCEPTIONS = new Set(["産む", "濡れる", "濡らす"]);
    for (const p of VERB_PAIRS) {
      for (const m of [p.happens, p.doIt]) {
        if (EXCEPTIONS.has(m.word)) continue;
        const row = vocabRow(m.word);
        assert.ok(row, `${m.word}: not a VOCAB entry at all`);
        assert.equal(row!.reb, m.reading, `${m.word}: VOCAB reads it ${row!.reb}, not ${m.reading}`);
      }
    }
  });
});

/**
 * A fully-spelled sample of the direction: happens word/reading, doIt
 * word/reading. Restated from a reference; catches a swapped side or a corrupted
 * reading independently of the pair's position in the array.
 */
const TRANSITIVITY_SAMPLE: ReadonlyArray<{
  happens: [string, string];
  doIt: [string, string];
}> = [
  { happens: ["開く", "あく"], doIt: ["開ける", "あける"] },
  { happens: ["閉まる", "しまる"], doIt: ["閉める", "しめる"] },
  { happens: ["始まる", "はじまる"], doIt: ["始める", "はじめる"] },
  { happens: ["出る", "でる"], doIt: ["出す", "だす"] },
  { happens: ["入る", "はいる"], doIt: ["入れる", "いれる"] },
  { happens: ["止まる", "とまる"], doIt: ["止める", "とめる"] },
  { happens: ["集まる", "あつまる"], doIt: ["集める", "あつめる"] },
  // The reversed shape: here the intransitive is the -eru and the transitive is
  // the -ku, the opposite of 開く/開ける. A guard that assumed one alternation
  // direction would flip this.
  { happens: ["焼ける", "やける"], doIt: ["焼く", "やく"] },
  { happens: ["生まれる", "うまれる"], doIt: ["産む", "うむ"] },
];

describe("transitivity direction sample: happens is vi-side, doIt is vt-side", () => {
  for (const s of TRANSITIVITY_SAMPLE) {
    test(`${s.happens[0]} (it happens) / ${s.doIt[0]} (someone does it)`, () => {
      const p = VERB_PAIRS.find(
        (p) => p.happens.word === s.happens[0] && p.doIt.word === s.doIt[0],
      );
      assert.ok(
        p,
        `pair ${s.happens[0]}/${s.doIt[0]} is missing or has its sides swapped`,
      );
      assert.equal(p!.happens.reading, s.happens[1], `${s.happens[0]} reading drifted`);
      assert.equal(p!.doIt.reading, s.doIt[1], `${s.doIt[0]} reading drifted`);
    });
  }
});

// ---------------------------------------------------------------------------
// LOOK-ALIKES — every confusable char is a real kanji.
// ---------------------------------------------------------------------------

describe("every confusable character is a real kanji the app carries", () => {
  // confusable.ts's header says a test "fails the build when a typo puts a
  // non-jōyō character in it" — this is that test, which was missing.
  test("LOOKALIKE_KANJI: every hand-authored char resolves to a kanji row", () => {
    for (const group of LOOKALIKE_KANJI) {
      assert.ok(group.length >= 2, `group ${group.join("")} has fewer than 2 members`);
      for (const c of group) {
        assert.ok(kanjiRow(c), `LOOKALIKE_KANJI char "${c}" is not a real kanji`);
      }
    }
  });

  test("DERIVED_CONFUSABLE: every generated char resolves to a kanji row", () => {
    for (const group of DERIVED_CONFUSABLE) {
      assert.ok(group.length >= 2, `derived group ${group.join("")} has fewer than 2 members`);
      for (const c of group) {
        assert.ok(kanjiRow(c), `DERIVED_CONFUSABLE char "${c}" is not a real kanji`);
      }
    }
  });

  test("no group pairs a character with itself", () => {
    for (const group of [...LOOKALIKE_KANJI, ...DERIVED_CONFUSABLE]) {
      assert.equal(new Set(group).size, group.length, `duplicate in ${group.join("")}`);
    }
  });
});

// ---------------------------------------------------------------------------
// CROSS-SCRIPT — one taught kana + one real kanji per pair; index round-trips.
// ---------------------------------------------------------------------------

describe("cross-script lookalikes pair a taught kana with a real kanji", () => {
  // Empty today (Sam's call), so these are future-proofing guards: if a pair is
  // ever added back, it must be a real, teachable kana⇔kanji pair, not a typo.
  test("each pair is exactly one taught kana and one real kanji", () => {
    for (const [a, b] of CROSS_SCRIPT_LOOKALIKES) {
      const kana = [a, b].filter((g) => CHAR_INDEX[g]);
      const kanji = [a, b].filter((g) => kanjiRow(g));
      assert.equal(
        kana.length,
        1,
        `pair ${a}/${b}: expected exactly one taught kana, got ${kana.length}`,
      );
      assert.equal(
        kanji.length,
        1,
        `pair ${a}/${b}: expected exactly one real kanji, got ${kanji.length}`,
      );
    }
  });

  test("the reverse index round-trips every pair", () => {
    for (const [a, b] of CROSS_SCRIPT_LOOKALIKES) {
      assert.ok(
        crossScriptLookalikes(a).includes(b),
        `${a} does not list ${b} as a cross-script lookalike`,
      );
      assert.ok(
        crossScriptLookalikes(b).includes(a),
        `${b} does not list ${a} as a cross-script lookalike`,
      );
    }
  });
});
