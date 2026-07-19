// A recipe, read out as a FORMULA rather than as a finished string.
//
// WHY THIS EXISTS WHEN build.ts ALREADY BUILDS ROWS
// =================================================
// build.ts answers "what does this pattern look like on 行く" and returns
// `built` and `how` as STRINGS — 行ってから, and "行って + から". That is exactly
// right for the cluster page, whose job is a column of finished examples you can
// read down and compare.
//
// The entry page asks a different question. It is about ONE pattern, and the
// thing a learner needs from one pattern is not another worked example, it is
// the RULE: take any verb, put it in its て-form, add から. A pre-joined string
// cannot be typeset — the slot cannot be dashed, the suffix cannot be tinted,
// the arrow cannot be an arrow — and reaching into "行って + から" with a split
// on " + " to recover the parts would be reading display text to recover a
// structural fact, which is the exact mistake build.ts's own header records
// itself having made and undone (the old `complete` flag).
//
// So this file returns STRUCTURE and the component does the typesetting. The
// numbers underneath are still the engine's: `worked` is apply() run against
// real vehicle words, so the 音便 and the suppletive stems are correct here for
// the same reason they are correct on the cluster page. Nothing in this file
// knows any Japanese.
//
// NOTHING HERE IS HARDCODED PER PATTERN. The only tables are FORM_LABEL and
// HOST_LABEL, which translate the codebase's own vocabulary ("adj-i", "te") into
// the reader's ("い-adjective", "て-form"), and that is a naming job rather than
// a content one. Add a recipe to recipes.ts and its formula appears.

import { apply } from "./apply.ts";
import { buildRow } from "./build.ts";
import { vehiclesFor } from "./vehicles.ts";
import type { Attachment, Host, Recipe } from "../../data/grammar/recipes.ts";
import type { Form } from "../conjugate/index.ts";

/**
 * What a host is called on screen. Plain words, not the table's ids: "adj-i" is
 * this codebase's vocabulary, not the reader's.
 *
 * Exported because the entry page names hosts in three places — the muted line
 * under the pattern, the production chips, and the formula's slot — and three
 * copies of this map would be three chances to disagree about what a な-adjective
 * is called.
 */
export const HOST_LABEL: Record<Host, string> = {
  verb: "verb",
  "adj-i": "い-adjective",
  "adj-na": "な-adjective",
  noun: "noun",
};

/** The indefinite article each label wants. English, and irregular enough that
 * a vowel test would get "an い-adjective" wrong — the label starts with a kana.
 *
 * Exported for the same reason HOST_LABEL is: the cluster page's group headings
 * read "On an い-adjective", and a second article table would be a second chance
 * to disagree with this one about which hosts take "an". */
export const HOST_ARTICLE: Record<Host, string> = {
  verb: "a verb",
  "adj-i": "an い-adjective",
  "adj-na": "a な-adjective",
  noun: "a noun",
};

/**
 * A form's name, in the way a learner meets it.
 *
 * The engine's `Form` ids are English camelCase because they are code; a reader
 * looking at 〜てから has met "the て-form" and has never met "te". Where the
 * Japanese name is the one in circulation it is used as-is (て-form, ない-form);
 * where it is not, the description is (the stem, the form before a noun).
 *
 * `dictionary` is NOT "dictionary form" here and that is deliberate. In a
 * formula the dictionary form is the word doing nothing, and a step that reads
 * "any verb → dictionary form → + ことができる" invites the reader to look for a
 * transformation that is not there. "just as it is" says the true thing, which
 * is that this pattern asks nothing of the word. It is also why these patterns
 * have no production fact at all (see isVacuous in recipes.ts) — the page and
 * the scheduler agree, from the same data, for the same reason.
 */
export const FORM_LABEL: Record<Form, string> = {
  dictionary: "just as it is",
  masu: "ます-form",
  masuPast: "ました-form",
  masuNegative: "ません-form",
  te: "て-form",
  ta: "た-form",
  nai: "ない-form",
  naiPast: "なかった-form",
  potential: "potential form",
  passive: "passive form",
  causative: "causative form",
  causativePassive: "causative-passive form",
  imperative: "command form",
  volitional: "let's-form",
  ba: "ば-form",
  tara: "たら-form",
  tai: "たい-form",
  teiru: "ている-form",
  // Named by what it IS rather than by 連用形, which is the word for someone who
  // already knows it. The parenthetical is the whole definition and it is short
  // enough to carry: every reader has met ます by the time they meet 〜すぎる.
  stem: "stem (the ます-form minus ます)",
  adverb: "adverb form",
  prenominal: "the form it takes before a noun",
  polite: "polite form",
};

/** One worked instance of a formula: the word you start from and what it becomes. */
export interface Worked {
  /** The dictionary word. 食べる. For a wrap, both slots' words joined. */
  readonly from: string;
  /** The pattern built on it. 食べてから */
  readonly to: string;
}

/**
 * One host's way of building a pattern, in parts a component can typeset.
 *
 * Every field is nullable where the pattern genuinely has nothing there, rather
 * than carrying an empty string that would render as a stray operator. That
 * matters: build.ts records printing "行けば + " with an empty right-hand side
 * and how badly it read, and this is the same hazard one layer up.
 */
export interface Formula {
  readonly host: Host;
  /** The dashed slot's text. "any verb" */
  readonly slot: string;
  /**
   * The form the word goes into, or null when the word is taken as it is.
   *
   * Null and "just as it is" are different states on purpose. Null is the NOUN
   * case (`form: null` in the attachment — 本 + だけ, nothing to conjugate);
   * "just as it is" is the DICTIONARY case, where a form was named and it
   * happens to be the identity. The reader sees the same thing either way; the
   * data does not, and flattening them here would lose the distinction for the
   * next caller.
   */
  readonly formLabel: string | null;
  /** Text stripped off the form's end before adding. "い" on 〜なければならない. */
  readonly trim: string | null;
  /** The fixed string added, or null when the form IS the pattern (〜ば, 〜たら). */
  readonly add: string | null;
  /** Real words through the real engine. Empty only if nothing would build. */
  readonly worked: readonly Worked[];
  /**
   * Does the whole pattern wrap around a phrase — i.e. does a worked example
   * here take TWO words?
   *
   * A field rather than something the component infers, because the only thing
   * left to infer it from is the shape of `from` ("本 + 読む" has a plus in it),
   * and reading display text to recover a structural fact is the mistake
   * build.ts records making with its old `complete` flag. The component needs
   * it because "Any noun you know: 本 + 読む → 本しか読まない" names one host and
   * then shows two words, which is a small lie in the lead-in of a line whose
   * whole job is to be checkable.
   */
  readonly wraps: boolean;
}

/** A pattern's build, opening half and (for a wrap) closing half. */
export interface RecipeFormula {
  /** One per host the opening half attaches to, in the recipe's own order. */
  readonly opening: readonly Formula[];
  /**
   * One per host the CLOSING half attaches to. Empty for the 77 recipes that
   * are not wraps — see the Wrap doc in recipes.ts for why four of them are.
   */
  readonly closing: readonly Formula[];
}

/** How many worked examples a formula carries. Three, because three is what it
 * takes to show that the rule is a rule: one ichidan, one godan and one
 * irregular land differently and the reader can see the ending survive all
 * three. Two looked like a coincidence; four ran off the line. */
const WORKED = 3;

/**
 * The pattern's build, ready to typeset.
 *
 * One entry in `opening` per attachment, NOT per production fact. Those are
 * different populations and the page needs the wider one: 〜ので attaches to a
 * verb and to a な-adjective but carries a production fact only for the
 * adjective (the verb half is 行く retyped), and a card that showed only what is
 * scored would be telling the reader 〜ので is an adjective pattern. The chips
 * above say what is scored; this card says what is true.
 */
export function recipeFormula(r: Recipe): RecipeFormula {
  return {
    opening: r.attach.map((a) => formulaFor(r, a, false)),
    closing: (r.wrap?.close ?? []).map((a) => formulaFor(r, a, true)),
  };
}

function formulaFor(r: Recipe, a: Attachment, closing: boolean): Formula {
  return {
    host: a.host,
    slot: `any ${HOST_LABEL[a.host]}`,
    formLabel: a.form === null ? null : FORM_LABEL[a.form],
    trim: a.trim ?? null,
    // "" is a real and common value — for 〜ば, 〜たら, the potential and bare
    // 〜て the pattern IS a form the engine already produces and there is no
    // suffix. It becomes null so the component can drop the "+" instead of
    // printing one with nothing after it.
    add: a.add === "" ? null : a.add,
    // A closing half has no formula of its own to work: applyWrap needs both
    // slots, and the worked line for a wrap already shows the whole thing on the
    // opening half's row. A second copy of 行ったり読んだりする under the closing
    // half would read as a second, different example.
    worked: closing ? [] : workedFor(r, a.host),
    wraps: r.wrap !== undefined,
  };
}

/**
 * Up to WORKED real words run through the real engine, for one host.
 *
 * ONE PER CONJUGATION CLASS. The vehicle pool lists 食べる, 見る and 起きる, all
 * v1, all doing the identical thing to their stem — three rows of that teach
 * exactly as much as one and use up the space where a godan would have gone.
 * Taking the first vehicle of each distinct class instead gives 行く (v5k-s,
 * the irregular て), 食べる (v1) and 書く (v5k), which is three different 音便 in
 * one line and is the whole argument that the rule generalises.
 *
 * A wrap cannot be worked this way — apply() refuses a single word, correctly,
 * and handing back half a pattern is the bug that refusal exists to prevent. So
 * a wrap borrows buildRow, which knows how to fill both slots, and gets one
 * example rather than three.
 */
function workedFor(r: Recipe, host: Host): Worked[] {
  if (r.wrap) {
    const row = buildRow(r, host);
    return row ? [{ from: row.on.join(" + "), to: row.built }] : [];
  }
  const out: Worked[] = [];
  const seen = new Set<string>();
  for (const v of vehiclesFor(r, host)) {
    // A noun has no class; keying every noun on the same null would let exactly
    // one through. The surface word is the fallback key, which for nouns means
    // "all of them are distinct" — correct, since a noun's build is the word
    // plus a string and the words are what differ.
    const key = v.cls ?? v.surface;
    if (seen.has(key)) continue;
    const built = apply(r, v.surface, v.cls);
    if (!built.ok) continue;
    // The word unchanged is not a worked example, it is the word. Same guard
    // example.ts uses before baking a production fact, and for the same reason.
    if (built.value === v.surface) continue;
    seen.add(key);
    out.push({ from: v.surface, to: built.value });
    if (out.length >= WORKED) break;
  }
  return out;
}

/**
 * "attaches to a verb", "attaches to a verb, an い-adjective or a な-adjective".
 *
 * The muted line under a pattern's gloss, and the one thing about a pattern that
 * is neither its meaning nor its build: WHAT YOU CAN HANG IT ON. A learner who
 * knows 〜すぎる means "too much" and does not know it takes adjectives will
 * never write 高すぎる.
 *
 * A wrap says both ends, because "attaches to a noun" is false about 〜しか〜ない
 * in a way that matters — the ない at the far end is on a verb, and a reader told
 * only about the noun has been given half the pattern.
 */
export function attachesTo(r: Recipe): string {
  const open = listHosts(r.attach);
  const close = listHosts(r.wrap?.close ?? []);
  if (!open) return "";
  if (!close) return `attaches to ${open}`;
  return `wraps around a phrase: opens on ${open}, closes on ${close}`;
}

/** "a verb, an い-adjective or a な-adjective" — distinct hosts, in order, with
 * an Oxford-free "or" before the last. Empty string for no hosts, which the
 * caller drops rather than printing a sentence with a hole in it. */
function listHosts(as: readonly Attachment[]): string {
  const hosts = [...new Set(as.map((a) => a.host))].map((h) => HOST_ARTICLE[h]);
  if (hosts.length === 0) return "";
  if (hosts.length === 1) return hosts[0] as string;
  return `${hosts.slice(0, -1).join(", ")} or ${hosts[hosts.length - 1]}`;
}
