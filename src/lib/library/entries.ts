// The Library's index: every entry in the app, in one shape, with the links
// between them precomputed.
//
// WHY THIS EXISTS RATHER THAN THREE SCREENS
// =========================================
// src/lib/facts.ts already knows every entry (`ALL_ENTRIES`) — but only as an
// id and a glyph, because FactInfo is deliberately thin and each subject keeps
// its own material to itself. That is the right shape for the drill, which does
// not care what it is asking about. It is the wrong shape for a screen whose
// entire job is to show you what a thing IS.
//
// So the Library does the one thing facts.ts refuses to: it reaches into each
// subject's own module and builds a browsing view. That is a legitimate reversal
// and not a leak, on one condition — it happens HERE, in one file, and what
// comes out the other side is subject-agnostic again. A Library screen renders
// `LibEntry`. It does not know that kanji have grades.
//
// NOTHING HERE PARSES AN ID. Ids are minted by each subject's own minter
// (`kanaEntry`, `kanjiEntry`, `wordEntry`, `kanaFact`, `meaningFactId`,
// `readingFactId`, `wordReadingFactId`, `wordMeaningFactId`) and resolved by
// lookup. The join back to CHAR_INDEX / KANJI / VOCAB is by GLYPH, which is the
// key those tables are already keyed by — not by taking an id apart.
//
// COST
// ====
// Built once at module load: ~9,761 entries and three maps over them. It is the
// work the search box would otherwise redo on every keystroke, and it is what
// lets search be ranked instead of a filter.

import {
  CHAR_INDEX,
  KANA_SUBJECT,
  kanaEntry,
  kanaFact,
  LOOK_GROUP,
} from "@/data/characters";
import { CONFUSABLE_WITH } from "@/data/confusable";
import {
  KANJI,
  KANJI_SUBJECT,
  kanjiEntry,
  kanjiRow,
  meaningFactId,
  READINGS,
  readingFactId,
  type ReadingRow,
  variantTaughtKanji,
} from "@/data/kanji";
import { isExcludedVariant, variantForm, type VariantPosition } from "@/data/variant-forms";
import {
  VOCAB,
  VOCAB_SUBJECT,
  vocabRow,
  wordEntry,
  wordUnitFacts,
} from "@/data/vocab";
import {
  GRAMMAR_SUBJECT,
  SPECIAL_ADJ_ROWS,
  SPECIAL_VERB_ROWS,
  classProductionFactId,
  conjugatesVerb,
  patternEntry,
  patternMeaningFactId,
  patternProductionFactId,
  productionHosts,
  specialVerbProductionFactId,
} from "@/data/grammar";
import { CLASS_ANCHOR } from "@/lib/grammar/te-endings";
import { MARK_SUBJECT, MARKS, markEntry } from "@/data/marks";
import { sentenceTierMarkerFact } from "@/lib/sentence-ordering-progress";
import {
  GRAMMAR_CONCEPT_SUBJECT,
  GRAMMAR_CONCEPTS,
  grammarConceptEntry,
} from "@/data/grammar-concepts";
import {
  NUMBER_CONSTRUCTION_SUBJECT,
  NUMBER_CONSTRUCTIONS,
  numberConstructionEntry,
} from "@/data/number-construction";
import { isNumberKanji } from "@/data/number-kanji";
import { TERM_SUBJECT, TERMS, termEntry } from "@/data/terms";
import {
  COUNTER_CURRICULUM,
  COUNTER_KANJI_GLYPHS,
  counterEntry,
  counterForm,
  counterMeaningFactId,
  counterReadingFactId,
  isKanaForm as isKanaCounterForm,
} from "@/data/counters";
import {
  RADICAL_SUBJECT,
  RADICALS,
  isRadicalTaughtAsKanji,
  radicalEntry,
  radicalByGlyph,
  radicalByWrittenForm,
  radicalMeaningFactId,
} from "@/data/radicals";
import { primitiveEntry, PRIMITIVE_SUBJECT, PRIMITIVE_STROKES, primitiveStrokes } from "@/data/components";
import { cluster } from "@/data/grammar/clusters";
import {
  RECIPES,
  isPrimaryPatternRecipe,
  isProducible,
  patternGroup,
  patternLabel,
  type Recipe,
} from "@/data/grammar/recipes";

/** The particle-pair clusters — comparisons ("は vs が", "に vs で") whose title
 * is redundant as a member's sub-line (see the grammar-entry `sub` below). Their
 * titles still ride `searchAlso`, so the family stays findable by name. */
export const COMPARISON_CLUSTER_IDS: ReadonlySet<string> = new Set(["wa-ga", "ni-de"]);
import { CURRICULUM_PAIRS } from "@/lib/transitivity-lesson";
import {
  TRANSITIVITY_SUBJECT,
  pairEntry,
  pairForEntry,
  sideFactId,
  transitivitySide,
} from "@/data/transitivity-facts";
import { pairPattern, shiftLabel } from "@/lib/transitivity-pattern";
import {
  KEIGO_SUBJECT,
  keigoSetEntry,
  keigoSetForEntry,
  keigoWordFactId,
  recognitionGloss,
} from "@/data/keigo";
import { CURRICULUM_KEIGO_SETS } from "@/lib/keigo-lesson";
import { buildExample } from "@/lib/grammar/example";
import { HOST_LABEL } from "@/lib/grammar/formula";
import { deframe } from "@/lib/kanji-parts";
import { factInfo, factsOf } from "@/lib/facts";
import type { EntryId, FactId, FactInfo } from "@/types";

/**
 * The counters shelf's kind — and the ONE Kind that is not a fact subject.
 *
 * Every other Kind is a subject constant, because a shelf is usually one
 * subject. The counters track breaks that on purpose: the owner ruled it "vocab
 * with a track label", so its facts carry subject `word` (COUNTERS_SUBJECT) and
 * are indistinguishable from any other word downstream — but on the Library it
 * wants a shelf of its own, "Counting", not to be dropped into the
 * general Words shelf. So the SHELF label and the FACT subject are decoupled
 * here for the counters alone: their LibEntry.kind is this string, while their
 * facts stay `word`. Nothing reads it as a subject (the registry never sees it;
 * subjectLabel is driven by FactInfo.subject, which is `word`); it is a
 * browse-only label, exactly the "track label" the ruling asked for.
 */
export const COUNTER_KIND = "counter";
/**
 * The "how numbers and counts are built" reference pages' kind. Like COUNTER_KIND
 * it is a browse-only label, not a fact subject: a construction page mints no
 * facts (factRows returns []), so nothing downstream drills it. It is its OWN
 * kind rather than reusing COUNTER_KIND so its URL and routing are its own
 * (/library/numbers/tens), while its breadcrumb still reads "Numbers and
 * counters" — the pages browse ON the counters shelf (injected by
 * counterShelfSections), so shelfKindOf below sends the breadcrumb crumb there.
 */
export const NUMBER_CONSTRUCTION_KIND = NUMBER_CONSTRUCTION_SUBJECT;
/** Sentence-ordering rules are marks internally, but they are a full learning
 * track rather than writing notation. Giving them a browse kind keeps their
 * Library shelf and search results separate from dakuten, punctuation, etc. */
export const SENTENCE_RULE_KIND = "sentence-rule";

/** Which shelf an entry lives on. The subject id, re-stated as a union so a
 * screen can switch on it — the values come from each subject's own constant
 * (so this cannot drift from what the facts carry), with the one exception of
 * COUNTER_KIND, a browse-only label (see above). */
export type Kind =
  | typeof KANA_SUBJECT
  | typeof MARK_SUBJECT
  | typeof RADICAL_SUBJECT
  | typeof KANJI_SUBJECT
  | typeof VOCAB_SUBJECT
  | typeof COUNTER_KIND
  | typeof NUMBER_CONSTRUCTION_KIND
  | typeof SENTENCE_RULE_KIND
  | typeof GRAMMAR_SUBJECT
  | typeof GRAMMAR_CONCEPT_SUBJECT
  | typeof TRANSITIVITY_SUBJECT
  | typeof KEIGO_SUBJECT
  | typeof TERM_SUBJECT
  | typeof PRIMITIVE_SUBJECT;

/** Browse order, and it is teaching order: kana, then radicals, then the kanji
 * built around them, then the words kanji spell, then grammar, then the verb
 * pairs grammar makes usable. Radicals sit just before kanji because 氵 is a
 * fact about 海; verb pairs sit after grammar because that is where the
 * curriculum teaches them (you need to build a sentence before "the door opened"
 * vs "I opened the door" is a distinction you can act on). Sentence rules sit
 * after the grammar-based tracks they bring together. Writing rules remain
 * reference material near the end: ゛ is a fact about か, but it is something a
 * learner returns to rather than a first stop. */
export const KINDS: readonly Kind[] = [
  KANA_SUBJECT,
  RADICAL_SUBJECT,
  KANJI_SUBJECT,
  VOCAB_SUBJECT,
  // Counting sits right after words: its entries ARE words (subject `word`),
  // and a learner reaches for them alongside vocabulary. They get their own shelf
  // rather than mixing into Words because the track teaches them as a system with
  // its own order — see COUNTER_KIND.
  COUNTER_KIND,
  GRAMMAR_SUBJECT,
  // Grammar concepts sit right after Grammar: they are the IDEAS the grammar
  // patterns rest on (what a conjugation form is, how the て-form connects), so a
  // learner reaches for them alongside the patterns they explain. Reference
  // material like a term, but browsed here rather than at the end, next to the
  // shelf it is about.
  GRAMMAR_CONCEPT_SUBJECT,
  TRANSITIVITY_SUBJECT,
  // Keigo sits after verb pairs: it is a politeness layer over verbs the learner
  // already knows, so it browses after the plain-verb tracks it builds on.
  KEIGO_SUBJECT,
  SENTENCE_RULE_KIND,
  MARK_SUBJECT,
  // Reference definitions, LAST — the same argument that parks Writing rules at
  // the end. A term is a word you look up, not a first stop, and like a mark it
  // has no facts the scheduler ever asks about.
  TERM_SUBJECT,
  // Kanji parts: shapes with no meaning or reading of their own, shown here so
  // a learner can browse what each is a piece of.
  PRIMITIVE_SUBJECT,
];

/** What a shelf is called on screen. */
export const KIND_LABEL: Record<Kind, string> = {
  [KANA_SUBJECT]: "Kana",
  [MARK_SUBJECT]: "Writing rules",
  [RADICAL_SUBJECT]: "Radicals",
  [KANJI_SUBJECT]: "Kanji",
  [VOCAB_SUBJECT]: "Words",
  [COUNTER_KIND]: "Counting",
  // A construction page's breadcrumb crumb reads under the counting shelf, the
  // same label its pages browse on. It is deliberately NOT in KINDS (no shelf
  // chip of its own — the pages live on the counting shelf); this label is what
  // the breadcrumb prints, via shelfKindOf.
  [NUMBER_CONSTRUCTION_KIND]: "Counting",
  [SENTENCE_RULE_KIND]: "Sentence rules",
  [GRAMMAR_SUBJECT]: "Grammar",
  [GRAMMAR_CONCEPT_SUBJECT]: "Grammar concepts",
  [TRANSITIVITY_SUBJECT]: "Verb pairs",
  [KEIGO_SUBJECT]: "Keigo",
  [TERM_SUBJECT]: "Terms",
  [PRIMITIVE_SUBJECT]: "Kanji parts",
};

/**
 * The shelf an entry's breadcrumb crumb should point at — its own kind, except
 * for a construction page, whose pages BROWSE on the counters shelf rather than
 * a shelf of their own. So a construction page's "Counting" crumb
 * links to the counters shelf (where the reader actually finds it) instead of a
 * /library?kind=numbers shelf that is not offered. Every other kind is its own
 * shelf and maps to itself.
 */
export function shelfKindOf(kind: Kind): Kind {
  return kind === NUMBER_CONSTRUCTION_KIND ? COUNTER_KIND : kind;
}

/**
 * Where a lesson's specific type differs from the shelf it lives on. A lesson
 * teaches one word, so the "Words" shelf reads "Word" in the session header, and
 * one radical, so the "Radicals" shelf reads "Radical"; every other non-kana
 * subject's shelf label is already the right singular.
 */
const SUBJECT_LABEL: Partial<Record<Kind, string>> = {
  [VOCAB_SUBJECT]: "Word",
  [RADICAL_SUBJECT]: "Radical",
};

/**
 * The specific lesson-type label for a fact — what the session header's subject
 * pip shows. More pointed than KIND_LABEL: a kana lesson is either "Hiragana"
 * or "Katakana" depending on the character's own script, read off CHAR_INDEX by
 * the fact's glyph rather than by parsing its id. Every other subject falls
 * back to SUBJECT_LABEL and then KIND_LABEL. Undefined when the fact is gone.
 */
export function subjectLabel(info: FactInfo | undefined): string | undefined {
  if (!info) return undefined;
  // Transitivity IS a Library shelf now ("Verb pairs"), but the session header
  // wants the singular lesson-type name for a teach set, like "Word" and
  // "Radical" below — and it is "Verb pair", not the shelf's plural.
  if (info.subject === TRANSITIVITY_SUBJECT) return "Verb pair";
  // Keigo's shelf is "Keigo" (plural-less already), but a teach set is one set of
  // politeness forms, so the session header says "Keigo set".
  if (info.subject === KEIGO_SUBJECT) return "Keigo set";
  const kind = info.subject as Kind;
  if (kind === KANA_SUBJECT) {
    return CHAR_INDEX[info.glyph]?.setLabel ?? KIND_LABEL[kind];
  }
  return SUBJECT_LABEL[kind] ?? KIND_LABEL[kind];
}

/**
 * One thing you can look up.
 *
 * The whole of what a Library screen is allowed to know. Everything
 * subject-specific that survives is a STRING already fit to print (`sub`), not
 * a grade or a band a screen could start branching on.
 */
export interface LibEntry {
  readonly id: EntryId;
  readonly kind: Kind;
  /**
   * What it looks like. し, 生, 先生 — AND SOMETIMES NOTHING.
   *
   * It was safe to assume this was a character for as long as every entry was
   * one. Marks broke that: "long vowels" is a rule written ー in katakana and by
   * doubling a vowel kana in hiragana, so it has no single character and its
   * glyph is the empty string. See `name` below, and src/data/marks.ts.
   *
   * The empty case is SEARCH-INERT and that is worth knowing: `classify` asks
   * `glyph === q`, `glyph.startsWith(q)` and `glyph.includes(q)`, and with a
   * non-empty query (search trims and bails on "") all three are false for "".
   * So a glyphless entry cannot be found by its glyph — it is found by its
   * meanings and its `searchAlso` aliases, which is why the long-vowel mark
   * carries ー as an alias.
   */
  readonly glyph: string;
  /**
   * What to CALL it, when the glyph cannot.
   *
   * Absent for every entry whose glyph IS its name, which is all of kana, kanji,
   * words and grammar — 生 is called 生. Present only where the glyph is empty or
   * is a specimen rather than a name: "Long vowels" has no character at all, and
   * "Small ゃ ゅ ょ" has three. Read it through `entryName`, never directly, so a
   * caller cannot forget the fallback.
   *
   * This is a NAME, not a title: it goes where a glyph would have gone — a
   * breadcrumb crumb, a row's leading cell, an aria-label — and not in place of
   * the meanings a page prints as its heading.
   */
  readonly name?: string;
  /**
   * How it is READ — し's romaji, 生's nine readings, 先生's せんせい. Searched.
   *
   * RICHEST FIRST for a kanji (most attesting words), which is the same order
   * the entry page's table uses. It is NOT "the reading" — 生's is い in raw
   * data order and せい by evidence, and neither is the answer to "how is 生
   * read", because that question has nine answers and is the reason facts exist.
   * A caller printing `readings[0]` as if it were the reading is making the
   * mistake the whole entry/fact split exists to prevent; see EntryRow, which
   * prints one only when there IS only one.
   */
  readonly readings: readonly string[];
  /** What it MEANS, in English. Searched. Empty for a kana. */
  readonly meanings: readonly string[];
  /**
   * Extra strings SEARCH matches but the screen never renders — an alias index.
   *
   * Grammar is the reason it exists: a pattern's cluster name ("seems", "must")
   * is what you would type to find the whole family, and そう-hearsay's gloss
   * ("I hear that X") does not contain the word "seems". So the cluster title
   * rides here, findable but not shown, and the tile keeps printing the gloss.
   *
   * MARKS ARE THE SECOND REASON, and they widened what this field is for. Two
   * things a learner would type can live nowhere else: the jargon every other
   * resource uses and this app never prints ("sokuon", "yōon", "chōonpu"), and
   * the Japanese tokens an entry is about but whose `glyph` cannot hold — ゃゅょ
   * is one entry with three characters, and "long vowels" has no glyph at all, so
   * ー is findable ONLY from here. That last case is why `classify` now matches an
   * alias exactly as well as through the English-only meaning path.
   *
   * Empty (and absent from the match loop's cost) for every other kind.
   */
  readonly searchAlso?: readonly string[];
  /** The one line under the glyph: "5 strokes", "Everyday word". */
  readonly sub: string;
  /**
   * Tie-break weight for search: LOWER sorts first. Not shown, ever.
   *
   * A rough everyday-ness, and deliberately crude: a kana beats any kanji, which
   * beats the 8,045th word. Inside a kind it falls back to the newspaper band,
   * WHICH IS A BAD NUMBER (see VocabRow.newspaperBand — its top band holds 安保
   * and not 食べる). It is used anyway, for the one job it is fit for: breaking
   * ties in a list that is already sectioned by HOW you matched. It never ranks
   * anything on its own and it never reaches a screen.
   */
  readonly weight: number;
  /**
   * Whether this ENTRY (one instance, not its shelf) has one real pronunciation
   * worth a 🔊 — the fact `speakable()` in entry-tile.tsx reads instead of
   * re-deriving from `kind`.
   *
   * `kind` answers "which shelf" and nothing else; it is not safe to reread it
   * as "does this have a sound", because two populations can share one shelving
   * kind and disagree on that question. COUNTER_KIND is exactly this: a real
   * counted word (一本 · いっぽん, from COUNTER_CURRICULUM) sits on the same
   * shelf as a sound-shift RULE PAGE (〜枚, from NUMBER_CONSTRUCTIONS) whose
   * "glyph" is a tilde-prefixed placeholder and whose body is prose about how
   * a counter's sound shifts. A kind check alone cannot tell those apart, so
   * whether an entry is speakable is decided HERE, once, by the construction
   * code that actually knows which population it is building — not re-guessed
   * from `kind` at render time.
   *
   * TRUE for anything that is genuinely one piece of spoken Japanese with ONE
   * pronunciation: kana, a word, a counted or kana counter form. FALSE for a
   * reference/rule/concept page (grammar, grammar concepts, number-construction
   * pages, terms), writing notation (marks, sentence rules), a shape with no
   * attested reading of its own (a radical, a kanji part), an AGGREGATE entry
   * that names more than one word at once (a verb pair, a keigo set) — its one
   * `glyph` is a representative fragment, not the whole entry's sound, the same
   * reason those rows carry their own per-word speakers instead of one
   * entry-level button — and a KANJI, whose glyph has no single pronunciation
   * of its own at all (on'yomi vs. kun'yomi is context-dependent); a 🔊 next to
   * the bare glyph would teach the wrong thing, so its readings only ever get a
   * speaker each, on the entry page's own "As a kanji" section.
   */
  readonly speakable: boolean;
}

// ---------- readings, grouped (needed by the build below) ----------

const BY_KANJI_READINGS: ReadonlyMap<string, readonly ReadingRow[]> = groupReadings();

function groupReadings(): Map<string, ReadingRow[]> {
  const map = new Map<string, ReadingRow[]>();
  for (const r of READINGS) {
    const list = map.get(r.k);
    if (list) list.push(r);
    else map.set(r.k, [r]);
  }
  for (const list of map.values()) list.sort((a, b) => b.nWords - a.nWords);
  return map;
}

/** Every ReadingRow of one kanji, RICHEST EVIDENCE FIRST — the reading you meet
 * in the most words is the one worth reading first, and the one the ingest is
 * surest of.
 *
 * The sort happens once, here, at build, rather than in the two places that
 * want the order (LibEntry.readings and the entry page's table). They were
 * drifting already: the raw READINGS order put 生's い first — attested by 9
 * words — ahead of せい, which 33 words attest, so a row printing "the first
 * reading" printed the fifth most useful one. */
export function readingsOf(c: string): readonly ReadingRow[] {
  return BY_KANJI_READINGS.get(c) ?? [];
}

/**
 * A kanji's readings, richest evidence first — the WHOLE row, not the flattened
 * FactRow the generic table takes.
 *
 * The entry page's kanji branch needs three things FactRow deliberately drops:
 * `nWords` (how common the reading is, as a real number rather than a bar), the
 * full `words` list (to name the word that OPENS a shut reading, which may be
 * one the four-word `askedIn` sample never reaches), and `anchor` (the word the
 * fact is keyed on). Widening FactRow with kanji-only fields would push subject
 * knowledge into a shape four kinds share; this is a second, narrower accessor
 * for the one kind that needs it.
 *
 * NO FILTER, EVER. Measured: the most readings any kanji has is 8, and it is 生;
 * 1,944 of 2,022 have three or fewer. There is no length to manage, so the page
 * shows them all and the "＋ N more" control that a words list needs has no
 * business here.
 */
export function readingRowsOf(entry: LibEntry): readonly ReadingRow[] {
  if (entry.kind !== KANJI_SUBJECT) return [];
  return readingsOf(entry.glyph);
}

/**
 * Which of an entry's facts decide whether it is KNOWN — the input to the
 * Library's knowledge filter, and the one place the choice is made per kind.
 *
 * For almost everything it is all of them (`factsOf`): a kana is its one fact,
 * a radical is meaning-only already, a word is known when its reading AND its
 * meaning are, a grammar pattern when its meaning (and any production) is. The
 * "known" bar itself — every one of these solid or claimed — never changes; only
 * WHICH facts have to clear it does.
 *
 * A KANJI is the one exception, and it is not a Library invention: the whole
 * curriculum teaches, claims and displays a kanji by its MEANING (see
 * kanji-known.ts, "A kanji is KNOWN once its MEANING has been learned"; the
 * lesson claims only `meaningFactId`; the entry page's kanji chip is the meaning
 * fact's standing alone). Its readings open one word at a time, through
 * vocabulary, long after the character itself is familiar. So a kanji counts as
 * known on its meaning fact, which is exactly what the entry page already shows —
 * without this, 人 read "you know this" on its own page yet failed the shelf's
 * Known filter, because that filter demanded all eleven facts.
 */
export function knownFactsOf(entry: LibEntry): readonly FactId[] {
  if (entry.kind === KANJI_SUBJECT) return [meaningFactId(entry.glyph)];
  // A MERGED radical is learned on its kanji card, not a radical card, so its
  // own meaning fact is never taught — its knowledge lives on the identical
  // kanji glyph (radical:乙 has no lesson, kanji:乙 does). Read the kanji's
  // meaning fact so the shelf's Known filter matches what the learner actually
  // did, instead of stranding 116 radicals as forever-unknown. The 90
  // radical-only shapes and the 8 that keep a radical card fall through to their
  // own fact below. See isRadicalTaughtAsKanji in src/data/radicals.ts.
  if (entry.kind === RADICAL_SUBJECT) {
    const rad = radicalByGlyph(entry.glyph);
    if (rad && isRadicalTaughtAsKanji(rad.num)) return [meaningFactId(entry.glyph)];
  }
  // A pair mints a fact per side but SCHEDULES only the askable ones — the
  // unaskable side rides along solely as a distractor and is never quizzed, so
  // it can never be "known". Counting it would leave every pair permanently
  // not-known and hold the "I know this" button open forever. See
  // transitivity-facts.ts.
  if (entry.kind === TRANSITIVITY_SUBJECT) {
    return factsOf(entry.id).filter((f) => transitivitySide(f)?.askable);
  }
  // A sentence tier's completion lives on its TRACK-LOCAL marker
  // (sentenceTierMarkerFact) — deliberately not a registered quiz fact (see
  // its own doc comment), so it never shows up via the general factsOf(id)
  // lookup below. Read it directly, or the "I already know this"/completion
  // claim a learner made is invisible here and the tier sits permanently
  // "Not known" no matter what they do.
  if (entry.kind === SENTENCE_RULE_KIND) {
    const tierId = entry.id.replace(`${MARK_SUBJECT}:sentence-rule-`, "");
    return [sentenceTierMarkerFact(tierId)];
  }
  return factsOf(entry.id);
}

// ---------- the index ----------

/** Every entry in the app, in browse order: kana, then kanji, then words. */
export const LIB_ENTRIES: readonly LibEntry[] = build();

/** Entries bucketed once by shelf kind, for callers that need repeated per-kind
 * lookups without re-filtering the full library on every render. */
export const LIB_ENTRIES_BY_KIND: ReadonlyMap<Kind, readonly LibEntry[]> =
  (() => {
    const buckets = new Map<Kind, LibEntry[]>();
    for (const k of KINDS) buckets.set(k, []);
    for (const e of LIB_ENTRIES) {
      const list = buckets.get(e.kind);
      if (list) list.push(e);
    }
    return buckets;
  })();

const BY_ID: ReadonlyMap<EntryId, LibEntry> = new Map(
  LIB_ENTRIES.map((e) => [e.id, e]),
);

/** An entry, by its opaque id. A lookup, like everything else that resolves an
 * id — see src/lib/facts.ts. Undefined for an id this build has no data for,
 * which a screen must handle: a URL outlives a re-cut of the dictionaries. */
export function libEntry(id: EntryId): LibEntry | undefined {
  return BY_ID.get(id);
}

/**
 * What to call an entry where a character would have gone.
 *
 * The glyph for everything that has one, the name for the one kind that doesn't.
 * It exists so that "render the entry's glyph" — a breadcrumb crumb, a row's
 * leading cell, `aria-label={`Open ${…}`}` — has a single answer that is never
 * the empty string. Before this, the long-vowel mark rendered a blank crumb after
 * a "›" and an aria-label reading "Open ", which is a screen reader announcing a
 * button with no name.
 *
 * NOT a replacement for the glyph everywhere. Where the glyph is the SUBJECT
 * rather than a label — the 76px hero on an entry page, `speak(entry.glyph)` —
 * an empty glyph means there is genuinely nothing to show or say, and the right
 * answer is to render nothing, not to render the words "Long vowels" at 76px or
 * read them out in a Japanese voice.
 */
export function entryName(entry: LibEntry): string {
  // Aggregate verb entries keep their full pair/set name in labels and
  // breadcrumbs even though their now-authoritative glyph is the one form the
  // detail header leads with.
  if (
    (entry.kind === TRANSITIVITY_SUBJECT || entry.kind === KEIGO_SUBJECT) &&
    entry.name
  ) {
    return entry.name;
  }
  return entry.glyph || entry.name || entry.id;
}

function build(): LibEntry[] {
  const out: LibEntry[] = [];

  for (const [c, info] of Object.entries(CHAR_INDEX)) {
    out.push({
      id: kanaEntry(c),
      kind: KANA_SUBJECT,
      glyph: c,
      readings: info.r,
      meanings: [],
      sub: `${info.setLabel} · ${info.secLabel}`,
      weight: 0,
      // A kana IS a sound — the one thing this whole shelf teaches.
      speakable: true,
    });
  }

  // Marks — the reading rules, right after the kana they are rules about.
  //
  // `meanings` HOLDS THE NAME, and `sub` holds the one-line rule. That looks
  // back-to-front for one beat and is the arrangement that makes every existing
  // renderer say the right thing without being told about marks: EntryRow prints
  // `meanings` as its main line and `sub` as the note under it, so the row reads
  // "Dakuten / Two dashes that voice the consonant"; the entry page's PageTitle
  // takes `meanings` and prints `sub` beneath, so the page is headed "Dakuten"
  // and sub-headed with the rule. A mark has no gloss competing for `meanings`,
  // so nothing is displaced — and search over meanings then finds a mark by its
  // name, which is what anyone would type.
  //
  // NO READINGS, deliberately and not for want of a plausible string. ゛ is
  // called "dakuten", but that is its NAME, not how it is read: nothing in
  // Japanese pronounces a bare ゛, and `readings` is exact-matched by search and
  // spoken by the tile's 🔊. A romaji-shaped name in that field would make ゛ a
  // hit for someone sounding out a kana and hand a synthesiser something to say.
  for (const m of MARKS) {
    out.push({
      id: markEntry(m.id),
      kind: m.shelf === "sentence" ? SENTENCE_RULE_KIND : MARK_SUBJECT,
      glyph: m.glyph,
      name: m.name,
      readings: [],
      meanings: [m.name],
      searchAlso: m.searchAlso,
      sub: m.summary,
      // Below kana (0) and below grammar (500+), so that when a query hits a
      // mark and something else, the mark leads. There are five of them and they
      // are the answer to a question about a rule; nothing is buried by putting
      // five entries near the front, and typing "dakuten" should not turn up a
      // word first.
      weight: 1,
      // A mark is writing notation, not a sound — see LibEntry.speakable and the
      // NO READINGS note above.
      speakable: false,
    });
  }

  // Terms — the reference definitions. Built exactly like a mark: no glyph (the
  // title IS the name, so `meanings` carries it and `sub` the one-line summary,
  // which is what EntryRow and PageTitle print), no readings (nothing here is a
  // sound to speak or to exact-match), and search finds a term by its name or an
  // alias. No facts, minted below by no one — a term is read, never asked.
  for (const t of TERMS) {
    out.push({
      id: termEntry(t.id),
      kind: TERM_SUBJECT,
      glyph: "",
      name: t.name,
      readings: [],
      meanings: [t.name],
      searchAlso: t.searchAlso,
      sub: t.summary,
      // Beside marks (1), for the same reason: a handful of reference entries
      // that answer "what is this word", worth leading with when a query hits
      // one, and never numerous enough to bury anything.
      weight: 1,
      // A term is an English name for a concept, not a Japanese sound — see
      // LibEntry.speakable.
      speakable: false,
    });
  }

  // Grammar concepts — the ideas behind the grammar patterns, built exactly like
  // a term: no glyph (the title IS the name, so `meanings` carries it and `sub`
  // the one-line summary, which is what EntryRow and PageTitle print), no
  // readings (nothing here is a sound), and search finds a concept by its name or
  // an alias. No facts, minted below by no one — a concept is read, never asked.
  for (const c of GRAMMAR_CONCEPTS) {
    out.push({
      id: grammarConceptEntry(c.id),
      kind: GRAMMAR_CONCEPT_SUBJECT,
      glyph: "",
      name: c.name,
      readings: [],
      meanings: [c.name],
      searchAlso: c.searchAlso,
      sub: c.summary,
      // Beside marks and terms (1): a reference entry worth leading with when a
      // query hits it, and never numerous enough to bury anything.
      weight: 1,
      // A grammar concept is an idea explained in English, not a sound — see
      // LibEntry.speakable.
      speakable: false,
    });
  }

  // Number construction pages — the "how numbers and counts are BUILT" reference,
  // built like a grammar concept (no readings — a rule is read, not spoken; its
  // glyph is the 十〜 / 百〜 / 〜本 plate, shown on the shelf row and the page
  // hero). No facts, minted by no one below: a construction page is read, and its
  // only action is the Quiz me button. Search finds it by its name, its summary,
  // or a searchAlso alias (the counter glyph, "hundreds", "man"…).
  for (const c of NUMBER_CONSTRUCTIONS) {
    out.push({
      id: numberConstructionEntry(c.id),
      kind: NUMBER_CONSTRUCTION_KIND,
      glyph: c.glyph,
      name: c.name,
      readings: [],
      meanings: [c.name],
      searchAlso: c.searchAlso,
      sub: c.summary,
      // Beside marks, terms and concepts (1): a reference entry worth leading
      // with when a query hits it, and never numerous enough to bury anything.
      weight: 1,
      // A construction page is a sound-shift RULE, read in prose, not a word —
      // its glyph is a tilde-prefixed plate (〜枚), not something to hand a
      // synthesiser. This is the confirmed SAK-79 bug: these pages shared
      // COUNTER_KIND's shelf and used to fall through `speakable()`'s kind
      // check unnoticed. See LibEntry.speakable.
      speakable: false,
    });
  }

  // Radicals — the shapes kanji are built around and filed under, right before
  // the kanji that gate on them. The glyph is the radical, `meanings` its one
  // sense (so search finds 氵 by "water" and the tile prints it), and `sub`
  // carries the Kangxi number and stroke count. No readings: a radical is a
  // shape and an idea, not a pronunciation.
  for (const r of RADICALS) {
    out.push({
      id: radicalEntry(r.glyph),
      kind: RADICAL_SUBJECT,
      glyph: r.glyph,
      readings: [],
      meanings: [r.meaning],
      sub: `Radical ${r.num} · ${r.strokes} stroke${r.strokes === 1 ? "" : "s"}`,
      // Below kanji and words: someone searching "water" wants 水 the kanji or
      // the word before 氵 the radical, so radicals sort after both on a shared
      // meaning. The Kangxi number keeps them in canonical order among themselves.
      weight: 2000 + r.num,
      // A radical is a shape and an idea, not a pronunciation (see the "no
      // reading fact" note atop src/data/radicals.ts and the null `speak` its
      // own meaning-fact row carries below) — found wrongly speakable during
      // the SAK-79 audit and fixed alongside it. See LibEntry.speakable.
      speakable: false,
    });
  }

  for (const k of KANJI) {
    out.push({
      id: kanjiEntry(k.c),
      kind: KANJI_SUBJECT,
      glyph: k.c,
      readings: readingsOf(k.c).map((r) => r.base),
      meanings: k.meanings,
      // Stroke count only. The jōyō grade and the name of the dictionary the
      // row came from were both here and both removed: a grade is a fact about
      // the Japanese school system, not about the character, and a data-source
      // name means nothing to a beginner. Attribution is not lost — the entry
      // page foot credits every source.
      sub: `${k.strokes} stroke${k.strokes === 1 ? "" : "s"}`,
      weight: 1000 + (k.newspaperFreq ?? 3000),
      // FALSE, even though a kanji is a real character with a real reading (or
      // several) — unlike a kana or a word, a bare kanji glyph has NO single
      // pronunciation of its own; on'yomi vs. kun'yomi and which one applies is
      // entirely context-dependent (人 alone could be じん, にん, or ひと). A 🔊
      // next to the tile implies the glyph itself has a canonical sound, which
      // is exactly the wrong thing to teach. The readings live in the entry
      // page's own "As a kanji" section, each with its own speaker on the
      // specific reading, not the glyph. See LibEntry.speakable.
      speakable: false,
    });
  }

  for (const w of VOCAB) {
    // SAK-147: a kanji-written counter glyph (day-of-month, month-of-year,
    // 二十歳 — COUNTER_KANJI_GLYPHS, see its doc comment in src/data/counters.ts)
    // is NOT a plain word here. 二十歳 gets its own row below, under
    // COUNTER_KIND, from the COUNTER_CURRICULUM walk a few dozen lines down —
    // built off the exact same glyph. Day/month's 43 glyphs no longer do (SAK-
    // 163 round 4 made them generative categories, so they are reference data
    // now, not individual COUNTER_CURRICULUM forms); they instead browse via
    // the single 〜日/〜月 NUMBER_CONSTRUCTION_KIND row every generative counter
    // gets. Either way, skipping the glyph here does not drop it from the
    // Library, only from the Words shelf it does not belong on. This is the
    // same exclusion word-lesson.ts applies to the teaching spine
    // (CURRICULUM_WORDS); both read the one set so neither can drift ahead of
    // the other the way this bug started.
    if (COUNTER_KANJI_GLYPHS.has(w.keb)) continue;
    out.push({
      id: wordEntry(w.keb),
      kind: VOCAB_SUBJECT,
      glyph: w.keb,
      readings: [w.reb],
      meanings: w.glosses,
      // No source name here either. See the kanji sub-line above. No sub-label:
      // "everyday word" is not a fact worth a line under every one of 12,553.
      sub: "",
      weight: 10_000 + (w.newspaperBand ?? 60),
      // A word is one glyph with one reading (w.reb) — the clearest speakable
      // case there is. See LibEntry.speakable.
      speakable: true,
    });
  }

  // Grammar patterns are entries too — the pattern is the glyph, the gloss is
  // the meaning, and there is NO reading because a pattern has no single
  // pronunciation (see the tile, which omits 🔊 for these). They sort last in
  // browse order, after every word.
  RECIPES.forEach((r, i) => {
    if (!isPrimaryPatternRecipe(r)) return;
    const id = patternEntry(r.id);
    const senses = patternGroup(r.id);
    const clusterTitles = [
      ...new Set(
        senses.flatMap((sense) => {
          const title = sense.cluster ? cluster(sense.cluster)?.title : undefined;
          return title ? [title] : [];
        }),
      ),
    ];
    // The particle-pair clusters (は vs が, に vs で) are COMPARISONS, not family
    // concepts: the title just names the two glyphs being contrasted, so it is
    // redundant as the sub-line under a member whose own glyph is the lead
    // (は · "marks the topic" needs no "は vs が" beneath it). It stays in
    // searchAlso — findable — but drops out of the shown `sub`. Concept clusters
    // ("must", "after") keep theirs as a genuine family cue.
    const subTitles = [
      ...new Set(
        senses.flatMap((sense) => {
          if (!sense.cluster || COMPARISON_CLUSTER_IDS.has(sense.cluster)) return [];
          const title = cluster(sense.cluster)?.title;
          return title ? [title] : [];
        }),
      ),
    ];
    out.push({
      id,
      kind: GRAMMAR_SUBJECT,
      // The entry's first fact is the display item the detail route builds. Its
      // glyph carries two disambiguating parentheticals that patternLabel omits;
      // keeping that exact value here makes the index authoritative everywhere.
      glyph:
        factInfo(factsOf(id)[0])?.glyph ??
        (senses.length > 1 ? r.pattern : patternLabel(r)),
      readings: [],
      meanings: senses.map((sense) => sense.gloss),
      searchAlso: [
        ...senses.flatMap((sense) => (sense.sense ? [sense.sense] : [])),
        ...clusterTitles,
      ],
      // JLPT level is internal curriculum metadata, not a useful explanation
      // of what the row is. Keep a meaningful family cue ("after", "must",
      // and so on) where one exists; otherwise the sub-line is simply absent.
      sub: subTitles.join(" · "),
      // A pattern has no single pronunciation (〜てから is a shape, not a
      // sound) — see LibEntry.speakable.
      speakable: false,
      // A LOW weight, below kanji — the one kind that outranks it. This is the
      // owner's "make sure search surfaces grammar properly" as a number: when
      // you type "must", the seven obligation PATTERNS are the answer, and a
      // word like 糾合 ("muster") that merely starts with your letters is not.
      // A high weight would bury the patterns under every incidental match; a
      // low one puts them where "how do I say must" is answered. Only meaning
      // searches pit grammar against other kinds — a pattern's glyph (〜てから)
      // rarely collides with a word or a kanji — so leading there costs the
      // other kinds nothing they were winning.
      weight: 500 + i,
    });
  });

  // Verb pairs — the transitivity subject, taught after grammar (see KINDS), so
  // they browse after it. A pair is TWO verbs and one event; its first fact's
  // glyph is the shared written stem the detail route uses as its hero. `name`
  // still carries the full pair — "出る / 出す" — and both written forms ride in
  // `searchAlso`, so every representation remains findable. CURRICULUM_PAIRS,
  // not the raw VERB_PAIRS: a pair whose verb the app can never teach (産む,
  // 濡れる/濡らす today) gets no entry here either, so search/detail agrees with
  // the shelf (shelves.tsx) and the schedule (verb-pair-unit.ts) about what
  // "the app teaches" means, instead of a third, silently different answer.
  CURRICULUM_PAIRS.forEach((p, i) => {
    const id = pairEntry(p);
    const pattern = pairPattern(p.happens.reading, p.doIt.reading);
    const tailLabel = pattern.isException ? "Exception" : shiftLabel(pattern);
    const tailFrom = pattern.from?.replace(/^-/, "");
    const tailTo = pattern.to?.replace(/^-/, "");
    const tailSearch = pattern.isException
      ? ["exception", "verb pair"]
      : [tailLabel, `${tailFrom} ${tailTo}`, `${tailFrom}${tailTo}`];
    out.push({
      id,
      kind: TRANSITIVITY_SUBJECT,
      glyph: factInfo(factsOf(id)[0])?.glyph ?? p.happens.word,
      name: `${p.happens.word} / ${p.doIt.word}`,
      readings: [p.happens.reading, p.doIt.reading],
      meanings: [p.happens.en, p.doIt.en],
      searchAlso: [p.happens.word, p.doIt.word, ...tailSearch],
      // The tail-shift name is the one line worth carrying — "the -ある/-える swap
      // again" is a real memory aid (see transitivity-pattern.ts). A pair that
      // fits no rule says "Verb pair" rather than "Exception", which would read
      // as a warning on a shelf where the shift name is a help, not a grade.
      sub: tailLabel,
      // Their own band, below kanji (1000+) and above grammar (500+): a pair
      // rarely collides with another kind on a query, because its meanings are
      // whole English sentences, so this only breaks ties among pairs — in data
      // order, which is the order the table was curated in.
      weight: 700 + i,
      // A pair NAMES TWO WORDS, not one — its `glyph` is a representative hero
      // form (see above), not the whole entry's sound. That is exactly why
      // VerbPairRow renders two independent per-verb HearButtons instead of one
      // entry-level speaker. Found wrongly speakable during the SAK-79 audit —
      // a generic search-result row (EntryRow, not VerbPairRow) rendered a
      // single speaker that only ever said HALF the pair — and fixed alongside
      // it, matching KEIGO_SUBJECT's identical call below. See
      // LibEntry.speakable.
      speakable: false,
    });
  });

  // Counting — the track's words, given browse pages of their own.
  //
  // These are `word` facts (COUNTERS_SUBJECT), so they are indistinguishable
  // from vocabulary in the registry and the drill — but here they carry
  // COUNTER_KIND so they shelve as "Counting" rather than vanishing
  // into 12,553 everyday words. The whole point of the page is to VIEW the
  // counted form beside its reading (一本 · いっぽん), which is exactly what a
  // counter's factRows below print.
  //
  // A KANA FORM CARRIES NO READING and a COUNTED FORM CARRIES ONE. A kana form's
  // reading IS its glyph (ひとつ), so listing it under the glyph would print
  // ひとつ twice; its `readings` is empty and the tile falls back to the meaning
  // ("one thing"). A counted form (一本) shows its reading (いっぽん), the sound
  // the shelf exists to teach — findable in search and printed under the glyph.
  COUNTER_CURRICULUM.forEach((f, i) => {
    const kana = isKanaCounterForm(f);
    out.push({
      id: counterEntry(f),
      kind: COUNTER_KIND,
      glyph: f.glyph,
      readings: kana ? [] : [f.reading],
      meanings: [f.meaning],
      // What it is, in one word, for the search-row note. A bare number says so;
      // everything else is a counter (the specific counter is the shelf section).
      sub: f.counter === "" ? "Number" : "Counter",
      // Below everyday words (10,000+): a bare number like に collides on glyph
      // with the particle に, and the word should lead — a counter is the
      // specialist answer, surfaced but not ahead of the vocabulary. Curriculum
      // order breaks ties among counters.
      weight: 9_000 + i,
      // A REAL counted word, unlike its NUMBER_CONSTRUCTION_KIND shelf-mate
      // above: a kana form's glyph IS its reading (ひとつ) and a counted form
      // carries its own (一本 · いっぽん) — both are one genuine pronunciation.
      // See LibEntry.speakable.
      speakable: true,
    });
  });

  // Keigo sets — the politeness track, browsed after verb pairs (see KINDS). A
  // set is a plain verb and its honorific/humble forms. Its first fact's glyph is
  // the exact form the detail route uses as its hero; `name` still carries the
  // complete set — "召し上がる / いただく". The recognition glosses are the
  // `meanings`, and the plain verbs/register words ride in `searchAlso`.
  // CURRICULUM_KEIGO_SETS, not the raw KEIGO_SETS: a set whose plain verb the
  // app can never teach gets no entry here either, matching the shelf
  // (keigo-shelf.ts) and the schedule (keigo-unit.ts).
  CURRICULUM_KEIGO_SETS.forEach((set, i) => {
    const id = keigoSetEntry(set);
    out.push({
      id,
      kind: KEIGO_SUBJECT,
      glyph: factInfo(factsOf(id)[0])?.glyph ?? set.words[0]?.word ?? "",
      name: set.words.map((w) => w.word).join(" / "),
      readings: set.words.map((w) => w.reading),
      meanings: set.words.map((w) => recognitionGloss(set, w)),
      searchAlso: [
        ...set.plain.map((p) => p.keb),
        ...set.words.map((w) => w.register),
        "keigo",
        set.meaning,
      ],
      sub: `Keigo · ${set.meaning}`,
      weight: 800 + i,
      // A set NAMES MULTIPLE WORDS (honorific and humble forms), not one — same
      // reasoning as the verb-pair case above, and the reason KeigoSetRow gives
      // each word its own HearButton instead of one entry-level speaker. See
      // LibEntry.speakable.
      speakable: false,
    });
  });

  // Kanji parts: shapes that appear in the KanjiVG decomposition but are neither
  // a jōyō kanji, a Kangxi radical, nor a variant form of either. 278 shapes.
  // CDP-coded glyphs (non-Unicode characters referenced by database code) are
  // excluded since they cannot render as characters.
  for (const [glyph] of PRIMITIVE_STROKES) {
    if (glyph.startsWith("CDP-")) continue;
    if (kanjiRow(glyph)) continue;
    if (variantTaughtKanji(glyph)) continue;
    if (radicalByWrittenForm(glyph)) continue;
    const strokes = primitiveStrokes(glyph) ?? 0;
    out.push({
      id: primitiveEntry(glyph),
      kind: PRIMITIVE_SUBJECT,
      glyph,
      readings: [],
      meanings: [],
      sub: strokes === 1 ? "1 stroke" : `${strokes} strokes`,
      weight: 900 + strokes,
      // A primitive is a shape, not a character — no meaning and no reading
      // are tracked for it anywhere in the app (see the empty `meanings` above
      // and `factsTitle`'s "it is a shape, not a character"). Found wrongly
      // speakable during the SAK-79 audit and fixed alongside it. See
      // LibEntry.speakable.
      speakable: false,
    });
  }

  return out;
}

/** entry id → its recipe, for the grammar-only lookups below. Built off the
 * same RECIPES walk `build()` uses, so it cannot name an entry that walk did
 * not mint. */
const RECIPE_OF_ENTRY: ReadonlyMap<EntryId, Recipe> = new Map(
  RECIPES.filter(isPrimaryPatternRecipe).map((r) => [patternEntry(r.id), r]),
);

/**
 * The cluster a grammar entry belongs to — the "compare similar patterns" view
 * its detail page links out to. Null for a pattern in no cluster, and for every
 * non-grammar entry.
 */
export function clusterOf(entry: LibEntry): string | null {
  return RECIPE_OF_ENTRY.get(entry.id)?.cluster ?? null;
}

/**
 * The recipe behind a grammar entry, or null for every other kind.
 *
 * The entry page needs the RECIPE and not just its cluster: the formula, the
 * hosts it attaches to and which production facts it carries all live on the
 * recipe, and the page had no way to reach it that was not re-deriving the id.
 * A lookup, never a parse — the same rule `clusterOf` follows and the same map.
 */
export function recipeOf(entry: LibEntry): Recipe | null {
  return RECIPE_OF_ENTRY.get(entry.id) ?? null;
}

/** Every independently meaningful recipe shown on this written pattern's one
 * reference page. Non-grammar entries have no recipes. */
export function recipesOf(entry: LibEntry): readonly Recipe[] {
  const primary = RECIPE_OF_ENTRY.get(entry.id);
  return primary ? patternGroup(primary.id) : [];
}

// ---------- the links ----------

/** kanji glyph → every everyday word containing it, in vocab order. The join
 * that makes 人生 both a word AND the evidence for 生's セイ. */
const APPEARS_IN: ReadonlyMap<string, readonly string[]> = buildAppearsIn();

function buildAppearsIn(): Map<string, string[]> {
  const map = new Map<string, string[]>();
  for (const w of VOCAB) {
    for (const c of new Set(w.keb)) {
      if (!kanjiRow(c)) continue;
      const list = map.get(c);
      if (list) list.push(w.keb);
      else map.set(c, [w.keb]);
    }
  }
  return map;
}

/**
 * The words an entry appears inside.
 *
 * For a kanji, every everyday word written with it — 生 has ~219. For a word or
 * a kana, nothing: containment is a KANJI relation here, because that is the one
 * the data attests. A kana appears in nearly every reading in the language,
 * which is not a link, it is noise.
 */
export function appearsIn(entry: LibEntry): readonly string[] {
  if (entry.kind !== KANJI_SUBJECT) return [];
  return APPEARS_IN.get(entry.glyph) ?? [];
}

/**
 * The DIRECT components a kanji is written with — 休 = 亻 + 木, 時 = 日 + 寺.
 * From KanjiVG's depth-1 element hierarchy (see KanjiRow.comps).
 *
 * NOT ALL COMPONENTS ARE ENTRIES. Variant and bound forms — 亻, 氵, 艹 — have no
 * KANJIDIC2 row, so each comes back with an entry id or null and the screen
 * renders a link or plain text. `c` is always the ACTUAL component to DISPLAY;
 * `id` is where tapping it goes. Where a component is a variant of a taught
 * character (亻 of 人, 刂 of 刀), `id` points at that character so the learner
 * can meet it — the shape shown is still 亻, only the link resolves to 人.
 */
export function madeOf(entry: LibEntry): Array<{ c: string; id: EntryId }> {
  if (entry.kind !== KANJI_SUBJECT) return [];
  return (kanjiRow(entry.glyph)?.comps ?? []).map((c) => ({
    c,
    id: builtPieceEntryId(c),
  }));
}

/**
 * Where a "Built from" tile links when tapped: the Library page for the shape it
 * shows. The same id-resolution the shape decomposition has always used, lifted
 * out so the etymology-driven Built-from (which shows a SUBSET of the shape
 * pieces, chosen by Wiktionary's glyph origin) links each surviving piece exactly
 * as the old full decomposition did.
 *
 * A kanji (or a variant of a taught kanji — 亻 of 人, 刂 of 刀) links to that
 * kanji; a bare Kangxi radical to its radical page; anything else to its
 * primitive page. Where a component is a variant, the shape SHOWN is still the
 * drawn form, only the link resolves to the character it stands for.
 */
export function builtPieceEntryId(c: string): EntryId {
  // An EXCLUDED variant (儿→八, 眞→真) is a dropped mapping: its link and meaning
  // must NOT resolve through the false original, or the tile would label a 儿
  // "eight" while its own radical page says "legs". Treat it as its own shape —
  // it falls through to the radical (儿 → legs) or primitive branch below.
  const kanjiLink = kanjiRow(c)
    ? c
    : isExcludedVariant(c)
      ? undefined
      : variantTaughtKanji(c);
  if (kanjiLink) return kanjiEntry(kanjiLink);
  // A component that is a Kangxi radical (not itself a kanji) links to its
  // library page rather than the primitive /radical route.
  const rad = radicalByWrittenForm(c);
  if (rad) return radicalEntry(rad.glyph);
  return primitiveEntry(c);
}

/** One piece of the kanji-page "Built from" section: the shape to show, where
 * tapping it goes, and the one-word meaning printed under it. */
export interface BuiltPiece {
  readonly c: string;
  readonly id: EntryId;
  readonly meaning: string;
  /** Present only when the piece is a VARIANT form — 亻 for 人, 氵 for 水. It
   * carries what the tile then says under the meaning: the character the shape is
   * a form of, where it sits, and its position-name where one is verified. A
   * plain piece (a kanji or a bare radical) has none. */
  readonly variant?: {
    readonly original: string;
    readonly position?: VariantPosition;
    readonly name?: string;
  };
}

/**
 * The kanji page's "Built from" pieces — the FULL immediate decomposition, so
 * unlike the lesson's kanji-only `teachableParts` this KEEPS the radical and
 * variant pieces: 何 → 亻 person + 可 possible, 明 → 日 sun + 月 moon, 可 → 丁
 * street + 口 mouth. Every piece links to its library page (kanji, radical, or
 * primitive) and carries its meaning so the tile reads glyph-over-meaning.
 *
 * THE #32 FRAME-DEDUP APPLIES HERE. `madeOf` reads the raw KanjiVG comps, which
 * still double a split enclosure (可 → 丁,口,丁). `deframe` collapses that single
 * frame written twice while leaving a genuine repetition intact (品 → 口,口,口) —
 * it only ever drops the trailing copy, so slicing `madeOf` to the deframed
 * length keeps each surviving piece paired with its own id and meaning.
 *
 * Empty for an atomic kanji (一 has no components); the section renders nothing.
 */
export function builtFrom(entry: LibEntry): BuiltPiece[] {
  // The number kanji 一…十 are memorised wholes, not compositions: their KanjiVG
  // pieces (囗 儿 亠 丿 乙, the 八 in 六) are shape-only and imply a meaning the
  // number does not carry, so the page (and the lesson card, which mounts this
  // same box and gates on this same length via lesson-roles) shows NO "Built
  // from" for them. Every other kanji — counters included — keeps its breakdown.
  if (entry.kind === KANJI_SUBJECT && isNumberKanji(entry.glyph)) return [];
  const pieces = madeOf(entry);
  if (!pieces.length) return [];
  const kept = deframe(pieces.map((p) => p.c)).length;
  return pieces.slice(0, kept).map((p) => {
    const v = variantForm(p.c);
    return {
      c: p.c,
      id: p.id,
      meaning: builtPieceMeaning(p.c, p.id),
      // A variant piece carries what the tile says under its meaning: 亻 is 人 in
      // its left form. `variantForm` is defined only for the forms the `variants`
      // map names, so a plain piece leaves this undefined.
      ...(v
        ? { variant: { original: v.original, position: v.position, name: v.name } }
        : {}),
    };
  });
}

/** The meaning printed under a "Built from" piece. A kanji's own gloss; a
 * variant form's from the taught character it resolves to; a radical or
 * primitive's from its library entry if any. */
function builtPieceMeaning(c: string, id: EntryId): string {
  const kanji = kanjiRow(c);
  if (kanji) return kanji.meanings[0] ?? "";
  const entry = libEntry(id);
  if (entry?.kind === PRIMITIVE_SUBJECT) return "Kanji part";
  return entry?.meanings[0] ?? "";
}

/**
 * Entries this one might get mixed up with — A GUESS, and the screen must say
 * so.
 *
 * Shape only: LOOK_GROUP for kana, CONFUSABLE_WITH for kanji. It is not a record
 * of anything you have done. What you have ACTUALLY mixed up is a different
 * question with a different source (src/lib/confusions.ts, over history); this
 * is the app guessing before it has evidence, which is the only time a guess is
 * worth anything — and the entry page prints that in as many words, because a
 * guess must never read as a report.
 */
export function confusableWith(entry: LibEntry): EntryId[] {
  if (entry.kind === KANA_SUBJECT) {
    return (LOOK_GROUP[entry.glyph] ?? [])
      .filter((c) => CHAR_INDEX[c])
      .map((c) => kanaEntry(c));
  }
  if (entry.kind === KANJI_SUBJECT) {
    return (CONFUSABLE_WITH.get(entry.glyph) ?? [])
      .filter((c) => kanjiRow(c))
      .map((c) => kanjiEntry(c));
  }
  return [];
}

/**
 * The entry a glyph names on a given shelf, when the glyph is all a link has —
 * an "appears in" word, a component kanji.
 *
 * Null when there is no such entry, which the caller must handle rather than
 * mint an id for data it does not have. A minted id that resolves to nothing is
 * a broken link that type-checks.
 */
export function entryForGlyph(kind: Kind, glyph: string): EntryId | null {
  switch (kind) {
    case KANA_SUBJECT:
      return CHAR_INDEX[glyph] ? kanaEntry(glyph) : null;
    case KANJI_SUBJECT:
      return kanjiRow(glyph) ? kanjiEntry(glyph) : null;
    // A radical IS resolved by its glyph: the 214 glyphs are unique and the
    // entry is keyed on the glyph, so a kanji page's "filed under" link mints its
    // radical link this way. radical:水 and kanji:水 stay apart by subject.
    case RADICAL_SUBJECT:
      return radicalByGlyph(glyph) ? radicalEntry(glyph) : null;
    case PRIMITIVE_SUBJECT:
      return PRIMITIVE_STROKES.has(glyph) ? primitiveEntry(glyph) : null;
    case VOCAB_SUBJECT:
      return vocabRow(glyph) ? wordEntry(glyph) : null;
    // A counter is NOT resolved by its glyph, and for the same reason a bare
    // number gets a low weight above: に the number and に the particle share a
    // glyph, and 一本 is not a vocab keb at all. Counter links are minted from the
    // form's own namespaced id (counterEntry), never from a glyph, so nothing
    // asks this — but the answer would be ambiguous if it did.
    case COUNTER_KIND:
      return null;
    // A mark is not resolved by its glyph either, and for a stronger reason than
    // grammar's: っ IS a kana glyph as well as a mark, ゃゅょ is three glyphs in
    // one entry, and long vowels has none. Mark links are minted from the mark's
    // own id (`markEntry`), so nothing asks this.
    case MARK_SUBJECT:
    case SENTENCE_RULE_KIND:
      return null;
    // A pattern is not resolved by its glyph — many grammar rows can share a
    // visible shape, so links are minted from a recipe id, never from a glyph.
    case GRAMMAR_SUBJECT:
      return null;
    // A pair has no glyph at all — `glyph` is the empty string — so nothing
    // resolves one this way. Its links are minted from the pair id (pairEntry).
    case TRANSITIVITY_SUBJECT:
      return null;
    // A keigo set has no glyph either — `glyph` is the empty string — and its
    // verbs' glyphs belong to their own vocabulary entries. Keigo links are
    // minted from the set id (keigoSetEntry), so this is never asked.
    case KEIGO_SUBJECT:
      return null;
    // A term has no glyph either, and nothing links to one by glyph — a term is
    // reached from the shelf or search, and its links are minted from its own id
    // (termEntry). So this is never asked.
    case TERM_SUBJECT:
      return null;
    // A grammar concept has no glyph either, and nothing links to one by glyph —
    // it is reached from the shelf, from search, or from a te-family entry's
    // Links row, and every link is minted from its own id (grammarConceptEntry).
    case GRAMMAR_CONCEPT_SUBJECT:
      return null;
    // A construction page has a plate for a glyph (十〜, 〜本), not a unique
    // character, and nothing links to one by glyph — it is reached from the
    // counters shelf, from search, or from a related counter's page, and every
    // link is minted from its own id (numberConstructionEntry). So this is never
    // asked.
    case NUMBER_CONSTRUCTION_KIND:
      return null;
  }
}

// ---------- an entry's facts, with what a screen needs to LABEL them ----------
//
// factsOf(entry) gives ids and nothing else, by design. The entry page has to
// say what each one ASKS — and that is subject knowledge, so it is resolved
// here, once, rather than every screen learning which subjects have anchors.

/** One row of the entry page's facts table. */
export interface FactRow {
  readonly id: FactId;
  /** "Meaning", "セイ", "い(きる)" — what this fact asks about. */
  readonly label: string;
  /** The answer. The entry page SHOWS it: this is a reference, not a quiz, and
   * a reference that withholds the answer is a quiz with no marking. */
  readonly answer: string;
  /**
   * The words this fact is asked in — 学生 · 先生 for 生's セイ.
   *
   * The reason the fact exists. A kanji reading fact is keyed on (kanji, word)
   * precisely because the word is what makes it gradeable, so a table showing
   * the reading without the word would be showing a question the app cannot ask.
   * Empty for a meaning fact and for kana, which have no anchor and need none.
   */
  readonly askedIn: readonly string[];
  /** A reading the ingest found no everyday word for: here to be READ, never
   * asked. The design's "＋ 4 rarer readings — here if you look, never asked." */
  readonly unattested: boolean;
  /**
   * Where this reading's SOUND came from, in beginner English — the answer to
   * "why do 一's いち and ひと sound nothing like each other".
   *
   * THIS COLUMN still says "from Chinese" / "native Japanese", not "on'yomi" /
   * "kun'yomi". It is a per-row label in a dense table, read at a glance, and
   * there the plain phrase carries its own meaning where the jargon would need
   * looking up.
   *
   * THE JARGON ITSELF IS NO LONGER BANNED, and that is a deliberate reversal.
   * This column existed BECAUSE the words were forbidden app-wide, on the
   * reasoning that a reading is taught through the WORD it surfaces in, so a
   * learner never needs the term. Sam has since decided the term is worth
   * teaching directly: the kanji entry now carries an on'yomi hint (the reading
   * borrowed from Chinese, the one a kanji takes in compounds), and the concept
   * is explained once, in a curriculum intro card, before the first kanji with
   * an on'yomi. So "on'yomi" IS used in the UI now — introduced up front, then
   * used as a brief label on the hint — while this reference table keeps the
   * plainer phrase for the same at-a-glance reason it always did. See
   * src/lib/kanji-onyomi.ts and the on'yomi intro in src/data/phase-intros.ts.
   *
   * `null` for every row that is not a kanji reading (a kana's romaji, a word's
   * reading, a grammar pattern) — those have no such distinction, and printing
   * an empty column for them would invent one.
   */
  readonly origin: "from Chinese" | "native Japanese" | "both" | null;
  /**
   * The kana to SPEAK for this row, or null when there is nothing to say.
   *
   * Null is the common case and the honest one: a grammar pattern has no single
   * pronunciation (the same reason the page's Hear-it button is omitted for
   * grammar), and a meaning row's answer is English. Only a row whose label IS
   * Japanese sound gets a speaker.
   */
  readonly speak: string | null;
}

/**
 * What the entry page's facts table is CALLED, per kind.
 *
 * It used to be a sentence generated from the row count — "一 is one character
 * and 4 things to know" — which was accurate and unreadable, and which lost its
 * only justification when the meaning row left the kanji table. A heading names
 * the thing under it; these do.
 *
 * PER KIND, because the table is not the same table four times. Only kanji and
 * kana hold readings and nothing else. A word holds its reading AND its
 * meaning, which are separately scored and both belong. Grammar holds a meaning
 * and, when the pattern is producible, the form it builds — calling that
 * "Readings" would be false twice over.
 */
export function factsTitle(entry: LibEntry, rows: readonly FactRow[]): string {
  switch (entry.kind) {
    case KANA_SUBJECT:
      return "Reading";
    case KANJI_SUBJECT:
      return rows.length === 1 ? "Reading" : "Readings";
    case VOCAB_SUBJECT:
      return "Reading and meaning";
    // A counter is a word, so its table is a word's — reading AND meaning for a
    // counted form (一本 · いっぽん), meaning alone for a kana form whose reading is
    // the glyph itself (ひとつ). Read off the row count, like grammar below, so a
    // one-row kana counter is not promised a reading it does not test.
    case COUNTER_KIND:
      return rows.length > 1 ? "Reading and meaning" : "Meaning";
    // A radical has one fact and it is its meaning, so the table is headed by
    // what it holds.
    case RADICAL_SUBJECT:
      return "Meaning";
    case GRAMMAR_SUBJECT:
      // A non-producible pattern (は〜より, たり〜たり) has ONLY the meaning row,
      // so promising a form here would be promising a row that is not there.
      return rows.length > 1 ? "Meaning and form" : "Meaning";
    // A mark never has rows (see factRows), so this string never reaches a
    // screen — the page's `rows.length > 0` guard drops the whole section first.
    // It is here because the switch is exhaustive and because a silent `""` for
    // a kind that later grew a fact would ship a headed table with no heading.
    case MARK_SUBJECT:
    case SENTENCE_RULE_KIND:
      return "Nothing to test";
    // A grammar concept never has rows (see factRows), for the same reason a mark
    // does not: "what is a conjugation form" has no gradeable answer. The page's
    // `rows.length > 0` guard drops the whole section, so this never shows.
    case GRAMMAR_CONCEPT_SUBJECT:
      return "Nothing to test";
    // A construction page never has rows (see factRows), for the same reason a
    // concept does not: how a number is built is read, not graded. The page's
    // `rows.length > 0` guard drops the whole section, so this never shows.
    case NUMBER_CONSTRUCTION_KIND:
      return "Nothing to test";
    // A pair's facts are chips on its own page, never this generic table (the
    // entry page excludes transitivity from genericRows), so this heading is not
    // shown. Present for exhaustiveness, and named for what the rows would ask.
    case TRANSITIVITY_SUBJECT:
      return "Which verb";
    // A keigo set's facts are shown on its own page (the set view, not this
    // generic table — the entry page excludes keigo from genericRows), so this
    // heading is not shown. Present for exhaustiveness, named for what the rows
    // would ask.
    case KEIGO_SUBJECT:
      return "Which register";
    // A term never has rows (see factRows), for the same reason a mark does not:
    // "what is JLPT" has no gradeable answer. The page's `rows.length > 0` guard
    // drops the whole section, so this string never reaches a screen.
    case TERM_SUBJECT:
      return "Nothing to test";
    // A primitive has no facts — it is a shape, not a character.
    case PRIMITIVE_SUBJECT:
      return "Nothing to test";
  }
}

/**
 * The first column's header, which is the same honesty problem one level down.
 *
 * It said "Reading" for every kind. For kanji that is now true (the meaning row
 * that made it false has gone) and for kana it always was. For a word the
 * column holds a reading AND a meaning, and for a pattern a meaning and a
 * build-it; "Reading" names neither. Those get a header that describes the
 * column it actually heads.
 */
export function factsColumnHeader(entry: LibEntry): string {
  return entry.kind === KANA_SUBJECT || entry.kind === KANJI_SUBJECT
    ? "Reading"
    : "What it asks";
}

/**
 * An entry's facts, in table order, each with what it asks.
 *
 * 生 comes back as 1 meaning + one row per distinct reading — the model's whole
 * thesis, made visible. This is the closest thing the app has to a proof that
 * "what is the reading of 生" is not a question.
 */
export function factRows(entry: LibEntry): FactRow[] {
  switch (entry.kind) {
    case KANA_SUBJECT:
      return [
        {
          id: kanaFact(entry.glyph),
          label: "Reading",
          answer: entry.readings.join(" / "),
          askedIn: [],
          unattested: false,
          origin: null,
          speak: entry.glyph,
        },
      ];
    case KANJI_SUBJECT:
      return kanjiFactRows(entry);
    // A word KEEPS its meaning row. The kanji table could drop one because what
    // remained was still a table; here the reading and meaning rows ARE the word
    // — separately scored, and dropping either leaves a table that no longer says
    // what the app tests.
    //
    // ONE PAIR PER READING-UNIT, not just the primary: 日 shows its ひ (day) row
    // and its か (day-counter) row, because each is its own scored skill (see
    // wordUnitFacts). The label stays "Reading"/"Meaning" on every unit — the
    // rows sit under the one word entry and the answer disambiguates which
    // reading each is about. A kana word has no reading fact, so it is the
    // meaning row alone, exactly as before.
    case VOCAB_SUBJECT:
      return wordUnitFacts(entry.glyph).flatMap(({ unit, reading, meaning }) => {
        const rows: FactRow[] = [];
        if (reading) {
          rows.push({
            id: reading,
            label: "Reading",
            answer: unit.reb,
            askedIn: [],
            unattested: false,
            origin: null,
            // The word's own kana. Speaking the reading rather than the written
            // form is the point: 先生 read aloud by a synthesiser is a coin flip,
            // せんせい is not.
            speak: unit.reb,
          });
        }
        rows.push({
          id: meaning,
          label: "Meaning",
          answer: unit.glosses.join(", "),
          askedIn: [],
          unattested: false,
          origin: null,
          speak: null,
        });
        return rows;
      });
    case GRAMMAR_SUBJECT:
      return grammarFactRows(entry);
    // A counter is a word, so it prints a word's rows — but keyed on the form's
    // OWN facts (counterReadingFactId / counterMeaningFactId), not the vocab-keb
    // minters the word branch uses: 一本 is no keb and に would collide with the
    // particle. A counted form has both rows, its reading spoken (いっぽん, not the
    // synthesiser's guess at 一本); a kana form has the meaning row alone.
    case COUNTER_KIND:
      return counterFactRows(entry);
    // A radical's one fact is its meaning — the same meaning-recall row a kanji
    // carries, and the fact that unlocks the kanji filed under it. No reading:
    // a radical is a shape and an idea, never a sound.
    case RADICAL_SUBJECT:
      return [
        {
          id: radicalMeaningFactId(entry.glyph),
          label: "Meaning",
          answer: entry.meanings.join(", "),
          askedIn: [],
          unattested: false,
          origin: null,
          speak: null,
        },
      ];
    // A MARK HAS NO FACTS AT ALL, and this empty array is the shape of that
    // rather than a stub. "What is a dakuten" has no gradeable answer; the rule
    // is read, not tested, and the thing that IS testable — きて vs きって — is a
    // question about a WORD and is scored against the word's facts.
    //
    // It follows the precedent this table already sets: no rows, no section. The
    // entry page's `rows.length > 0` guard (there for the 114 kanji with no
    // attested reading) drops the whole box, so a mark page has no facts table
    // instead of an empty one. Nothing here had to be added for that to work.
    case MARK_SUBJECT:
    case SENTENCE_RULE_KIND:
      return [];
    // A GRAMMAR CONCEPT HAS NO FACTS AT ALL — like a mark or a term. "What is a
    // conjugation form" is a thing to read, not a question to mark, so the empty
    // array is the shape of that and the entry page's `rows.length > 0` guard
    // drops the facts box entirely.
    case GRAMMAR_CONCEPT_SUBJECT:
      return [];
    // A CONSTRUCTION PAGE HAS NO FACTS AT ALL — like a concept, a mark or a term.
    // How a number is built is read, not graded, so the empty array is the shape
    // of that and the entry page's `rows.length > 0` guard drops the facts box.
    case NUMBER_CONSTRUCTION_KIND:
      return [];
    // A pair's gradeable facts, one row per ASKABLE side. Not rendered by the
    // entry page (which draws the pair itself), but kept honest for any generic
    // caller: see transitivityFactRows.
    case TRANSITIVITY_SUBJECT:
      return transitivityFactRows(entry);
    // A keigo set's gradeable facts, one row per keigo word. Not rendered by the
    // entry page (which draws the set itself), but kept honest for any generic
    // caller: see keigoFactRows.
    case KEIGO_SUBJECT:
      return keigoFactRows(entry);
    // A TERM HAS NO FACTS AT ALL — like a mark. "What is a radical" is a thing to
    // read, not a question to mark, so the empty array is the shape of that and
    // the entry page's `rows.length > 0` guard drops the facts box entirely.
    case TERM_SUBJECT:
    case PRIMITIVE_SUBJECT:
      return [];
  }
}

/** A pair's facts as table rows: one per ASKABLE side — the English cue as the
 * label, the verb it points to as the answer, its reading to speak. The
 * unaskable side is omitted for the same reason knownFactsOf drops it (it is
 * never quizzed). Empty when the entry names no pair the build knows. */
function transitivityFactRows(entry: LibEntry): FactRow[] {
  const pair = pairForEntry(entry.id);
  if (!pair) return [];
  const rows: FactRow[] = [];
  for (const side of ["happens", "doIt"] as const) {
    const id = sideFactId(pair, side);
    const info = transitivitySide(id);
    if (!info?.askable) continue;
    rows.push({
      id,
      label: info.en,
      answer: info.word,
      askedIn: [],
      unattested: false,
      origin: null,
      // The reading, not the written form: a synthesiser handed 出す reads it
      // as one of its verbs at random, だす is unambiguous — the same call the
      // word table makes.
      speak: info.reading,
    });
  }
  return rows;
}

/** A keigo set's facts as table rows: one per keigo word — the word as the label,
 * its recognition gloss (register and action) as the answer, its reading to
 * speak. Empty when the entry names no set the build knows. */
function keigoFactRows(entry: LibEntry): FactRow[] {
  const set = keigoSetForEntry(entry.id);
  if (!set) return [];
  return set.words.map((w) => ({
    id: keigoWordFactId(set, w),
    label: w.word,
    answer: recognitionGloss(set, w),
    askedIn: [],
    unattested: false,
    origin: null,
    // The reading, spoken off the word's own kana — a synthesiser handed
    // 召し上がる may guess a reading, めしあがる is unambiguous.
    speak: w.reading,
  }));
}

/**
 * A counter's facts as table rows — its reading (for a counted form) and its
 * meaning, the two things the entry page exists to show side by side.
 *
 * The reading row is present only for a counted form: a kana form (ひとつ) IS its
 * reading, so there is nothing to test and buildCounterFacts mints no reading
 * fact — the same rule the word branch follows for kana words. The reading is
 * SPOKEN off the row's own kana (いっぽん), because handing a synthesiser 一本
 * gets a reading at random, which is precisely the mistake this shelf teaches
 * against. Empty when the id names no form this track minted.
 */
function counterFactRows(entry: LibEntry): FactRow[] {
  const form = counterForm(entry.id);
  if (!form) return [];
  const rows: FactRow[] = [];
  if (!isKanaCounterForm(form)) {
    rows.push({
      id: counterReadingFactId(form),
      label: "Reading",
      answer: form.reading,
      askedIn: [],
      unattested: false,
      origin: null,
      speak: form.reading,
    });
  }
  rows.push({
    id: counterMeaningFactId(form),
    label: "Meaning",
    answer: form.meaning,
    askedIn: [],
    unattested: false,
    origin: null,
    speak: null,
  });
  return rows;
}

/**
 * A grammar entry's facts: what it MEANS, and — when it is producible — the form
 * it BUILDS, shown on the fixed representative verb the drill uses. A vacuous or
 * wrap pattern (は〜より, たり〜たり) has only the meaning row, which is the
 * same "shown, never asked" honesty the cluster page keeps.
 */
// HOST_LABEL — what a host is called on screen — used to be a private copy
// here. It is now imported from lib/grammar/formula.ts, because the entry page
// names hosts in three more places (the line under the pattern, the production
// chips, the formula's slot) and four copies of "い-adjective" are four chances
// to disagree about it.

function grammarFactRows(entry: LibEntry): FactRow[] {
  const recipes = recipesOf(entry);
  const rows: FactRow[] = [];
  for (const r of recipes) {
    rows.push({
      id: patternMeaningFactId(r.id),
      label: r.sense ? `Meaning (${r.sense})` : "Meaning",
      answer: r.gloss,
      askedIn: [],
      unattested: false,
      origin: null,
      // A pattern is a shape, not a sound — 〜てから has no one pronunciation,
      // which is why the page's Hear-it button is omitted for grammar too.
      speak: null,
    });
    // ONE ROW PER VERB CLASS. Every conjugating recipe scores the nine godan
    // endings and ichidan separately, so the Library must link to those actual
    // facts rather than the former five 音便 buckets or one unqualified row-shift
    // fact. The anchor is the same one the fact is baked on.
    if (isProducible(r) && conjugatesVerb(r)) {
      for (const anchor of CLASS_ANCHOR) {
        const id = classProductionFactId(r.id, anchor.cls);
        const info = factInfo(id);
        if (!info) continue;
        rows.push({
          id,
          label: `Build it (${anchor.ending || "る-verb"})`,
          answer: `${anchor.surface} → ${info.glyph}`,
          askedIn: [],
          unattested: false,
          origin: null,
          speak: null,
        });
      }
    }

    // ONE ROW PER PRODUCTION FACT, which is one per host that carries one. The
    // page is a list of the entry's FACTS, so a pattern with a separate adjective
    // fact has to show it — otherwise the split exists in the scheduler and the
    // one screen that promises to enumerate what is scored still says there is a
    // single "Build it". The label names the host for the same reason.
    //
    const hosts = isProducible(r) ? productionHosts(r) : [];
    for (const host of hosts) {
      const ex = buildExample(r, host);
      if (!ex) continue;
      rows.push({
        id: patternProductionFactId(r.id, host),
        // The host is named only when there is something to tell apart. One
        // production fact needs no qualifier, and adding "(verb)" to all 45 of
        // them to be uniform would be noise on every page to serve five.
        label:
          conjugatesVerb(r) || hosts.length > 1
            ? `Build it (${HOST_LABEL[host]})`
            : "Build it",
        answer: `${ex.lemma} → ${ex.form}`,
        askedIn: [],
        unattested: false,
        origin: null,
        speak: null,
      });
    }
    if (isProducible(r)) pushSpecialWordRows(r, rows);
  }
  return rows;
}

/** Append the exceptional verb and adjective production facts this pattern owns. */
function pushSpecialWordRows(r: Recipe, rows: FactRow[]): void {
  for (const sv of [...SPECIAL_VERB_ROWS, ...SPECIAL_ADJ_ROWS]) {
    const id = specialVerbProductionFactId(r.id, sv.qualifier);
    const info = factInfo(id);
    if (!info) continue;
    rows.push({
      id,
      label: `Build it (${sv.label})`,
      answer: info.glyph,
      askedIn: [],
      unattested: false,
      origin: null,
      speak: null,
    });
  }
}

/** How a reading's KANJIDIC2 type reads to someone who has never heard the
 * words on'yomi and kun'yomi. See FactRow.origin. */
const ORIGIN_LABEL = {
  on: "from Chinese",
  kun: "native Japanese",
  // KANJIDIC2 lists the same reading under both types for different senses.
  // Said out loud rather than resolved: the dictionary declines to choose, so
  // this does too.
  both: "both",
} as const;

/**
 * A kanji's rows: ONE PER READING, and no meaning row.
 *
 * The meaning row used to lead this table, which made the "Reading" column
 * header a lie about its own first row — 一's read as "one, one radical
 * (no.1)", which is neither a reading nor, as it turns out, a meaning. The
 * meaning is already the page's title, so the row was duplicating it; what the
 * row uniquely carried was its own scoring, and that moved to a StandingChip
 * beside the definition rather than being lost. See the entry page.
 */
function kanjiFactRows(entry: LibEntry): FactRow[] {
  const rows: FactRow[] = [];
  for (const r of readingsOf(entry.glyph)) {
    rows.push({
      id: readingFactId(r.k, r.anchor, r.base),
      label: r.base,
      origin: r.type ? ORIGIN_LABEL[r.type] : null,
      speak: r.base,
      // How the reading SURFACES in its anchor — 口 in 出口 is ぐち, and the
      // fact accepts both (see buildKanjiFacts). The table shows the surface,
      // because that is what you would actually say.
      answer: r.surface,
      askedIn: r.words.slice(0, 4),
      unattested: r.nWords === 0,
    });
  }
  return rows;
}
