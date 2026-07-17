// ===========================================================================
// RULES — *how* to conjugate. Data only; the engine in `index.ts` walks these.
//
// This file is meant to be read and edited by someone who knows Japanese and
// not TypeScript. It is tables, not code. If you need to change how a form is
// built, you change a row here, not a branch in the engine.
//
// What may be conjugated AT ALL is a different question and lives in
// `policy.ts`. Rules are essentially finished forever; policy grows every time
// someone spots a bad output. Don't merge them.
// ===========================================================================

import type { Form, Onbin, Row, StemKey, WordClass } from "./types";

// ---------------------------------------------------------------------------
// RULE MECHANISM #1 — the vowel-row shift.
//
// This ONE table, parameterised by the verb's final kana, serves NINE forms
// (masu, nai, potential, passive, causative, imperative, volitional, ba, tai).
// It is the single highest-leverage object in the library.
// ---------------------------------------------------------------------------

/** Final kana of a godan verb -> its あ/い/え/お row stems. */
export const VOWEL_ROWS: Record<string, Row> = {
  // う is the odd one: the あ-row is わ, not あ (買う -> 買わない, never 買あない).
  // This is the historical /w/ surviving in exactly one slot.
  う: { a: "わ", i: "い", e: "え", o: "お" },
  く: { a: "か", i: "き", e: "け", o: "こ" },
  ぐ: { a: "が", i: "ぎ", e: "げ", o: "ご" },
  す: { a: "さ", i: "し", e: "せ", o: "そ" },
  つ: { a: "た", i: "ち", e: "て", o: "と" },
  ぬ: { a: "な", i: "に", e: "ね", o: "の" },
  ぶ: { a: "ば", i: "び", e: "べ", o: "ぼ" },
  む: { a: "ま", i: "み", e: "め", o: "も" },
  る: { a: "ら", i: "り", e: "れ", o: "ろ" },
};

// ---------------------------------------------------------------------------
// RULE MECHANISM #2 — the 音便 (euphonic change) branch for godan て/た.
//
// Five outcomes across nine endings. This is the only place godan verbs stop
// being regular, and it's why 待つ->待って has to be *generated* rather than
// memorised as a card.
// ---------------------------------------------------------------------------

/** Final kana of a godan verb -> its て/た forms (suffix replaces the kana). */
export const ONBIN: Record<string, Onbin> = {
  // 促音便 — う/つ/る all collapse to って
  う: { te: "って", ta: "った" },
  つ: { te: "って", ta: "った" },
  る: { te: "って", ta: "った" },
  // 撥音便 — む/ぶ/ぬ all collapse to んで (voiced)
  む: { te: "んで", ta: "んだ" },
  ぶ: { te: "んで", ta: "んだ" },
  ぬ: { te: "んで", ta: "んだ" },
  // イ音便
  く: { te: "いて", ta: "いた" },
  ぐ: { te: "いで", ta: "いだ" }, // voiced, mirroring ぐ
  // す alone doesn't reduce at all — the い-stem survives intact
  す: { te: "して", ta: "した" },
};

// ---------------------------------------------------------------------------
// FORM RULES — stem + suffix. Consumes MECHANISM #1 and #2 above.
//
// `stem` picks a column from the vowel-row table (or the 音便 stems).
// `godan` / `ichidan` are the suffixes glued onto that stem.
// ---------------------------------------------------------------------------

export interface StemFormRule {
  stem: StemKey;
  godan: string;
  ichidan: string;
}

export const FORM_RULES: Partial<Record<Form, StemFormRule>> = {
  masu: { stem: "i", godan: "ます", ichidan: "ます" },
  tai: { stem: "i", godan: "たい", ichidan: "たい" },
  nai: { stem: "a", godan: "ない", ichidan: "ない" },
  te: { stem: "te", godan: "", ichidan: "" },
  ta: { stem: "ta", godan: "", ichidan: "" },
  potential: { stem: "e", godan: "る", ichidan: "られる" },
  passive: { stem: "a", godan: "れる", ichidan: "られる" },
  causative: { stem: "a", godan: "せる", ichidan: "させる" },
  // 書け (bare え-stem) vs 食べろ. The godan imperative is the only form with
  // an empty suffix — the stem *is* the word.
  imperative: { stem: "e", godan: "", ichidan: "ろ" },
  volitional: { stem: "o", godan: "う", ichidan: "よう" },
  ba: { stem: "e", godan: "ば", ichidan: "れば" },
};

// ---------------------------------------------------------------------------
// DERIVED FORMS — pure composition, free. No new knowledge, no new rules.
//
// These are computed from another form's output, which means they work
// identically for godan, ichidan, する, くる and the adjectives without any of
// those classes knowing about them.
// ---------------------------------------------------------------------------

export interface DerivedFormRule {
  from: Form;
  /** Text to strip off the end of `from`'s output ("" = strip nothing). */
  trim: string;
  add: string;
}

export const DERIVED_FORMS: Partial<Record<Form, DerivedFormRule>> = {
  masuPast: { from: "masu", trim: "ます", add: "ました" },
  masuNegative: { from: "masu", trim: "ます", add: "ません" },
  naiPast: { from: "nai", trim: "い", add: "かった" },
  tara: { from: "ta", trim: "", add: "ら" },
  teiru: { from: "te", trim: "", add: "いる" },
  causativePassive: { from: "causative", trim: "る", add: "られる" },
  // 連用形, for verbs. Deriving it off masu rather than reading the i-stem
  // directly is deliberate: the paradigm classes (する -> し, くる -> き) have
  // no stem table to read, and this way they need no entry at all. Adjectives
  // never reach here — they list `stem` in their own tables below.
  stem: { from: "masu", trim: "ます", add: "" },
};

// ---------------------------------------------------------------------------
// CLASS TABLE — which mechanism each class uses, and its exceptions.
// ---------------------------------------------------------------------------

/** A class built from the vowel-row + 音便 tables. */
export interface GodanClassDef {
  kind: "godan";
  /**
   * Overrides a cell of the vowel-row table for this class only.
   * Used by exactly one class (v5aru) — see below.
   */
  row?: Partial<Row>;
  /** Replaces the 音便 outcome for this class only. */
  onbin?: Onbin;
  /** Replaces a whole form rule for this class only. */
  forms?: Partial<Record<Form, StemFormRule>>;
  /**
   * Suppletive forms: replace a trailing string outright rather than build
   * from a stem. Used for ある -> ない, which is not derivable by any rule.
   * First match wins, so list the longer/kanji endings first.
   */
  suppletive?: Partial<Record<Form, { endsWith: string; replaceWith: string }[]>>;
}

/** A class where every stem collapses to the bare stem (drop る). */
export interface IchidanClassDef {
  kind: "ichidan";
  forms?: Partial<Record<Form, StemFormRule>>;
}

/**
 * A class with a fully-listed paradigm — the suppletive verbs. No stem
 * arithmetic survives contact with these, so we just write them out.
 * `match` is the trailing text stripped off to find the prefix; first match
 * wins, so order matters (kanji before kana).
 */
export interface ParadigmClassDef {
  kind: "paradigm";
  variants: { match: string; forms: Partial<Record<Form, string>> }[];
}

export interface AdjectiveClassDef {
  kind: "adjective";
  /** First matching rule wins. `trim` chars come off the end, `add` goes on. */
  stemRules: { endsWith: string; trim: number; add: string }[];
  forms: Partial<Record<Form, string>>;
}

export type ClassDef =
  | GodanClassDef
  | IchidanClassDef
  | ParadigmClassDef
  | AdjectiveClassDef;

// --- the suppletive paradigms, written out in full -------------------------
// Only the 12 base forms are listed. masuPast / masuNegative / naiPast / tara /
// teiru / causativePassive fall out of DERIVED_FORMS above for free.

/** する. Also every 〜する compound (気にする, 一緒にする, ...). */
const SURU_FORMS: Partial<Record<Form, string>> = {
  masu: "します",
  te: "して",
  ta: "した",
  nai: "しない",
  potential: "できる", // suppletive: NOT しれる
  passive: "される",
  causative: "させる",
  imperative: "しろ",
  volitional: "しよう",
  ba: "すれば",
  tai: "したい",
};

/** くる, written in kana (くる, 持ってくる, 頭にくる). */
const KURU_KANA_FORMS: Partial<Record<Form, string>> = {
  masu: "きます",
  te: "きて",
  ta: "きた",
  nai: "こない",
  potential: "こられる",
  passive: "こられる",
  causative: "こさせる",
  imperative: "こい",
  volitional: "こよう",
  ba: "くれば",
  tai: "きたい",
};

/**
 * くる written with the kanji (来る, やって来る). The reading shifts き/こ/く but
 * the SPELLING doesn't — 来ます, 来ない, 来て. So the kanji paradigm is a
 * separate table, not a transformation of the kana one.
 */
const KURU_KANJI_FORMS: Partial<Record<Form, string>> = {
  masu: "来ます",
  te: "来て",
  ta: "来た",
  nai: "来ない",
  potential: "来られる",
  passive: "来られる",
  causative: "来させる",
  imperative: "来い",
  volitional: "来よう",
  ba: "来れば",
  tai: "来たい",
};

/**
 * 演ずる / 重んずる / 禁ず. An ichidan verb wearing a ずる ending: the stem is
 * じ everywhere except ば (演ずれば) and the literary passive (演ぜられる).
 */
const VZ_FORMS: Partial<Record<Form, string>> = {
  masu: "じます",
  te: "じて",
  ta: "じた",
  nai: "じない",
  potential: "じられる",
  passive: "ぜられる", // ぜ, not じ
  causative: "じさせる",
  imperative: "じろ",
  volitional: "じよう",
  ba: "ずれば", // ず, not じ
  tai: "じたい",
};

/** 來る — the pre-1946 spelling. Same paradigm, different glyph. */
const KURU_KYUJITAI_FORMS: Partial<Record<Form, string>> = Object.fromEntries(
  Object.entries(KURU_KANJI_FORMS).map(([form, value]) => [form, value.replace("来", "來")]),
);

/**
 * The final kana each godan class must end with.
 *
 * A guard, not a rule: if a v5m entry doesn't end in む, something upstream is
 * wrong and we refuse rather than silently conjugating it off the wrong row.
 */
export const GODAN_ENDINGS: Partial<Record<WordClass, string[]>> = {
  v5u: ["う"],
  v5k: ["く"],
  v5g: ["ぐ"],
  v5s: ["す"],
  v5t: ["つ"],
  v5n: ["ぬ"],
  v5b: ["ぶ"],
  v5m: ["む"],
  v5r: ["る"],
  v5aru: ["る"],
  "v5r-i": ["る"],
  "v5k-s": ["く"],
  "v5u-s": ["う"],
};

export const CLASSES: Record<WordClass, ClassDef> = {
  // --- plain godan: nothing but the two tables ---
  v5u: { kind: "godan" },
  v5k: { kind: "godan" },
  v5g: { kind: "godan" },
  v5s: { kind: "godan" },
  v5t: { kind: "godan" },
  v5n: { kind: "godan" },
  v5b: { kind: "godan" },
  v5m: { kind: "godan" },
  v5r: { kind: "godan" },

  // --- godan with exactly one exception each ---

  // 行く -> 行って, NOT 行いて. The only irregular 音便 in modern Japanese.
  // 56 entries incl. 持って行く. Everything else about 行く is regular:
  // 行かない, 行きます, 行けば all come straight from the tables.
  "v5k-s": { kind: "godan", onbin: { te: "って", ta: "った" } },

  // 問う -> 問うて, NOT 問って. Also 乞う, 請う, 給う. 14 entries.
  "v5u-s": { kind: "godan", onbin: { te: "うて", ta: "うた" } },

  // 下さる / 為さる / 仰る / いらっしゃる. JMdict documents this as a *masu*
  // irregularity, but it is really an い-STEM irregularity: the row's い slot
  // is い, not り. Once you say that, the imperative falls out for free,
  // because the v5aru imperative IS the い-stem:
  //   ください / なさい / おっしゃい / いらっしゃい  — not 下され / 為され / 仰れ.
  // That's one table cell + one form override covering all 7 entries. It does
  // NOT need a hard-coded per-word list.
  v5aru: {
    kind: "godan",
    row: { i: "い" },
    forms: { imperative: { stem: "i", godan: "", ichidan: "" } },
  },

  // ある. The negative is suppletive — ない, from a different root entirely.
  // No rule derives it, so we replace the trailing ある outright.
  //
  // One rule covers every one of the 75 entries in the class, in both scripts:
  //   ある -> ない · 有る -> ない · 事がある -> 事がない · である -> でない
  //   花も実も有る -> 花も実もない
  // The kanji spellings need their own line because the negative of 有る isn't
  // written with 有 at all — it's 無い, or just kana. 有ない is not a word in
  // any script, so there is nothing to derive and we substitute outright.
  "v5r-i": {
    kind: "godan",
    suppletive: {
      nai: [
        { endsWith: "ある", replaceWith: "ない" },
        { endsWith: "有る", replaceWith: "ない" },
        { endsWith: "在る", replaceWith: "ない" },
      ],
    },
  },

  // --- ichidan ---
  v1: { kind: "ichidan" },

  // くれる -> くれ, not くれろ. This class exists in JMdict *for* this fact.
  "v1-s": {
    kind: "ichidan",
    forms: { imperative: { stem: "e", godan: "", ichidan: "" } },
  },

  // --- suppletive ---

  // 為る is an archaic spelling of する; we emit the kana paradigm for it
  // rather than inventing 為ます, which nobody writes.
  "vs-i": {
    kind: "paradigm",
    variants: [
      { match: "する", forms: SURU_FORMS },
      { match: "為る", forms: SURU_FORMS },
    ],
  },

  // 愛する, 課する, 訳する. Looks like する but conjugates on a さ/せ stem:
  // 愛さない (not 愛しない), 愛せる (not 愛できる), 愛せ (not 愛しろ).
  "vs-s": {
    kind: "paradigm",
    variants: [
      {
        match: "する",
        forms: {
          masu: "します",
          te: "して",
          ta: "した",
          nai: "さない",
          potential: "せる",
          passive: "される",
          causative: "させる",
          imperative: "せ",
          volitional: "そう",
          ba: "すれば",
          tai: "したい",
        },
      },
    ],
  },

  // Every variant KEEPS ITS PREFIX: 持って来る -> 持って来て, 持ってくる ->
  // 持ってきて. Collapsing the 38 くる compounds onto bare くる would make
  // くれば falsely resolve to dozens of lemmas downstream.
  vk: {
    kind: "paradigm",
    variants: [
      { match: "来る", forms: KURU_KANJI_FORMS }, // kanji first — 来る before くる
      { match: "來る", forms: KURU_KYUJITAI_FORMS }, // 舊字體 spelling
      { match: "くる", forms: KURU_KANA_FORMS },
    ],
  },

  // 演ずる / 重んずる. An ichidan verb wearing a ずる ending; the stem is じ
  // except in ば (演ずれば) and the literary passive (演ぜられる).
  vz: {
    kind: "paradigm",
    variants: [
      {
        match: "ずる",
        forms: VZ_FORMS,
      },
      // 禁ず — the bare ず citation form. Same paradigm, shorter ending.
      { match: "ず", forms: VZ_FORMS },
    ],
  },

  // --- adjectives ---

  // 高い -> 高. Trim the い, glue on the suffix.
  "adj-i": {
    kind: "adjective",
    stemRules: [
      { endsWith: "い", trim: 1, add: "" },
      // Slang spellings, all real JMdict entries. Without these, ウザイ /
      // キモイ / イクナイ / 熱っちぃ are the only adj-i entries we can't touch.
      { endsWith: "イ", trim: 1, add: "" }, // katakana: ウザイ, キモイ
      { endsWith: "ぃ", trim: 1, add: "" }, // small kana: 熱っちぃ
      { endsWith: "ィ", trim: 1, add: "" },
    ],
    forms: {
      te: "くて",
      ta: "かった",
      nai: "くない",
      ba: "ければ",
      stem: "", // 高 / よ — the 高すぎる, 高そう attachment point.
      adverb: "く",
      prenominal: "い",
    },
  },

  // The よい/いい class. This is NOT a JMdict bug — it's correct design.
  // よい conjugates perfectly regularly; it's いい that can't (*いくない,
  // *いかった). So every form is built off a よ stem, and only the dictionary
  // form keeps whatever the entry actually says.
  //
  // The kana rule (trim 2, add よ) handles いい and よい alike: 気持ちいい ->
  // 気持ちよ -> 気持ちよくない. But the KANJI spellings must keep their kanji:
  // 格好の良い -> 格好の良くない, not 格好のよくない. Hence one rule per kanji.
  // 133 entries, all covered.
  "adj-ix": {
    kind: "adjective",
    stemRules: [
      { endsWith: "いい", trim: 2, add: "よ" },
      { endsWith: "よい", trim: 2, add: "よ" },
      { endsWith: "良い", trim: 1, add: "" },
      { endsWith: "好い", trim: 1, add: "" },
      { endsWith: "善い", trim: 1, add: "" },
      { endsWith: "佳い", trim: 1, add: "" },
      { endsWith: "吉い", trim: 1, add: "" },
    ],
    forms: {
      te: "くて",
      ta: "かった",
      nai: "くない",
      ba: "ければ",
      stem: "", // 高 / よ — the 高すぎる, 高そう attachment point.
      adverb: "く",
      prenominal: "い",
    },
  },

  // 静か. The word IS the stem; what conjugates is the copula after it.
  // That's why Ichiran's do-not-conjugate list includes adj-na — for a
  // *deinflector* it's noise. For a drill it's a real, teachable paradigm.
  "adj-na": {
    kind: "adjective",
    stemRules: [{ endsWith: "", trim: 0, add: "" }],
    forms: {
      dictionary: "だ",
      polite: "です",
      te: "で",
      ta: "だった",
      nai: "ではない",
      ba: "なら",
      stem: "", // 静か — the word already IS the stem; see stemRules above.
      adverb: "に",
      prenominal: "な",
    },
  },
};

/**
 * Adjective `polite` for the い-classes is just the dictionary form + です
 * (高いです, 気持ちいいです). Doing it as a derivation rather than a stem rule
 * keeps いい intact — よいです would be a different word.
 */
export const ADJ_I_POLITE: DerivedFormRule = {
  from: "dictionary",
  trim: "",
  add: "です",
};
