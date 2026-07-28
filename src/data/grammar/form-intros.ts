// Form-intro pages: the foundational verb forms a family of patterns is built
// on, taught just before the first pattern that uses them — the way lesson 1
// teaches the て/で-form before the て-patterns. A pattern lesson whose form has
// not been introduced yet prepends these pages (see lessons.ts). Same shape as
// 〜ている's first page: a human title, a short blurb, then a build table.
//
// Kana examples, verified against the conjugation engine. The た-form is the
// same idea as the て-form (a short recap); the ない-form and the stem are their
// own small ideas.

import type { PhaseIntro } from "@/data/phase-intros";

/** The ない-form — the plain negative. A different idea from the て-form, so two
 * pages: the う-verb shift, then る-verbs and the irregulars. */
export const NAI_FORM_PAGES: readonly PhaseIntro[] = [
  {
    id: "gl-nai-u",
    setId: "",
    eyebrow: "The ない-form",
    title: "The ない-form is the plain “not” form.",
    body: [
      {
        text: "For an う-verb, shift the last kana to its あ-row sound and add ない: く→か, む→ま, す→さ, つ→た, and so on. う is the odd one out — it becomes わ, not あ.",
      },
    ],
    buildRules: [
      { verb: "かう", to: "かわない", gloss: "not buy" },
      { verb: "かく", to: "かかない", gloss: "not write" },
      { verb: "のむ", to: "のまない", gloss: "not drink" },
      { verb: "はなす", to: "はなさない", gloss: "not speak" },
    ],
    buildHeads: { gloss: "Meaning" },
  },
  {
    id: "gl-nai-ru-irregular",
    setId: "",
    eyebrow: "The ない-form",
    title: "る-verbs drop る; a few verbs are irregular.",
    body: [
      { text: "For an る-verb, drop る and add ない." },
      {
        text: "する becomes しない and くる becomes こない. ある is special: its negative is just ない, not あらない.",
      },
    ],
    buildRules: [
      { verb: "たべる", to: "たべない", gloss: "not eat" },
      { verb: "みる", to: "みない", gloss: "not see" },
      { verb: "する", to: "しない", gloss: "not do" },
      { verb: "くる", to: "こない", gloss: "not come" },
      { verb: "ある", to: "ない", gloss: "there isn't" },
    ],
    buildHeads: { gloss: "Meaning" },
  },
];

/** The た-form — the plain past. The same 音便 as the て-form, so one short recap
 * page that leans on it. */
export const TA_FORM_PAGES: readonly PhaseIntro[] = [
  {
    id: "gl-ta-form",
    setId: "",
    eyebrow: "The た-form",
    title: "The た-form is the plain past — “did”.",
    body: [
      {
        text: "You build it exactly like the て/で-form you already know, but ending in た or だ instead of て or で.",
      },
      {
        text: "So う・つ・る → った, む・ぶ・ぬ → んだ, く → いた, ぐ → いだ, す → した. And いく → いった, the same exception the て-form has.",
      },
    ],
    buildRules: [
      { verb: "かう", to: "かった", gloss: "bought" },
      { verb: "のむ", to: "のんだ", gloss: "drank" },
      { verb: "かく", to: "かいた", gloss: "wrote" },
      { verb: "はなす", to: "はなした", gloss: "spoke" },
      { verb: "たべる", to: "たべた", gloss: "ate" },
    ],
    buildHeads: { gloss: "Meaning" },
  },
];

/** The stem — the verb with ます taken off. Many patterns hang off it. One page. */
export const STEM_FORM_PAGES: readonly PhaseIntro[] = [
  {
    id: "gl-stem-form",
    setId: "",
    eyebrow: "The stem",
    title: "The stem is the verb with ます taken off.",
    body: [
      {
        text: "Take the polite ます-form and drop ます. For an う-verb the last kana shifts to its い-row (く→き, む→み); for an る-verb you just drop る.",
      },
      {
        text: "Lots of patterns hang off the stem — 〜たい (want to), 〜ながら (while doing), 〜すぎる (too much).",
      },
    ],
    buildRules: [
      { verb: "かく", to: "かき", gloss: "write" },
      { verb: "のむ", to: "のみ", gloss: "drink" },
      { verb: "はなす", to: "はなし", gloss: "speak" },
      { verb: "たべる", to: "たべ", gloss: "eat" },
    ],
    buildHeads: { gloss: "Meaning" },
  },
];
