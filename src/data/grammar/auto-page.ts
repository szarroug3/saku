// A pattern's teach page, generated from its recipe. Every drillable pattern
// that is not hand-authored (te-form and 〜ている are) gets ONE page in the same
// shape as 〜ている's first page: a meaning line, then a build table showing the
// pattern built on a few kana example words, the added suffix accented. Nothing
// is hardcoded per pattern — the recipe's attach rule plus the conjugation engine
// produce the whole page, so adding a recipe adds its lesson.
//
// Kana, not kanji: the build table teaches a rule, and a beginner reads the rule
// off the kana. The examples are a small fixed set per host, filtered to the ones
// the recipe actually accepts and actually builds on (recipeAllows + apply), so a
// pattern only ever shows verbs it is real Japanese for.

import { conjugate, type Form, type WordClass } from "@/lib/conjugate";
import { apply } from "@/lib/grammar/apply";
import { primaryHost } from "@/lib/grammar/example";
import { FORM_LABEL, HOST_ARTICLE } from "@/lib/grammar/formula";
import { recipeAllows } from "@/lib/grammar/vehicles";
import { examplesFor } from "@/data/grammar/corpus";
import { patternLabel, type Host, type Recipe } from "@/data/grammar/recipes";
import type { IntroBuildRule, IntroDeriveRow, PhaseIntro, SentenceExample } from "@/data/phase-intros";

/** The pattern's own worked sentence, straight from the Tatoeba corpus — the
 * SAME lookup grammar-entry-view.tsx used to do on its own; centralised here so
 * the teach walk and the Library page always show the identical sentence. Absent
 * for a pattern the corpus tagger has not signed (see authored.ts for that lane).
 *
 * PREFERS A SENTENCE WHERE THE PATTERN SURVIVES INTACT. The tagger signs a
 * sentence whenever the pattern's HOST verb appears, even when the pattern
 * itself has since been further conjugated away — 〜ている past-tensed to
 * 〜ていた drops る, leaving a lone い in the highlighted span with no visible
 * "いる" for a learner to recognise, right after a build panel that just showed
 * them て-form + いる. Any candidate whose sentence still contains the pattern's
 * own written form literally (てください, ている, …) reads as the SAME thing
 * the build panel just taught; one that doesn't is technically correct but
 * confusing, so it is only a fallback when nothing cleaner is tagged. */
function sentenceExampleFor(r: Recipe): SentenceExample | undefined {
  const candidates = examplesFor(r.id).filter((ex) => ex.sp[r.id]);
  if (!candidates.length) return undefined;
  const written = r.pattern.replace(/^〜/, "");
  const example = candidates.find((ex) => ex.jp.includes(written)) ?? candidates[0];
  const span = example.sp[r.id]!;
  return { jp: example.jp, en: example.en, span: [span[0], span[1]] };
}

/** One example word for the build table: the kana form, its class (null for a
 * noun, which does not conjugate), and its English meaning. Verbs also carry the
 * inflected English forms, so the Meaning column can slot the verb into whatever
 * shape a gloss's X frame needs (base, gerund, past, past participle). */
interface ExampleWord {
  word: string;
  cls: WordClass | null;
  en: string;
  ing?: string;
  pp?: string;
  past?: string;
  s?: string;
}

/** A small, beginner-friendly example set per host — common words whose readings
 * are kana the learner can read, chosen to span the conjugation classes so a rule
 * is shown to hold across them. Filtered per recipe, three shown. */
const EXAMPLES: Record<Host, ExampleWord[]> = {
  verb: [
    { word: "たべる", cls: "v1", en: "eat", ing: "eating", pp: "eaten", past: "ate", s: "eats" },
    { word: "のむ", cls: "v5m", en: "drink", ing: "drinking", pp: "drunk", past: "drank", s: "drinks" },
    { word: "かく", cls: "v5k", en: "write", ing: "writing", pp: "written", past: "wrote", s: "writes" },
    { word: "かう", cls: "v5u", en: "buy", ing: "buying", pp: "bought", past: "bought", s: "buys" },
    { word: "はなす", cls: "v5s", en: "speak", ing: "speaking", pp: "spoken", past: "spoke", s: "speaks" },
    { word: "あそぶ", cls: "v5b", en: "play", ing: "playing", pp: "played", past: "played", s: "plays" },
  ],
  "adj-i": [
    { word: "たかい", cls: "adj-i", en: "expensive" },
    { word: "やすい", cls: "adj-i", en: "cheap" },
    { word: "あたらしい", cls: "adj-i", en: "new" },
  ],
  "adj-na": [
    { word: "しずか", cls: "adj-na", en: "quiet" },
    { word: "べんり", cls: "adj-na", en: "convenient" },
    { word: "ゆうめい", cls: "adj-na", en: "famous" },
  ],
  noun: [
    { word: "ほん", cls: null, en: "book" },
    { word: "みず", cls: null, en: "water" },
    { word: "がっこう", cls: null, en: "school" },
  ],
};

/** Meanings for words used in the Ending·Change build tables (RULE_VERBS,
 * PATTERN_TABLE_GROUPS, and form-intros.ts's FORM_TABLE_VERBS) that fall
 * outside EXAMPLES' spread — the representative-per-sound-change set needs a
 * couple of verbs (まつ, とる, しぬ, およぐ) and the irregulars/exceptions
 * (いく, する, くる, ある, いい) EXAMPLES has no reason to carry, plus the
 * kanji spellings PATTERN_TABLE_GROUPS' adjective rows use (高い, 静か)
 * alongside the kana ones (たかい, しずか) FORM_TABLE_VERBS and lessons.ts use.
 * One consistent gloss per word, single source, reused by every table builder
 * so no two tables can drift on what a shared word means (SAK-39). */
const EXTRA_GLOSSES: Readonly<Record<string, string>> = {
  まつ: "wait",
  とる: "take",
  しぬ: "die",
  およぐ: "swim",
  いく: "go",
  する: "do",
  くる: "come",
  ある: "exist",
  いい: "good",
  高い: "expensive",
  静か: "quiet",
};

/** Every word's English meaning, keyed by its kana (or, for the adjective rows
 * that are spelled in kanji, its kanji) — EXAMPLES' own meanings plus
 * EXTRA_GLOSSES for the words EXAMPLES doesn't carry. The single lookup every
 * build-table generator glosses its rows from. */
export const WORD_GLOSS: Readonly<Record<string, string>> = {
  ...Object.fromEntries(Object.values(EXAMPLES).flat().map((ex) => [ex.word, ex.en])),
  ...EXTRA_GLOSSES,
};

const HOST_SECTION_TITLE: Record<Host, string> = {
  verb: "Verbs",
  "adj-i": "い-adjectives",
  "adj-na": "な-adjectives",
  noun: "Nouns",
};

const HOST_COLUMN_TITLE: Record<Host, string> = {
  verb: "Verb",
  "adj-i": "Adjective",
  "adj-na": "Adjective",
  noun: "Noun",
};

const HOST_FORMULA_LABEL: Record<Host, string> = {
  verb: "verb",
  "adj-i": "い-adjective",
  "adj-na": "な-adjective",
  noun: "noun",
};

/** The verb/adj/noun a pattern is best shown on: its primary production host, or
 * verb when it names none. */
function pageHost(r: Recipe): Host {
  return primaryHost(r) ?? "verb";
}

/** The pattern's gloss with its X slot filled by the example's meaning, so the
 * Meaning column reads as the pattern APPLIED. A verb's X takes whatever English
 * form its frame calls for — "after doing X" + eat = "after eating", "may do X" +
 * eat = "may eat" — so the scaffolding words ("do", "doing") do not survive into
 * the reading. A noun or adjective has no such frames, so it is filled plainly. A
 * gloss with no X slot is left as it is. */
function appliedGloss(gloss: string, ex: ExampleWord): string {
  if (!/\bX\b/.test(gloss)) return gloss;
  if (!ex.ing) {
    // A noun takes an article so a particle gloss reads ("from a book", not "from
    // book"); an adjective takes none ("too expensive", not "too a expensive").
    const filled =
      ex.cls === null ? `${/^[aeiou]/i.test(ex.en) ? "an" : "a"} ${ex.en}` : ex.en;
    return gloss.replace(/\bX\b/g, filled);
  }
  const base = ex.en;
  return (
    gloss
      // An adjective-only alternative sense (〜すぎる "too X", 〜そう "looks X")
      // does not apply to a verb row; drop it so the verb reading stands alone.
      .replace(/ \/ (?:too|looks?) X\b/g, "")
      // Inflected X first, so "of X-ing" is not caught by the "of X" gerund rule.
      .replace(/\bX-ing\b/g, ex.ing)
      .replace(/\bX-ed\b/g, ex.pp!)
      // A bare X after a conjunction needs a subject to read as a clause.
      .replace(/\beven if X\b/g, `even if you ${base}`)
      .replace(/\bif\/when X\b/g, `if/when you ${base}`)
      .replace(/\bif X\b/g, `if you ${base}`)
      .replace(/\bwhen X\b/g, `when you ${base}`)
      .replace(/\bbecause X\b/g, `because you ${base}`)
      // The other subordinate-clause frames — a complementizer ("that X"), a
      // concessive ("even though X"), a temporal ("whenever X"), a reason
      // ("that's why X") — all need a subject too, so the clause reads as English
      // and not a bare verb ("think that you eat", not "think that eat").
      .replace(/\bthat X\b/g, `that you ${base}`)
      .replace(/\beven though X\b/g, `even though you ${base}`)
      .replace(/\bwhenever X\b/g, `whenever you ${base}`)
      .replace(/\bwhy X\b/g, `why you ${base}`)
      // "be X" is written for an adjective/noun predicate ("might be expensive");
      // on a verb the "be" is wrong, so drop it: "might be X" -> "might eat".
      .replace(/\bbe X\b/g, base)
      // "of X" takes a gerund: "in the state of eating", "way of eating".
      .replace(/\bof X\b/g, `of ${ex.ing}`)
      // Scaffolded verb: do / doing / did / done / does X.
      .replace(/\bdoing X\b/g, ex.ing)
      .replace(/\bdone X\b/g, ex.pp!)
      .replace(/\bdid X\b/g, ex.past!)
      .replace(/\bdoes X\b/g, ex.s!)
      .replace(/\bdo X\b/g, base)
      // Bare X is the base form.
      .replace(/\bX\b/g, base)
  );
}

/** The derivation rows for a pattern on a host: for each accepted example, the
 * dictionary verb, the form the pattern attaches to (omitted where the word is
 * taken unchanged), the finished pattern, and what the finished pattern means.
 *
 * `labelClass` tags each row with its conjugation class (Godan / Ichidan·
 * irregular) — only asked for by the volitional form's own pattern page, where
 * the written pattern branches by class (〜(よ)うと思う's parenthesized よ) and a
 * single example would leave the branch unexplained. EXAMPLES.verb leads with
 * たべる (v1) before any godan verb, so `limit`'s first two rows are already one
 * of each class without any special selection here. */
function deriveRows(r: Recipe, host: Host, limit = 3, labelClass = false): IntroDeriveRow[] {
  const attach = r.attach.find((a) => a.host === host) ?? r.attach[0];
  if (!attach) return [];
  const rows: IntroDeriveRow[] = [];
  for (const ex of EXAMPLES[host]) {
    if (!recipeAllows(r, ex.word)) continue;
    const built = apply(r, ex.word, ex.cls);
    if (!built.ok || built.value === ex.word) continue;
    let form: string | undefined;
    if (attach.form && attach.form !== "dictionary" && ex.cls) {
      const c = conjugate(ex.word, ex.cls, attach.form as Form);
      if (c.ok && c.value !== ex.word) form = c.value;
    }
    const classLabel =
      labelClass && ex.cls
        ? ex.cls === "v1"
          ? "Ichidan/irregular, adds よう"
          : "Godan, adds う"
        : undefined;
    rows.push({
      verb: ex.word,
      form,
      result: built.value,
      gloss: appliedGloss(r.gloss, ex),
      ...(classLabel ? { classLabel } : {}),
    });
    if (rows.length >= limit) break;
  }
  return rows;
}

/** The instruction and compact formula for one host on a mixed pattern page.
 * Each section says what happens to THAT kind of word instead of relying on a
 * generic sentence above all the tables. */
function hostBuild(r: Recipe, host: Host): {
  instruction: string;
  formula: { base: string; add?: string; trim?: string };
} {
  const attachment = r.attach.find((candidate) => candidate.host === host)!;
  const word = HOST_FORMULA_LABEL[host];
  const article = /^[aeiouい]/i.test(word) ? "an" : "a";
  const add = attachment.add ?? "";
  const trim = attachment.trim;

  if (!attachment.form || attachment.form === "dictionary") {
    return {
      instruction: trim
        ? `Take ${article} ${word}, remove ${trim}, then add ${add}.`
        : add
          ? `Take ${article} ${word}, just as it is, and add ${add}.`
        : `Use ${article} ${word} just as it is.`,
      formula: { base: word, ...(trim ? { trim } : {}), ...(add ? { add } : {}) },
    };
  }

  const form = FORM_LABEL[attachment.form];
  const formPhrase = /^the /.test(form) ? form : `its ${form}`;
  const instruction = trim
    ? `Put ${article} ${word} into ${formPhrase}, remove ${trim}, then add ${add}.`
    : add
      ? `Put ${article} ${word} into ${formPhrase}, then add ${add}.`
    : `Put ${article} ${word} into ${formPhrase}.`;
  if (attachment.form === "prenominal") {
    return {
      instruction,
      formula: { base: word, add: ["な", add].filter(Boolean).join(" + ") },
    };
  }
  return {
    instruction,
    formula: {
      base: form,
      ...(trim ? { trim } : {}),
      ...(add ? { add } : {}),
    },
  };
}

/** The representative verbs an ending-change rule is shown across: one per godan
 * sound-change group, a る-verb, and the two irregulars, so the rule is seen to
 * hold class by class. Same spread the hand-authored form intros use. */
const RULE_VERBS: { label: string; word: string; cls: WordClass }[] = [
  { label: "う", word: "かう", cls: "v5u" },
  { label: "く", word: "かく", cls: "v5k" },
  { label: "ぐ", word: "およぐ", cls: "v5g" },
  { label: "む", word: "のむ", cls: "v5m" },
  { label: "す", word: "はなす", cls: "v5s" },
  { label: "る-verb", word: "たべる", cls: "v1" },
  { label: "する", word: "する", cls: "vs-i" },
  { label: "くる", word: "くる", cls: "vk" },
];

/** Length of the shared leading run of two kana strings. */
function commonPrefix(a: string, b: string): number {
  let i = 0;
  while (i < a.length && i < b.length && a[i] === b[i]) i++;
  return i;
}

/** An Ending·Change table for a standalone conjugation (the potential, passive,
 * causative, volitional, たら, ば): for each representative verb, the drop and add
 * that turn the dictionary form into that form, diffed off the shared prefix. A
 * verb whose whole shape shifts (an irregular, or する→できる) is shown whole via
 * `to`, the way the form intros show their irregulars. */
function standaloneRuleRows(form: Form): IntroBuildRule[] {
  const rows: IntroBuildRule[] = [];
  for (const v of RULE_VERBS) {
    const c = conjugate(v.word, v.cls, form);
    if (!c.ok || c.value === v.word) continue;
    const p = commonPrefix(v.word, c.value);
    if (p === 0) {
      // The whole word shifts (する→できる): no drop/add rule fits, so it is
      // shown whole and flagged irregular, the way the form intros do.
      rows.push({ label: "irregular", verb: v.word, to: c.value, gloss: WORD_GLOSS[v.word] });
    } else {
      rows.push({
        label: v.label,
        verb: v.word,
        drop: v.word.slice(p),
        add: c.value.slice(p),
        gloss: WORD_GLOSS[v.word],
      });
    }
  }
  return rows;
}

/** The verb set the grouped pattern tables are built across — the same verbs the
 * hand-authored て-form build page uses, so a pattern's tables read as the て-form's
 * carried through to the finished pattern. Grouped Godan / Ichidan / Exceptions. */
const PATTERN_TABLE_GROUPS: {
  title: string;
  heads?: { label?: string };
  /** When true, a row shows only where the word conjugates IRREGULARLY for this
   * recipe — i.e. differently from `regular`. Keeps 行く off 〜ます (行きます is the
   * plain rule) while keeping it on the て-form (行って). */
  irregular?: boolean;
  verbs: { label: string; word: string; cls: WordClass; regular?: WordClass; note?: string }[];
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
    // The ADJECTIVE forms, where the pattern conjugates one: い-adjective (高くて),
    // the いい exception (よくて — its stem is よ, not い), and な-adjective (静かで).
    // Self-filtering: a row shows only where apply transforms the word, so a
    // verb-only pattern gets no adjective table and 〜ば (adj-i only) shows no な row.
    title: "Adjectives",
    heads: { label: "Ending" },
    verbs: [
      { label: "い", word: "高い", cls: "adj-i", regular: "adj-i" },
      { label: "な", word: "静か", cls: "adj-na", regular: "adj-na" },
    ],
  },
  {
    title: "Irregular adjectives",
    heads: { label: "" },
    irregular: true,
    verbs: [
      {
        label: "exception",
        word: "いい",
        cls: "adj-ix",
        regular: "adj-i",
      },
    ],
  },
];

/**
 * A verb pattern's full conjugation, grouped the way the て-form build page groups
 * it (Godan / Ichidan / Exceptions), each verb built THROUGH to the finished
 * pattern — かう → かっている, たべる → たべている, する → している. Shown whole via `to`
 * because a pattern is several steps (drop the ending, add the form, add the
 * suffix) and the step-by-step mechanics live on the form's own page. A group with
 * no buildable verb (the recipe refuses them) is dropped; empty overall means the
 * caller falls back to the derivation table. */
function patternRuleTables(
  r: Recipe,
): { title: string; rules: IntroBuildRule[]; heads?: { label?: string } }[] {
  const tables: { title: string; rules: IntroBuildRule[]; heads?: { label?: string } }[] = [];
  for (const g of PATTERN_TABLE_GROUPS) {
    const rules: IntroBuildRule[] = [];
    for (const v of g.verbs) {
      if (!recipeAllows(r, v.word)) continue;
      const built = apply(r, v.word, v.cls);
      if (!built.ok || built.value === v.word) continue;
      // An irregular row appears only where the word actually breaks its regular
      // rule: 行く shows on the て-form (行って ≠ 行いて) but not on 〜ます (行きます is
      // the plain rule). Compared on the same word conjugated as its regular class.
      if (g.irregular && v.regular) {
        const reg = apply(r, v.word, v.regular);
        if (reg.ok && reg.value === built.value) continue;
      }
      rules.push({
        label: v.label,
        verb: v.word,
        to: built.value,
        note: v.note,
        gloss: WORD_GLOSS[v.word],
      });
    }
    if (rules.length) tables.push({ title: g.title, rules, heads: g.heads });
  }
  return tables;
}

/** Sentence-case a gloss for the hero line: "after doing X" → "After doing X." */
function heroFromGloss(gloss: string): string {
  const g = gloss.trim();
  const cap = g.charAt(0).toUpperCase() + g.slice(1);
  if (/[.!?…]$/.test(cap)) return cap;
  // A gloss that ENDS on a connective ("do X, and then") describes a link to a
  // following clause; a full stop makes the hero read as a dangling fragment
  // ("Do X, and then."), so an ellipsis signals the continuation instead.
  if (/\b(and then|and|then)$/i.test(cap)) return `${cap}…`;
  return `${cap}.`;
}

/** The build line for a WRAP pattern (〜たり〜たり, 〜は〜より, 〜しか〜ない): it has
 * two slots, so the single-slot line would describe only the opening half and read
 * as if the whole pattern were "た-form + り". Describe both halves. */
function wrapBuild(r: Recipe): string {
  const open = r.attach[0];
  const close = r.wrap?.close?.[0];
  if (!open || !close) return "";
  const bareNoun = (h: Host) => HOST_ARTICLE[h].replace(/^an? /, "");
  const part = (a: { host: Host; form: Form | null; add?: string }, art: string) => {
    const label = a.form && a.form !== "dictionary" ? FORM_LABEL[a.form] : null;
    const base = label ? `${art} ${bareNoun(a.host)}'s ${label}` : `${art} ${bareNoun(a.host)}`;
    return a.add ? `${base} and add ${a.add}` : base;
  };
  const secondArt = close.host === open.host ? "another" : "a";
  return `Take ${part(open, "one")}, then ${part(close, secondArt)}.`;
}

/** The concrete verbs a wrap's worked pair is shown on: eat, drink, talk, the
 * same everyday trio the て-pages build their examples on. */
const WRAP_PAIR_VERBS = ["たべる", "のむ", "はなす"];

/** A worked PAIR for a wrap pattern. `apply` refuses a wrap (it needs two words),
 * so the derivation table would be empty; but a verb+verb wrap (〜たり〜たり) has an
 * obvious worked example: build the open half on one verb and the close half on
 * another and join them (たべたり + のんだりする = たべたりのんだりする). Only
 * verb+verb wraps get this; a noun-slot wrap (〜しか〜ない, 〜は〜より) has no clean
 * pair, so it keeps the build line alone. */
function wrapDeriveRows(r: Recipe): IntroDeriveRow[] {
  const open = r.attach[0];
  const close = r.wrap?.close?.[0];
  if (!open || !close || open.host !== "verb" || close.host !== "verb") return [];
  const half = (a: { form: Form | null; add?: string }, ex: ExampleWord): string | null => {
    if (!ex.cls) return null;
    const base =
      a.form && a.form !== "dictionary"
        ? conjugate(ex.word, ex.cls, a.form as Form)
        : { ok: true as const, value: ex.word };
    return base.ok ? base.value + (a.add ?? "") : null;
  };
  const pool = WRAP_PAIR_VERBS.map((w) => EXAMPLES.verb.find((e) => e.word === w)).filter(
    (e): e is ExampleWord => Boolean(e) && recipeAllows(r, (e as ExampleWord).word),
  );
  const rows: IntroDeriveRow[] = [];
  for (let i = 0; i + 1 < pool.length && rows.length < 2; i += 1) {
    const a = pool[i];
    const b = pool[i + 1];
    const oa = half(open, a);
    const ob = half(close, b);
    if (!oa || !ob) continue;
    // "do things like X and Y" reads as the two verbs in -ing: eating and drinking.
    const gloss = r.gloss.replace(/\bX\b/g, a.ing ?? a.en).replace(/\bY\b/g, b.ing ?? b.en);
    rows.push({ verb: `${a.word}・${b.word}`, result: oa + ob, gloss });
  }
  return rows;
}

/**
 * The teach page for one pattern, in 〜ている-page-1 shape: a hero claim (the
 * meaning), a build line, and the build table. The eyebrow carries the pattern
 * itself so the reader always sees the written form.
 */
export function autoPatternPage(r: Recipe): PhaseIntro {
  const host = pageHost(r);
  const attach = r.attach.find((a) => a.host === host) ?? r.attach[0];
  const formLabel = attach?.form ? FORM_LABEL[attach.form] : null;
  const add = attach?.add ?? "";

  // The build line: how the pattern is made. "Take a verb's て-form and add から."
  // A form with no suffix (〜ば, 〜たら) is the pattern itself; a null form (a
  // noun) is taken as it is. Some form labels are a noun ("て-form") and some a
  // phrase ("the form it takes before a noun"); the phrase ones slot after "into"
  // rather than after a possessive, so they don't read as "a な-adjective's the
  // form…".
  const on = HOST_ARTICLE[host];
  const dict = attach?.form === "dictionary";
  const phrase = formLabel ? /^the /.test(formLabel) : false;
  let build: string;
  if (dict) {
    // The dictionary form is the word doing nothing, so it takes no possessive:
    // "Take a verb, just as it is, and add と思う", never "a verb's just as it is".
    build = add ? `Take ${on}, just as it is, and add ${add}.` : `Take ${on} just as it is.`;
  } else if (formLabel && add) {
    build = phrase
      ? `Put ${on} into ${formLabel}, then add ${add}.`
      : `Take ${on}'s ${formLabel} and add ${add}.`;
  } else if (formLabel) {
    build = phrase ? `Put ${on} into ${formLabel}.` : `Put ${on} into its ${formLabel}.`;
  } else if (add) {
    build = `Take ${on} and add ${add}.`;
  } else {
    build = `Attach it to ${on}.`;
  }
  // A wrap has a second slot the single-slot line above cannot describe.
  if (r.wrap?.close?.length) build = wrapBuild(r);
  // When the form IS the whole pattern (nothing added: the potential, passive,
  // causative, たら, ば), the verb→result derivation would repeat itself, since the
  // form and the result are the same word. Teach the conjugation instead, with the
  // Ending·Change rule table the form intros use, so the rule is shown, not just an
  // input and an output. Otherwise the form is a prerequisite taught on its own
  // page, and the derivation table shows it slotting into the pattern.
  const standalone =
    host === "verb" && !!attach?.form && attach.form !== "dictionary" && !attach.add;
  const ruleRows = standalone ? standaloneRuleRows(attach.form as Form) : [];
  // A VERB pattern that adds a suffix to a form (〜ている, 〜てから, 〜ないでください)
  // shows its whole conjugation grouped Godan / Ichidan / Exceptions, the て-form's
  // tables carried through to the finished pattern. Empty for a non-verb pattern
  // (a noun/adjective one), which falls back to the derivation table below.
  const verbSuffix =
    host === "verb" && !!attach?.form && attach.form !== "dictionary" && !!attach.add;
  const buildTables = verbSuffix && !r.wrap?.close?.length ? patternRuleTables(r) : [];
  // The "how to build it" formula: the form in a dashed box, then + the suffix —
  // [ない-form] + でください. A pattern that TRIMS the form first shows the drop too —
  // [ます-form] − ます + ましょう — so the formula stays honest.
  const buildFormula =
    verbSuffix && !r.wrap?.close?.length && formLabel && add
      ? { base: formLabel, add, ...(attach?.trim ? { trim: attach.trim } : {}) }
      : undefined;
  // A wrap builds its own worked pair (apply refuses two-slot patterns); a plain
  // pattern derives one row per example verb.
  const wrapRows = r.wrap?.close?.length ? wrapDeriveRows(r) : [];
  const deriveRules = wrapRows.length ? wrapRows : deriveRows(r, host);
  const deriveTables = (wrapRows.length ? [host] : [...new Set(r.attach.map((a) => a.host))])
        .map((sectionHost) => {
          const attachment = r.attach.find((a) => a.host === sectionHost);
          // One row is enough here: the formula already states the rule, and a
          // pattern page gives each distinct word class its own section. The
          // volitional form is the one exception — its OWN written form (the
          // parenthesized よ) branches by class, so one example can only ever
          // show half the rule. Two rows, labeled, so both halves are visible
          // on the page that actually needs them.
          const onVolitional = attachment?.form === "volitional" && !!attachment.add;
          const rules = wrapRows.length
            ? wrapRows
            : deriveRows(r, sectionHost, onVolitional ? 2 : 1, onVolitional);
          const sectionBuild = wrapRows.length ? null : hostBuild(r, sectionHost);
          const form = attachment?.form;
          const formHead =
            form && form !== "dictionary"
              ? form === "prenominal"
                ? "〜な form"
                : FORM_LABEL[form]
              : undefined;
          // The pattern's own written form carries a parenthesized よ because the
          // volitional ending it's built on branches by class, and nothing else
          // on THIS page (the build table's two labeled rows aside) says why in
          // words. Said here, in the build instruction, not as a separate aside.
          const instruction = onVolitional
            ? `${sectionBuild?.instruction ?? build} A godan verb shifts to う; an ichidan verb or irregular adds よう, which is why the pattern is written ${r.pattern}.`
            : (sectionBuild?.instruction ?? build);
          // Two pills instead of one, for the same reason the derive table
          // above gets two rows: a single "[let's-form] + と思う" formula
          // never shows WHICH ending, う or よう, actually lands.
          const formula = onVolitional
            ? ([
                { label: "Godan", base: "う", add: attachment!.add },
                { label: "Ichidan/irregular", base: "よう", add: attachment!.add },
              ] as const)
            : sectionBuild?.formula;
          return {
            title: HOST_SECTION_TITLE[sectionHost],
            instruction,
            ...(formula ? { formula } : {}),
            rules,
            heads: { verb: HOST_COLUMN_TITLE[sectionHost], form: formHead },
          };
        })
        .filter((table) => table.rules.length > 0);

  if (deriveTables.length) build = "";

  const sentenceExample = sentenceExampleFor(r);

  // The header LEADS with the written pattern — "〜てから: After doing X." — so a
  // learner gets used to reading the pattern in its 〜て… form, then a human
  // explanation, then the build blurb and table (the 〜ている-page-1 shape).
  return {
    id: `gl-auto-${r.id}`,
    setId: "",
    eyebrow: "Grammar",
    // Same string the Library entry header shows for this pattern (see
    // grammar-entry-view.tsx, which reads a live item's glyph or
    // libEntry(...).glyph — both trace back to this same patternLabel call).
    // The eyebrow above is shared by every auto-generated pattern card
    // ("Grammar"), so it cannot tell three upcoming patterns apart; `name`
    // is what does.
    name: patternLabel(r),
    title: `${r.pattern}: ${heroFromGloss(r.gloss)}`,
    body: [{ text: build }],
    ...(buildFormula ? { buildFormula } : {}),
    ...(deriveTables.length
      ? { deriveTables }
      : ruleRows.length
        ? { buildRules: ruleRows, buildHeads: { label: "Ending" } }
        : buildTables.length
          ? { buildTables }
          : deriveRules.length
            ? { deriveRules, deriveHeads: { form: formLabel ?? undefined } }
            : {}),
    ...(sentenceExample ? { sentenceExample } : {}),
  };
}
