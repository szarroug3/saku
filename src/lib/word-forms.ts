// The bridge from a word's dictionary tags to the conjugation engine, and the
// grouping that makes ~19 forms readable on a page.
//
// WHY THIS FILE HAD TO EXIST AT ALL
// =================================
// The engine works. `conjugateAll("生きる", "v1")` has returned 19 correct forms
// since the day it landed. Nothing called it, and nothing could: the engine
// speaks JMdict `<pos>` CODES ("v1", "v5k-s") and vocab.json stores JMdict's
// EXPANDED names ("Ichidan verb", "Godan verb - Iku/Yuku special class"). The
// two vocabularies never met — `classFromTags` had no callers anywhere in the
// app, because handing it a vocab row's `pos` returns null for every word in the
// dictionary. This map is the missing half.
//
// THE TRAP, AND WHY THE TEST BELOW IS NOT OPTIONAL
// ===============================================
// This map was built twice before, in throwaway scripts, and BOTH times it
// covered only the nine regular godan strings. 行く is tagged "Godan verb -
// Iku/Yuku special class"; unmapped, it came back as "not a verb" and simply
// never conjugated. THAT FAILURE IS SILENT. There is no error, no refusal to
// inspect, no missing-key warning — a verb with no class is indistinguishable
// from a noun, and the page just doesn't show a Forms section. Twice, that
// produced confidently wrong findings.
//
// So the special classes are covered here explicitly and named in comments, and
// word-forms.test.ts asserts that EVERY entry in the engine's SUPPORTED_CLASSES
// is reachable from at least one real pos string in vocab.json. A future JMdict
// re-ingest that renames a tag fails that test loudly instead of quietly
// dropping a class on the floor.

import { classFromTags, conjugateAll, type Form, type WordClass } from "@/lib/conjugate";
import type { VocabRow } from "@/data/vocab";

/**
 * JMdict's expanded `<pos>` name → the engine's class code.
 *
 * Keyed on the exact string vocab.json stores. All 22 of the engine's supported
 * classes appear here; the other 30 pos strings in the file are nouns, adverbs,
 * particles and markers, which have no conjugation class and correctly resolve
 * to null.
 */
export const POS_TO_CLASS: Readonly<Record<string, WordClass>> = {
  // --- godan, the nine regular endings ---
  "Godan verb with 'u' ending": "v5u",
  "Godan verb with 'ku' ending": "v5k",
  "Godan verb with 'gu' ending": "v5g",
  "Godan verb with 'su' ending": "v5s",
  "Godan verb with 'tsu' ending": "v5t",
  "Godan verb with 'nu' ending": "v5n",
  "Godan verb with 'bu' ending": "v5b",
  "Godan verb with 'mu' ending": "v5m",
  "Godan verb with 'ru' ending": "v5r",

  // --- godan, the special classes. THESE ARE THE ONES THAT GET MISSED. ---
  // Each is a real verb a beginner meets, and each is a separate string that
  // does not contain any of the nine above as a substring — so no amount of
  // pattern-matching on "Godan verb with" finds them.
  "Godan verb - Iku/Yuku special class": "v5k-s", // 行く — irregular 音便 (行って, not 行いて)
  "Godan verb with 'u' ending (special class)": "v5u-s", // 問う — 問うて, not 問って
  "Godan verb - -aru special class": "v5aru", // 下さる, ござる — irregular い-stem
  "Godan verb with 'ru' ending (irregular verb)": "v5r-i", // ある — suppletive negative ない

  // --- ichidan ---
  "Ichidan verb": "v1",
  "Ichidan verb - kureru special class": "v1-s", // くれる — imperative くれ, not くれろ
  "Ichidan verb - zuru verb (alternative form of -jiru verbs)": "vz", // 演ずる

  // --- irregular ---
  "suru verb - included": "vs-i", // する itself, and 勉強する as one entry
  "suru verb - special class": "vs-s", // 愛する
  "Kuru verb - special class": "vk", // 来る

  // --- adjectives ---
  "adjective (keiyoushi)": "adj-i",
  "adjective (keiyoushi) - yoi/ii class": "adj-ix", // いい / よい — よかった, not いかった
  "adjectival nouns or quasi-adjectives (keiyodoshi)": "adj-na",
};

/**
 * A word's conjugation class, or null when it does not conjugate.
 *
 * Null is the answer for two thirds of the vocabulary and it is not a gap: most
 * words are nouns. It is also the right answer for the 2,382 する-nouns — 勉強 is
 * tagged "noun or participle which takes the aux. verb suru", and what conjugates
 * is する, not 勉強 (see `conjugateSuruNoun` and the `vs` note in policy.ts).
 * Those are deliberately left out of the map rather than pointed at vs-i, which
 * would emit 勉強られる and friends.
 */
export function wordClassOf(w: VocabRow): WordClass | null {
  const codes = w.pos.map((p) => POS_TO_CLASS[p]).filter((c): c is WordClass => c !== undefined);
  // Back through the engine's own resolver rather than returning codes[0]: it
  // is the thing that knows which codes it can drive, so a class this map names
  // and the engine later drops cannot slip through.
  return classFromTags(codes);
}

/** Whether a class is an adjective paradigm — it takes a different set of axes
 * below, because "who does it to whom" is not a question you can ask of 高い. */
function isAdjective(cls: WordClass): boolean {
  return cls === "adj-i" || cls === "adj-ix" || cls === "adj-na";
}

/**
 * ONLY VERBS AND い-ADJECTIVES GET A FORMS SECTION.
 *
 * な-adjectives are excluded on purpose. 静か conjugates through the copula
 * (静かです / 静かだった), which is a pattern about だ rather than a shape of 静か,
 * and printing it as "forms of 静か" would teach the wrong owner for the change.
 * It is grammar, and it is scored on the grammar side.
 */
export function hasForms(cls: WordClass): boolean {
  return cls !== "adj-na";
}

/**
 * One axis of change, and the reason the section is grouped rather than listed.
 *
 * Nineteen forms in one column is a wall: nothing tells you that 食べます and
 * 食べました are the same move made twice, or that 食べられる and 食べさせる are a
 * pair of opposite ones. Grouped, each block is a single question — "how do I
 * make it polite", "how do I say who did it to whom" — and the answer is two or
 * three rows you can compare side by side.
 */
export interface FormGroup {
  /** The question this block answers, in the reader's words. */
  readonly title: string;
  readonly rows: readonly { readonly label: string; readonly form: Form }[];
}

/**
 * The verb axes. Every one of the 19 verb forms appears in exactly one group —
 * asserted in word-forms.test.ts, so a form added to the engine cannot silently
 * fail to reach the page.
 *
 * Labels say what the form DOES, never what it is called. "連用形" and "volitional"
 * are the same kind of word as "godan": real terminology the owner's textbook
 * teaches, and not what the app leads with.
 */
const VERB_GROUPS: readonly FormGroup[] = [
  {
    title: "Plain and polite",
    rows: [
      { label: "plain", form: "dictionary" },
      { label: "polite", form: "masu" },
    ],
  },
  {
    title: "Past and negative",
    rows: [
      { label: "past", form: "ta" },
      { label: "not", form: "nai" },
      { label: "didn’t", form: "naiPast" },
      { label: "polite past", form: "masuPast" },
      { label: "polite, not", form: "masuNegative" },
    ],
  },
  {
    title: "Joining and conditions",
    rows: [
      { label: "and then", form: "te" },
      { label: "if", form: "ba" },
      { label: "if / when", form: "tara" },
    ],
  },
  {
    title: "Who does it to whom",
    rows: [
      { label: "can do it", form: "potential" },
      { label: "it’s done to them", form: "passive" },
      { label: "make or let them do it", form: "causative" },
      { label: "made to do it", form: "causativePassive" },
    ],
  },
  {
    title: "Asking, wanting, doing now",
    rows: [
      { label: "an order", form: "imperative" },
      { label: "let’s", form: "volitional" },
      { label: "want to", form: "tai" },
      { label: "doing it now", form: "teiru" },
    ],
  },
  {
    title: "The stem",
    rows: [{ label: "the stem", form: "stem" }],
  },
];

/**
 * The adjective axes — the same first three, then the one that replaces "who
 * does it to whom".
 *
 * An adjective has no agent, so that axis has nothing to hold; what it has
 * instead is two ways of attaching to the rest of the sentence, which verbs do
 * not. Keeping the shared axes in the same order and the same words means the
 * two kinds of page still read as one design.
 */
const ADJ_GROUPS: readonly FormGroup[] = [
  {
    title: "Plain and polite",
    rows: [
      { label: "plain", form: "dictionary" },
      { label: "polite", form: "polite" },
    ],
  },
  {
    title: "Past and negative",
    rows: [
      { label: "past", form: "ta" },
      { label: "not", form: "nai" },
      { label: "wasn’t", form: "naiPast" },
    ],
  },
  {
    title: "Joining and conditions",
    rows: [
      { label: "and", form: "te" },
      { label: "if", form: "ba" },
      { label: "if / when", form: "tara" },
    ],
  },
  {
    title: "Describing and modifying",
    rows: [
      { label: "before a noun", form: "prenominal" },
      { label: "describing how", form: "adverb" },
    ],
  },
  {
    title: "The stem",
    rows: [{ label: "the stem", form: "stem" }],
  },
];

export function groupsFor(cls: WordClass): readonly FormGroup[] {
  return isAdjective(cls) ? ADJ_GROUPS : VERB_GROUPS;
}

/** One printable row: the label, and the form the engine actually produced. */
export interface BuiltForm {
  readonly label: string;
  readonly form: Form;
  readonly value: string;
}

export interface BuiltGroup {
  readonly title: string;
  readonly rows: readonly BuiltForm[];
}

/**
 * Every form of a word, grouped and ready to print — or null when the word does
 * not conjugate.
 *
 * NO TRUNCATION, AND NO COUNT ON SCREEN. The maximum is 19 for every verb class
 * and 11 for every adjective class, so there is never a list long enough to need
 * cutting, and a "19 forms" caption would be counting something the reader can
 * see. A group whose forms were ALL refused is dropped rather than printed
 * empty: ある has no potential, passive, causative or imperative (policy.ts), so
 * its "who does it to whom" block genuinely has nothing in it, and an empty
 * block reads as broken data rather than as a defective verb.
 */
export function formsOfWord(w: VocabRow): readonly BuiltGroup[] | null {
  const cls = wordClassOf(w);
  if (!cls || !hasForms(cls)) return null;

  // The engine takes the WRITTEN form. For a word JMdict marks "usually kana"
  // (keb === reb) that is already the kana, so this is right either way.
  const { forms } = conjugateAll(w.keb, cls);

  const out: BuiltGroup[] = [];
  for (const g of groupsFor(cls)) {
    const rows = g.rows
      .map((r) => ({ ...r, value: forms[r.form] }))
      .filter((r): r is BuiltForm => typeof r.value === "string");
    if (rows.length) out.push({ title: g.title, rows });
  }
  // Every form refused — a malformed row, or a class whose shape the word does
  // not have. Nothing to show, so show nothing rather than a heading over air.
  return out.length ? out : null;
}

/**
 * Whether the word happens rather than being done to something — JMdict's
 * `vi`, said without the word "object".
 *
 * "Doesn't take an object" is the standard gloss and it is jargon twice over:
 * "object" is a grammar term, and the phrasing describes the verb's syntax
 * rather than its meaning. What the learner is actually choosing between is 開く
 * and 開ける — whether the door opened or someone opened it — which is what
 * transitivity.ts already names its fields for (`happens` / `doIt`).
 */
export const INTRANSITIVE_POS = "intransitive verb";
export const INTRANSITIVE_NOTE = "it happens, rather than being done to something";

export function isIntransitive(w: VocabRow): boolean {
  return w.pos.includes(INTRANSITIVE_POS);
}

/**
 * Whether somebody does the word TO something — JMdict's `vt`, the other half
 * of the pair above.
 *
 * NOT `!isIntransitive`, and the difference is the reason this is a function.
 * JMdict tags plenty of verbs BOTH ways (待つ, する, 開く in one of its
 * readings), so the two predicates are both true at once for them. A caller
 * asking "can somebody do this to something" wants a yes there — a transitive
 * reading exists — and negating the intransitive test would have said no.
 */
export const TRANSITIVE_POS = "transitive verb";

export function isTransitive(w: VocabRow): boolean {
  return w.pos.includes(TRANSITIVE_POS);
}
