// Run: node --import ../conjugate/test-hooks.mjs --test src/lib/engine/script-mismatch.test.ts
//
// SAK-122: a typed answer in the wrong script/format for what a card wants —
// English where Japanese is expected, Japanese where English is expected, or
// the kana glyph itself where the card wants ROMAJI (a kana card) — should
// warn and let the learner retype rather than being scored as a plain miss.
//
// `scriptMismatch` is a pre-check, not a second grader: the contract this
// suite exercises is "only ever consulted after the real grader (checkTyped)
// has already said `given` is wrong", so every case here pairs the two —
// proving checkTyped's own verdict first, then scriptMismatch's classification
// of that same input.

import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { kanaFact } from "../../data/characters.ts";
import { wordMeaningFactId, wordReadingFactId } from "../../data/vocab.ts";
import { meaningFactId, readingFactId } from "../../data/kanji.ts";
import { checkTyped, scriptMismatch } from "./index.ts";
import type { Direction, FactId } from "../../types/index.ts";

/**
 * The exact gate the drill screen applies (see submit() in drill-screen.tsx):
 * scriptMismatch is consulted ONLY when the real grader has already said
 * `given` is wrong. A correct answer short-circuits before scriptMismatch is
 * ever called — this is the contract `scriptMismatch`'s own docstring states,
 * and it is what actually protects a legitimately correct answer, romaji or
 * otherwise, from ever being intercepted as a "wrong script" false positive.
 */
function grade(
  fact: FactId,
  dir: Direction,
  given: string,
): { ok: boolean; mismatch: ReturnType<typeof scriptMismatch> } {
  const ok = checkTyped(fact, given, dir);
  return { ok, mismatch: ok ? null : scriptMismatch(fact, dir, given) };
}

describe("correct answers still pass unmolested", () => {
  test("a correct kana (romaji-typed) answer grades correct and is never checked for mismatch", () => {
    const sensei = wordReadingFactId("先生");
    const result = grade(sensei, "jp2en", "sensei");
    assert.equal(result.ok, true);
    assert.equal(result.mismatch, null);
  });

  test("a correct English meaning answer grades correct and is never checked for mismatch", () => {
    const teacher = wordMeaningFactId("先生");
    const result = grade(teacher, "jp2en", "teacher");
    assert.equal(result.ok, true);
    assert.equal(result.mismatch, null);
  });

  test("a correct raw-kana answer (IME) grades correct and is never checked for mismatch", () => {
    const sensei = wordReadingFactId("先生");
    const result = grade(sensei, "jp2en", "せんせい");
    assert.equal(result.ok, true);
    assert.equal(result.mismatch, null);
  });
});

describe("English typed where Japanese is expected is a mismatch, not a miss", () => {
  test("an en2jp kana-word card answered in English is caught", () => {
    // これ's meaning fact en2jp wants これ/kore. Typing the ENGLISH gloss
    // instead ("this") is wrong either way, but it should be named a script
    // mismatch, not folded into an ordinary miss.
    const kore = wordMeaningFactId("これ");
    assert.equal(checkTyped(kore, "this", "en2jp"), false);
    assert.equal(scriptMismatch(kore, "en2jp", "this"), "wantsJapanese");
  });

  test("a jp2en word-reading card answered with its English gloss is caught", () => {
    // Shown 先生 + its meaning, the card wants the reading せんせい/sensei — not
    // the meaning itself. Typing "teacher" here is the SAK-122 case: right
    // language for the OTHER half of this card, wrong for what was asked.
    const sensei = wordReadingFactId("先生");
    assert.equal(checkTyped(sensei, "teacher", "jp2en"), false);
    assert.equal(scriptMismatch(sensei, "jp2en", "teacher"), "wantsJapanese");
  });

  test("a botched romaji attempt is left as a plain miss, not claimed as English", () => {
    // The drill's live romaji→kana converter (toKana with live:true) resolves
    // whatever prefix of a typed syllable run it can match before giving up
    // on an unrecognized letter and leaving the rest verbatim — so a
    // misspelled romaji attempt typically reaches submission as a MIX of real
    // kana and a latin tail, not pure Latin. "せんsai" stands in for exactly
    // that shape: real kana up front (evidence the learner WAS attempting
    // Japanese), garbled tail after. That must not be swept into "wants
    // Japanese" (which would turn ordinary typos into free, unlimited
    // retries) — only a CLEAN, all-Latin answer is.
    const sensei = wordReadingFactId("先生");
    const garbled = "せんsai"; // a kana prefix plus an unresolved latin tail
    assert.equal(checkTyped(sensei, garbled, "jp2en"), false);
    assert.equal(scriptMismatch(sensei, "jp2en", garbled), null);
  });

  test("a kanji reading card cannot be talked into English forgiveness", () => {
    const sei = readingFactId("生", "先生");
    assert.equal(checkTyped(sei, "life", "jp2en"), false); // life is the MEANING, not せい
    assert.equal(scriptMismatch(sei, "jp2en", "life"), "wantsJapanese");
  });
});

describe("Japanese typed where English is expected is a mismatch, not a miss", () => {
  test("a jp2en meaning card answered in kana/kanji is caught", () => {
    const life = meaningFactId("生");
    assert.equal(checkTyped(life, "せい", "jp2en"), false);
    assert.equal(scriptMismatch(life, "jp2en", "せい"), "wantsEnglish");
    assert.equal(checkTyped(life, "生", "jp2en"), false);
    assert.equal(scriptMismatch(life, "jp2en", "生"), "wantsEnglish");
  });

  test("a word meaning card answered with the written word itself is caught", () => {
    const teacher = wordMeaningFactId("先生");
    assert.equal(checkTyped(teacher, "先生", "jp2en"), false);
    assert.equal(scriptMismatch(teacher, "jp2en", "先生"), "wantsEnglish");
  });
});

describe("kana typed where romaji is the expected FORMAT is a mismatch", () => {
  test("a kana character's jp2en card wants romaji; typing the glyph itself is caught", () => {
    // か's jp2en card shows か and wants "ka" — the sound written in English
    // letters, not the character pasted back. This is the "kana typed where
    // romaji was the expected answer format" case named in the ticket.
    const ka = kanaFact("か");
    assert.equal(checkTyped(ka, "か", "jp2en"), false);
    assert.equal(scriptMismatch(ka, "jp2en", "か"), "wantsRomaji");
    // The real answer still grades fine, and still no mismatch.
    assert.equal(checkTyped(ka, "ka", "jp2en"), true);
    assert.equal(scriptMismatch(ka, "jp2en", "ka"), null);
  });
});

describe("empty and mixed input never produce a false mismatch", () => {
  test("an empty answer is null, not a mismatch", () => {
    const teacher = wordMeaningFactId("先生");
    assert.equal(scriptMismatch(teacher, "jp2en", ""), null);
    assert.equal(scriptMismatch(teacher, "jp2en", "   "), null);
  });

  test("a mixed kana+latin wrong answer on an English card is left a plain miss", () => {
    // Contains a latin letter, so it does not read as clean Japanese either
    // — this is an ordinary garbled miss, not a script mismatch in either
    // direction.
    const teacher = wordMeaningFactId("先生");
    assert.equal(scriptMismatch(teacher, "jp2en", "ねこcat"), null);
  });
});
