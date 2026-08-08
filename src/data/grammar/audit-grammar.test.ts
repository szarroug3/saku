// Data-correctness audit guards for the grammar slice.
//
// This is a NEW file added by a correctness audit (see the task in the branch
// history). It does not replace the existing grammar/engine tests — it pins a
// second, independent table so that a regression in either the conjugation
// engine (src/lib/conjugate) or the recipe-application layer
// (src/lib/grammar/apply) is caught against hand-verified Japanese rather than
// against a form the code happens to produce today.
//
// Two tables:
//   1. ENGINE   — (class, form) -> surface, one representative word per class,
//      spanning godan/ichidan/irregular/adjective/copula and every pattern the
//      engine teaches. Every expected value was checked by a human against
//      correct Japanese during the audit; none was copied from engine output.
//   2. RECIPE   — (recipe id, host word/class) -> surface, for the grammar
//      layer that glues a suffix onto an engine form. Catches a wrong `add`
//      string or `form`/`trim` choice in recipes.ts, which the engine table
//      cannot see.

import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { conjugate, type Form, type WordClass } from "../../lib/conjugate/index.ts";
import { apply } from "../../lib/grammar/apply.ts";
import { RECIPES } from "./recipes.ts";

// ---------------------------------------------------------------------------
// 1. ENGINE — (class, form) -> expected surface, pinned per representative word.
// ---------------------------------------------------------------------------

interface EngineCase {
  readonly word: string;
  readonly cls: WordClass;
  /** Every form asserted for this word. A form omitted here is not checked. */
  readonly forms: Partial<Record<Form, string>>;
}

const ENGINE_CASES: readonly EngineCase[] = [
  // --- godan, one per final-kana row --------------------------------------
  {
    word: "買う",
    cls: "v5u",
    forms: {
      masu: "買います", masuPast: "買いました", masuNegative: "買いません",
      te: "買って", ta: "買った", nai: "買わない", naiPast: "買わなかった",
      potential: "買える", passive: "買われる", causative: "買わせる",
      causativePassive: "買わせられる", imperative: "買え", volitional: "買おう",
      ba: "買えば", tara: "買ったら", tai: "買いたい", teiru: "買っている", stem: "買い",
    },
  },
  {
    word: "書く",
    cls: "v5k",
    forms: {
      te: "書いて", ta: "書いた", nai: "書かない", masu: "書きます",
      potential: "書ける", passive: "書かれる", causative: "書かせる",
      volitional: "書こう", ba: "書けば", imperative: "書け", stem: "書き",
    },
  },
  {
    word: "泳ぐ",
    cls: "v5g",
    // voiced イ音便: て/た take で/だ, not て/た.
    forms: { te: "泳いで", ta: "泳いだ", nai: "泳がない", potential: "泳げる", teiru: "泳いでいる" },
  },
  {
    word: "話す",
    cls: "v5s",
    // す alone does NOT reduce: the い-stem survives in て/た.
    forms: { te: "話して", ta: "話した", nai: "話さない", masu: "話します", volitional: "話そう" },
  },
  {
    word: "待つ",
    cls: "v5t",
    forms: { te: "待って", ta: "待った", nai: "待たない", masu: "待ちます", potential: "待てる", stem: "待ち" },
  },
  {
    word: "死ぬ",
    cls: "v5n",
    // 撥音便: ぬ -> んで/んだ.
    forms: { te: "死んで", ta: "死んだ", nai: "死なない", volitional: "死のう", ba: "死ねば" },
  },
  {
    word: "遊ぶ",
    cls: "v5b",
    forms: { te: "遊んで", ta: "遊んだ", nai: "遊ばない", masu: "遊びます", potential: "遊べる" },
  },
  {
    word: "読む",
    cls: "v5m",
    forms: { te: "読んで", ta: "読んだ", nai: "読まない", passive: "読まれる", causative: "読ませる", volitional: "読もう" },
  },
  {
    word: "帰る",
    cls: "v5r",
    forms: { te: "帰って", ta: "帰った", nai: "帰らない", potential: "帰れる", imperative: "帰れ", stem: "帰り" },
  },

  // --- godan irregulars ---------------------------------------------------
  {
    word: "行く",
    cls: "v5k-s",
    // THE irregular 音便: 行って, never 行いて. Everything else regular.
    forms: {
      te: "行って", ta: "行った", nai: "行かない", masu: "行きます",
      potential: "行ける", volitional: "行こう", ba: "行けば", tara: "行ったら",
    },
  },
  {
    word: "問う",
    cls: "v5u-s",
    // 問うて/問うた, not 問って. But の regular row elsewhere (問わない).
    forms: { te: "問うて", ta: "問うた", nai: "問わない", masu: "問います", tara: "問うたら" },
  },
  {
    word: "下さる",
    cls: "v5aru",
    // い-stem irregularity: 下さいます (not 下さります), imperative 下さい (not 下され).
    forms: { masu: "下さいます", nai: "下さらない", te: "下さって", ta: "下さった", imperative: "下さい" },
  },
  {
    word: "ある",
    cls: "v5r-i",
    // suppletive negative: ない, not あらない.
    forms: { nai: "ない", naiPast: "なかった", te: "あって", ta: "あった", masu: "あります", ba: "あれば" },
  },

  // --- ichidan ------------------------------------------------------------
  {
    word: "食べる",
    cls: "v1",
    forms: {
      te: "食べて", ta: "食べた", nai: "食べない", masu: "食べます",
      potential: "食べられる", passive: "食べられる", causative: "食べさせる",
      causativePassive: "食べさせられる", imperative: "食べろ", volitional: "食べよう",
      ba: "食べれば", tara: "食べたら", tai: "食べたい", stem: "食べ",
    },
  },
  {
    word: "くれる",
    cls: "v1-s",
    // imperative くれ, NOT くれろ. That is the whole reason this class exists.
    forms: { imperative: "くれ", te: "くれて", nai: "くれない", masu: "くれます" },
  },

  // --- irregular / suppletive verbs ---------------------------------------
  {
    word: "する",
    cls: "vs-i",
    forms: {
      masu: "します", te: "して", ta: "した", nai: "しない",
      potential: "できる", passive: "される", causative: "させる",
      imperative: "しろ", volitional: "しよう", ba: "すれば", stem: "し",
    },
  },
  {
    word: "勉強する",
    cls: "vs-i",
    forms: { te: "勉強して", nai: "勉強しない", potential: "勉強できる", passive: "勉強される", volitional: "勉強しよう" },
  },
  {
    word: "愛する",
    cls: "vs-s",
    // さ/せ stem: 愛さない (not 愛しない), 愛せる (not 愛できる), 愛せ (not 愛しろ).
    forms: { nai: "愛さない", potential: "愛せる", imperative: "愛せ", te: "愛して", volitional: "愛そう" },
  },
  {
    word: "くる",
    cls: "vk",
    // reading shifts き/こ/く, kana spelled out.
    forms: {
      masu: "きます", te: "きて", ta: "きた", nai: "こない",
      potential: "こられる", causative: "こさせる", imperative: "こい",
      volitional: "こよう", ba: "くれば", stem: "き",
    },
  },
  {
    word: "来る",
    cls: "vk",
    // kanji spelling is INVARIANT even though the reading shifts.
    forms: {
      masu: "来ます", te: "来て", nai: "来ない", potential: "来られる",
      imperative: "来い", volitional: "来よう", ba: "来れば",
    },
  },
  {
    word: "演ずる",
    cls: "vz",
    // じ stem everywhere except ば (演ずれば) and literary passive (演ぜられる).
    forms: { masu: "演じます", te: "演じて", nai: "演じない", passive: "演ぜられる", ba: "演ずれば", imperative: "演じろ" },
  },

  // --- adjectives + copula ------------------------------------------------
  {
    word: "高い",
    cls: "adj-i",
    forms: {
      te: "高くて", ta: "高かった", nai: "高くない", naiPast: "高くなかった",
      ba: "高ければ", tara: "高かったら", stem: "高", adverb: "高く",
      prenominal: "高い", polite: "高いです",
    },
  },
  {
    word: "いい",
    cls: "adj-ix",
    // よ-stem for every inflection; いい/prenominal keep いい.
    forms: {
      dictionary: "いい", te: "よくて", ta: "よかった", nai: "よくない",
      ba: "よければ", stem: "よ", adverb: "よく", prenominal: "いい", polite: "いいです",
    },
  },
  {
    word: "良い",
    cls: "adj-ix",
    // kanji kept through the inflection.
    forms: { te: "良くて", ta: "良かった", nai: "良くない", adverb: "良く", prenominal: "良い" },
  },
  {
    word: "静か",
    cls: "adj-na",
    forms: {
      dictionary: "静かだ", polite: "静かです", te: "静かで", ta: "静かだった",
      nai: "静かではない", naiPast: "静かではなかった", ba: "静かなら",
      tara: "静かだったら", stem: "静か", adverb: "静かに", prenominal: "静かな",
    },
  },
];

describe("audit: engine (class, form) -> surface, pinned against verified Japanese", () => {
  for (const c of ENGINE_CASES) {
    test(`${c.word} (${c.cls})`, () => {
      for (const [form, expected] of Object.entries(c.forms) as [Form, string][]) {
        const got = conjugate(c.word, c.cls, form);
        assert.ok(got.ok, `${c.word} ${form} was refused: ${got.ok ? "" : got.detail}`);
        assert.equal(got.value, expected, `${c.word} ${form}`);
      }
    });
  }
});

describe("audit: defective forms stay refused, not silently invented", () => {
  test("ある has no potential/passive/causative/imperative/teiru", () => {
    for (const form of ["potential", "passive", "causative", "imperative", "teiru"] as Form[]) {
      const got = conjugate("ある", "v5r-i", form);
      assert.ok(!got.ok, `ある ${form} should be refused but got ${got.ok ? got.value : ""}`);
    }
  });
  test("honorific 下さる has no potential/passive/causative", () => {
    for (const form of ["potential", "passive", "causative"] as Form[]) {
      const got = conjugate("下さる", "v5aru", form);
      assert.ok(!got.ok, `下さる ${form} should be refused but got ${got.ok ? got.value : ""}`);
    }
  });
});

// ---------------------------------------------------------------------------
// 2. RECIPE — (recipe id, host) -> expected surface. Guards the suffix/trim
//    strings in recipes.ts, which the engine table above cannot reach.
// ---------------------------------------------------------------------------

interface RecipeCase {
  readonly id: string;
  readonly word: string;
  readonly cls: WordClass | null;
  readonly expected: string;
}

const RECIPE_CASES: readonly RecipeCase[] = [
  // て-series: the 音便 is the engine's; the suffix is the recipe's.
  { id: "te-request", word: "読む", cls: "v5m", expected: "読んでください" },
  { id: "te-kara", word: "行く", cls: "v5k-s", expected: "行ってから" },
  { id: "te-permission", word: "高い", cls: "adj-i", expected: "高くてもいい" },
  { id: "te-mo", word: "泳ぐ", cls: "v5g", expected: "泳いでも" },

  // ない-series, including the trim-い rows.
  { id: "nai-request", word: "する", cls: "vs-i", expected: "しないでください" },
  { id: "nakute-mo-ii", word: "食べる", cls: "v1", expected: "食べなくてもいい" },
  { id: "nakereba-naranai", word: "買う", cls: "v5u", expected: "買わなければならない" },
  { id: "nakute-wa-ikenai", word: "書く", cls: "v5k", expected: "書かなくてはいけない" },
  { id: "nakya", word: "行く", cls: "v5k-s", expected: "行かなきゃ" },

  // た-series.
  { id: "ta-koto-ga-aru", word: "来る", cls: "vk", expected: "来たことがある" },
  { id: "ta-hou-ga-ii", word: "泳ぐ", cls: "v5g", expected: "泳いだほうがいい" },

  // stem-series, including the さ-insertion exception on the いい family.
  { id: "nagara", word: "読む", cls: "v5m", expected: "読みながら" },
  { id: "sugiru", word: "高い", cls: "adj-i", expected: "高すぎる" },
  { id: "tai", word: "食べる", cls: "v1", expected: "食べたい" },
  { id: "sou-appearance", word: "降る", cls: "v5r", expected: "降りそう" },
  { id: "sou-appearance", word: "高い", cls: "adj-i", expected: "高そう" },
  { id: "sou-appearance", word: "いい", cls: "adj-ix", expected: "よさそう" },
  { id: "sou-appearance", word: "ない", cls: "adj-i", expected: "なさそう" },

  // dictionary-form hosts (no conjugation) + noun (の-insertion) hosts.
  { id: "koto-ga-dekiru", word: "食べる", cls: "v1", expected: "食べることができる" },
  { id: "tsumori", word: "する", cls: "vs-i", expected: "するつもり" },
  { id: "node", word: "静か", cls: "adj-na", expected: "静かなので" },
  { id: "you-da", word: "本", cls: null, expected: "本のようだ" },
  { id: "tame-ni", word: "本", cls: null, expected: "本のために" },
  { id: "nara", word: "本", cls: null, expected: "本なら" },

  // potential/passive/causative as recipes agree with the engine.
  { id: "potential", word: "する", cls: "vs-i", expected: "できる" },
  { id: "passive", word: "演ずる", cls: "vz", expected: "演ぜられる" },
  { id: "causative", word: "食べる", cls: "v1", expected: "食べさせる" },
  { id: "volitional-form", word: "書く", cls: "v5k", expected: "書こう" },
  { id: "ba", word: "いい", cls: "adj-ix", expected: "よければ" },
  { id: "tara", word: "静か", cls: "adj-na", expected: "静かだったら" },
];

const RECIPE_BY_ID = new Map(RECIPES.map((r) => [r.id, r]));

describe("audit: recipe (id, host) -> surface, pinned against verified Japanese", () => {
  for (const c of RECIPE_CASES) {
    test(`${c.id} + ${c.word}`, () => {
      const r = RECIPE_BY_ID.get(c.id);
      assert.ok(r, `recipe '${c.id}' not found`);
      const got = apply(r, c.word, c.cls);
      assert.ok(got.ok, `${c.id} + ${c.word} was refused: ${got.ok ? "" : got.detail}`);
      assert.equal(got.value, c.expected, `${c.id} + ${c.word}`);
    });
  }
});
