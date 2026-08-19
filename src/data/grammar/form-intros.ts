// Form-intro pages: the foundational verb forms a family of patterns is built
// on, taught just before the first pattern that uses them — the way lesson 2
// teaches the て/で-form before the て-patterns. A pattern lesson whose form has
// not been introduced yet prepends these pages (see lessons.ts).
//
// Same table as the て-form lesson: Ending · Change · Note, the change shown as an
// equation (drop the last kana, add the ending) so the small kana a form
// introduces — the っ of った — is flagged automatically. Kana examples, verified
// against the conjugation engine.

import type { WordClass } from "@/lib/conjugate";
import { apply } from "@/lib/grammar/apply";
import { recipe } from "@/data/grammar/recipes";
import { recipeAllows } from "@/lib/grammar/vehicles";
import { WORD_GLOSS } from "@/data/grammar/auto-page";
import type { IntroBuildRule, IntroPara, PhaseIntro } from "@/data/phase-intros";

// ---------------------------------------------------------------------------
// GENERATED FORM TABLES — shared by every foundational form page. They are built
// straight off the recipe engine so the lesson cannot drift from its scored facts,
// grouped as Godan / Ichidan / Irregular verbs / Adjectives.
// ---------------------------------------------------------------------------

const FORM_TABLE_VERBS: {
  title: string;
  heads?: { label?: string };
  irregular?: boolean;
  verbs: { label: string; word: string; cls: WordClass; regular?: WordClass }[];
}[] = [
  {
    title: "Godan (う-verbs)",
    heads: { label: "Ending" },
    verbs: [
      { label: "う・つ・る", word: "かう", cls: "v5u" },
      { label: "", word: "まつ", cls: "v5t" },
      { label: "", word: "とる", cls: "v5r" },
      { label: "む・ぶ・ぬ", word: "のむ", cls: "v5m" },
      { label: "", word: "あそぶ", cls: "v5b" },
      { label: "", word: "しぬ", cls: "v5n" },
      { label: "く", word: "かく", cls: "v5k" },
      { label: "ぐ", word: "およぐ", cls: "v5g" },
      { label: "す", word: "はなす", cls: "v5s" },
    ],
  },
  {
    // ONE example: every ichidan verb conjugates identically (drop る), so a
    // second row teaches nothing the first did not.
    title: "Ichidan (る-verbs)",
    verbs: [{ label: "", word: "たべる", cls: "v1" }],
  },
  {
    title: "Irregular verbs",
    heads: { label: "" },
    irregular: true,
    verbs: [
      { label: "exception", word: "いく", cls: "v5k-s", regular: "v5k" },
      { label: "irregular", word: "する", cls: "vs-i", regular: "v1" },
      { label: "irregular", word: "くる", cls: "vk", regular: "v1" },
      { label: "exception", word: "ある", cls: "v5r-i", regular: "v5r" },
    ],
  },
  {
    // The ADJECTIVE forms, where this form conjugates one: い-adjective (高くて),
    // the いい exception (よくて — stem よ, not い), and な-adjective (静かで). Self-
    // filtering through `apply`: a form that does not touch adjectives (〜ます)
    // conjugates none of these, so the table is absent; 〜ば touches only い, so its
    // な row drops out.
    title: "Adjectives",
    heads: { label: "Ending" },
    verbs: [
      { label: "い", word: "たかい", cls: "adj-i" },
      { label: "な", word: "しずか", cls: "adj-na" },
    ],
  },
  {
    title: "Irregular adjectives",
    heads: { label: "" },
    irregular: true,
    verbs: [
      { label: "exception", word: "いい", cls: "adj-ix", regular: "adj-i" },
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
  recipeId: string,
): { title: string; rules: IntroBuildRule[]; heads?: { label?: string } }[] {
  const r = recipe(recipeId);
  if (!r) return [];
  const tables: { title: string; rules: IntroBuildRule[]; heads?: { label?: string } }[] = [];
  for (const g of FORM_TABLE_VERBS) {
    const rules: IntroBuildRule[] = [];
    for (const v of g.verbs) {
      // apply (not raw conjugate) so the recipe's OWN attachments decide which
      // rows exist: 〜ば conjugates い-adjectives (高ければ) but not な (静か uses なら,
      // a different pattern), so its な row drops out here rather than showing a
      // form the pattern does not own.
      if (!recipeAllows(r, v.word)) continue;
      const c = apply(r, v.word, v.cls);
      if (!c.ok || c.value === v.word) continue;
      // An irregular row shows only where it actually breaks its regular rule:
      // 行く on the て/た-form (行って ≠ 行いて), but not on 〜ます (行きます is plain);
      // する/来る everywhere except ば (すれば coincides with the ichidan rule).
      if (v.regular) {
        const reg = apply(r, v.word, v.regular);
        if (reg.ok && reg.value === c.value) continue;
      }
      const p = prefixLen(v.word, c.value);
      const note = FORM_RULE_NOTES[`${recipeId}:${v.cls}`];
      const gloss = WORD_GLOSS[v.word];
      if (g.irregular || p === 0) {
        rules.push({ label: v.label || "irregular", verb: v.word, to: c.value, note, gloss });
      } else {
        rules.push({
          label: v.label,
          verb: v.word,
          drop: v.word.slice(p),
          add: c.value.slice(p),
          note,
          gloss,
        });
      }
    }
    if (rules.length) tables.push({ title: g.title, rules, heads: g.heads });
  }
  return tables;
}

type FormTable = ReturnType<typeof formRuleTables>[number];

/** Split a generated form table stack into the same word-type sections every
 * pattern page uses: heading, instruction, then the relevant grouped tables. */
function formBuildSections(
  recipeId: string,
  verbs: readonly IntroPara[],
  adjectives?: readonly IntroPara[],
): NonNullable<PhaseIntro["buildSections"]> {
  const tables = formRuleTables(recipeId);
  const adjectiveTables = tables.filter((table) => /adjective/i.test(table.title));
  const verbTables = tables.filter((table) => !/adjective/i.test(table.title));
  const sections: {
    title: string;
    body: readonly IntroPara[];
    tables: readonly FormTable[];
  }[] = [];
  if (verbTables.length) sections.push({ title: "Verbs", body: verbs, tables: verbTables });
  if (adjectiveTables.length) {
    sections.push({
      title: "Adjectives",
      body: adjectives ?? [{ text: "Change the adjective's ending according to its type." }],
      tables: adjectiveTables,
    });
  }
  return sections;
}

/** Notes that teach something the generated equation cannot show by itself. */
const FORM_RULE_NOTES: Readonly<Record<string, string>> = {
  "nai-form:v5u": "う shifts to わ, not あ.",
  "nai-form:v5r-i": "ある's negative is just ない, not あらない.",
  "ta-form:v5u": "The っ in った is a small っ, not a full-size つ.",
};

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
    ],
    buildSections: formBuildSections("nai-form", [{
      text: "For an う-verb, the last kana shifts to its あ-row before ない. An る-verb just drops る and adds ない.",
    }]),
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
    ],
    buildSections: formBuildSections(
      "ta-form",
      [{
        lead: "Memory hook:",
        text: "Build it exactly like the て/で-form, with た/だ where て/で went (かって→かった, のんで→のんだ). いく is the same exception, and する / くる are the irregulars.",
      }],
      [{
        text: "An い-adjective changes its final い to かった. A な-adjective adds だった. いい changes to よかった.",
      }],
    ),
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
    buildSections: formBuildSections("masu-form", [{
      text: "Put the verb into its stem and add ます.",
    }]),
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
    ],
    buildSections: formBuildSections("volitional-form", [{
      text: "An う-verb shifts its last kana to the お-row and adds う; a る-verb adds よう.",
    }]),
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
    ],
    buildSections: formBuildSections("stem-form", [{
      text: "For an う-verb, the last kana simply switches to its い-row. An る-verb just drops る.",
    }]),
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
        text: 'Often "is X-ed (by someone)": わらう (laugh) becomes わらわれる (be laughed at).',
      },
    ],
    buildSections: formBuildSections("passive", [{
      text: "An う-verb shifts its last kana to the あ-row and adds れる; a る-verb adds られる. する and くる are irregular.",
    }]),
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
        text: 'たべる (eat) becomes たべられる (can eat); のむ (drink) becomes のめる (can drink).',
      },
    ],
    buildSections: formBuildSections("potential", [{
      text: "An う-verb shifts its last kana to the え-row and adds る; a る-verb adds られる. する becomes できる, くる becomes こられる.",
    }]),
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
        text: 'たべる (eat) becomes たべさせる (make / let someone eat).',
      },
    ],
    buildSections: formBuildSections("causative", [{
      text: "An う-verb shifts its last kana to the あ-row and adds せる; a る-verb adds させる. する and くる are irregular.",
    }]),
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
        text: 'たべる (eat) becomes たべさせられる (be made to eat). It is the causative and the passive stacked.',
      },
    ],
    buildSections: formBuildSections("causative-passive", [{
      text: "Build the causative, then make that passive. An う-verb ends in 〜せられる; a る-verb in 〜させられる.",
    }]),
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
        text: 'たべれば means "if [someone] eats"; やすければ, "if it is cheap".',
      },
    ],
    buildSections: formBuildSections(
      "ba",
      [{
        text: "An う-verb shifts its last kana to the え-row and adds ば; a る-verb drops る and adds れば.",
      }],
      [{
        text: "An い-adjective changes its final い to ければ. いい changes to よければ.",
      }],
    ),
  },
];

/** The たら-conditional — "if" or "when", built on the た-form. */
export const TARA_FORM_PAGES: readonly PhaseIntro[] = [
  {
    id: "gl-tara-form",
    setId: "",
    eyebrow: "The たら-conditional",
    title: "“If” or “when”.",
    body: [{
      text: 'たべたら means "if / when [someone] eats"; やすかったら means "if it is cheap".',
    }],
    buildSections: formBuildSections(
      "tara",
      [{
        lead: "Memory hook:",
        text: "Put the verb into its た-form and add ら. If you know the た-form, you already know this.",
      }],
      [{
        lead: "Memory hook:",
        text: "Put the adjective into its た-form and add ら.",
      }],
    ),
  },
];
