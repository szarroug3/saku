// Run:
//   node --import ./src/lib/conjugate/test-hooks.mjs --test src/lib/conjugate/conjugate.test.ts
//
// Uses node:test + Node 24's native TypeScript stripping. No test framework,
// no new dependencies, no build step. See test-hooks.mjs for why the --import
// is needed (it bridges Node's ESM resolver and the repo's tsconfig).
//
// Every exception in this library is tested BY NAME. The point of the engine
// is that it beats a flashcard deck — a deck can only hold 待つ->待って as a
// card, so you learn the card. If the generator is wrong, the drill teaches
// wrong Japanese, and the worst outputs are the ones that look fine.

import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { classFromTags, conjugate, conjugateAll, conjugateSuruNoun } from "./index";
import { DEFECTIVE_WORDS } from "./policy";
import type { Form } from "./types";

/** Assert a form generates exactly this string. */
function eq(word: string, cls: string, form: Form, want: string) {
  const got = conjugate(word, cls, form);
  assert.ok(got.ok, `${word} [${cls}] ${form} was refused: ${got.ok ? "" : got.detail}`);
  assert.equal(got.value, want, `${word} [${cls}] ${form}`);
}

/** Assert a form is refused, for the stated reason. */
function refused(word: string, cls: string, form: Form, reason: string) {
  const got = conjugate(word, cls, form);
  assert.ok(!got.ok, `${word} [${cls}] ${form} should have been refused, got "${got.ok ? got.value : ""}"`);
  assert.equal(got.reason, reason, `${word} [${cls}] ${form} refusal reason`);
}

// ===========================================================================
// The two mechanisms
// ===========================================================================

describe("the vowel-row shift (one table, nine forms)", () => {
  test("godan across all nine rows", () => {
    eq("買う", "v5u", "nai", "買わない"); // う -> わ, not あ
    eq("書く", "v5k", "nai", "書かない");
    eq("泳ぐ", "v5g", "nai", "泳がない");
    eq("話す", "v5s", "nai", "話さない");
    eq("待つ", "v5t", "nai", "待たない");
    eq("死ぬ", "v5n", "nai", "死なない");
    eq("遊ぶ", "v5b", "nai", "遊ばない");
    eq("読む", "v5m", "nai", "読まない");
    eq("帰る", "v5r", "nai", "帰らない");
  });

  test("the same table serves masu / potential / volitional / ba / tai", () => {
    eq("読む", "v5m", "masu", "読みます");
    eq("読む", "v5m", "potential", "読める");
    eq("読む", "v5m", "volitional", "読もう");
    eq("読む", "v5m", "ba", "読めば");
    eq("読む", "v5m", "tai", "読みたい");
    eq("読む", "v5m", "imperative", "読め");
    eq("読む", "v5m", "passive", "読まれる");
    eq("読む", "v5m", "causative", "読ませる");
  });

  test("帰る and 要る are godan despite -iru/-eru — the tag resolves them", () => {
    // The classic learner trap, and a non-problem here: JMdict tags them v5r,
    // so they never reach the ichidan path. This is the tag earning its keep.
    eq("帰る", "v5r", "te", "帰って"); // not 帰りて
    eq("走る", "v5r", "te", "走って");
    eq("要る", "v5r", "masu", "要ります"); // not 要ます
  });
});

describe("the 音便 branch (five outcomes)", () => {
  test("promoting/nasal/i-onbin and the す non-reduction", () => {
    eq("買う", "v5u", "te", "買って");
    eq("待つ", "v5t", "te", "待って");
    eq("帰る", "v5r", "te", "帰って");
    eq("読む", "v5m", "te", "読んで");
    eq("遊ぶ", "v5b", "te", "遊んで");
    eq("死ぬ", "v5n", "te", "死んで");
    eq("書く", "v5k", "te", "書いて");
    eq("泳ぐ", "v5g", "te", "泳いで");
    eq("話す", "v5s", "te", "話して"); // す alone doesn't reduce
  });

  test("た mirrors て", () => {
    eq("読む", "v5m", "ta", "読んだ");
    eq("書く", "v5k", "ta", "書いた");
    eq("泳ぐ", "v5g", "ta", "泳いだ");
  });
});

// ===========================================================================
// Every confirmed exception, by name
// ===========================================================================

describe("exception: 行く -> 行って (v5k-s)", () => {
  test("irregular 音便 only; everything else stays regular", () => {
    eq("行く", "v5k-s", "te", "行って"); // not 行いて
    eq("行く", "v5k-s", "ta", "行った");
    eq("行く", "v5k-s", "nai", "行かない"); // regular
    eq("行く", "v5k-s", "masu", "行きます"); // regular
    eq("行く", "v5k-s", "ba", "行けば"); // regular
  });

  test("compounds keep their prefix (56 entries incl. 持って行く)", () => {
    eq("持って行く", "v5k-s", "te", "持って行って");
  });

  test("plain 書く (v5k) is unaffected — the exception is class-scoped", () => {
    eq("書く", "v5k", "te", "書いて");
  });
});

describe("exception: 問う -> 問うて (v5u-s)", () => {
  test("問う / 乞う / 給う", () => {
    eq("問う", "v5u-s", "te", "問うて"); // not 問って
    eq("問う", "v5u-s", "ta", "問うた");
    eq("乞う", "v5u-s", "te", "乞うて");
    eq("問う", "v5u-s", "nai", "問わない"); // regular う -> わ
    eq("問う", "v5u-s", "masu", "問います"); // regular
  });

  test("plain 買う (v5u) is unaffected", () => {
    eq("買う", "v5u", "te", "買って");
  });
});

describe("exception: ある -> ない (v5r-i)", () => {
  test("the negative is suppletive, from a different root entirely", () => {
    eq("ある", "v5r-i", "nai", "ない"); // NOT あらない
    eq("有る", "v5r-i", "nai", "ない"); // 有ない is not a word in any script
    eq("在る", "v5r-i", "nai", "ない");
    eq("ある", "v5r-i", "naiPast", "なかった"); // composes off the suppletive form
  });

  test("the 〜がある compounds fall out of the same rule (all 75 entries)", () => {
    eq("事がある", "v5r-i", "nai", "事がない");
    eq("気がある", "v5r-i", "nai", "気がない");
    eq("である", "v5r-i", "nai", "でない");
    eq("花も実も有る", "v5r-i", "nai", "花も実もない"); // kanji compound
  });

  test("the rest of ある is regular", () => {
    eq("ある", "v5r-i", "masu", "あります");
    eq("ある", "v5r-i", "te", "あって");
    eq("ある", "v5r-i", "ta", "あった");
    eq("ある", "v5r-i", "ba", "あれば");
  });
});

describe("exception: v5aru imperative -> ください / なさい / おっしゃい", () => {
  // JMdict documents v5aru as a *masu* irregularity. It is really an い-STEM
  // irregularity, and once you say that, the imperative comes free — because
  // the v5aru imperative IS the い-stem. One table cell, all 7 entries.
  test("the imperative is NOT 下され / 為され / 仰れ", () => {
    // Read from the kana spellings, these are the textbook forms.
    eq("くださる", "v5aru", "imperative", "ください");
    eq("なさる", "v5aru", "imperative", "なさい");
    eq("おっしゃる", "v5aru", "imperative", "おっしゃい");
    eq("いらっしゃる", "v5aru", "imperative", "いらっしゃい");
  });

  test("the kanji spellings keep their kanji", () => {
    // The rule is spelling-preserving: it shifts the okurigana, it doesn't
    // transliterate. 下さる -> 下さい, which is how it's actually written.
    eq("下さる", "v5aru", "imperative", "下さい");
    eq("為さる", "v5aru", "imperative", "為さい");
    eq("仰る", "v5aru", "imperative", "仰い");
    eq("ご覧なさる", "v5aru", "imperative", "ご覧なさい");
  });

  test("the masu form uses the same い-stem", () => {
    eq("くださる", "v5aru", "masu", "くださいます");
    eq("おっしゃる", "v5aru", "masu", "おっしゃいます");
    eq("なさる", "v5aru", "masu", "なさいます");
    eq("下さる", "v5aru", "masu", "下さいます");
  });

  test("everything else is regular godan る", () => {
    eq("下さる", "v5aru", "te", "下さって");
    eq("下さる", "v5aru", "nai", "下さらない");
  });

  test("a plain v5r verb still gets the り stem — the override is class-scoped", () => {
    eq("帰る", "v5r", "masu", "帰ります");
    eq("帰る", "v5r", "imperative", "帰れ");
  });
});

describe("exception: ござる is mis-tagged v5r in JMdict (upstream bug)", () => {
  test("patched to v5aru — ございます, not ござります", () => {
    // Generate from the tag JMdict actually gives and you emit ござります.
    eq("ござる", "v5r", "masu", "ございます");
    eq("御座る", "v5r", "masu", "御座います");
  });

  test("the patch is scoped to the exact word+tag pair", () => {
    // Any other v5r verb is untouched.
    eq("帰る", "v5r", "masu", "帰ります");
  });
});

describe("exception: くれる -> くれ (v1-s)", () => {
  test("the imperative is くれ, not くれろ — this class exists for this fact", () => {
    eq("呉れる", "v1-s", "imperative", "呉れ");
    eq("くれる", "v1-s", "imperative", "くれ");
  });

  test("plain ichidan still gets ろ", () => {
    eq("食べる", "v1", "imperative", "食べろ");
  });
});

describe("exception: いい / よい (adj-ix)", () => {
  // Not a JMdict bug — correct design. よい conjugates regularly; it's いい
  // that can't (*いくない). So everything is built off a よ stem.
  test("いい conjugates through よ", () => {
    eq("いい", "adj-ix", "nai", "よくない"); // NOT いくない
    eq("いい", "adj-ix", "ta", "よかった"); // NOT いかった
    eq("いい", "adj-ix", "te", "よくて");
    eq("いい", "adj-ix", "adverb", "よく");
    eq("いい", "adj-ix", "ba", "よければ");
    eq("いい", "adj-ix", "naiPast", "よくなかった");
  });

  test("the dictionary and polite forms keep いい intact", () => {
    eq("いい", "adj-ix", "dictionary", "いい"); // not よい
    eq("いい", "adj-ix", "polite", "いいです"); // not よいです
  });

  test("よい spelled out uses the same rule", () => {
    eq("よい", "adj-ix", "nai", "よくない");
    eq("よい", "adj-ix", "dictionary", "よい");
  });

  test("compounds, kana and kanji (133 entries incl. 格好いい)", () => {
    eq("格好いい", "adj-ix", "nai", "格好よくない");
    eq("気持ちいい", "adj-ix", "ta", "気持ちよかった");
    eq("運がいい", "adj-ix", "nai", "運がよくない");
    // Kanji spellings keep their kanji: 格好の良くない, not 格好のよくない.
    eq("格好の良い", "adj-ix", "nai", "格好の良くない");
    eq("歯切れの良い", "adj-ix", "ta", "歯切れの良かった");
  });

  test("よい is adj-i in JMdict and conjugates regularly there too", () => {
    eq("良い", "adj-i", "nai", "良くない");
  });
});

describe("exception: 死ぬ is not the only v5n", () => {
  test("往ぬ conjugates off the same row (12 entries)", () => {
    eq("死ぬ", "v5n", "te", "死んで");
    eq("往ぬ", "v5n", "te", "往んで");
    eq("往ぬ", "v5n", "nai", "往なない");
    eq("焼け死ぬ", "v5n", "ta", "焼け死んだ");
  });
});

// ===========================================================================
// The two prototype bugs
// ===========================================================================

describe("prototype bug 1: causative-passive collapsed on ichidan", () => {
  // The prototype had identical ternary branches, emitting せられる for both
  // groups. For 食べる that's obvious garbage. For 見る it produces 見せられる —
  // a REAL word (the potential of 見せる, "to show"), and the wrong one. The
  // app would have shown a valid word as the answer and marked the truth wrong.
  // That's the worst failure this project has: plausible, well-formed, false.
  test("ichidan takes させられる, not せられる", () => {
    eq("食べる", "v1", "causativePassive", "食べさせられる"); // not 食べせられる
    eq("見る", "v1", "causativePassive", "見させられる"); // NOT 見せられる
  });

  test("見せられる is not reachable as any form of 見る", () => {
    const all = conjugateAll("見る", "v1");
    const hit = Object.entries(all.forms).find(([, v]) => v === "見せられる");
    assert.equal(hit, undefined, `見る generated 見せられる as ${hit?.[0]}`);
  });

  test("godan takes せられる", () => {
    eq("読む", "v5m", "causativePassive", "読ませられる");
    eq("書く", "v5k", "causativePassive", "書かせられる");
  });
});

describe("prototype bug 2: vk dropped the stem", () => {
  test("くる compounds keep their prefix (all 38 entries)", () => {
    eq("持ってくる", "vk", "te", "持ってきて"); // not bare きて
    eq("持って来る", "vk", "te", "持って来て");
    eq("やって来る", "vk", "ta", "やって来た");
    eq("連れてくる", "vk", "nai", "連れてこない");
    eq("頭にくる", "vk", "ta", "頭にきた");
  });

  test("bare くる / 来る still work", () => {
    eq("くる", "vk", "te", "きて");
    eq("くる", "vk", "nai", "こない");
    eq("くる", "vk", "ba", "くれば");
    eq("くる", "vk", "imperative", "こい");
    eq("来る", "vk", "te", "来て");
    eq("来る", "vk", "nai", "来ない");
    eq("来る", "vk", "imperative", "来い");
  });

  test("the kanji spelling is invariant while the reading shifts き/こ/く", () => {
    // 来ます / 来ない / 来れば all keep 来 — the paradigm is per-script.
    eq("来る", "vk", "masu", "来ます");
    eq("来る", "vk", "volitional", "来よう");
    eq("来る", "vk", "ba", "来れば");
  });
});

// ===========================================================================
// The defectiveness guard — the thing no data source gives us
// ===========================================================================

describe("defectiveness: ある has no potential", () => {
  // JMdict has no defectiveness field. It will happily let you generate 有れる
  // and 有られる. Both are nonexistent. This blocklist is the only thing
  // stopping the drill from asking "what's the potential of ある?".
  test("ある potential is REFUSED, not generated", () => {
    refused("ある", "v5r-i", "potential", "defective");
    refused("有る", "v5r-i", "potential", "defective");
  });

  test("ある passive is refused", () => {
    refused("ある", "v5r-i", "passive", "defective");
  });

  test("有れる and 有られる are unreachable by any form of ある", () => {
    for (const word of ["ある", "有る"]) {
      const all = conjugateAll(word, "v5r-i");
      for (const bad of ["あれる", "有れる", "あられる", "有られる"]) {
        const hit = Object.entries(all.forms).find(([, v]) => v === bad);
        assert.equal(hit, undefined, `${word} generated ${bad} as ${hit?.[0]}`);
      }
    }
  });

  test("defectiveness propagates to composed forms without being restated", () => {
    // ある has no causative, therefore no causative-passive. Stated once.
    refused("ある", "v5r-i", "causative", "defective");
    refused("ある", "v5r-i", "causativePassive", "defective");
  });

  test("other defectives", () => {
    refused("できる", "v1", "potential", "defective"); // already a potential
    refused("見える", "v1", "potential", "defective");
    refused("要る", "v5r", "potential", "defective"); // 要れる is not a word
    // 分かれる is a real word — but it's 別れる. Exactly the plausible-and-false
    // output the list exists to stop.
    refused("分かる", "v5r", "potential", "defective");
  });

  test("v5aru honorifics have no potential (class-level rule)", () => {
    refused("仰る", "v5aru", "potential", "defective");
    refused("下さる", "v5aru", "passive", "defective");
  });

  test("the blocklist is small and every entry carries a reason", () => {
    for (const rule of DEFECTIVE_WORDS) {
      assert.ok(rule.reason.length > 20, `${rule.words[0]} needs a real reason`);
      assert.ok(rule.words.length > 0);
      assert.ok(rule.forms.length > 0);
    }
  });

  test("the guard is narrow — normal potentials still generate", () => {
    eq("読む", "v5m", "potential", "読める");
    eq("食べる", "v1", "potential", "食べられる");
    eq("死ぬ", "v5n", "potential", "死ねる"); // 死ぬ is fine
  });
});

// ===========================================================================
// The vs filter — refuse the tag, keep the word
// ===========================================================================

describe("vs nouns are refused", () => {
  // `vs` is the most common "verb" tag in JMdict (~16,900 uses / 14,354
  // entries) and it is a NOUN marker. Verified: ZERO vs entries carry a
  // conjugation class. Conjugating them emits ~14k garbage forms.
  test("conjugate() refuses a vs noun outright", () => {
    refused("勉強", "vs", "te", "not-a-conjugation-class");
    refused("勉強", "vs", "masu", "not-a-conjugation-class");
    refused("電話", "vs", "ta", "not-a-conjugation-class");
  });

  test("勉強せられる and friends are never emitted", () => {
    const all = conjugateAll("勉強", "vs");
    assert.deepEqual(all.forms, {}, "a vs noun must generate nothing at all");
    assert.ok(all.refused.length > 0);
  });

  test("classFromTags returns null for a real vs entry", () => {
    // 勉強 is n + vs + vi/vt, with no conjugation class. Null is correct.
    assert.equal(classFromTags(["n", "vs", "vt", "vi"]), null);
  });

  test("but the word is not invisible: する composes onto it", () => {
    // Refusing the tag must not make 勉強して unresolvable — it's one of the
    // first words a beginner meets.
    const got = conjugateSuruNoun("勉強", "te");
    assert.ok(got.ok);
    assert.equal(got.value, "勉強して");
  });

  test("the whole する paradigm is reachable by composition", () => {
    const suru = (noun: string, form: Form) => {
      const got = conjugateSuruNoun(noun, form);
      assert.ok(got.ok, `${noun} ${form} refused`);
      return got.value;
    };
    assert.equal(suru("電話", "ta"), "電話した");
    assert.equal(suru("結婚", "volitional"), "結婚しよう");
    assert.equal(suru("旅行", "tai"), "旅行したい");
    assert.equal(suru("運動", "causativePassive"), "運動させられる");
  });
});

describe("archaic classes are refused", () => {
  test("v2 / v4 / vr / vn / dead tags", () => {
    refused("蹴る", "v4r", "te", "archaic-class");
    refused("得", "v2a-s", "te", "archaic-class");
    refused("侍り", "vr", "te", "archaic-class");
    refused("熟す", "vs-c", "te", "not-a-conjugation-class");
  });

  test("v5uru is defined in the JMdict DTD but has zero uses", () => {
    refused("得る", "v5uru", "te", "archaic-class");
  });

  test("往ぬ is tagged both vn (archaic) and v5n — the v5n path works", () => {
    assert.equal(classFromTags(["v5n", "vi", "vn"]), "v5n");
  });
});

// ===========================================================================
// する / くる / vs-s / vz
// ===========================================================================

describe("する (vs-i)", () => {
  test("the suppletive paradigm", () => {
    eq("する", "vs-i", "te", "して");
    eq("する", "vs-i", "nai", "しない");
    eq("する", "vs-i", "masu", "します");
    eq("する", "vs-i", "imperative", "しろ");
    eq("する", "vs-i", "volitional", "しよう");
    eq("する", "vs-i", "ba", "すれば");
    eq("する", "vs-i", "potential", "できる"); // suppletive, not しれる
    eq("する", "vs-i", "passive", "される");
    eq("する", "vs-i", "causative", "させる");
  });

  test("compounds keep their prefix", () => {
    eq("勉強する", "vs-i", "te", "勉強して");
    eq("気にする", "vs-i", "ta", "気にした");
    eq("一緒にする", "vs-i", "nai", "一緒にしない");
  });

  test("為る is an archaic spelling — emit the kana paradigm, not 為ます", () => {
    eq("為る", "vs-i", "masu", "します");
  });
});

describe("愛する (vs-s) conjugates on a さ/せ stem, not a し one", () => {
  test("愛さない, not 愛しない", () => {
    eq("愛する", "vs-s", "nai", "愛さない");
    eq("愛する", "vs-s", "potential", "愛せる"); // not 愛できる
    eq("愛する", "vs-s", "imperative", "愛せ"); // not 愛しろ
    eq("愛する", "vs-s", "volitional", "愛そう");
    eq("愛する", "vs-s", "te", "愛して"); // same as vs-i here
    eq("愛する", "vs-s", "ba", "愛すれば");
  });

  test("vs-s and vs-i genuinely differ — the class tag is load-bearing", () => {
    eq("愛する", "vs-s", "nai", "愛さない");
    eq("愛する", "vs-i", "nai", "愛しない"); // what vs-i would give — and it's wrong for 愛する
  });
});

describe("演ずる (vz)", () => {
  test("the じ stem, with ば and the literary passive on ず/ぜ", () => {
    eq("演ずる", "vz", "masu", "演じます");
    eq("演ずる", "vz", "te", "演じて");
    eq("演ずる", "vz", "nai", "演じない");
    eq("演ずる", "vz", "ba", "演ずれば"); // ず, not じ
    eq("演ずる", "vz", "passive", "演ぜられる"); // ぜ
    eq("重んずる", "vz", "te", "重んじて");
  });

  test("禁ず — the bare ず citation form", () => {
    eq("禁ず", "vz", "masu", "禁じます");
    eq("禁ず", "vz", "te", "禁じて");
    eq("禁ず", "vz", "dictionary", "禁ず");
  });
});

describe("JMdict bug: 画餅に帰する is tagged v5s but ends in する", () => {
  test("patched to vs-s — JMdict's own 烏有に帰する is tagged vs-s", () => {
    // Found by running this engine over the whole dictionary. Unpatched, the
    // v5s ending guard refuses all 17 forms.
    eq("画餅に帰する", "v5s", "nai", "画餅に帰さない");
    eq("画餅に帰する", "v5s", "te", "画餅に帰して");
    eq("烏有に帰する", "vs-s", "nai", "烏有に帰さない"); // correctly tagged upstream
  });
});

describe("slang adjective spellings (adj-i)", () => {
  test("katakana and small-kana endings — the last 4 adj-i entries", () => {
    eq("ウザイ", "adj-i", "nai", "ウザくない");
    eq("キモイ", "adj-i", "ta", "キモかった");
    eq("イクナイ", "adj-i", "te", "イクナくて");
    eq("熱っちぃ", "adj-i", "nai", "熱っちくない");
  });
});

// ===========================================================================
// Adjectives
// ===========================================================================

describe("adjectives conjugate too", () => {
  test("adj-i (2,798 entries)", () => {
    eq("高い", "adj-i", "nai", "高くない");
    eq("高い", "adj-i", "ta", "高かった");
    eq("高い", "adj-i", "naiPast", "高くなかった");
    eq("高い", "adj-i", "te", "高くて");
    eq("高い", "adj-i", "adverb", "高く");
    eq("高い", "adj-i", "ba", "高ければ");
    eq("高い", "adj-i", "tara", "高かったら");
    eq("高い", "adj-i", "polite", "高いです");
    eq("面白い", "adj-i", "nai", "面白くない");
  });

  test("adj-na (6,253 entries) — what conjugates is the copula", () => {
    eq("静か", "adj-na", "dictionary", "静かだ");
    eq("静か", "adj-na", "prenominal", "静かな");
    eq("静か", "adj-na", "adverb", "静かに");
    eq("静か", "adj-na", "te", "静かで");
    eq("静か", "adj-na", "ta", "静かだった");
    eq("静か", "adj-na", "nai", "静かではない");
    eq("静か", "adj-na", "naiPast", "静かではなかった");
    eq("静か", "adj-na", "tara", "静かだったら");
    eq("静か", "adj-na", "polite", "静かです");
  });

  test("adjectives have no imperative or causative", () => {
    refused("高い", "adj-i", "imperative", "form-not-in-class");
    refused("高い", "adj-i", "causative", "form-not-in-class");
    refused("静か", "adj-na", "volitional", "form-not-in-class");
  });

  test("verbs have no prenominal or adverb", () => {
    refused("読む", "v5m", "prenominal", "form-not-in-class");
    refused("読む", "v5m", "adverb", "form-not-in-class");
  });
});

// ===========================================================================
// Composition — five forms for free
// ===========================================================================

describe("derived forms are pure composition", () => {
  test("they work identically across every class without being restated", () => {
    eq("読む", "v5m", "masuPast", "読みました");
    eq("読む", "v5m", "masuNegative", "読みません");
    eq("読む", "v5m", "naiPast", "読まなかった");
    eq("読む", "v5m", "tara", "読んだら");
    eq("読む", "v5m", "teiru", "読んでいる");

    eq("食べる", "v1", "masuPast", "食べました");
    eq("食べる", "v1", "teiru", "食べている");
    eq("食べる", "v1", "naiPast", "食べなかった");

    eq("する", "vs-i", "teiru", "している");
    eq("する", "vs-i", "masuPast", "しました");
    eq("する", "vs-i", "naiPast", "しなかった");
    eq("する", "vs-i", "causativePassive", "させられる");

    eq("くる", "vk", "teiru", "きている");
    eq("くる", "vk", "tara", "きたら");

    eq("行く", "v5k-s", "tara", "行ったら"); // rides the 音便 exception
    eq("行く", "v5k-s", "teiru", "行っている");
  });
});

// ===========================================================================
// Enumeration — the search index is a loop over this
// ===========================================================================

describe("conjugateAll enumerates every form", () => {
  test("a regular verb yields all 18 forms", () => {
    const all = conjugateAll("読む", "v5m");
    assert.equal(all.refused.length, 0);
    assert.equal(Object.keys(all.forms).length, 18);
    assert.equal(all.forms.te, "読んで");
    assert.equal(all.forms.dictionary, "読む");
  });

  test("a defective verb yields forms AND refusals, not an exception", () => {
    const all = conjugateAll("ある", "v5r-i");
    assert.ok(Object.keys(all.forms).length > 0);
    assert.ok(all.refused.length > 0);
    assert.ok(all.refused.every((r) => r.reason === "defective"));
    assert.equal(all.forms.nai, "ない");
  });

  test("an adjective yields the adjective form set", () => {
    const all = conjugateAll("高い", "adj-i");
    assert.equal(all.refused.length, 0);
    assert.equal(all.forms.adverb, "高く");
    assert.equal(all.forms.imperative, undefined);
  });

  test("enumeration never throws, whatever it's handed", () => {
    for (const [w, c] of [
      ["", "v5m"],
      ["読む", "nonsense"],
      ["勉強", "vs"],
      ["読む", "v5k"], // mis-tagged: ends in む, claims く
      ["食べる", "v5m"], // mis-tagged
    ] as const) {
      assert.doesNotThrow(() => conjugateAll(w, c));
    }
  });
});

// ===========================================================================
// Refusing loudly
// ===========================================================================

describe("mis-tagged input is refused, not silently mangled", () => {
  test("a v5-class word whose ending contradicts its tag", () => {
    // Without the ending guard this would conjugate 読む off the く row and
    // emit 読いて — well-formed-looking and false.
    refused("読む", "v5k", "te", "malformed");
    refused("書く", "v5m", "te", "malformed");
  });

  test("an ichidan word that doesn't end in る", () => {
    refused("読む", "v1", "te", "malformed");
  });

  test("a paradigm word that doesn't match its paradigm", () => {
    refused("読む", "vs-i", "te", "malformed");
    refused("読む", "vk", "te", "malformed");
  });

  test("unknown and empty input", () => {
    refused("読む", "not-a-tag", "te", "unknown-class");
    refused("", "v5m", "te", "malformed");
  });
});
