// HOW THE SOUND IS SPELLED IN ENGLISH, kana by kana (SAK-435).
//
// The rule lives in characters.ts and derives these strings from the romaji, so
// a test that derives them the same way would only prove the code agrees with
// itself. This file types the approved list out instead, exactly as Sam
// approved it, and grades it through the drill's own front door: `checkTyped`,
// which is what a keystroke reaches, and `answerKeyFor`, which is what the
// browser compares against when the tables are not there. A spelling has to
// pass both to count as accepted.

import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { CHAR_INDEX, kanaFact, soundSpellingsFor } from "./characters.ts";
import { answerKeyFor, buildMcOptions, checkTyped } from "../lib/engine/index.ts";
import { matchesKey } from "../lib/answer-key.ts";
import { factInfo } from "../lib/facts.ts";
import { toKana } from "../lib/romaji.ts";

/** The approved spellings, by hiragana row. Katakana shares the row. */
const APPROVED: Record<string, string[]> = {
  あいうえお: ["ah", "ee", "oo", "eh", "oh"],
  かきくけこ: ["kah", "kee", "koo", "keh", "koh"],
  さしすせそ: ["sah", "shee", "soo", "seh", "soh"],
  たちつてと: ["tah", "chee", "tsoo", "teh", "toh"],
  なにぬねの: ["nah", "nee", "noo", "neh", "noh"],
  はひふへほ: ["hah", "hee", "foo", "heh", "hoh"],
  まみむめも: ["mah", "mee", "moo", "meh", "moh"],
  やゆよ: ["yah", "yoo", "yoh"],
  らりるれろ: ["rah", "ree", "roo", "reh", "roh"],
  がぎぐげご: ["gah", "gee", "goo", "geh", "goh"],
  ざじずぜぞ: ["zah", "jee", "zoo", "zeh", "zoh"],
  だぢづでど: ["dah", "jee", "zoo", "deh", "doh"],
  ばびぶべぼ: ["bah", "bee", "boo", "beh", "boh"],
  ぱぴぷぺぽ: ["pah", "pee", "poo", "peh", "poh"],
};

/** The ones with two spellings or none, named one at a time. */
const SPECIAL: Record<string, string[]> = {
  わ: ["wah"],
  を: ["woh", "oh"],
  ん: [],
  ぎ: ["gee", "ghee"],
};

/** The yōon, keyed by the little-kana trio they are written with. */
const YOON: Record<string, string[]> = {
  きゃきゅきょ: ["kyah", "kyoo", "kyoh"],
  しゃしゅしょ: ["shah", "shoo", "shoh"],
  ちゃちゅちょ: ["chah", "choo", "choh"],
  にゃにゅにょ: ["nyah", "nyoo", "nyoh"],
  ひゃひゅひょ: ["hyah", "hyoo", "hyoh"],
  みゃみゅみょ: ["myah", "myoo", "myoh"],
  りゃりゅりょ: ["ryah", "ryoo", "ryoh"],
  ぎゃぎゅぎょ: ["gyah", "gyoo", "gyoh"],
  じゃじゅじょ: ["jah", "joo", "joh"],
  ぢゃぢゅぢょ: ["jah", "joo", "joh"],
  びゃびゅびょ: ["byah", "byoo", "byoh"],
  ぴゃぴゅぴょ: ["pyah", "pyoo", "pyoh"],
};

/** glyph to its approved spellings, hiragana only, every row folded together. */
function approvedByGlyph(): Map<string, string[]> {
  const out = new Map<string, string[]>();
  for (const [row, sounds] of Object.entries(APPROVED)) {
    [...row].forEach((c, i) => out.set(c, [sounds[i]]));
  }
  for (const [trio, sounds] of Object.entries(YOON)) {
    // Each yōon is two code points, so the trio splits by pairs, not by char.
    const kana = trio.match(/../gu) ?? [];
    kana.forEach((c, i) => out.set(c, [sounds[i]]));
  }
  for (const [c, sounds] of Object.entries(SPECIAL)) out.set(c, sounds);
  return out;
}

/** The katakana twin of a hiragana glyph, by the Unicode offset the two
 * blocks are laid out on. Both scripts say the same thing, so both accept the
 * same spellings, and this test should not have to say so twice. */
function katakanaOf(hira: string): string {
  return [...hira].map((c) => String.fromCodePoint(c.codePointAt(0)! + 0x60)).join("");
}

const APPROVED_BY_GLYPH = approvedByGlyph();

/** Whether a kana card grades `given` right, through both grading paths. */
function accepted(c: string, given: string): boolean {
  const fact = kanaFact(c);
  const live = checkTyped(fact, given);
  const byKey = matchesKey(answerKeyFor(fact), given);
  assert.equal(live, byKey, `the two grading paths disagree on "${given}" for ${c}`);
  return live;
}

describe("a kana accepts how its sound is spelled in English (SAK-435)", () => {
  test("the approved list covers every kana in the table, both scripts", () => {
    const missing: string[] = [];
    for (const c of Object.keys(CHAR_INDEX)) {
      const hira = /[ァ-ヶ]/.test(c[0])
        ? [...c].map((x) => String.fromCodePoint(x.codePointAt(0)! - 0x60)).join("")
        : c;
      if (!APPROVED_BY_GLYPH.has(hira)) missing.push(c);
    }
    assert.deepEqual(missing, [], "every kana should be named in the approved list");
  });

  test("every kana accepts its spelling, and katakana accepts the same one", () => {
    for (const [hira, sounds] of APPROVED_BY_GLYPH) {
      for (const sound of sounds) {
        assert.ok(accepted(hira, sound), `${hira} should accept "${sound}"`);
        const kata = katakanaOf(hira);
        assert.ok(accepted(kata, sound), `${kata} should accept "${sound}"`);
      }
      assert.deepEqual(
        [...soundSpellingsFor(hira)].sort(),
        [...sounds].sort(),
        `${hira} should publish exactly its approved spellings`,
      );
    }
  });

  test("the romaji still answers every card, and is still what the card reveals", () => {
    for (const [c, info] of Object.entries(CHAR_INDEX)) {
      for (const r of info.r) assert.ok(accepted(c, r), `${c} should still accept "${r}"`);
      assert.equal(factInfo(kanaFact(c))?.answers[0], info.r[0], `${c} should reveal its romaji`);
    }
  });

  test("ぎ takes gee and ghee, since English spells the hard g both ways", () => {
    for (const c of ["ぎ", "ギ"]) {
      assert.ok(accepted(c, "gee"), `${c} should accept "gee"`);
      assert.ok(accepted(c, "ghee"), `${c} should accept "ghee"`);
    }
  });

  test("を takes oh and woh, since it is written wo and said o", () => {
    for (const c of ["を", "ヲ"]) {
      assert.ok(accepted(c, "oh"), `${c} should accept "oh"`);
      assert.ok(accepted(c, "woh"), `${c} should accept "woh"`);
    }
  });

  test("ん gains nothing: it has no vowel for the rule to convert", () => {
    for (const c of ["ん", "ン"]) {
      assert.deepEqual(soundSpellingsFor(c), []);
      assert.ok(accepted(c, "n"));
      assert.ok(accepted(c, "nn"));
    }
  });

  test("no ay for an e-row kana, however English it looks", () => {
    const eRow = [...APPROVED_BY_GLYPH].filter(([, sounds]) => sounds.some((s) => s.endsWith("eh")));
    assert.equal(eRow.length, 13, "the e row is the five vowels' e plus one per consonant row");
    for (const [c, sounds] of eRow) {
      const ay = `${sounds[0].slice(0, -2)}ay`;
      assert.ok(!accepted(c, ay), `${c} should not accept "${ay}"`);
      assert.ok(!accepted(katakanaOf(c), ay), `${katakanaOf(c)} should not accept "${ay}"`);
    }
    assert.ok(!accepted("え", "ay"), "え should not accept the glide it does not have");
  });

  test("a neighbor's sound is still wrong, so the fuzzy layer never reaches these", () => {
    // The four the English typo pool would have forgiven if these strings had
    // been filed as answers: one edit apart, and different kana.
    assert.ok(!accepted("し", "chee"), "し should not accept ち's sound");
    assert.ok(!accepted("つ", "soo"), "つ should not accept す's sound");
    assert.ok(!accepted("きゃ", "kyoh"), "きゃ should not accept きょ's sound");
    assert.ok(!accepted("ぎ", "shee"), "ぎ should not accept し's sound");
  });
});

describe("the sound spellings share what the romaji already shares (SAK-435)", () => {
  test("two kana share a spelling only where they already share an answer", () => {
    const bySound = new Map<string, string[]>();
    for (const c of Object.keys(CHAR_INDEX)) {
      for (const s of soundSpellingsFor(c)) {
        const seen = bySound.get(s) ?? [];
        seen.push(c);
        bySound.set(s, seen);
      }
    }
    for (const [sound, chars] of bySound) {
      for (const a of chars) {
        for (const b of chars) {
          if (a === b) continue;
          const shared = CHAR_INDEX[a].r.filter((r) => CHAR_INDEX[b].r.includes(r));
          assert.ok(
            shared.length > 0,
            `"${sound}" reaches ${a} and ${b}, which share no romaji`,
          );
        }
      }
    }
  });

  test("jee is じ and ぢ, zoo is ず and づ, the way ji and zu already are", () => {
    for (const [sound, pair] of [["jee", ["じ", "ぢ"]], ["zoo", ["ず", "づ"]]] as const) {
      for (const c of pair) {
        assert.ok(soundSpellingsFor(c).includes(sound), `${c} should take "${sound}"`);
        assert.ok(accepted(c, sound), `${c} should accept "${sound}"`);
      }
    }
  });

  test("no kana accepts another kana's answer unless the two really are one sound", () => {
    const kana = Object.keys(CHAR_INDEX);
    const soundsOf = (c: string) => [...CHAR_INDEX[c].r, ...soundSpellingsFor(c)];
    const wrong: string[] = [];
    for (const c of kana) {
      const mine = new Set(soundsOf(c));
      for (const other of kana) {
        if (other === c) continue;
        for (const s of soundsOf(other)) {
          if (mine.has(s)) continue; // じ and ぢ are one sound, and always were
          if (checkTyped(kanaFact(c), s)) wrong.push(`${c} accepts ${other}'s "${s}"`);
        }
      }
    }
    assert.deepEqual(wrong, []);
  });

  test("the English synonym pool does not reach a kana", () => {
    // WordNet reads "sa", "ka" and "re" as English words and has opinions
    // about all three. A kana is a sound, so it grades on sounds only.
    assert.ok(!checkTyped(kanaFact("さ"), "cpp"), "さ is not C++");
    assert.ok(!checkTyped(kanaFact("ど"), "karate"), "ど is not karate");
    assert.ok(!checkTyped(kanaFact("か"), "oo"), "か should not take う's sound");
    assert.ok(!checkTyped(kanaFact("ら"), "re"), "ら should not take れ's romaji");
    assert.ok(!checkTyped(kanaFact("れ"), "ra"), "れ should not take ら's romaji");
    assert.ok(!checkTyped(kanaFact("し"), "te"), "し should not take て's romaji");
  });

  test("no board offers the same sound twice", () => {
    for (const c of Object.keys(CHAR_INDEX)) {
      const options = buildMcOptions(kanaFact(c));
      const sounds = options.flatMap((f) => {
        const glyph = factInfo(f)?.glyph ?? "";
        return [...(factInfo(f)?.answers ?? []), ...soundSpellingsFor(glyph)];
      });
      assert.equal(
        new Set(sounds).size,
        sounds.length,
        `${c}'s board offers one sound under two options`,
      );
    }
  });
});

describe("the sound spellings stay out of the places that are not grading", () => {
  test("the typing box does not turn a sound spelling into kana", () => {
    // "ah" inside the romaji table would type あ, and "koh" would eat the ko
    // of こひ. The box is built from the romaji rows, which these never join.
    assert.equal(toKana("ah"), "あh");
    assert.equal(toKana("kohi"), "こひ");
  });

  test("the Library still prints the romaji as the reading, and only that", () => {
    assert.deepEqual(CHAR_INDEX["あ"].r, ["a"]);
    assert.deepEqual(CHAR_INDEX["し"].r, ["shi", "si"]);
    assert.deepEqual(CHAR_INDEX["を"].r, ["wo", "o"]);
  });
});
