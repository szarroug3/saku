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
 * For a verb whose written form ends in る — the one case where the spelling
 * alone cannot tell you the class — which class it actually is, in the app's
 * learner terms: "う-verb" (godan) or "る-verb" (ichidan). Null for everything
 * else.
 *
 * WHY る-ENDING ONLY. A verb ending in う, く, ぐ, す, つ, ぬ, ぶ or む is
 * unambiguously a う-verb; the class is written on its face. It is the る ending
 * that is shared — 知る conjugates as a う-verb (知って) and 食べる as a る-verb
 * (食べて), and nothing in 〜る says which. So this is the one shape that earns a
 * note on the word card AND the one the words track holds back until the て-form
 * is learned (see nextCurriculumLock): the two questions are the same question.
 *
 * v1 / v1-s are the る-verbs (ichidan); every v5* is a う-verb (godan). The
 * irregulars whose form ends in る (来る kuru, する and its compounds, 演ずる) are
 * neither godan nor ichidan, so they get NO label rather than a wrong one — null
 * is the honest answer, and it leaves them ungated too.
 */
export function ruVerbKind(w: VocabRow): "う-verb" | "る-verb" | null {
  return ruVerbKindOf(w.keb, wordClassOf(w));
}

/**
 * `ruVerbKind` keyed on a (surface, class) pair rather than a whole VocabRow —
 * the shape the grammar drill's vehicle carries (see GrammarVehicle). Same rule,
 * one source of truth: only a る-ending surface is ambiguous, v1 / v1-s are
 * る-verbs, every other v5* is a う-verb, and the irregulars whose form ends in
 * る (来る, する) are neither and get null.
 */
export function ruVerbKindOf(
  surface: string,
  cls: WordClass | null,
): "う-verb" | "る-verb" | null {
  if (!surface.endsWith("る")) return null;
  if (cls === "v1" || cls === "v1-s") return "る-verb";
  // Only a REGULAR godan class gets the label. An IRREGULAR godan-る (ある, v5r-i,
  // whose negative is ない not あらない) has a hyphenated class, and naming it a
  // plain "う-verb" would point the learner at the wrong rule — so it gets no
  // label, exactly like 行く/する/来る, and the reveal teaches its form.
  if (cls && cls.startsWith("v5") && !cls.includes("-")) return "う-verb";
  return null;
}

/** The adjective class in the learner-facing terms used by grammar tables and
 * drill instructions. Unlike る-verbs, the label is useful for every unknown
 * adjective: it tells the learner whether to apply the い or な paradigm. */
export function adjectiveKindOf(
  cls: WordClass | null,
): "い-adjective" | "な-adjective" | null {
  // adj-ix (いい) is the IRREGULAR い-adjective — its stem is よ, so the plain
  // "い-adjective" rule (drop い, add くて → いくて) gives the wrong answer (よくて).
  // Like the irregular verbs 行く/する/来る, it carries NO paradigm label: naming a
  // rule that does not produce its form would mislead. The card says "this word"
  // and the reveal teaches よくて, exactly as a memorized exception should.
  if (cls === "adj-i") return "い-adjective";
  return cls === "adj-na" ? "な-adjective" : null;
}

/** The learner-facing adjective class for a dictionary word. Kept beside
 * `ruVerbKind` because word lessons, Library pages, and the curriculum gate all
 * need the same answer from the same JMdict classification. */
export function adjectiveKind(w: VocabRow): "い-adjective" | "な-adjective" | null {
  const cls = wordClassOf(w);
  // The word PAGE classifies いい (adj-ix) as an い-adjective — that is what its
  // Forms section is, even though its stem is irregular. This is a different
  // question from the DRILL's `adjectiveKindOf`, which returns null there because
  // naming the paradigm would point at the wrong conjugation rule.
  if (cls === "adj-ix") return "い-adjective";
  return adjectiveKindOf(cls);
}

export type WordFormKind =
  | "う-verb"
  | "る-verb"
  | "irregular verb"
  | "い-adjective"
  | "な-adjective";

/** The class badge shown beside a word's Forms heading. Unlike `ruVerbKind`,
 * this names every conjugating word: non-る godan verbs still say う-verb, and
 * irregular verbs get an honest label rather than being forced into either
 * regular paradigm. */
export function wordFormKind(w: VocabRow): WordFormKind | null {
  const cls = wordClassOf(w);
  // adj-ix (いい) is an い-adjective for the Forms heading (see `adjectiveKind`),
  // even though the drill's `adjectiveKindOf` withholds the label.
  const adjective = cls === "adj-ix" ? "い-adjective" : adjectiveKindOf(cls);
  if (adjective) return adjective;
  if (cls === "v1" || cls === "v1-s") return "る-verb";
  if (cls?.startsWith("v5")) return "う-verb";
  if (cls === "vs-i" || cls === "vs-s" || cls === "vk" || cls === "vz") {
    return "irregular verb";
  }
  return null;
}

/** Every conjugating class gets a Forms section. For a な-adjective this makes
 * the newly taught noun-describing form visible on its own word page
 * (静か → 静かな), alongside the copula-backed sentence forms. */
export function hasForms(_cls: WordClass): boolean {
  return true;
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
