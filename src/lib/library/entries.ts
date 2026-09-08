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
// and not a leak, on one condition — it happens in ONE place (entries-build.ts,
// at build time; see below) and what comes out the other side is
// subject-agnostic again. A Library screen renders `LibEntry`. It does not know
// that kanji have grades.
//
// NOTHING HERE PARSES AN ID. Ids are minted by each subject's own minter
// (`kanaEntry`, `kanjiEntry`, `wordEntry`, `kanaFact`, `meaningFactId`,
// `readingFactId`, `wordReadingFactId`, `wordMeaningFactId`) and resolved by
// lookup. The join back to CHAR_INDEX / KANJI / VOCAB is by GLYPH, which is the
// key those tables are already keyed by — not by taking an id apart.
//
// WHERE THE ENTRIES COME FROM (SAK-400)
// =====================================
// Not from here, at runtime. `buildEntries` in entries-build.ts walks every
// subject's tables and mints the 15,553 entries; scripts/build-library-index.mjs
// runs it and writes src/data/generated/library-index.json, and this module
// reads that file. A process serving a page never builds an entry, which is
// what a cold start used to pay for on top of loading the tables.
// library-index.equiv.test.ts asserts the file agrees with the build it came
// from, and `npm run build` regenerates it before every deploy.

import { CHAR_INDEX, KANA_SUBJECT, kanaEntry, LOOK_GROUP } from "@/data/characters";
import { CONFUSABLE_WITH } from "@/data/confusable";
import {
  KANJI_SUBJECT,
  kanjiEntry,
  kanjiRow,
  READINGS,
  type ReadingRow,
  variantTaughtKanji,
} from "@/data/kanji";
import { isExcludedVariant } from "@/data/variant-forms";
import { VOCAB_SUBJECT, wordEntry } from "@/data/vocab";
import { GRAMMAR_SUBJECT, GRAMMAR_VOCAB_DUPLICATE_KEBS, patternEntry } from "@/data/grammar";
import { MARK_SUBJECT } from "@/data/marks";
import { GRAMMAR_CONCEPT_SUBJECT } from "@/data/grammar-concepts";
import { NUMBER_CONSTRUCTION_SUBJECT } from "@/data/number-construction";
import { TERM_SUBJECT } from "@/data/terms";
import { COUNTER_ENTRIES, COUNTER_TAIL_FORM_ALIASES, COUNTER_VOCAB_DUPLICATE_KEBS } from "@/data/counters";
import {
  RADICAL_SUBJECT,
  radicalEntry,
  radicalByGlyph,
  radicalByWrittenForm,
} from "@/data/radicals";
import { primitiveEntry, PRIMITIVE_SUBJECT, PRIMITIVE_STROKES } from "@/data/components";
import { radicalConfusablePartner } from "@/data/radical-tips";
import {
  RECIPES,
  isPrimaryPatternRecipe,
  patternGroup,
  type Recipe,
} from "@/data/grammar/recipes";

/** The particle-pair clusters — comparisons ("は vs が", "に vs で") whose title
 * is redundant as a member's sub-line (see the grammar-entry `sub` below). Their
 * titles still ride `searchAlso`, so the family stays findable by name. */
export const COMPARISON_CLUSTER_IDS: ReadonlySet<string> = new Set(["wa-ga", "ni-de"]);
import { TRANSITIVITY_SUBJECT } from "@/data/transitivity-facts";
import { KEIGO_SUBJECT } from "@/data/keigo";
import type { EntryId, FactId, FactInfo, QuizMode } from "@/types";
import libraryIndexJson from "@/data/generated/library-index.json" with { type: "json" };
import type { LibraryIndex } from "./library-index-types";

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
export const COUNTER_KIND = "counting";
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
 * The coarser TRACK a fact's lesson belongs to (SAK-145) — the same seven
 * names Home's track cards use (TRACK_TITLE, components/home/home-feed.tsx):
 * "Kana", "Vocabulary", "Grammar", "Transitivity", "Keigo". Radicals, kanji
 * and words are three different `subjectLabel` item-kinds ("Radical",
 * "Kanji", "Word") but one track, "Vocabulary" — there is no separate
 * radical/kanji track for a lesson to belong to. Not re-exported from
 * home-feed.tsx on purpose: that module is part of the /learn bundle, and
 * this is read from the session header on every lesson, so the two keep
 * independent (small, easily-kept-in-sync) copies of the same seven names
 * rather than share an import across that bundle boundary.
 *
 * Counting and sentence-ordering lessons are not resolved here — both share
 * `word` or another non-distinct subject with ordinary vocab facts, and are
 * already named by the session page's own `session.what`/mode checks before
 * this is ever consulted. Undefined for a subject with no track of its own
 * (marks, terms, grammar concepts, kanji parts — none of which a lesson
 * teaches directly).
 */
const TRACK_LABEL: Partial<Record<Kind, string>> = {
  [KANA_SUBJECT]: "Kana",
  [RADICAL_SUBJECT]: "Vocabulary",
  [KANJI_SUBJECT]: "Vocabulary",
  [VOCAB_SUBJECT]: "Vocabulary",
  [GRAMMAR_SUBJECT]: "Grammar",
  [TRANSITIVITY_SUBJECT]: "Transitivity",
  [KEIGO_SUBJECT]: "Keigo",
};

/** The session header's track name for a fact — "Vocabulary" rather than
 * `subjectLabel`'s "Word". See TRACK_LABEL. */
export function trackLabel(info: FactInfo | undefined): string | undefined {
  if (!info) return undefined;
  return TRACK_LABEL[info.subject as Kind];
}

/**
 * The session header's track name for a QUIZ's whole fact pool (SAK-145
 * round 3) — the drill/grid/pairs/assembly/substitution/listen-sentence HUDs'
 * equivalent of `trackLabel` above.
 *
 * A LESSON's teach set is always one subject (the session page's own
 * `trackLabel` comment says so, and resolves the track from the first teach
 * fact alone) — but a QUIZ is not always a lesson's drill. Practice's "Due
 * for review" one-click shortcut (app/practice/page.tsx's `startDue`) pulls
 * `dueFacts` across every list at once — kana, vocabulary and grammar in the
 * same run — and the Practice builder's own Selection can check more than one
 * Kind too. Naming a mixed pool after its first fact would be actively
 * WRONG, not just imprecise (a "Grammar" label over a run that is half kana),
 * so this checks every fact instead of assuming the first names them all: it
 * returns a track only when EVERY fact that resolves to one resolves to the
 * SAME one, and undefined otherwise — the HUDs fall back to showing no track
 * name at all, exactly what they render today, rather than guess.
 *
 * A fact with no track of its own (see TRACK_LABEL's "undefined for a
 * subject with no track" case — marks, terms, grammar concepts, kanji parts)
 * is skipped rather than treated as a disagreement: those never drive a quiz
 * on their own, and a pool that is otherwise single-track should not lose its
 * label because one confusable-distractor fact along for the ride has none.
 *
 * COUNTING AND SENTENCE-ORDERING (SAK-252)
 * =========================================
 * TRACK_LABEL's own doc says these two are "not resolved [t]here" because the
 * session page's teach-header applies its own `session.what`/mode override on
 * top of `trackLabel`'s result. That override lives ONLY in the teach-phase
 * branch of app/session/page.tsx — every quiz HUD (drill/grid/pairs/assembly/
 * substitution/listen-sentence) reads `quizTrackLabel` raw, with no such
 * override, so a Counting or Sentence-ordering QUIZ fell through to whatever
 * `trackLabel` said about the underlying subject: "Vocabulary" for a counter
 * (subject `word`, see COUNTER_ENTRIES/src/data/counters.ts) and "Grammar" for
 * a sentence-ordering assembly leg (which drills ordinary grammar-pattern
 * MEANING facts — assemblyFacts()/src/data/assembly.ts mints nothing of its
 * own). Both are fixed HERE, the one place every quiz HUD already funnels
 * through, rather than in six near-identical call sites:
 *
 *  - Counting is told apart PER FACT, the same test trackOfFact
 *    (lib/track-open.ts) uses: a counter is a `word` fact whose ENTRY is in
 *    COUNTER_ENTRIES, so it is checked before falling back to `trackLabel`'s
 *    subject-only map. This is fact-content-safe — an entry is either a
 *    counter or it isn't — so a pool that mixes counters with ordinary words
 *    still correctly reports "genuinely mixed" (undefined) rather than
 *    collapsing both into "Vocabulary".
 *
 *  - Sentence-ordering CANNOT be told apart per fact: assembly's meaning
 *    facts are the exact same facts an ordinary Grammar quiz can ask, so two
 *    quizzes over an identical fact pool need different labels depending on
 *    which screen is asking. The one signal that actually distinguishes them
 *    is the QUIZ MODE — "assembly" means sentence-ordering and nothing else
 *    (home-feed.tsx's `trackKeyForRun` reads it the same way: `mode ===
 *    "assembly"` before ever looking at a fact). So `mode` is an optional
 *    second parameter, checked first and returned unconditionally: an
 *    assembly leg's pool is always this one part of the sentence track, never
 *    a genuine mix. Every other caller omits it and keeps today's fact-only
 *    behavior.
 */
export function quizTrackLabel(
  infos: readonly (FactInfo | undefined)[],
  mode?: QuizMode,
): string | undefined {
  if (mode === "assembly") return "Sentences";
  let label: string | undefined;
  for (const info of infos) {
    if (!info) continue;
    const l = COUNTER_ENTRIES.has(info.entry) ? "Counting" : trackLabel(info);
    if (!l) continue;
    if (label === undefined) label = l;
    else if (label !== l) return undefined; // genuinely mixed — no single track
  }
  return label;
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
   *
   * SAK-265: for the 114 of 2,136 jouyou kanji `readingsOf` has zero rows for
   * (no everyday taught word aligns to them — see KanjiRow.on/.kun), this falls
   * back to KANJIDIC2's raw on/kun list so the kanji is still searchable by its
   * real reading (壱 by いち) instead of returning no readings at all. Evidence-
   * backed readings always come first and this fallback never runs alongside
   * them; it fires only when the aligned list is empty.
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

// ---------- readings, grouped ----------

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
 * The generated index, typed: the one runtime source of the entries and of
 * the maps derived from them (SAK-400). library-index.ts reads its smaller
 * tables from here too.
 */
export const LIBRARY_INDEX: LibraryIndex = libraryIndexJson as unknown as LibraryIndex;

/** Every entry in the app, in browse order: kana, then kanji, then words. Read
 * from the index, never built here — see the header and entries-build.ts. */
export const LIB_ENTRIES: readonly LibEntry[] = LIBRARY_INDEX.entries;

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
 * Which of an entry's facts decide whether it is KNOWN — the input to the
 * Library's knowledge filter. The rule is per kind and lives in
 * entries-build.ts (`knownFactsRule`), whose answer for every entry the index
 * carries; this reads it back, so a page never re-derives it. Empty for an
 * entry with no facts that count. Takes an id as well, for a caller that has
 * only that.
 */
export function knownFactsOf(entry: LibEntry | EntryId): readonly FactId[] {
  const id = typeof entry === "string" ? entry : entry.id;
  return LIBRARY_INDEX.knownFacts[id as unknown as string] ?? [];
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

/** entry id → its recipe, for the grammar-only lookups below. Built off the
 * same RECIPES walk `build()` uses, so it cannot name an entry that walk did
 * not mint. */
const RECIPE_OF_ENTRY: ReadonlyMap<EntryId, Recipe> = new Map(
  RECIPES.filter(isPrimaryPatternRecipe).map((r) => [patternEntry(r.id), r]),
);

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

/**
 * Entries this one might get mixed up with — A GUESS, and the screen must say
 * so.
 *
 * Shape only: LOOK_GROUP for kana, CONFUSABLE_WITH for kanji, plus (SAK-155)
 * RADICAL_CONFUSABLE_PAIRS's hand-authored radical lookalikes (口/囗, 日/曰). It
 * is not a record of anything you have done. What you have ACTUALLY mixed up
 * is a different question with a different source (src/lib/confusions.ts, over
 * history); this is the app guessing before it has evidence, which is the only
 * time a guess is worth anything — and the entry page prints that in as many
 * words, because a guess must never read as a report.
 *
 * WHY THE RADICAL PAIR CHECK RUNS FOR BOTH KANJI_SUBJECT AND RADICAL_SUBJECT
 * ============================================================================
 * A radical pair is a relationship between two GLYPHS, but which SUBJECT this
 * function sees for a given glyph depends on whether that radical is merged
 * into its own kanji card (isRadicalTaughtAsKanji, src/data/radicals.ts): 口
 * (mouth) is merged, so its one Library page is a KANJI_SUBJECT entry; 囗
 * (enclosure) has no kanji role at all, so its page is a RADICAL_SUBJECT entry.
 * Checking only one branch would make the pair show up on just one glyph's
 * page — checking `entry.glyph` (not `entry.kind`) against the pair table in
 * both branches keeps it symmetric regardless of which side happens to be
 * merged.
 */
export function confusableWith(entry: LibEntry): EntryId[] {
  if (entry.kind === KANA_SUBJECT) {
    return (LOOK_GROUP[entry.glyph] ?? [])
      .filter((c) => CHAR_INDEX[c])
      .map((c) => kanaEntry(c));
  }
  const radicalPartner = radicalConfusablePartner(entry.glyph);
  const radicalPair = radicalPartner ? [builtPieceEntryId(radicalPartner.glyph)] : [];
  if (entry.kind === KANJI_SUBJECT) {
    return [
      ...radicalPair,
      ...(CONFUSABLE_WITH.get(entry.glyph) ?? [])
        .filter((c) => kanjiRow(c))
        .map((c) => kanjiEntry(c)),
    ];
  }
  if (entry.kind === RADICAL_SUBJECT) {
    return radicalPair;
  }
  return [];
}

/**
 * SAK-409: the words the entries walk skips because another page already
 * teaches them, each mapped to that page — a grammar recipe's own pattern
 * (だけ, まで, しか…) to the pattern entry, a counting duplicate (一つ, 一人,
 * １００億…) and 二十歳 to the counting or construction entry. Read straight off
 * the three source maps that make the walk skip them (entries-build.ts), so
 * this cannot come to disagree with them about which word which page teaches.
 * `canonicalMixupEntry` (library-index.ts) makes the same redirect for a
 * mix-up recorded against one of these words, off two of the same maps.
 */
const DUPLICATE_KEB_ENTRY: ReadonlyMap<string, EntryId> = new Map([
  ...GRAMMAR_VOCAB_DUPLICATE_KEBS,
  ...COUNTER_VOCAB_DUPLICATE_KEBS,
  ...COUNTER_TAIL_FORM_ALIASES,
]);

/**
 * The entry a glyph names on a given shelf, when the glyph is all a link has —
 * an "appears in" word, a component kanji.
 *
 * Null when there is no such entry, which the caller must handle rather than
 * mint an id for data it does not have. A minted id that resolves to nothing is
 * a broken link that type-checks — which is why a VOCAB keb is answered against
 * `libEntry`, the entries themselves, rather than against the dictionary row it
 * was built from. The two differ for the 98 kebs the walk skips: 55 of them
 * name the page that teaches the word instead (DUPLICATE_KEB_ENTRY above), and
 * the 43 day and month forms (１日…３１日, １月…１２月, skipped by
 * COUNTER_KANJI_GLYPHS, which carries no target) are null.
 *
 * There is one of this function. library-index.ts re-exports it (SAK-409); it
 * used to carry a second copy that answered null for all 98.
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
    case VOCAB_SUBJECT: {
      const taughtElsewhere = DUPLICATE_KEB_ENTRY.get(glyph);
      if (taughtElsewhere) return taughtElsewhere;
      const id = wordEntry(glyph);
      return libEntry(id) ? id : null;
    }
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

