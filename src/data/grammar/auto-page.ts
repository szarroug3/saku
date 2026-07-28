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
import type { Host, Recipe } from "@/data/grammar/recipes";
import type { IntroBuildRule, IntroDeriveRow, PhaseIntro } from "@/data/phase-intros";

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
  if (!ex.ing) return gloss.replace(/\bX\b/g, ex.en); // a noun or adjective: plain fill
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
 * taken unchanged), the finished pattern, and what the finished pattern means. */
function deriveRows(r: Recipe, host: Host): IntroDeriveRow[] {
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
    rows.push({ verb: ex.word, form, result: built.value, gloss: appliedGloss(r.gloss, ex) });
    if (rows.length >= 3) break;
  }
  return rows;
}

/** The representative verbs an ending-change rule is shown across: one per godan
 * sound-change group, an る-verb, and the two irregulars, so the rule is seen to
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
      rows.push({ label: "irregular", verb: v.word, to: c.value });
    } else {
      rows.push({ label: v.label, verb: v.word, drop: v.word.slice(p), add: c.value.slice(p) });
    }
  }
  return rows;
}

/** Sentence-case a gloss for the hero line: "after doing X" → "After doing X." */
function heroFromGloss(gloss: string): string {
  const g = gloss.trim();
  const cap = g.charAt(0).toUpperCase() + g.slice(1);
  return /[.!?]$/.test(cap) ? cap : `${cap}.`;
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

  // The header LEADS with the written pattern — "〜てから: After doing X." — so a
  // learner gets used to reading the pattern in its 〜て… form, then a human
  // explanation, then the build blurb and table (the 〜ている-page-1 shape).
  return {
    id: `gl-auto-${r.id}`,
    setId: "",
    eyebrow: "Grammar",
    title: `${r.pattern}: ${heroFromGloss(r.gloss)}`,
    body: [{ text: build }],
    ...(ruleRows.length
      ? { buildRules: ruleRows, buildHeads: { label: "Ending" } }
      : { deriveRules: deriveRows(r, host), deriveHeads: { form: formLabel ?? undefined } }),
  };
}
