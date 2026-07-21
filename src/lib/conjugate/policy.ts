// ===========================================================================
// POLICY — *what may be conjugated at all*. Deliberately NOT in `rules.ts`.
//
// Rules say how to conjugate; policy says whether we should. These are
// different kinds of knowledge and they change at different rates:
//
//   - The rules of Japanese verb morphology are finished. They will not change.
//   - This file grows every time someone notices a bad output.
//
// Nothing in here is derivable from JMdict. JMdict has no defectiveness field,
// no "this tag isn't really a verb" field, and at least one outright bug. Every
// table below is knowledge we own permanently, so every entry carries a reason.
// ===========================================================================

import type { Form, WordClass } from "./types";

// ---------------------------------------------------------------------------
// FILTER 1 — tags that look like verb classes and are not.
//
// Passing any of these to conjugate() is refused rather than guessed at.
// ---------------------------------------------------------------------------

export const NOT_A_CONJUGATION_CLASS: Record<string, string> = {
  // THE big one. `vs` is the single most common "verb" tag in JMdict (~16,900
  // sense uses / 14,354 entries) and it is a NOUN MARKER, not a verb class.
  // 勉強 is tagged n + vs + vi/vt and carries NO conjugation class, because
  // what conjugates is する, not 勉強.
  //
  // Verified against the real JMdict: of 14,354 `vs` entries, ZERO carry a
  // conjugation class. So the filter is exact — there is no collision to
  // adjudicate. Conjugate these directly and you emit ~14k garbage forms
  // (勉強せられる and friends).
  //
  // BUT: refusing them does not mean ignoring them. 勉強して must still
  // resolve. The rule is "never conjugate a vs noun directly; compose する
  // onto it" — see `conjugateSuruNoun()` in index.ts. One composition rule,
  // no extra forms.
  vs: "Noun that takes する. Conjugate する, not the noun — use conjugateSuruNoun().",

  // 熟す(じゅくす), 期す, 座す. The classical precursor to する. 49 entries.
  // A modern drill has no use for it and its paradigm is not the する one.
  "vs-c": "Classical precursor to する (す). Archaic.",

  n: "Noun.",
  exp: "Expression. May *also* carry a real class — check for one first.",
  "adj-no": "Noun that takes の. Not an adjective paradigm.",
  "adj-f": "Prenominal-only. Does not conjugate.",
  "adj-pn": "Rentaishi (この, その). Does not conjugate.",
  "adj-t": "たる-adjective. Archaic paradigm.",
  vi: "Transitivity marker, not a class.",
  vt: "Transitivity marker, not a class.",
  "aux-v": "Auxiliary marker, not a class.",
};

// ---------------------------------------------------------------------------
// FILTER 2 — classical / archaic classes.
//
// 36 of JMdict's 59 verb tags are classical noise. A drill app needs 19.
// Split out from FILTER 1 because the reason is different: these ARE real
// conjugation classes, just not ones a learner of modern Japanese should be
// drilled on. If someone ever builds a classical-Japanese mode, this is the
// list to start from — which is exactly why it's data and not a regex.
// ---------------------------------------------------------------------------

export const ARCHAIC_CLASSES: Record<string, string> = {
  // 二段 (nidan) — the classical ancestors of modern 一段. 18 tags in use.
  "v2a-s": "Nidan, archaic.",
  "v2b-k": "Nidan, archaic.",
  "v2b-s": "Nidan, archaic.",
  "v2d-k": "Nidan, archaic.",
  "v2d-s": "Nidan, archaic.",
  "v2g-k": "Nidan, archaic.",
  "v2g-s": "Nidan, archaic.",
  "v2h-k": "Nidan, archaic.",
  "v2h-s": "Nidan, archaic.",
  "v2k-k": "Nidan, archaic.",
  "v2k-s": "Nidan, archaic.",
  "v2m-k": "Nidan, archaic.",
  "v2m-s": "Nidan, archaic.",
  "v2n-s": "Nidan, archaic.",
  "v2r-k": "Nidan, archaic.",
  "v2r-s": "Nidan, archaic.",
  "v2s-s": "Nidan, archaic.",
  "v2t-k": "Nidan, archaic.",
  "v2t-s": "Nidan, archaic.",
  "v2w-s": "Nidan, archaic.",
  "v2y-k": "Nidan, archaic.",
  "v2y-s": "Nidan, archaic.",
  "v2z-s": "Nidan, archaic.",
  // 四段 (yodan) — the classical ancestors of modern 五段. 9 tags.
  v4b: "Yodan, archaic.",
  v4g: "Yodan, archaic.",
  v4h: "Yodan, archaic.",
  v4k: "Yodan, archaic.",
  v4m: "Yodan, archaic.",
  v4n: "Yodan, archaic.",
  v4r: "Yodan, archaic.",
  v4s: "Yodan, archaic.",
  v4t: "Yodan, archaic.",
  // 'kari'/'ku'/'shiku'/'nari' adjectives — classical paradigms.
  "adj-kari": "Classical adjective.",
  "adj-ku": "Classical adjective.",
  "adj-shiku": "Classical adjective.",
  "adj-nari": "Classical na-adjective.",
  // Odds and ends.
  vr: "Irregular ru-verb, plain form ends -り (あり, 侍り). Classical. 10 entries.",
  vn: "Irregular nu-verb. 往ぬ only, and it also carries v5n which we DO handle.",
  v5uru: "Old form of -eru. Defined in the JMdict DTD but has ZERO uses. Dead tag.",
  "v-unspec": "Verb, class unspecified. Exactly 1 use in all of JMdict.",
};

// ---------------------------------------------------------------------------
// PATCH — upstream JMdict data that is simply wrong.
//
// Applied before anything else. Keyed by exact spelling + the class JMdict
// claims, so a future JMdict release that fixes the bug silently stops
// matching instead of double-patching.
// ---------------------------------------------------------------------------

export interface ClassPatch {
  word: string;
  from: string;
  to: WordClass;
  reason: string;
}

export const CLASS_PATCHES: ClassPatch[] = [
  // A real, verified JMdict bug. ござる is tagged v5r (with aux-v + vi) when
  // it is unmistakably v5aru — it's the textbook member of the class.
  // Generate from the tag as given and you emit ござります; the word is
  // ございます. (JMdict does carry a separate 御座ります entry marked `exp`,
  // which is the archaic form — so the bug isn't even self-consistent.)
  {
    word: "ござる",
    from: "v5r",
    to: "v5aru",
    reason: "JMdict upstream bug: tagged v5r, is v5aru. Naive gen emits ござります, not ございます.",
  },
  {
    word: "御座る",
    from: "v5r",
    to: "v5aru",
    reason: "Kanji spelling of ござる. Same upstream bug.",
  },
  // A second verified JMdict bug, found by running this engine over the whole
  // dictionary: 画餅に帰する is tagged v5s, but it ends in する and 帰する is a
  // vs-s verb. JMdict isn't even self-consistent here — the near-identical
  // 烏有に帰する IS tagged vs-s. Left unpatched, the v5s ending guard refuses
  // it (17 forms); patched, it conjugates correctly as 画餅に帰さない etc.
  {
    word: "画餅に帰する",
    from: "v5s",
    to: "vs-s",
    reason: "JMdict upstream bug: tagged v5s but ends in する. Sibling 烏有に帰する is vs-s.",
  },
];

// ---------------------------------------------------------------------------
// DEFECTIVENESS — forms that are mechanically derivable and do not exist.
//
// This is the list that matters most, and the one no data source will ever
// give us. JMdict has no defectiveness field, so it will happily let you
// generate ある -> 有れる and ある -> 有られる. Both are nonexistent. "Give me
// the potential of ある" is a drill that must never be generated, and the ONLY
// thing standing between the app and that prompt is this table.
//
// A generator that silently emits 有れる is worse than one that throws.
//
// This list is ours forever and it WILL grow. Add entries freely; each one
// needs a reason, not a vibe. `vi` (intransitive) was considered as a blunt
// lever for "no passive" and rejected — it's wrong (雨に降られる is intransitive
// and passive) and it would suppress thousands of good forms to catch a few
// bad ones.
// ---------------------------------------------------------------------------

export interface DefectiveRule {
  /** Exact spellings this applies to (kanji and kana forms both listed). */
  words: string[];
  forms: Form[];
  reason: string;
  /**
   * OPT-IN: also gate words BUILT ON this verb — である inherits ある's rule.
   *
   * Off by default, and it must stay that way. Turning it on means "a word
   * ending in these characters is a compound of this verb", which is true for
   * some stems and catastrophically false for others. The failure mode is not
   * a missing form; it is teaching a learner that a form of an ordinary verb
   * does not exist. So this is an explicit per-rule opt-in with a written
   * justification, not a general heuristic applied to the whole table.
   *
   * SAFE FOR ある. A Japanese verb ending in the -aru sound is written with a
   * consonant+あ kana: 始まる is ま+る, 終わる is わ+る, 分かる is か+る. A BARE
   * あ+る ending can essentially only be the verb ある standing on its own.
   * Verified against all 12,553 vocab rows: the only entries longer than ある
   * that end in ある are ことがある, である, でもある and 人気のある — every one
   * a genuine ある compound, zero false positives.
   *
   * SAFE FOR できる. One hit in the whole vocabulary, ことができる, which is a
   * genuine compound.
   *
   * NOT SAFE FOR いる — see the いる rule below, which deliberately omits this.
   */
  gatesCompounds?: boolean;
}

export const DEFECTIVE_WORDS: DefectiveRule[] = [
  {
    words: ["ある", "有る", "在る"],
    forms: ["potential", "passive", "causative", "causativePassive", "imperative", "teiru"],
    gatesCompounds: true,
    reason:
      "Existential verb. 有れる / 有られる do not exist — JMdict will generate them anyway. " +
      "No ている either: ある already states an ongoing state, so あっている is not used. " +
      "(Kept: volitional あろう, which is literary but genuinely attested — あろうことか.) " +
      "Applies to compounds too — である, ことがある, でもある. One honest caveat there: " +
      "the imperative であれ IS attested as a literary imperative (民主的であれ, 'be " +
      "democratic!'). It is gated not because it does not exist but because it is a " +
      "register a beginner cannot place, and shown unlabelled beside everyday forms it " +
      "teaches the wrong Japanese. であれる / であられる / でありたい are simply not words.",
  },
  {
    words: ["できる", "出来る"],
    forms: ["potential", "passive", "causative", "causativePassive", "imperative"],
    gatesCompounds: true,
    reason:
      "Already a potential. 出来られる is not a word, and neither is ことができろ. " +
      "(Kept: ている — できている 'is finished / is made of' is ordinary Japanese.)",
  },
  {
    words: ["見える"],
    forms: ["potential", "passive", "causativePassive"],
    reason: "Already a potential ('be visible'). 見えられる is not a word.",
  },
  {
    words: ["聞こえる"],
    forms: ["potential", "passive", "causativePassive"],
    reason: "Already a potential ('be audible'). 聞こえられる is not a word.",
  },
  {
    words: ["わかる", "分かる", "解る", "判る"],
    forms: ["potential", "imperative"],
    reason:
      "Already carries potential sense. 分かれる is a real word but it's 別れる ('to part') — " +
      "exactly the plausible-and-false output this list exists to stop.",
  },
  {
    // NO `gatesCompounds` HERE, AND IT MUST STAY THAT WAY.
    //
    // いる is the trap in this table. It has the harshest form list of any rule
    // — six forms, including volitional — and a pile of ordinary verbs merely
    // END in its characters without being built on it. In this vocabulary:
    //
    //   by written form: 悔いる 強いる 報いる 用いる 率いる 老いる まいる
    //   by reading only: 陥る(おちいる) 気に入る(きにいる) 手に入る(てにはいる)
    //                    射る(いる) 鋳る(いる) 入る(いる)
    //
    // 用いる (to use), 率いる (to lead), 陥る (to fall into), 強いる (to force)
    // are independent verbs. 用いられる and 率いられる are common, correct, and
    // useful. Switching this rule on would strip six forms from thirteen normal
    // verbs and teach a learner those forms do not exist — worse than the bug
    // that motivated compound matching in the first place.
    //
    // The last three are worse still: their READING is exactly いる, so any
    // future matcher that looks at readings rather than written forms would hit
    // them as EXACT matches, not even as suffixes. Match on the written form.
    words: ["いる", "要る"],
    forms: ["potential", "passive", "causative", "causativePassive", "imperative", "volitional"],
    reason: "要る ('to need'). 要れる does not exist.",
  },
  {
    words: ["ござる", "御座る"],
    forms: ["imperative", "potential", "passive", "causative", "causativePassive"],
    reason:
      "Humble copula. After the v5aru patch the い-stem imperative would give ござい; " +
      "the real imperative is ございませ. Nothing else in the paradigm is drillable.",
  },
];

/**
 * Class-wide defectiveness. The v5aru verbs are honorific/humble; their
 * potential and passive are either nonexistent or so marginal that asking a
 * learner for them is a bug, not a question. 仰れる is not a drill answer.
 */
export const DEFECTIVE_BY_CLASS: Partial<Record<WordClass, Form[]>> = {
  v5aru: ["potential", "passive", "causative", "causativePassive"],
};

// ---------------------------------------------------------------------------
// Which forms each class HAS. Verbs have no `prenominal`; adjectives have no
// `imperative`. Asking for one is refused as `form-not-in-class`.
// ---------------------------------------------------------------------------

const VERB_FORMS: Form[] = [
  "dictionary",
  "masu",
  "masuPast",
  "masuNegative",
  "te",
  "ta",
  "nai",
  "naiPast",
  "potential",
  "passive",
  "causative",
  "causativePassive",
  "imperative",
  "volitional",
  "ba",
  "tara",
  "tai",
  "teiru",
  "stem",
];

const ADJ_FORMS: Form[] = [
  "dictionary",
  "polite",
  "te",
  "ta",
  "nai",
  "naiPast",
  "ba",
  "tara",
  "stem",
  "adverb",
  "prenominal",
];

export const FORMS_BY_CLASS: Record<WordClass, Form[]> = {
  v5u: VERB_FORMS,
  v5k: VERB_FORMS,
  v5g: VERB_FORMS,
  v5s: VERB_FORMS,
  v5t: VERB_FORMS,
  v5n: VERB_FORMS,
  v5b: VERB_FORMS,
  v5m: VERB_FORMS,
  v5r: VERB_FORMS,
  v5aru: VERB_FORMS,
  "v5r-i": VERB_FORMS,
  "v5k-s": VERB_FORMS,
  "v5u-s": VERB_FORMS,
  v1: VERB_FORMS,
  "v1-s": VERB_FORMS,
  "vs-i": VERB_FORMS,
  "vs-s": VERB_FORMS,
  vk: VERB_FORMS,
  vz: VERB_FORMS,
  "adj-i": ADJ_FORMS,
  "adj-ix": ADJ_FORMS,
  "adj-na": ADJ_FORMS,
};
