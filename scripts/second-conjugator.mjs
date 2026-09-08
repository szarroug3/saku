// A SECOND conjugator, written from a grammar reference's rules rather than
// from this app's code, so that its output can be diffed against
// src/lib/conjugate and every disagreement can be looked at by hand (SAK-418).
//
// WHY THIS EXISTS
// ===============
// src/lib/conjugate is the only thing that decides what the app says a verb
// looks like in a given form. A test written against it can only say that it
// still does what it did yesterday. It cannot say that what it does is right.
// So this file is a deliberately separate derivation: the rules below were
// written out from a grammar reference (the conjugation tables in A Dictionary
// of Basic Japanese Grammar, appendix 1 "Basic Conjugations", cross-checked
// against Tae Kim's Guide to Japanese, "Verb Basics" and "Polite Forms"), by
// someone who had not read src/lib/conjugate. Anywhere the two derivations
// disagree is either a bug in one of them or a genuinely contested form, and
// either way a human should look at it.
//
// It is a script, not app code. Nothing imports it at runtime.
//
//     node scripts/second-conjugator.mjs                 dump every form as JSON
//     node scripts/second-conjugator.mjs --sample 20     the first 20 verbs only
//
// WHAT THIS FILE DOES NOT MODEL, FOUND BY RUNNING THE DIFF
// ========================================================
// Three JMdict classes came out of the diff as this file's own gaps rather than
// the app's, and they are left unfixed on purpose: patching them from the app's
// answers would turn the second derivation into a copy of the first, and the
// value here is that the two were written apart. They are named so the diff's
// numbers can be read honestly (see docs/content-review-2026-09.md).
//
//   vs-s   愛する, 察する and their 40-odd siblings. These inflect partly like
//          godan す verbs (愛さない, 愛せる, 愛そう), not like する. 210 of the
//          diff's rows are this file being wrong and the app being right.
//   vz     演ずる's DICTIONARY form. This file rewrites it to 演じる, which is a
//          real word but not the entry's own spelling. 20 rows, this file's bug.
//          (Its passive and ba forms are a genuine disagreement, not a bug: see
//          the report.)
//   v5r-i  ある in compounds. である's negative is でない, not ない; this file
//          applies the bare suppletion and loses the prefix. 12 rows.
//
// It also has no notion of DEFECTIVENESS: it will happily build ことがあれる,
// which the app refuses with a reason. All 152 such rows are the app being
// right.
//
// The verb list and its class tags come from src/data/generated/vocab.json,
// whose `pos` strings are JMdict's own part-of-speech entities expanded
// ("Godan verb with 'ku' ending", "Ichidan verb", ...). The class is therefore
// JMdict's opinion, not this file's guess; only the endings are this file's.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const VOCAB_PATH = fileURLToPath(new URL("../src/data/generated/vocab.json", import.meta.url));

// ---------------------------------------------------------------------------
// The kana grid. A godan verb's ending is its final kana, and every godan form
// is that kana moved along its consonant row. DBJG appendix 1 lays this out as
// five stems; the names here are the usual ones (a-stem = 未然形, i-stem =
// 連用形, e-stem = 仮定形/命令形, o-stem = 意向形).
// ---------------------------------------------------------------------------

/** [a, i, u, e, o] for each godan ending, keyed by the dictionary-form kana. */
const ROWS = {
  う: ["わ", "い", "う", "え", "お"], // the わ is the irregular one: 買う -> 買わない
  く: ["か", "き", "く", "け", "こ"],
  ぐ: ["が", "ぎ", "ぐ", "げ", "ご"],
  す: ["さ", "し", "す", "せ", "そ"],
  つ: ["た", "ち", "つ", "て", "と"],
  ぬ: ["な", "に", "ぬ", "ね", "の"],
  ぶ: ["ば", "び", "ぶ", "べ", "ぼ"],
  む: ["ま", "み", "む", "め", "も"],
  る: ["ら", "り", "る", "れ", "ろ"],
};

const A = 0;
const I = 1;
const E = 3;
const O = 4;

/** The te-form and past-form endings of a godan verb, by dictionary ending.
 * This is the 音便 table: う/つ/る take っ, む/ぶ/ぬ take ん and voice the
 * ending, く takes い, ぐ takes い and voices, す keeps し. */
const ONBIN = {
  う: ["って", "った"],
  つ: ["って", "った"],
  る: ["って", "った"],
  む: ["んで", "んだ"],
  ぶ: ["んで", "んだ"],
  ぬ: ["んで", "んだ"],
  く: ["いて", "いた"],
  ぐ: ["いで", "いだ"],
  す: ["して", "した"],
};

// ---------------------------------------------------------------------------
// Classifying a dictionary entry from its JMdict part-of-speech strings.
// ---------------------------------------------------------------------------

/**
 * @typedef {"godan"|"ichidan"|"suru"|"kuru"|"suru-noun"|"i-adj"|"na-adj"|"zuru"|null} Kind
 */

/** The class of a word, and any special sub-class, from its `pos` strings. */
export function classify(pos) {
  const has = (s) => pos.some((p) => p === s);
  const any = (re) => pos.some((p) => re.test(p));

  if (has("Kuru verb - special class")) return { kind: "kuru", special: null };
  if (has("Ichidan verb - kureru special class")) return { kind: "ichidan", special: "kureru" };
  if (has("Ichidan verb - zuru verb (alternative form of -jiru verbs)"))
    return { kind: "zuru", special: null };
  if (has("Ichidan verb")) return { kind: "ichidan", special: null };
  if (has("Godan verb - -aru special class")) return { kind: "godan", special: "aru-honorific" };
  if (has("Godan verb - Iku/Yuku special class")) return { kind: "godan", special: "iku" };
  if (has("Godan verb with 'ru' ending (irregular verb)"))
    return { kind: "godan", special: "aru-existential" };
  if (has("Godan verb with 'u' ending (special class)")) return { kind: "godan", special: "utsu" };
  if (any(/^Godan verb with '(\w+)' ending$/)) return { kind: "godan", special: null };
  if (has("suru verb - special class") || has("suru verb - included") || has("su verb - precursor to the modern suru"))
    return { kind: "suru", special: null };
  if (has("noun or participle which takes the aux. verb suru")) return { kind: "suru-noun", special: null };
  if (has("adjective (keiyoushi) - yoi/ii class")) return { kind: "i-adj", special: "yoi" };
  if (has("adjective (keiyoushi)")) return { kind: "i-adj", special: null };
  if (has("adjectival nouns or quasi-adjectives (keiyodoshi)")) return { kind: "na-adj", special: null };
  return { kind: null, special: null };
}

// ---------------------------------------------------------------------------
// The rules.
//
// Every function below takes the DICTIONARY FORM as a string and returns the
// conjugated string, or null when the form does not exist for that class. The
// same function is applied to the written form (keb) and to the reading (reb):
// a verb's inflecting tail is okurigana in both, so 書く -> 書きます falls out
// of かく -> かきます by the identical rule.
// ---------------------------------------------------------------------------

const drop = (s, n = 1) => s.slice(0, s.length - n);
const last = (s) => s[s.length - 1];

/** Godan: swap the final kana for its row-mate at `slot`, then add `suffix`. */
function godanStem(word, slot, suffix) {
  const row = ROWS[last(word)];
  if (!row) return null;
  return drop(word) + row[slot] + suffix;
}

/** Godan te/past, honoring the two irregular sub-classes. */
function godanOnbin(word, special, past) {
  const idx = past ? 1 : 0;
  // 行く is the one godan く verb that takes the っ ending, not the い one.
  if (special === "iku") return drop(word) + (past ? "った" : "って");
  // 問う, 請う: the older う-verb ending, うて/うた rather than って/った.
  if (special === "utsu") return drop(word) + (past ? "うた" : "うて");
  const pair = ONBIN[last(word)];
  if (!pair) return null;
  return drop(word) + pair[idx];
}

/** The suru/kuru stems. `suru` inflects the whole word; `kuru`'s stem vowel
 * changes with the form, which is the whole of its irregularity. */
function suruForm(word, form) {
  // `word` ends in する (or just is する). Everything before it is carried.
  const head = word.endsWith("する") ? drop(word, 2) : drop(word, 1);
  const t = {
    dictionary: "する",
    masu: "します",
    negative: "しない",
    "negative-polite": "しません",
    past: "した",
    "past-polite": "しました",
    "past-negative": "しなかった",
    "past-negative-polite": "しませんでした",
    te: "して",
    "te-negative": "しなくて",
    "nai-de": "しないで",
    potential: "できる",
    passive: "される",
    causative: "させる",
    "causative-passive": "させられる",
    volitional: "しよう",
    "volitional-polite": "しましょう",
    imperative: "しろ",
    prohibitive: "するな",
    ba: "すれば",
    tara: "したら",
    progressive: "している",
    tai: "したい",
    "masu-stem": "し",
  }[form];
  return t === undefined ? null : head + t;
}

function kuruForm(word, form) {
  // 来る / くる. The kanji does not change; only the okurigana does, which is
  // why the kanji spelling of 来ない is ambiguous in writing and unambiguous
  // aloud. Applied to the reading (くる) the stem vowel is visible.
  const kana = word.endsWith("くる");
  const head = kana ? drop(word, 2) : drop(word, 1); // 来る -> 来
  const ko = kana ? "こ" : "";
  const ki = kana ? "き" : "";
  const t = {
    dictionary: kana ? "くる" : "る",
    masu: ki + "ます",
    negative: ko + "ない",
    "negative-polite": ki + "ません",
    past: ki + "た",
    "past-polite": ki + "ました",
    "past-negative": ko + "なかった",
    "past-negative-polite": ki + "ませんでした",
    te: ki + "て",
    "te-negative": ko + "なくて",
    "nai-de": ko + "ないで",
    potential: ko + "られる",
    passive: ko + "られる",
    causative: ko + "させる",
    "causative-passive": ko + "させられる",
    volitional: ko + "よう",
    "volitional-polite": ki + "ましょう",
    imperative: ko + "い",
    prohibitive: (kana ? "くる" : "る") + "な",
    ba: (kana ? "くれ" : "れ") + "ば",
    tara: ki + "たら",
    progressive: ki + "ている",
    tai: ki + "たい",
    "masu-stem": ki,
  }[form];
  return t === undefined ? null : head + t;
}

/** Ichidan. Drop the final る and add. */
function ichidanForm(word, form, special) {
  const s = drop(word);
  const t = {
    dictionary: "る",
    masu: "ます",
    negative: "ない",
    "negative-polite": "ません",
    past: "た",
    "past-polite": "ました",
    "past-negative": "なかった",
    "past-negative-polite": "ませんでした",
    te: "て",
    "te-negative": "なくて",
    "nai-de": "ないで",
    potential: "られる",
    passive: "られる",
    causative: "させる",
    "causative-passive": "させられる",
    volitional: "よう",
    "volitional-polite": "ましょう",
    // くれる is the one ichidan verb whose imperative is the bare stem.
    imperative: special === "kureru" ? "" : "ろ",
    prohibitive: "るな",
    ba: "れば",
    tara: "たら",
    progressive: "ている",
    tai: "たい",
    "masu-stem": "",
  }[form];
  return t === undefined ? null : s + t;
}

/** Godan. */
function godanForm(word, form, special) {
  const ending = last(word);
  if (!ROWS[ending]) return null;

  // ある is defective: it has no ない form of its own, the negative is just ない.
  if (special === "aru-existential") {
    if (form === "negative") return "ない";
    if (form === "past-negative") return "なかった";
    if (form === "te-negative") return "なくて";
  }
  // いらっしゃる, ください, なさる, おっしゃる, ござる: the i-stem is い, not り,
  // so ます attaches to いらっしゃい, and the imperative is that same い.
  const iStem = special === "aru-honorific" ? drop(word) + "い" : godanStem(word, I, "");

  switch (form) {
    case "dictionary":
      return word;
    case "masu":
      return iStem + "ます";
    case "masu-stem":
      return iStem;
    case "negative":
      return godanStem(word, A, "ない");
    case "negative-polite":
      return iStem + "ません";
    case "past":
      return godanOnbin(word, special, true);
    case "past-polite":
      return iStem + "ました";
    case "past-negative":
      return godanStem(word, A, "なかった");
    case "past-negative-polite":
      return iStem + "ませんでした";
    case "te":
      return godanOnbin(word, special, false);
    case "te-negative":
      return godanStem(word, A, "なくて");
    case "nai-de":
      return godanStem(word, A, "ないで");
    case "potential":
      return godanStem(word, E, "る");
    case "passive":
      return godanStem(word, A, "れる");
    case "causative":
      return godanStem(word, A, "せる");
    case "causative-passive":
      // The contraction せられる -> される applies to every godan verb EXCEPT
      // the す-ending ones, where it would collide with the passive
      // (話さされる is not a word; 話させられる is). DBJG, "causative passive".
      return ending === "す" ? godanStem(word, A, "せられる") : godanStem(word, A, "される");
    case "volitional":
      return godanStem(word, O, "う");
    case "volitional-polite":
      return iStem + "ましょう";
    case "imperative":
      return special === "aru-honorific" ? drop(word) + "い" : godanStem(word, E, "");
    case "prohibitive":
      return word + "な";
    case "ba":
      return godanStem(word, E, "ば");
    case "tara": {
      const past = godanOnbin(word, special, true);
      return past === null ? null : past + "ら";
    }
    case "progressive": {
      const te = godanOnbin(word, special, false);
      return te === null ? null : te + "いる";
    }
    case "tai":
      return iStem + "たい";
    default:
      return null;
  }
}

/** い-adjectives. いい/よい inflects off よ, which is the only irregularity. */
function iAdjForm(word, form, special) {
  // For the yoi/ii class every inflected form is built on よ, never on い:
  // いい -> よかった, never いかった. The dictionary form keeps whichever
  // spelling the entry has.
  const body = special === "yoi" && word.endsWith("いい") ? drop(word, 2) + "よい" : word;
  const s = drop(body); // strip the final い
  const t = {
    dictionary: word,
    polite: word + "です",
    past: s + "かった",
    "past-polite": s + "かったです",
    negative: s + "くない",
    "negative-polite": s + "くないです",
    "past-negative": s + "くなかった",
    "past-negative-polite": s + "くなかったです",
    te: s + "くて",
    adverb: s + "く",
    ba: s + "ければ",
    tara: s + "かったら",
    noun: s + "さ",
    // Before a noun an い-adjective is simply its dictionary form. いい keeps
    // its いい spelling here (いい店), which is why this reads `word` and not
    // the よ-stem `body`.
    prenominal: word,
    stem: special === "yoi" ? drop(body) : s,
  }[form];
  return t === undefined ? null : t;
}

/** な-adjectives. The stem is the whole word; the copula does the work. */
function naAdjForm(word, form) {
  const t = {
    dictionary: word + "だ",
    polite: word + "です",
    past: word + "だった",
    "past-polite": word + "でした",
    negative: word + "ではない",
    "negative-polite": word + "ではありません",
    "past-negative": word + "ではなかった",
    "past-negative-polite": word + "ではありませんでした",
    te: word + "で",
    adverb: word + "に",
    ba: word + "なら",
    tara: word + "だったら",
    prenominal: word + "な",
    stem: word,
  }[form];
  return t === undefined ? null : t;
}

/** ずる verbs (信ずる, 論ずる): the modern inflection is the じる one. */
function zuruForm(word, form) {
  const jiru = drop(word, 2) + "じる";
  return ichidanForm(jiru, form, null);
}

/** The whole table for one word. `kind` and `special` come from `classify`. */
export function conjugate(word, kind, special, form) {
  switch (kind) {
    case "godan":
      return godanForm(word, form, special);
    case "ichidan":
      return ichidanForm(word, form, special);
    case "zuru":
      return zuruForm(word, form);
    case "suru":
    case "suru-noun":
      return suruForm(kind === "suru-noun" ? word + "する" : word, form);
    case "kuru":
      return kuruForm(word, form);
    case "i-adj":
      return iAdjForm(word, form, special);
    case "na-adj":
      return naAdjForm(word, form);
    default:
      return null;
  }
}

export const VERB_FORMS = [
  "dictionary",
  "masu",
  "masu-stem",
  "negative",
  "negative-polite",
  "past",
  "past-polite",
  "past-negative",
  "past-negative-polite",
  "te",
  "te-negative",
  "nai-de",
  "potential",
  "passive",
  "causative",
  "causative-passive",
  "volitional",
  "volitional-polite",
  "imperative",
  "prohibitive",
  "ba",
  "tara",
  "progressive",
  "tai",
];

export const ADJ_FORMS = [
  "dictionary",
  "polite",
  "past",
  "past-polite",
  "negative",
  "negative-polite",
  "past-negative",
  "past-negative-polite",
  "te",
  "adverb",
  "ba",
  "tara",
  "prenominal",
  "stem",
];

/** Every word in the vocabulary this file can conjugate, with its class. */
export function conjugableWords() {
  const vocab = JSON.parse(readFileSync(VOCAB_PATH, "utf8"));
  const out = [];
  const seen = new Set();
  for (const w of vocab) {
    const { kind, special } = classify(w.pos ?? []);
    if (!kind) continue;
    const key = w.keb + " " + w.reb;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ keb: w.keb, reb: w.reb, kind, special });
  }
  return out;
}

/** The forms this file offers for a class. */
export function formsFor(kind) {
  return kind === "i-adj" || kind === "na-adj" ? ADJ_FORMS : VERB_FORMS;
}

function main() {
  const sampleAt = process.argv.indexOf("--sample");
  const limit = sampleAt === -1 ? Infinity : Number(process.argv[sampleAt + 1]);
  const rows = [];
  for (const w of conjugableWords().slice(0, limit)) {
    const forms = {};
    for (const form of formsFor(w.kind)) {
      const written = conjugate(w.keb, w.kind, w.special, form);
      const kana = conjugate(w.reb, w.kind, w.special, form);
      if (written === null && kana === null) continue;
      forms[form] = { written, kana };
    }
    rows.push({ ...w, forms });
  }
  process.stdout.write(JSON.stringify(rows, null, 1) + "\n");
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main();
