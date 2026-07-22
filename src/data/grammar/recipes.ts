// ===========================================================================
// PATTERN RECIPES — the grammar subject's data. Tables, not prose.
//
// THE WHOLE IDEA
// ==============
// Most beginner grammar is: take a form the conjugation engine already
// generates, attach a fixed string. 〜てから is not knowledge to be explained,
// it is [V-て] + から. So a recipe is a FORM NAME and a SUFFIX, and the engine
// in src/lib/conjugate does the rest — including every 音便 irregularity, for
// free, for all 20,408 conjugatable entries.
//
// That is why this file is data and not lessons. The app's job, in the user's
// own words, is to hand you the inventory, not the taste:
//
//   "i don't need the app to teach me judgement. i need it to give me the
//    skills to make judgement calls. the judgement part comes from experience."
//
// So: `gloss` is a terse functional label, never an explanation. "after doing
// X", not a paragraph about when あとで feels more final than てから. Feel is
// shown on a cluster page and never asked (see clusters.ts). A gloss this
// terse is also a FACT about Japanese with almost no expressive room, which is
// what keeps this file free of anyone else's copyright.
//
// HOW MANY GRAMMAR POINTS ARE THERE?
// ==================================
// It is not a question with an answer, and this file is the argument for why
// that's fine. N5 alone is counted at 40, 84, 125 or 132 depending which
// vendor you ask — a 3.4x spread — and totals run 287 to 979. The JLPT
// published the only official list and then WITHDREW it in 2010, on the
// grounds that "publishing a list of items to memorize was not necessarily
// appropriate."
//
// The reason the vendors disagree is our own thesis, arriving from outside.
// One vendor lists ない形 as ONE entry covering ないでください / なければなり
// ません / なくてもいいです. Another splits it into three. Neither is wrong —
// they are answering different questions. It is exactly the 生-has-nine-
// readings problem that forced the entry/fact split in src/types/index.ts:
// "how many readings does 生 have" is unanswerable and ungradeable, and the
// fix was to stop asking and key the fact on something that IS gradeable.
//
// Here the same move works: we store RECIPES, each of which is independently
// askable, and "how many grammar points are there" stops being a question the
// app needs an answer to. It is the strongest outside validation the fact
// model has — the vendors' 3.4x disagreement is the model's failure case,
// observed in the wild, in a subject that had never heard of us.
//
// SPLIT PATTERNS
// ==============
// Where one vendor entry is really several facts, it is several rows here,
// each with its own id and gloss. て merges sequence/cause/request; から is
// reason vs source; られる is potential vs passive. Note that られる is
// ambiguous IN JAPANESE ITSELF, not merely in someone's list — 食べられる is
// genuinely both, and no amount of splitting fixes the sentence. Splitting the
// RECIPE is still right: they are two different things to know.
// ===========================================================================

import type { Form, WordClass } from "../../lib/conjugate/index.ts";

/** JLPT level, as vendors reckon it. See the header: this is opinion, not fact. */
export type Level = "N5" | "N4";

/**
 * What kind of word a recipe attaches to.
 *
 * Not the same axis as the engine's WordClass. The engine cares whether a word
 * is v5k or v1 (how to conjugate it); a recipe cares whether it is a verb, an
 * adjective or a noun (whether it may attach at all). 〜てから takes a verb and
 * does not care which conjugation class it is — that is the engine's problem,
 * already solved.
 */
export type Host = "verb" | "adj-i" | "adj-na" | "noun";

/**
 * One way of building a pattern: a form name and a suffix.
 *
 * `form: null` means "no conjugation at all" — attach to the bare word. That
 * is the noun case (本 + だけ), and it is also the marker of a VACUOUS recipe;
 * see `isVacuous`.
 *
 * `trim` mirrors the engine's own DerivedFormRule vocabulary on purpose: 〜な
 * ければならない is ない minus い plus ければならない, and spelling that as a
 * trim keeps it a table row instead of a special case.
 */
export interface Attachment {
  readonly host: Host;
  /** The form to attach to, or null for the bare word. */
  readonly form: Form | null;
  /** Text stripped off the end of the form's output before adding. */
  readonly trim?: string;
  readonly add: string;
}

export interface Recipe {
  /** Stable id. Never parsed — see src/lib/fact-id.ts. */
  readonly id: string;
  /** How the pattern is written, for display. 〜てから */
  readonly pattern: string;
  /**
   * An optional Japanese SENSE label for the pattern, for display only. Some
   * patterns share a bare `pattern` string but differ in sense (〜られる is both
   * 可能 and 受身; 〜から is both 理由 and 起点), and a few carry a sense even when
   * unambiguous (〜そう 様態 vs 〜そうだ 伝聞). Rendered beside the pattern at a
   * smaller/secondary size, never folded into `pattern` itself. Never parsed.
   */
  readonly sense?: string;
  /**
   * A terse FUNCTIONAL gloss. "after doing X". Never an explanation, never a
   * comparison to a sibling pattern — that is what the cluster page is for,
   * and it is shown, not asked.
   */
  readonly gloss: string;
  readonly level: Level;
  /** Every host the OPENING half attaches to, and how. */
  readonly attach: readonly Attachment[];
  /**
   * The CLOSING half, for a pattern that wraps around a slot. See `Wrap`.
   *
   * Absent on 77 of the 81 rows, and that is the shape of the subject rather
   * than an oversight: almost all beginner grammar hangs off the end of one
   * word. The four that don't are the reason this field exists.
   */
  readonly wrap?: Wrap;
  /** The cluster this belongs to, if any. See clusters.ts. */
  readonly cluster?: string;
  /**
   * Word- or class-specific overrides of the attachment's `add`. First match
   * wins; a `word` match beats a `cls` match only by being listed first.
   *
   * This exists because ONE recipe needed it and generated wrong Japanese
   * without it — see sou-appearance. Keep it that way: an exception here is a
   * confession that the template model doesn't reach, and each one should be
   * justified in the row's `note`.
   */
  readonly except?: readonly RecipeException[];
  /**
   * The recipe whose rule this row's NON-PRIMARY hosts reuse, so they do not get
   * production facts of their own. See `productionHosts` in ./index.ts.
   *
   * THE DEFAULT IS TO SPLIT, AND THIS IS THE OPT-OUT.
   * =================================================
   * A recipe that attaches to a verb AND to an adjective is usually two skills
   * wearing one row: 〜そう is [V-stem]+そう on 行く and "chop the い"+そう on
   * 高い, and knowing one does not give you the other. So by default each host
   * whose attachment actually transforms carries its own production fact, and
   * the drill can find out about them separately.
   *
   * Two rows are not like that, and this field is where they say so. 〜ても and
   * 〜てもいい on an い-adjective are te-cause's rule (い → くて) plus a fixed
   * string — 高くて, then も or もいい. Minting adjective facts for them would
   * score ONE rule three times and call the result three numbers, which is the
   * same error as scoring two rules once: a figure true of nothing. The owner
   * made this call on dakuten too — five row-level mnemonics, not twenty-five
   * per-kana ones.
   *
   * A recipe id rather than a boolean, because the claim being made is not "no
   * split here" but "that rule is already scored, THERE" — and a name can be
   * checked. A test asserts the named recipe exists, is producible, and really
   * does carry a fact for every host this row is handing off.
   */
  readonly sharedProductionWith?: string;
  /**
   * Which verbs this pattern will take, when the host is not the whole story.
   *
   * `host: "verb"` says the pattern hangs off a verb. For almost every row that
   * is the entire rule. 〜てある is not one of them: it means somebody did this
   * and it is still done, so it needs a verb somebody does TO something, and
   * 行ってある / 死んである / 来てある are not Japanese. Left unset, a recipe takes
   * any verb — the common case, and the honest default.
   *
   * The value is checked against JMdict's own vt/vi tags (see `transitivityOf`
   * in lib/grammar/vehicles.ts), not against a second hand-written list. The
   * dictionary already knows which verbs are which; this field is the recipe
   * saying which kind it wants, and it is the ONLY new fact here.
   *
   * A verb JMdict tags both ways (待つ, する) counts as transitive: a transitive
   * reading exists, which is what the pattern needs.
   */
  readonly transitivity?: Transitivity;
  /**
   * Verbs this pattern refuses, named one at a time.
   *
   * `transitivity` narrows by a KIND of verb and lets the dictionary settle
   * which verbs are in it — one field, thousands of words, no hand-kept list.
   * That is the right shape whenever a tag exists. This field is for the
   * restriction no tag encodes.
   *
   * 〜に行く is the one that needed it. It says where you are going and why, so
   * the why cannot be the going: 行きに行く and 来に行く are not Japanese, while
   * 遊びに行く and 泳ぎに行く are the most ordinary sentences in the pattern —
   * and those two are intransitive, so the axis is not transitivity and no
   * JMdict field separates them. Two verbs, named.
   *
   * KEEP IT SHORT. A long list here means the recipe wants a category the data
   * does not carry, and inventing categories in a hand-kept list is how the two
   * halves of the app come to disagree about what a pattern takes. Name the
   * exceptions; do not build a taxonomy.
   */
  readonly notOn?: readonly string[];
  /** Why this row is interesting/awkward. Engineering notes, not lessons. */
  readonly note?: string;
}

/**
 * Whether a verb is done TO something, or just happens.
 *
 * Named the way JMdict names it because it is JMdict's tag being carried, not a
 * new judgement. On screen it is never this word — see `TRANSITIVE_SLOT` in
 * lib/grammar/formula.ts and `INTRANSITIVE_NOTE` in lib/word-forms.ts, which
 * both say it in the words a learner has.
 */
export type Transitivity = "transitive" | "intransitive";

export interface RecipeException {
  /** Match the host's dictionary form exactly. */
  readonly word?: string;
  /** Match any word of this conjugation class. */
  readonly cls?: WordClass;
  /** Replaces the attachment's `add`. */
  readonly add: string;
}

/**
 * The closing half of a pattern that WRAPS AROUND A SLOT.
 *
 * 〜は〜より is not "a noun plus は". It is two particles with the compared
 * thing between them, and storing only the first half stored half a fact. The
 * `〜` in a pattern string is the placeholder for a slot: a leading one is the
 * normal case ("hangs off a word"), and a SECOND one means there is a word in
 * the middle that the recipe has to reach past.
 *
 * The closing half is just another `Attachment`, deliberately — it has its own
 * host, its own form, its own trim, its own add, and it needs all four. 〜しか
 * 〜ない OPENS on a noun and CLOSES on a verb's ない form (本しか読まない), so a
 * closing half that inherited the opening's host could not express it.
 *
 * WHAT THIS DOES NOT BUY
 * ======================
 * Expressible is not askable. A wrap has two slots, so a production question
 * would have to supply two words, and whether the pair yields ONE right answer
 * is a separate question answered per pattern — see `isOrderFree` and
 * `notProduced`. All four wraps in the table are reference-only today, each
 * for its own reason, and the reasons are carried here rather than in prose.
 */
export interface Wrap {
  /** Every host the closing half attaches to, and how. */
  readonly close: readonly Attachment[];
  /**
   * Why this wrap is not produced, when the computed gates do NOT already rule
   * it out — i.e. it conjugates something and its slots cannot swap, and it is
   * still not a question. A sentence, because a boolean would not say why.
   *
   * Present on exactly one row (shika-nai), and the fact it records is about
   * DATA, not about this model: see that row's note.
   */
  readonly notProduced?: string;
}

/**
 * Is this recipe vacuous — i.e. is asking it to be PRODUCED not a question?
 *
 * "Give me the ことができる form of 食べる" is 食べる + ことができる. The user
 * types the word back plus a fixed string. Nothing was conjugated, so nothing
 * was tested. That is typing, not a drill.
 *
 * Computed, not hand-marked, so it cannot drift from the data it describes: a
 * recipe is vacuous exactly when no attachment transforms its host. Note this
 * is a claim about the PRODUCTION question only — a vacuous recipe can still
 * carry a perfectly good meaning fact, and can still appear as a distractor in
 * a SELECTION question. It just must not be asked "now you build it".
 *
 * BOTH HALVES COUNT. 〜しか〜ない attaches しか to a bare noun and would read as
 * vacuous on its opening half alone — but its closing half conjugates 読む to
 * 読まない, and that is a real transformation. A wrap is vacuous only when
 * NEITHER end does any work, which is exactly the two comparison rows.
 */
export function isVacuous(r: Recipe): boolean {
  return r.attach.every(isTrivialAttachment) && (r.wrap?.close ?? []).every(isTrivialAttachment);
}

/**
 * Does this attachment leave its host ALONE — bare word or dictionary form, no
 * trim — so that building it is retyping the word plus a fixed string?
 *
 * Lifted out of `isVacuous`, which used to hold it as a local, because a second
 * caller needs the SAME predicate and a copy would be a bug waiting: example.ts
 * picks which host a recipe's production is baked on, and "the one that isn't
 * trivial" is exactly this test. Keeping one definition is what makes the two
 * agree by construction rather than by review.
 *
 * The bug that made this necessary: 〜ので attaches to a verb's dictionary form
 * (行く + ので — trivial) and to an adj-na's PRENOMINAL form (静か → 静かな +
 * ので — not). It therefore passes `isVacuous`, correctly, on the strength of
 * its adjective half — and then baked its example on the verb, because that was
 * simply first in the host order. The shipped question was "行く · 〜ので form"
 * → 行くので, i.e. retyping: the exact item `isVacuous` exists to prevent,
 * reached through the one door nobody was watching.
 */
export function isTrivialAttachment(a: Attachment): boolean {
  return (a.form === null || a.form === "dictionary") && !a.trim;
}

/**
 * Can the wrap's two slots be swapped and still be right?
 *
 * If they can, the pattern has no single correct answer and therefore is not a
 * production question — 食べたり読んだりする and 読んだり食べたりする are BOTH
 * correct, so an item prompting (食べる, 読む) and grading one string would mark
 * correct Japanese wrong. That is the failure は/が cloze was killed for, and
 * it does not become acceptable for arriving through a different door.
 *
 * The structural test: the two slots are interchangeable exactly when they take
 * the same host in the same form, because then either word could fill either
 * slot. 〜たり〜たり is verb-た / verb-た and so is a LIST — order-free by
 * construction. 〜しか〜ない is noun / verb-ない, so its slots cannot swap: 本 has
 * nowhere else to go.
 *
 * Computed, like `isVacuous` and for the same reason — a hand-marked flag here
 * would be a claim about the table that the table could quietly outgrow.
 */
export function isOrderFree(r: Recipe): boolean {
  const close = r.wrap?.close ?? [];
  if (close.length === 0) return false;
  return close.some((c) => r.attach.some((a) => a.host === c.host && a.form === c.form));
}

// ---------------------------------------------------------------------------
// THE TABLE.
//
// Grouped by what the pattern DOES, because that is how a cluster forms and
// clusters are the thing the user actually needs (7 ways to say "must").
// Within a group, N5 before N4.
// ---------------------------------------------------------------------------

export const RECIPES: readonly Recipe[] = [
  // --- て-form: three different things wearing one coat --------------------
  // The classic "one vendor entry, several facts" case. A textbook teaches
  // "the て-form" once; it is at least three unrelated jobs, and a learner who
  // knows the て-form still does not know any of them.
  {
    id: "te-request",
    pattern: "〜てください",
    gloss: "please do X",
    level: "N5",
    attach: [{ host: "verb", form: "te", add: "ください" }],
  },
  {
    id: "te-sequence",
    pattern: "〜て",
    gloss: "do X, and then",
    level: "N5",
    attach: [{ host: "verb", form: "te", add: "" }],
    note:
      "Bare て. Same string as te-cause and te-request, different job — which " +
      "is why they are three rows. A SELECTION question can never distinguish " +
      "these three from the blank alone; only production is honest here.",
  },
  {
    id: "te-cause",
    pattern: "〜て",
    gloss: "because X (unintentional)",
    level: "N4",
    attach: [
      { host: "verb", form: "te", add: "" },
      { host: "adj-i", form: "te", add: "" },
      { host: "adj-na", form: "te", add: "" },
    ],
    note: "遅れて / 寒くて / 静かで. See te-sequence.",
  },
  {
    id: "te-permission",
    pattern: "〜てもいい",
    gloss: "may do X",
    level: "N5",
    attach: [
      { host: "verb", form: "te", add: "もいい" },
      { host: "adj-i", form: "te", add: "もいい" },
    ],
    sharedProductionWith: "te-cause",
    note:
      "NO adjective production fact of its own, and that asymmetry is a " +
      "decision rather than an oversight — see sharedProductionWith. 高くても" +
      "いい is te-cause's rule (高い → 高くて) plus もいい, and te-cause already " +
      "scores that rule on the adj-i host. Its verb half DOES get its own fact: " +
      "行く → 行って is the て-form's 音便, which is a real transformation and " +
      "the thing the item measures.",
  },
  {
    id: "te-prohibition",
    pattern: "〜てはいけない",
    gloss: "must not do X",
    level: "N5",
    attach: [{ host: "verb", form: "te", add: "はいけない" }],
  },
  {
    id: "te-kara",
    pattern: "〜てから",
    gloss: "after doing X",
    level: "N5",
    cluster: "after",
    attach: [{ host: "verb", form: "te", add: "から" }],
  },
  {
    id: "te-iru",
    pattern: "〜ている",
    gloss: "is doing X / is in the state of X",
    level: "N5",
    attach: [{ host: "verb", form: "te", add: "いる" }],
    note:
      "The engine already exposes this as the `teiru` form; it is restated as " +
      "a recipe because the user meets it as a pattern, not as a form. Both " +
      "spellings agree by construction — teiru IS te + いる in DERIVED_FORMS.",
  },
  {
    id: "te-shimau",
    pattern: "〜てしまう",
    gloss: "do X completely / do X regrettably",
    level: "N4",
    attach: [{ host: "verb", form: "te", add: "しまう" }],
  },
  {
    id: "te-miru",
    pattern: "〜てみる",
    gloss: "try doing X",
    level: "N4",
    attach: [{ host: "verb", form: "te", add: "みる" }],
  },
  {
    id: "te-oku",
    pattern: "〜ておく",
    gloss: "do X in advance",
    level: "N4",
    attach: [{ host: "verb", form: "te", add: "おく" }],
  },
  {
    id: "te-aru",
    pattern: "〜てある",
    gloss: "has been done (and stays done)",
    level: "N4",
    attach: [{ host: "verb", form: "te", add: "ある" }],
    transitivity: "transitive",
    note:
      "The only row in the table that restricts its verb. 〜てある is somebody " +
      "did it and it is still done, so it needs a verb somebody does to " +
      "something: 書いてある, not 行ってある. Its sibling 〜ている takes both kinds " +
      "(食べている, 開いている) and is deliberately left unrestricted — the " +
      "contrast between them is the thing worth seeing, and restricting both " +
      "would erase it.",
  },
  {
    id: "te-iku",
    pattern: "〜ていく",
    gloss: "go on doing X / X from now on",
    level: "N4",
    attach: [{ host: "verb", form: "te", add: "いく" }],
  },
  {
    id: "te-kuru",
    pattern: "〜てくる",
    gloss: "come to do X / X up to now",
    level: "N4",
    attach: [{ host: "verb", form: "te", add: "くる" }],
  },
  {
    id: "te-ageru",
    pattern: "〜てあげる",
    gloss: "do X for someone",
    level: "N4",
    attach: [{ host: "verb", form: "te", add: "あげる" }],
  },
  {
    id: "te-kureru",
    pattern: "〜てくれる",
    gloss: "someone does X for me",
    level: "N4",
    attach: [{ host: "verb", form: "te", add: "くれる" }],
  },
  {
    id: "te-morau",
    pattern: "〜てもらう",
    gloss: "have someone do X",
    level: "N4",
    attach: [{ host: "verb", form: "te", add: "もらう" }],
  },
  {
    id: "te-mo",
    pattern: "〜ても",
    gloss: "even if X",
    level: "N4",
    attach: [
      { host: "verb", form: "te", add: "も" },
      { host: "adj-i", form: "te", add: "も" },
    ],
    sharedProductionWith: "te-cause",
    note:
      "Same call as te-permission, for the same reason: 高くても is te-cause's " +
      "い → くて plus も, and one rule scored three times across 〜て, 〜ても and " +
      "〜てもいい would be three numbers about one skill.",
  },

  // --- ない-form ----------------------------------------------------------
  {
    id: "nai-request",
    pattern: "〜ないでください",
    gloss: "please don't do X",
    level: "N5",
    attach: [{ host: "verb", form: "nai", add: "でください" }],
  },
  {
    id: "nai-de",
    pattern: "〜ないで",
    gloss: "without doing X",
    level: "N4",
    attach: [{ host: "verb", form: "nai", add: "で" }],
  },
  {
    id: "nakute-mo-ii",
    pattern: "〜なくてもいい",
    gloss: "don't have to do X",
    level: "N5",
    attach: [{ host: "verb", form: "nai", trim: "い", add: "くてもいい" }],
  },
  {
    id: "nakereba-naranai",
    pattern: "〜なければならない",
    gloss: "must do X",
    level: "N4",
    cluster: "obligation",
    attach: [{ host: "verb", form: "nai", trim: "い", add: "ければならない" }],
  },
  {
    id: "nakereba-ikenai",
    pattern: "〜なければいけない",
    gloss: "must do X",
    level: "N4",
    cluster: "obligation",
    attach: [{ host: "verb", form: "nai", trim: "い", add: "ければいけない" }],
  },
  {
    id: "nakute-wa-naranai",
    pattern: "〜なくてはならない",
    gloss: "must do X",
    level: "N4",
    cluster: "obligation",
    attach: [{ host: "verb", form: "nai", trim: "い", add: "くてはならない" }],
  },
  {
    id: "nakute-wa-ikenai",
    pattern: "〜なくてはいけない",
    gloss: "must do X",
    level: "N4",
    cluster: "obligation",
    attach: [{ host: "verb", form: "nai", trim: "い", add: "くてはいけない" }],
  },
  {
    id: "nakucha",
    pattern: "〜なくちゃ",
    gloss: "must do X",
    level: "N4",
    cluster: "obligation",
    attach: [{ host: "verb", form: "nai", trim: "い", add: "くちゃ" }],
    note: "Spoken contraction of なくては. Same gloss as its six siblings — see clusters.ts.",
  },
  {
    id: "nakya",
    pattern: "〜なきゃ",
    gloss: "must do X",
    level: "N4",
    cluster: "obligation",
    attach: [{ host: "verb", form: "nai", trim: "い", add: "きゃ" }],
    note: "Spoken contraction of なければ.",
  },
  {
    id: "nai-to-ikenai",
    pattern: "〜ないといけない",
    gloss: "must do X",
    level: "N4",
    cluster: "obligation",
    attach: [{ host: "verb", form: "nai", add: "といけない" }],
  },
  {
    id: "nai-hou-ga-ii",
    pattern: "〜ないほうがいい",
    gloss: "had better not do X",
    level: "N4",
    attach: [{ host: "verb", form: "nai", add: "ほうがいい" }],
  },

  // --- た-form ------------------------------------------------------------
  {
    id: "ta-koto-ga-aru",
    pattern: "〜たことがある",
    gloss: "have done X before",
    level: "N5",
    attach: [{ host: "verb", form: "ta", add: "ことがある" }],
  },
  {
    id: "ta-ato-de",
    pattern: "〜たあとで",
    gloss: "after doing X",
    level: "N5",
    cluster: "after",
    attach: [{ host: "verb", form: "ta", add: "あとで" }],
    note:
      "CORPUS-SCARCE. Only 9 Tatoeba sentences at <=10 tokens: learners write " +
      "、where a textbook writes で. Needs hand-authored examples; see " +
      "src/data/grammar/examples.ts.",
  },
  {
    id: "ta-hou-ga-ii",
    pattern: "〜たほうがいい",
    gloss: "had better do X",
    level: "N5",
    attach: [{ host: "verb", form: "ta", add: "ほうがいい" }],
  },
  {
    id: "ta-bakari",
    pattern: "〜たばかり",
    gloss: "just did X",
    level: "N4",
    cluster: "just-happened",
    attach: [{ host: "verb", form: "ta", add: "ばかり" }],
  },
  {
    id: "ta-tokoro",
    pattern: "〜たところ",
    gloss: "just did X",
    level: "N4",
    cluster: "just-happened",
    attach: [{ host: "verb", form: "ta", add: "ところ" }],
  },
  {
    id: "tari-tari",
    pattern: "〜たり〜たり",
    gloss: "do things like X and Y",
    level: "N5",
    attach: [{ host: "verb", form: "ta", add: "り" }],
    wrap: { close: [{ host: "verb", form: "ta", add: "りする" }] },
    note:
      "CORPUS-SCARCE, structurally. Needs TWO verbs in the frame, so the " +
      "<=14-token filter bites hardest exactly here. Hand-authored examples. " +
      "The scarcity and the unaskability have the SAME cause, which is why " +
      "the thin corpus was the tell: two verbs in one frame is what the " +
      "filter drops, and two verbs in one frame is what makes this a LIST — " +
      "and a list has no order, so it has no single right answer. Before the " +
      "wrap existed this row was drillable and produced 行ったり as the whole " +
      "answer to 〜たり〜たり, which would have marked 行ったり読んだりする " +
      "wrong. isOrderFree now says no, and says it from the table.",
  },

  // --- stem (連用形) -------------------------------------------------------
  {
    id: "nagara",
    pattern: "〜ながら",
    gloss: "while doing X",
    level: "N4",
    attach: [{ host: "verb", form: "stem", add: "ながら" }],
  },
  {
    id: "sugiru",
    pattern: "〜すぎる",
    gloss: "do X too much / too X",
    level: "N4",
    attach: [
      { host: "verb", form: "stem", add: "すぎる" },
      { host: "adj-i", form: "stem", add: "すぎる" },
      { host: "adj-na", form: "stem", add: "すぎる" },
    ],
    note: "The adjective host is why the engine's adjective `stem` is 高 and not 高く.",
  },
  {
    id: "yasui",
    pattern: "〜やすい",
    gloss: "easy to X",
    level: "N4",
    attach: [{ host: "verb", form: "stem", add: "やすい" }],
  },
  {
    id: "nikui",
    pattern: "〜にくい",
    gloss: "hard to X",
    level: "N4",
    cluster: "hard-to-do",
    attach: [{ host: "verb", form: "stem", add: "にくい" }],
  },
  {
    id: "zurai",
    pattern: "〜づらい",
    gloss: "hard to X",
    level: "N4",
    cluster: "hard-to-do",
    attach: [{ host: "verb", form: "stem", add: "づらい" }],
  },
  {
    id: "kata",
    pattern: "〜方",
    gloss: "how to X / way of doing X",
    level: "N4",
    attach: [{ host: "verb", form: "stem", add: "方" }],
    notOn: ["する", "来る"],
    note:
      "〜方 builds a COMPOUND NOUN off the masu-stem — 食べ方, 読み方 — and off a " +
      "regular verb that is a real word. The two irregulars are not: this recipe " +
      "can only spell する's way-of-doing as し方 off the phonetic stem, but the " +
      "word is 仕方 (しかた, in VOCAB), and 来る's 来方 (きかた) is rare-to-nonstandard. " +
      "Both BUILD — the conjugation is fine, it is the lexeme that is wrong, which " +
      "is the one thing apply() cannot see — so without naming them the drill dealt " +
      "し方 and 来方 and graded them correct. Named here rather than checked against " +
      "VOCAB because 食べ方/行き方 are real words that VOCAB does not carry, so " +
      "membership cannot tell a real 方-word from a non-word. Same shape as 〜に行く.",
  },
  {
    id: "ni-iku",
    pattern: "〜に行く",
    gloss: "go in order to X",
    level: "N5",
    attach: [{ host: "verb", form: "stem", add: "に行く" }],
    notOn: ["行く", "来る"],
    note:
      "The pattern's slot is the ERRAND, and going is not an errand you go on. " +
      "行く leads the vehicle pool everywhere else, so this row led with " +
      "行きに行く — not strained, not Japanese. 来に行く the same. Both named in " +
      "`notOn` rather than filtered by a tag, because 遊びに行く and 泳ぎに行く are " +
      "the pattern at its most ordinary and both verbs are intransitive: there is " +
      "no dictionary field that separates a motion verb from the rest.",
  },
  {
    id: "sou-appearance",
    pattern: "〜そう",
    sense: "様態",
    gloss: "looks like it will X / looks X",
    level: "N4",
    cluster: "seems",
    attach: [
      { host: "verb", form: "stem", add: "そう" },
      { host: "adj-i", form: "stem", add: "そう" },
      { host: "adj-na", form: "stem", add: "そう" },
    ],
    except: [
      // THE さ-INSERTION. An い-adjective whose stem is a single mora takes さ
      // before そう: いい -> よさそう, ない -> なさそう. Without this the recipe
      // emits よそう, which is not merely wrong, it is a DIFFERENT WORD (予想,
      // "a forecast"). Caught by running the table against real vocabulary.
      //
      // Matching on the CLASS is what makes this safe. The tempting rule —
      // "ends with ない" — silently breaks 汚い, 危ない, 少ない (きたなそう is
      // correct, きたなさそう is not); their stems are three morae, not one.
      // adj-ix is exactly the いい/よい family and nothing else, so it carries
      // the compounds (気持ちいい -> 気持ちよさそう) for free.
      { cls: "adj-ix", add: "さそう" },
      // ない and 無い are tagged adj-i, so they need naming outright. They are
      // the only adj-i entries with a one-mora stem.
      { word: "ない", add: "さそう" },
      { word: "無い", add: "さそう" },
    ],
    note:
      "SPLIT from sou-hearsay, and the split is real rather than editorial: " +
      "the ATTACHMENT differs. 降りそう (stem) 'looks like rain' vs 降るそうだ " +
      "(plain) 'I hear it'll rain'. Different string, different meaning — the " +
      "one member of the そう family that a machine can tell apart. " +
      "Carries the only `except` table in the file; see it.",
  },
  {
    id: "tai",
    pattern: "〜たい",
    gloss: "want to X",
    level: "N5",
    attach: [{ host: "verb", form: "stem", add: "たい" }],
    note: "Also exposed as the engine's `tai` form; the two agree by construction.",
  },

  // --- ます-form ----------------------------------------------------------
  {
    id: "mashou",
    pattern: "〜ましょう",
    gloss: "let's X",
    level: "N5",
    attach: [{ host: "verb", form: "masu", trim: "ます", add: "ましょう" }],
  },
  {
    id: "masen-ka",
    pattern: "〜ませんか",
    gloss: "won't you X? (invitation)",
    level: "N5",
    attach: [{ host: "verb", form: "masu", trim: "ます", add: "ませんか" }],
  },
  {
    id: "mashou-ka",
    pattern: "〜ましょうか",
    gloss: "shall I X?",
    level: "N5",
    attach: [{ host: "verb", form: "masu", trim: "ます", add: "ましょうか" }],
  },

  // --- dictionary form ----------------------------------------------------
  // Most of these are VACUOUS as production questions — see isVacuous. They
  // are kept because their MEANING is still a fact, and because they are
  // indispensable as SELECTION distractors.
  {
    id: "koto-ga-dekiru",
    pattern: "〜ことができる",
    gloss: "can do X",
    level: "N5",
    cluster: "ability",
    attach: [{ host: "verb", form: "dictionary", add: "ことができる" }],
  },
  {
    id: "mae-ni",
    pattern: "〜前に",
    gloss: "before doing X",
    level: "N5",
    attach: [{ host: "verb", form: "dictionary", add: "前に" }],
  },
  {
    id: "tsumori",
    pattern: "〜つもり",
    gloss: "intend to X",
    level: "N5",
    attach: [{ host: "verb", form: "dictionary", add: "つもり" }],
  },
  {
    id: "koto-ni-suru",
    pattern: "〜ことにする",
    gloss: "decide to X",
    level: "N4",
    attach: [{ host: "verb", form: "dictionary", add: "ことにする" }],
  },
  {
    id: "koto-ni-naru",
    pattern: "〜ことになる",
    gloss: "it is decided that X",
    level: "N4",
    attach: [{ host: "verb", form: "dictionary", add: "ことになる" }],
  },
  {
    id: "to-omou",
    pattern: "〜と思う",
    gloss: "think that X",
    level: "N5",
    attach: [{ host: "verb", form: "dictionary", add: "と思う" }],
  },
  {
    id: "hazu",
    pattern: "〜はず",
    gloss: "is supposed to X",
    level: "N4",
    attach: [{ host: "verb", form: "dictionary", add: "はず" }],
  },
  {
    id: "tokoro",
    pattern: "〜ところ",
    gloss: "about to X",
    level: "N4",
    attach: [{ host: "verb", form: "dictionary", add: "ところ" }],
  },

  // --- potential / passive: ambiguous in Japanese, not just in the list ----
  {
    id: "potential",
    pattern: "〜られる",
    sense: "可能",
    gloss: "can do X",
    level: "N4",
    cluster: "ability",
    attach: [{ host: "verb", form: "potential", add: "" }],
    note:
      "SPLIT from passive, and unlike sou the split does NOT rescue the " +
      "sentence: for every ichidan verb the two forms are the SAME STRING " +
      "(食べられる is both 'can eat' and 'is eaten'). The ambiguity is in " +
      "Japanese itself. Splitting the recipe is still correct — they are two " +
      "things to know — but no SELECTION item may ever ask a learner to pick " +
      "between these two for a v1 verb, because there is no fact of the matter.",
  },
  {
    id: "passive",
    pattern: "〜られる",
    sense: "受身",
    gloss: "is X-ed (by someone)",
    level: "N4",
    attach: [{ host: "verb", form: "passive", add: "" }],
    transitivity: "transitive",
    note:
      "See potential. The restriction is what the GLOSS already says: 'is X-ed " +
      "(by someone)' needs something for it to be done to. 行く has nothing, so " +
      "行かれる is not 'is gone' — it is the OTHER passive, the one that says " +
      "somebody went and it put you out (友達に行かれた), plus a light honorific. " +
      "Leading a page glossed 'is X-ed' with 行かれる taught that first passive as " +
      "if it were this one. 書かれる is the model and now leads. The adversative is " +
      "a real pattern and a real gap; it needs its own row and its own gloss, not " +
      "a shared line with this one.",
  },
  {
    id: "causative",
    pattern: "〜させる",
    gloss: "make/let someone X",
    level: "N4",
    attach: [{ host: "verb", form: "causative", add: "" }],
  },
  {
    id: "causative-passive",
    pattern: "〜させられる",
    gloss: "be made to X",
    level: "N4",
    attach: [{ host: "verb", form: "causativePassive", add: "" }],
  },

  // --- volitional ---------------------------------------------------------
  {
    id: "you-to-omou",
    pattern: "〜(よ)うと思う",
    gloss: "am thinking of X-ing",
    level: "N4",
    attach: [{ host: "verb", form: "volitional", add: "と思う" }],
  },

  // --- conditionals: four ways, glossed the same ---------------------------
  {
    id: "ba",
    pattern: "〜ば",
    gloss: "if X",
    level: "N4",
    cluster: "conditionals",
    attach: [
      { host: "verb", form: "ba", add: "" },
      { host: "adj-i", form: "ba", add: "" },
    ],
  },
  {
    id: "tara",
    pattern: "〜たら",
    gloss: "if/when X",
    level: "N5",
    cluster: "conditionals",
    attach: [
      { host: "verb", form: "tara", add: "" },
      { host: "adj-i", form: "tara", add: "" },
      { host: "adj-na", form: "tara", add: "" },
    ],
  },
  {
    id: "to-conditional",
    pattern: "〜と",
    gloss: "whenever X, Y",
    level: "N4",
    cluster: "conditionals",
    attach: [{ host: "verb", form: "dictionary", add: "と" }],
  },
  {
    id: "nara",
    pattern: "〜なら",
    gloss: "if it's the case that X",
    level: "N4",
    cluster: "conditionals",
    attach: [
      { host: "noun", form: null, add: "なら" },
      { host: "verb", form: "dictionary", add: "なら" },
    ],
  },

  // --- reason: から vs ので (and から's other job) -------------------------
  {
    id: "kara-reason",
    pattern: "〜から",
    sense: "理由",
    gloss: "because X",
    level: "N5",
    cluster: "because",
    attach: [
      { host: "verb", form: "dictionary", add: "から" },
      { host: "adj-i", form: "dictionary", add: "から" },
    ],
    note: "SPLIT from kara-source. Same string, unrelated jobs.",
  },
  {
    id: "kara-source",
    pattern: "〜から",
    sense: "起点",
    gloss: "from X",
    level: "N5",
    attach: [{ host: "noun", form: null, add: "から" }],
    note: "SPLIT from kara-reason. 東京から — a starting point, not a reason.",
  },
  {
    id: "node",
    pattern: "〜ので",
    gloss: "because X",
    level: "N5",
    cluster: "because",
    attach: [
      { host: "verb", form: "dictionary", add: "ので" },
      { host: "adj-i", form: "dictionary", add: "ので" },
      { host: "adj-na", form: "prenominal", add: "ので" },
    ],
    note:
      "静かなので — the adj-na host needs the prenominal な, not the bare stem. " +
      "THE adj-i ROW IS NOT AN ODD ONE OUT. 高いので is plain form + ので, the " +
      "same attachment the verb takes, and it was missing purely because this " +
      "note explained the な and nobody noticed it did not explain the absence. " +
      "It adds no production fact — plain form + a fixed string is retyping, " +
      "exactly as the verb row is — but the cluster page now prints it, and " +
      "a table that stops at 行くので / 静かなので implies い-adjectives cannot " +
      "take ので, which is false.",
  },
  {
    id: "noni",
    pattern: "〜のに",
    gloss: "even though X",
    level: "N4",
    attach: [{ host: "verb", form: "dictionary", add: "のに" }],
  },
  {
    id: "shi",
    pattern: "〜し",
    gloss: "X, and what's more",
    level: "N4",
    attach: [{ host: "verb", form: "dictionary", add: "し" }],
  },

  // --- evidentials: the "seems" family ------------------------------------
  {
    id: "sou-hearsay",
    pattern: "〜そうだ",
    sense: "伝聞",
    gloss: "I hear that X",
    level: "N4",
    cluster: "seems",
    attach: [
      { host: "verb", form: "dictionary", add: "そうだ" },
      { host: "adj-i", form: "dictionary", add: "そうだ" },
    ],
    note: "SPLIT from sou-appearance by ATTACHMENT — see that row.",
  },
  {
    id: "you-da",
    pattern: "〜ようだ",
    gloss: "seems that X",
    level: "N4",
    cluster: "seems",
    attach: [
      { host: "verb", form: "dictionary", add: "ようだ" },
      { host: "noun", form: null, add: "のようだ" },
    ],
    note:
      "THE REGEX TRAP. A regex for ようだ scores 5,290 corpus hits against a " +
      "morphological truth of 728 — an 86% false-positive rate, silent. に " +
      "carries lemma だ in UniDic, so every ように matched. This row is why " +
      "the corpus filter is fugashi and not a pattern match.",
  },
  {
    id: "rashii",
    pattern: "〜らしい",
    gloss: "apparently X",
    level: "N4",
    cluster: "seems",
    attach: [
      { host: "verb", form: "dictionary", add: "らしい" },
      { host: "noun", form: null, add: "らしい" },
    ],
  },
  {
    id: "kamoshirenai",
    pattern: "〜かもしれない",
    gloss: "might be X",
    level: "N4",
    cluster: "seems",
    attach: [
      { host: "verb", form: "dictionary", add: "かもしれない" },
      { host: "noun", form: null, add: "かもしれない" },
    ],
  },
  {
    id: "deshou",
    pattern: "〜でしょう",
    gloss: "probably X",
    level: "N5",
    cluster: "seems",
    attach: [
      { host: "verb", form: "dictionary", add: "でしょう" },
      { host: "noun", form: null, add: "でしょう" },
    ],
  },

  // --- comparison ---------------------------------------------------------
  {
    id: "hou-ga-yori",
    pattern: "〜のほうが〜より",
    gloss: "X is more ... than Y",
    level: "N5",
    cluster: "comparison",
    attach: [{ host: "noun", form: null, add: "のほうが" }],
    wrap: { close: [{ host: "noun", form: null, add: "より" }] },
    note:
      "A wrap, and it was stored as its opening half alone until the model " +
      "could hold the rest. Reference-only for the same reason as wa-yori.",
  },
  {
    id: "wa-yori",
    pattern: "〜は〜より",
    gloss: "X is more ... than Y",
    level: "N5",
    cluster: "comparison",
    attach: [{ host: "noun", form: null, add: "は" }],
    wrap: { close: [{ host: "noun", form: null, add: "より" }] },
    note:
      "VACUOUS as production, and the clearest example of why isVacuous " +
      "exists: 'give me the は form of 私' is not a question, it is typing. " +
      "The wrap does not change that — two bare nouns and two particles is " +
      "still typing, now at twice the length.",
  },

  // --- particles: the ALLOWLIST ------------------------------------------
  // These ship as SELECTION items only in marked frames, and the allowlist is
  // the whole safety mechanism. See selection.ts for the argument; the short
  // version is that は/が cloze was verified dead across 660,343 particle
  // slots and is not here, and never will be.
  {
    id: "wo",
    pattern: "を",
    gloss: "marks the direct object",
    level: "N5",
    attach: [{ host: "noun", form: null, add: "を" }],
  },
  {
    id: "e",
    pattern: "へ",
    gloss: "toward (direction)",
    level: "N5",
    attach: [{ host: "noun", form: null, add: "へ" }],
  },
  {
    id: "made",
    pattern: "まで",
    gloss: "until / as far as",
    level: "N5",
    attach: [{ host: "noun", form: null, add: "まで" }],
  },
  {
    id: "made-ni",
    pattern: "までに",
    gloss: "by (a deadline)",
    level: "N4",
    attach: [{ host: "noun", form: null, add: "までに" }],
  },
  {
    id: "dake",
    pattern: "だけ",
    gloss: "only",
    level: "N5",
    attach: [{ host: "noun", form: null, add: "だけ" }],
  },
  {
    id: "shika-nai",
    pattern: "〜しか〜ない",
    gloss: "only X (nothing but)",
    level: "N4",
    attach: [{ host: "noun", form: null, add: "しか" }],
    wrap: {
      close: [{ host: "verb", form: "nai", add: "" }],
      notProduced:
        "The noun slot's particle depends on the VERB, and nothing in this " +
        "app knows which verb takes which.",
    },
    note:
      "The only wrap the computed gates DON'T rule out, and the one worth " +
      "reading closely. Its slots cannot swap (noun, then verb) and its " +
      "closing half really conjugates — 読む → 読まない — so it is a real " +
      "drill in shape. It is still not asked, for a reason about DATA: しか " +
      "REPLACES を but sits on TOP of に. 本しか読まない is right; a generator " +
      "reaching for a に-verb would emit 学校しか行かない, where 学校にしか行かない " +
      "is the sentence. Picking the pair needs to know what the verb takes, " +
      "which is a fact this app does not hold. Give it that fact and this row " +
      "becomes askable by deleting `notProduced` — nothing else.",
  },
];

// ---------------------------------------------------------------------------
// Lookups.
// ---------------------------------------------------------------------------

const BY_ID: ReadonlyMap<string, Recipe> = new Map(RECIPES.map((r) => [r.id, r]));

export function recipe(id: string): Recipe | undefined {
  return BY_ID.get(id);
}

export function recipesInCluster(cluster: string): Recipe[] {
  return RECIPES.filter((r) => r.cluster === cluster);
}

/**
 * The pattern with its sense appended, for the STRING-ONLY surfaces that cannot
 * render a second styled span — the drill's MC prompt, option labels and reveal,
 * and the fact/entry glyph the results and Library browse read. "〜られる (可能)",
 * never bare "〜られる", so 可能 and 受身 (and 理由 vs 起点) read apart where both
 * could otherwise be the same string. The " (sense)" form — halfwidth parens, a
 * leading space — is the one the crammed pattern strings used before sense was
 * split out, kept so nothing downstream changes shape. Rich surfaces render
 * `pattern` and `sense` as two elements instead; this is the fallback for the
 * ones that can only hold text. Bare `pattern` when the recipe carries no sense,
 * which is all but six rows.
 */
export function patternLabel(r: Recipe): string {
  return r.sense ? `${r.pattern} (${r.sense})` : r.pattern;
}

/**
 * Can a production question be built from this recipe at all?
 *
 * Three ways to fail, and each is a different kind of "no":
 *
 *   VACUOUS      nothing conjugates, so the answer is the prompt retyped.
 *   ORDER-FREE   the wrap's slots can swap, so there is no single answer.
 *   notProduced  it would be a fine question, and we lack the data to pose it.
 *
 * The first two are computed off the table and cannot drift from it. The third
 * is written down because it is not a fact about this table at all — it is a
 * fact about what the app knows, and the day that changes, the row changes.
 *
 * The rule underneath all three is the one that makes production safe: naming
 * the target destroys the ambiguity. A prompt whose answer isn't uniquely
 * determined isn't a question, and silence beats invention.
 */
export function isProducible(r: Recipe): boolean {
  return !isVacuous(r) && !isOrderFree(r) && !r.wrap?.notProduced;
}

/** The recipes worth asking a PRODUCTION question about. */
export const DRILLABLE: readonly Recipe[] = RECIPES.filter(isProducible);
