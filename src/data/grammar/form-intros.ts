// Form-intro pages: the foundational verb forms a family of patterns is built
// on, taught just before the first pattern that uses them — the way lesson 1
// teaches the て/で-form before the て-patterns. A pattern lesson whose form has
// not been introduced yet prepends these pages (see lessons.ts).
//
// Same table as lesson 1: Ending · Change · Note, the change shown as an
// equation (drop the last kana, add the ending) so the small kana a form
// introduces — the っ of った — is flagged automatically. Kana examples, verified
// against the conjugation engine.

import type { PhaseIntro } from "@/data/phase-intros";

/** The ない-form — the plain negative. One page (a form has little to say): what it
 * is for, then the build grouped Godan / Ichidan / Exceptions. */
export const NAI_FORM_PAGES: readonly PhaseIntro[] = [
  {
    id: "gl-nai-form",
    setId: "",
    eyebrow: "The ない-form",
    title: "The ない-form is the plain “not” form.",
    body: [
      {
        lead: "On its own,",
        text: 'the ない-form says a verb is not happening: たべない "doesn\'t / won\'t eat", いかない "not going".',
      },
      {
        text: "For an う-verb, the last kana shifts to its あ-row before ない. An る-verb just drops る and adds ない.",
      },
    ],
    buildTables: [
      {
        title: "Godan (う-verbs)",
        heads: { label: "Ending" },
        rules: [
          { label: "う", verb: "かう", drop: "う", add: "わない", note: "う shifts to わ, not あ." },
          { label: "つ", verb: "まつ", drop: "つ", add: "たない" },
          { label: "る", verb: "とる", drop: "る", add: "らない" },
          { label: "む", verb: "のむ", drop: "む", add: "まない" },
          { label: "ぶ", verb: "あそぶ", drop: "ぶ", add: "ばない" },
          { label: "ぬ", verb: "しぬ", drop: "ぬ", add: "なない" },
          { label: "く", verb: "かく", drop: "く", add: "かない" },
          { label: "ぐ", verb: "およぐ", drop: "ぐ", add: "がない" },
          { label: "す", verb: "はなす", drop: "す", add: "さない" },
        ],
      },
      {
        title: "Ichidan (る-verbs)",
        rules: [
          { verb: "たべる", drop: "る", add: "ない" },
          { verb: "みる", drop: "る", add: "ない" },
        ],
      },
      {
        title: "Exceptions and irregulars",
        heads: { label: "" },
        rules: [
          { label: "irregular", verb: "する", to: "しない" },
          { label: "irregular", verb: "くる", to: "こない" },
          { label: "irregular", verb: "ある", to: "ない", note: "ある's negative is just ない, not あらない." },
        ],
      },
    ],
  },
];

/** The た-form — the plain past. The same 音便 as the て-form (た/だ in place of
 * て/で), so it leans on the て-form as a memory hook. One page: what it is for,
 * then the build grouped Godan / Ichidan / Exceptions. */
export const TA_FORM_PAGES: readonly PhaseIntro[] = [
  {
    id: "gl-ta-form",
    setId: "",
    eyebrow: "The た-form",
    title: "The た-form is the plain past, “did”.",
    body: [
      {
        lead: "On its own,",
        text: 'the た-form is the casual past: たべた "ate", いった "went".',
      },
      {
        lead: "Memory hook:",
        text: "it is built exactly like the て/で-form, with た/だ where て/で went (かって→かった, のんで→のんだ). Know the て-form and you already know this. いく is the same exception, and する / くる are the irregulars.",
      },
    ],
    buildTables: [
      {
        title: "Godan (う-verbs)",
        heads: { label: "Ending" },
        rules: [
          { label: "う・つ・る", verb: "かう", drop: "う", add: "った", note: "The っ in った is a small っ, not a full-size つ." },
          { label: "", verb: "まつ", drop: "つ", add: "った" },
          { label: "", verb: "とる", drop: "る", add: "った" },
          { label: "む・ぶ・ぬ", verb: "のむ", drop: "む", add: "んだ" },
          { label: "", verb: "あそぶ", drop: "ぶ", add: "んだ" },
          { label: "", verb: "しぬ", drop: "ぬ", add: "んだ" },
          { label: "く", verb: "かく", drop: "く", add: "いた" },
          { label: "ぐ", verb: "およぐ", drop: "ぐ", add: "いだ" },
          { label: "す", verb: "はなす", drop: "す", add: "した" },
        ],
      },
      {
        title: "Ichidan (る-verbs)",
        rules: [
          { verb: "たべる", drop: "る", add: "た" },
          { verb: "みる", drop: "る", add: "た" },
        ],
      },
      {
        title: "Exceptions and irregulars",
        heads: { label: "" },
        rules: [
          { label: "exception", verb: "いく", drop: "く", add: "った" },
          { label: "irregular", verb: "する", to: "した" },
          { label: "irregular", verb: "くる", to: "きた" },
        ],
      },
    ],
  },
];

/** The ます-form — the polite present. It is the stem (taught just before) plus
 * ます, so the ending table is the stem's い-row shift with ます added. Taught here
 * because 〜ましょう / 〜ませんか / 〜ましょうか all trim ます off it. */
export const MASU_FORM_PAGES: readonly PhaseIntro[] = [
  {
    id: "gl-masu-form",
    setId: "",
    eyebrow: "The ます-form",
    title: "The ます-form is the polite present.",
    body: [
      {
        text: "It is the polite way to end a sentence, in place of the plain form. It is the stem you just learned plus ます.",
      },
      {
        text: "So an う-verb shifts its last kana to the い-row before ます, and an る-verb drops る.",
      },
      {
        text: "From it come 〜ましょう (let's), 〜ませんか (won't you), and 〜ましょうか (shall I): swap ます for the ending.",
      },
    ],
    buildRules: [
      { label: "う", verb: "かう", drop: "う", add: "います" },
      { label: "く", verb: "かく", drop: "く", add: "きます" },
      { label: "ぐ", verb: "およぐ", drop: "ぐ", add: "ぎます" },
      { label: "む", verb: "のむ", drop: "む", add: "みます" },
      { label: "す", verb: "はなす", drop: "す", add: "します" },
      { label: "る-verb", verb: "たべる", drop: "る", add: "ます" },
    ],
    buildHeads: { label: "Ending" },
  },
];

/** The volitional form — the plain "let's" / "I'll". The last kana shifts to its
 * お-row before う; an る-verb drops る and adds よう. The casual counterpart to
 * 〜ましょう, taught because 〜(よ)うと思う (thinking of doing) is built on it. */
export const VOLITIONAL_FORM_PAGES: readonly PhaseIntro[] = [
  {
    id: "gl-volitional-form",
    setId: "",
    eyebrow: "The volitional form",
    title: "The volitional form is the plain “let's / I'll”.",
    body: [
      {
        text: "It is the casual counterpart to 〜ましょう. Add と思う to it for 〜(よ)うと思う (I'm thinking of X-ing).",
      },
      {
        text: "For an う-verb, the last kana shifts to its お-row, then う. An る-verb drops る and adds よう.",
      },
    ],
    buildRules: [
      { label: "う", verb: "かう", drop: "う", add: "おう" },
      { label: "く", verb: "かく", drop: "く", add: "こう" },
      { label: "ぐ", verb: "およぐ", drop: "ぐ", add: "ごう" },
      { label: "む", verb: "のむ", drop: "む", add: "もう" },
      { label: "す", verb: "はなす", drop: "す", add: "そう" },
      { label: "る-verb", verb: "たべる", drop: "る", add: "よう" },
      { label: "irregular", verb: "する", to: "しよう" },
      { label: "irregular", verb: "くる", to: "こよう" },
    ],
    buildHeads: { label: "Ending" },
  },
];

/** The stem — the verb with ます taken off (the last kana shifts to its い-row, or
 * る drops). One page: what it is for, then the build grouped Godan / Ichidan /
 * Exceptions. */
export const STEM_FORM_PAGES: readonly PhaseIntro[] = [
  {
    id: "gl-stem-form",
    setId: "",
    eyebrow: "The stem",
    title: "The stem is a verb's connecting base.",
    body: [
      {
        text: "Unlike the other forms, the stem is never used alone. It just holds the verb ready, and a pattern gives it meaning: 〜ます (polite), 〜たい (want to), 〜ながら (while doing), 〜すぎる (too much).",
      },
      {
        text: "For an う-verb, the last kana simply switches to its い-row. An る-verb just drops る.",
      },
    ],
    buildTables: [
      {
        title: "Godan (う-verbs)",
        heads: { label: "Ending" },
        rules: [
          { label: "う", verb: "かう", drop: "う", add: "い" },
          { label: "つ", verb: "まつ", drop: "つ", add: "ち" },
          { label: "る", verb: "とる", drop: "る", add: "り" },
          { label: "む", verb: "のむ", drop: "む", add: "み" },
          { label: "ぶ", verb: "あそぶ", drop: "ぶ", add: "び" },
          { label: "ぬ", verb: "しぬ", drop: "ぬ", add: "に" },
          { label: "く", verb: "かく", drop: "く", add: "き" },
          { label: "ぐ", verb: "およぐ", drop: "ぐ", add: "ぎ" },
          { label: "す", verb: "はなす", drop: "す", add: "し" },
        ],
      },
      {
        title: "Ichidan (る-verbs)",
        rules: [
          { verb: "たべる", drop: "る", add: "" },
          { verb: "みる", drop: "る", add: "" },
        ],
      },
      {
        title: "Exceptions and irregulars",
        heads: { label: "" },
        rules: [
          { label: "irregular", verb: "する", to: "し" },
          { label: "irregular", verb: "くる", to: "き" },
        ],
      },
    ],
  },
];
