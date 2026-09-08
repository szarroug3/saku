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

import {
  CHAR_INDEX,
  KANA_SUBJECT,
  kanaEntry,
  kanaFact,
  LOOK_GROUP,
} from "@/data/characters";
import { CONFUSABLE_WITH } from "@/data/confusable";
import {
  KANJI_SUBJECT,
  kanjiEntry,
  kanjiRow,
  READINGS,
  readingFactId,
  type ReadingRow,
  variantTaughtKanji,
} from "@/data/kanji";
import { isExcludedVariant, variantForm, type VariantPosition } from "@/data/variant-forms";
import { VOCAB_SUBJECT, vocabRow, wordEntry, wordUnitFacts } from "@/data/vocab";
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
import { MARK_SUBJECT } from "@/data/marks";
import { GRAMMAR_CONCEPT_SUBJECT } from "@/data/grammar-concepts";
import { NUMBER_CONSTRUCTION_SUBJECT } from "@/data/number-construction";
import { isNumberKanji } from "@/data/number-kanji";
import { TERM_SUBJECT } from "@/data/terms";
import {
  COUNTER_ENTRIES,
  counterForm,
  counterMeaningFactId,
  counterReadingFactId,
  isKanaForm as isKanaCounterForm,
} from "@/data/counters";
import {
  RADICAL_SUBJECT,
  radicalEntry,
  radicalByGlyph,
  radicalByWrittenForm,
  radicalMeaningFactId,
} from "@/data/radicals";
import { primitiveEntry, PRIMITIVE_SUBJECT, PRIMITIVE_STROKES } from "@/data/components";
import { radicalConfusablePartner } from "@/data/radical-tips";
import {
  RECIPES,
  isPrimaryPatternRecipe,
  isProducible,
  patternGroup,
  type Recipe,
} from "@/data/grammar/recipes";

/** The particle-pair clusters — comparisons ("は vs が", "に vs で") whose title
 * is redundant as a member's sub-line (see the grammar-entry `sub` below). Their
 * titles still ride `searchAlso`, so the family stays findable by name. */
export const COMPARISON_CLUSTER_IDS: ReadonlySet<string> = new Set(["wa-ga", "ni-de"]);
import {
  TRANSITIVITY_SUBJECT,
  pairForEntry,
  sideFactId,
  transitivitySide,
} from "@/data/transitivity-facts";
import {
  KEIGO_SUBJECT,
  keigoSetForEntry,
  keigoWordFactId,
  recognitionGloss,
} from "@/data/keigo";
import { buildExample } from "@/lib/grammar/example";
import { HOST_LABEL } from "@/lib/grammar/formula";
import { deframe } from "@/lib/kanji-parts";
import { factInfo } from "@/lib/facts";
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
