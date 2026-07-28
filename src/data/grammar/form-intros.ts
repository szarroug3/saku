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

/** The ない-form — the plain negative. A different idea from the て-form (the last
 * kana shifts to its あ-row, then + ない), so two pages: the う-verb shift, then
 * る-verbs and the irregulars. */
export const NAI_FORM_PAGES: readonly PhaseIntro[] = [
  {
    id: "gl-nai-u",
    setId: "",
    eyebrow: "The ない-form",
    title: "The ない-form is the plain “not” form.",
    body: [{ text: "For an う-verb, the last kana shifts to its あ-row before ない." }],
    buildRules: [
      { label: "う", verb: "かう", drop: "う", add: "わない", note: "う shifts to わ, not あ." },
      { label: "く", verb: "かく", drop: "く", add: "かない" },
      { label: "ぐ", verb: "およぐ", drop: "ぐ", add: "がない" },
      { label: "む", verb: "のむ", drop: "む", add: "まない" },
      { label: "す", verb: "はなす", drop: "す", add: "さない" },
    ],
    buildHeads: { label: "Ending" },
  },
  {
    id: "gl-nai-ru-irregular",
    setId: "",
    eyebrow: "The ない-form",
    title: "る-verbs drop る; a few verbs are irregular.",
    body: [{ text: "For an る-verb, drop る and add ない. A few common verbs are irregular." }],
    buildRules: [
      { label: "る-verb", verb: "たべる", drop: "る", add: "ない" },
      { label: "irregular", verb: "する", to: "しない" },
      { label: "irregular", verb: "くる", to: "こない" },
      { label: "irregular", verb: "ある", to: "ない", note: "ある's negative is just ない, not あらない." },
    ],
    buildHeads: { label: "Verb type" },
  },
];

/** The た-form — the plain past. The same 音便 as the て-form, so one page with the
 * same ending table (た/だ in place of て/で). The っ of った is flagged, like the
 * て-form's って. */
export const TA_FORM_PAGES: readonly PhaseIntro[] = [
  {
    id: "gl-ta-form",
    setId: "",
    eyebrow: "The た-form",
    title: "The た-form is the plain past — “did”.",
    body: [
      {
        text: "Built just like the て/で-form you already know, but ending in た or だ. る-verbs drop る, and いく is the one exception.",
      },
    ],
    buildRules: [
      { label: "う・つ・る", verb: "かう", drop: "う", add: "った" },
      { label: "む・ぶ・ぬ", verb: "のむ", drop: "む", add: "んだ" },
      { label: "く", verb: "かく", drop: "く", add: "いた" },
      { label: "ぐ", verb: "およぐ", drop: "ぐ", add: "いだ" },
      { label: "す", verb: "はなす", drop: "す", add: "した" },
    ],
    buildHeads: { label: "Ending" },
  },
];

/** The stem — the verb with ます taken off (the last kana shifts to its い-row, or
 * る drops). One page, same ending table. */
export const STEM_FORM_PAGES: readonly PhaseIntro[] = [
  {
    id: "gl-stem-form",
    setId: "",
    eyebrow: "The stem",
    title: "The stem is the verb with ます taken off.",
    body: [
      {
        text: "Lots of patterns hang off the stem — 〜たい (want to), 〜ながら (while doing), 〜すぎる (too much).",
      },
    ],
    buildRules: [
      { label: "う", verb: "かう", drop: "う", add: "い" },
      { label: "く", verb: "かく", drop: "く", add: "き" },
      { label: "ぐ", verb: "およぐ", drop: "ぐ", add: "ぎ" },
      { label: "む", verb: "のむ", drop: "む", add: "み" },
      { label: "す", verb: "はなす", drop: "す", add: "し" },
      { label: "る-verb", verb: "たべる", drop: "る", add: "" },
    ],
    buildHeads: { label: "Ending" },
  },
];
