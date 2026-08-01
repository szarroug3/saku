// Form-intro pages: the foundational verb forms a family of patterns is built
// on, taught just before the first pattern that uses them — the way lesson 1
// teaches the て/で-form before the て-patterns. A pattern lesson whose form has
// not been introduced yet prepends these pages (see lessons.ts).
//
// Same table as lesson 1: Ending · Change · Note, the change shown as an
// equation (drop the last kana, add the ending) so the small kana a form
// introduces — the っ of った — is flagged automatically. Kana examples, verified
// against the conjugation engine.

import { conjugate, type Form, type WordClass } from "@/lib/conjugate";
import type { IntroBuildRule, PhaseIntro } from "@/data/phase-intros";

// ---------------------------------------------------------------------------
// GENERATED FORM TABLES — for the standalone conjugation forms (passive,
// potential, causative, causative-passive, 〜ば, 〜たら). Unlike the hand-authored
// て/ない/た/stem tables above, these are built straight off the conjugation
// engine so they cannot drift, grouped the same way: Godan / Ichidan / Irregulars.
// ---------------------------------------------------------------------------

const FORM_TABLE_VERBS: {
  title: string;
  heads?: { label?: string };
  irregular?: boolean;
  verbs: { label: string; word: string; cls: WordClass }[];
}[] = [
  {
    title: "Godan (う-verbs)",
    heads: { label: "Ending" },
    verbs: [
      { label: "う", word: "かう", cls: "v5u" },
      { label: "つ", word: "まつ", cls: "v5t" },
      { label: "る", word: "とる", cls: "v5r" },
      { label: "む", word: "のむ", cls: "v5m" },
      { label: "ぶ", word: "あそぶ", cls: "v5b" },
      { label: "ぬ", word: "しぬ", cls: "v5n" },
      { label: "く", word: "かく", cls: "v5k" },
      { label: "ぐ", word: "およぐ", cls: "v5g" },
      { label: "す", word: "はなす", cls: "v5s" },
    ],
  },
  {
    title: "Ichidan (る-verbs)",
    verbs: [
      { label: "", word: "たべる", cls: "v1" },
      { label: "", word: "みる", cls: "v1" },
    ],
  },
  {
    title: "Irregulars",
    heads: { label: "" },
    irregular: true,
    verbs: [
      { label: "irregular", word: "する", cls: "vs-i" },
      { label: "irregular", word: "くる", cls: "vk" },
    ],
  },
];

function prefixLen(a: string, b: string): number {
  let i = 0;
  while (i < a.length && i < b.length && a[i] === b[i]) i++;
  return i;
}

/** The three grouped build tables for a standalone conjugation FORM: each
 * representative verb conjugated to the form, the change diffed off the shared
 * prefix (drop the tail, add the new one). Irregulars (する, くる) are shown whole. */
function formRuleTables(
  form: Form,
): { title: string; rules: IntroBuildRule[]; heads?: { label?: string } }[] {
  const tables: { title: string; rules: IntroBuildRule[]; heads?: { label?: string } }[] = [];
  for (const g of FORM_TABLE_VERBS) {
    const rules: IntroBuildRule[] = [];
    for (const v of g.verbs) {
      const c = conjugate(v.word, v.cls, form);
      if (!c.ok || c.value === v.word) continue;
      const p = prefixLen(v.word, c.value);
      if (g.irregular || p === 0) {
        rules.push({ label: v.label || "irregular", verb: v.word, to: c.value });
      } else {
        rules.push({ label: v.label, verb: v.word, drop: v.word.slice(p), add: c.value.slice(p) });
      }
    }
    if (rules.length) tables.push({ title: g.title, rules, heads: g.heads });
  }
  return tables;
}

/** The ない-form — the plain negative. One page (a form has little to say): what it
 * is for, then the build grouped Godan / Ichidan / Exceptions. */
export const NAI_FORM_PAGES: readonly PhaseIntro[] = [
  {
    id: "gl-nai-form",
    setId: "",
    eyebrow: "The ない-form",
    title: "The plain “not” form.",
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
    title: "The plain past, “did”.",
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

/** The ます-form — the polite present, the stem plus ます. Its own form page: what
 * it is for, then the conjugation grouped Godan / Ichidan / Irregulars. */
export const MASU_FORM_PAGES: readonly PhaseIntro[] = [
  {
    id: "gl-masu-form",
    setId: "",
    eyebrow: "The ます-form",
    title: "The polite present.",
    body: [
      {
        text: "The polite way to end a sentence, in place of the plain form. It is the stem plus ます: たべる (eat) becomes たべます.",
      },
      {
        text: "From it come 〜ましょう (let's), 〜ませんか (won't you) and 〜ましょうか (shall I): swap ます for the ending.",
      },
    ],
    buildTables: formRuleTables("masu"),
  },
];

/** The volitional form — the plain "let's / I'll", the casual counterpart to
 * 〜ましょう. Its own form page. */
export const VOLITIONAL_FORM_PAGES: readonly PhaseIntro[] = [
  {
    id: "gl-volitional-form",
    setId: "",
    eyebrow: "The volitional form",
    title: "The plain “let's / I'll”.",
    body: [
      {
        text: "The casual counterpart to 〜ましょう: たべよう (let's eat), のもう (let's drink). Add と思う for 〜(よ)うと思う (thinking of X-ing).",
      },
      {
        text: "An う-verb shifts its last kana to the お-row and adds う; an る-verb adds よう.",
      },
    ],
    buildTables: formRuleTables("volitional"),
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
    title: "A verb's connecting base.",
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

/** The passive form (受身) — the subject has the action done to it. Its own form
 * page: the meaning, then the conjugation grouped Godan / Ichidan / Irregulars. */
export const PASSIVE_FORM_PAGES: readonly PhaseIntro[] = [
  {
    id: "gl-passive-form",
    setId: "",
    eyebrow: "The passive form",
    title: "Something is done to the subject.",
    body: [
      {
        text: 'The subject has the action done TO it, often "is X-ed (by someone)": わらう (laugh) becomes わらわれる (be laughed at).',
      },
      {
        text: "An う-verb shifts its last kana to the あ-row and adds れる; an る-verb adds られる. する and くる are irregular.",
      },
    ],
    buildTables: formRuleTables("passive"),
  },
];

/** The potential form (可能) — can / is able to do. */
export const POTENTIAL_FORM_PAGES: readonly PhaseIntro[] = [
  {
    id: "gl-potential-form",
    setId: "",
    eyebrow: "The potential form",
    title: "Can do, or is able to do.",
    body: [
      {
        text: 'Says you CAN do something: たべる (eat) becomes たべられる (can eat), のむ (drink) becomes のめる (can drink).',
      },
      {
        text: "An う-verb shifts its last kana to the え-row and adds る; an る-verb adds られる. する becomes できる, くる becomes こられる.",
      },
    ],
    buildTables: formRuleTables("potential"),
  },
];

/** The causative form (使役) — make or let someone do. */
export const CAUSATIVE_FORM_PAGES: readonly PhaseIntro[] = [
  {
    id: "gl-causative-form",
    setId: "",
    eyebrow: "The causative form",
    title: "Make or let someone do.",
    body: [
      {
        text: 'Make or let someone do something: たべる (eat) becomes たべさせる (make / let eat).',
      },
      {
        text: "An う-verb shifts its last kana to the あ-row and adds せる; an る-verb adds させる. する and くる are irregular.",
      },
    ],
    buildTables: formRuleTables("causative"),
  },
];

/** The causative-passive form — be MADE to do (the causative and passive stacked). */
export const CAUSATIVE_PASSIVE_FORM_PAGES: readonly PhaseIntro[] = [
  {
    id: "gl-causative-passive-form",
    setId: "",
    eyebrow: "The causative-passive form",
    title: "Be made to do something.",
    body: [
      {
        text: 'Be MADE to do something: たべる (eat) becomes たべさせられる (be made to eat). It is the causative and the passive stacked.',
      },
      {
        text: "Build the causative, then make that passive. An う-verb ends in 〜せられる; an る-verb in 〜させられる.",
      },
    ],
    buildTables: formRuleTables("causativePassive"),
  },
];

/** The ば-conditional — a general or hypothetical "if". */
export const BA_FORM_PAGES: readonly PhaseIntro[] = [
  {
    id: "gl-ba-form",
    setId: "",
    eyebrow: "The ば-conditional",
    title: "A general or hypothetical “if”.",
    body: [
      {
        text: 'A general or hypothetical "if": たべれば (if [someone] eats), やすければ (if it is cheap).',
      },
      {
        text: "An う-verb shifts its last kana to the え-row and adds ば; an る-verb drops る and adds れば.",
      },
    ],
    buildTables: formRuleTables("ba"),
  },
];

/** The たら-conditional — "if" or "when", built on the た-form. */
export const TARA_FORM_PAGES: readonly PhaseIntro[] = [
  {
    id: "gl-tara-form",
    setId: "",
    eyebrow: "The たら-conditional",
    title: "“If” or “when”.",
    body: [
      {
        lead: "Memory hook:",
        text: 'it is just the た-form plus ら: たべた (ate) becomes たべたら (if / when [someone] eats). If you know the た-form you already know this.',
      },
    ],
    buildTables: formRuleTables("tara"),
  },
];
