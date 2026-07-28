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
import type { IntroDeriveRow, PhaseIntro } from "@/data/phase-intros";

/** One example word for the build table: the kana form, its class (null for a
 * noun, which does not conjugate), and its English meaning. */
interface ExampleWord {
  word: string;
  cls: WordClass | null;
  en: string;
}

/** A small, beginner-friendly example set per host — common words whose readings
 * are kana the learner can read, chosen to span the conjugation classes so a rule
 * is shown to hold across them. Filtered per recipe, three shown. */
const EXAMPLES: Record<Host, ExampleWord[]> = {
  verb: [
    { word: "たべる", cls: "v1", en: "eat" },
    { word: "のむ", cls: "v5m", en: "drink" },
    { word: "かく", cls: "v5k", en: "write" },
    { word: "かう", cls: "v5u", en: "buy" },
    { word: "はなす", cls: "v5s", en: "speak" },
    { word: "あそぶ", cls: "v5b", en: "play" },
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

/** The pattern's gloss with its X slot filled by the verb's meaning, so the
 * Meaning column reads as the pattern APPLIED — "go in order to X" + "write" =
 * "go in order to write". A gloss with no X slot is left as it is. */
function appliedGloss(gloss: string, verbEn: string): string {
  return /\bX\b/.test(gloss) ? gloss.replace(/\bX\b/g, verbEn) : gloss;
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
    rows.push({ verb: ex.word, form, result: built.value, gloss: appliedGloss(r.gloss, ex.en) });
    if (rows.length >= 3) break;
  }
  return rows;
}

/** Sentence-case a gloss for the hero line: "after doing X" → "After doing X." */
function heroFromGloss(gloss: string): string {
  const g = gloss.trim();
  const cap = g.charAt(0).toUpperCase() + g.slice(1);
  return /[.!?]$/.test(cap) ? cap : `${cap}.`;
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
  const phrase = formLabel ? /^the /.test(formLabel) : false;
  let build: string;
  if (formLabel && add) {
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

  // The header LEADS with the written pattern — "〜てから: After doing X." — so a
  // learner gets used to reading the pattern in its 〜て… form, then a human
  // explanation, then the build blurb and table (the 〜ている-page-1 shape).
  return {
    id: `gl-auto-${r.id}`,
    setId: "",
    eyebrow: "Grammar",
    title: `${r.pattern}: ${heroFromGloss(r.gloss)}`,
    body: [{ text: build }],
    deriveRules: deriveRows(r, host),
    deriveHeads: { form: formLabel ?? undefined },
  };
}
