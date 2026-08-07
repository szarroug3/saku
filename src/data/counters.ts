// The counters and numbers TRACK — vocabulary with a track label, not a seventh
// subject.
//
// WHAT THIS IS, AND WHY IT IS NOT A NEW SUBJECT
// =============================================
// The owner ruled this "vocab with a track label" (task 10). Every fact minted
// here carries subject `word` (see COUNTERS_SUBJECT), so nothing downstream can
// tell a counter fact from any other word fact — it drills, scores and renders
// as a word. The ONE piece of structure this file adds is a LABEL: the set of
// entries that belong to the counters track (COUNTER_ENTRIES), which
// src/lib/track-open.ts consults to route these words to the counters track
// intro rather than the general words-track intro. That is the whole mechanism;
// there is no `track` field on VocabRow and no new FactId subject kind.
//
// WHY THE FACTS ARE MINTED HERE AND NOT READ FROM src/data/generated/vocab.json
// ============================================================================
// vocab.json is script-owned (scripts/ingest/build.py) and derived from JMdict.
// It carries a handful of counted forms already (一つ〜九つ, 一人/二人/四人, 一匹,
// and a few tail forms as NOUNS), but it is missing the spoken kana numbers this
// track teaches first (ひとつ, いち, ひとり are absent; に and さん exist only as
// the particle and the honorific) and every phase-2 counted form (一本, 三本,
// いっぴき's siblings). Those cannot be hand-edited into the generated file, so
// the track authors its OWN word facts here, the same way transitivity-facts.ts
// mints a hand-curated set (see src/lib/facts.ts, "ADDING A SUBJECT").
//
// The entry KEYS are namespaced (`counter:…`, never a bare written form), so a
// counter fact id can never collide with a vocab word id even when the counter's
// glyph equals an existing word — に (the number) and に (the particle) are two
// entries, `word:counter:num2` and `word:に`, sharing only a glyph. The
// duplication of the noun senses already in vocab (一つ, 一人, 一匹, 一台, 一冊,
// 一杯) is the "brief duplication" option B accepted: the words track owns the
// written noun, this track owns the spoken counting word. See the task report.
//
// THE ORDER, AND WHY 〜つ COMES FIRST
// ==================================
// 〜つ (ひとつ〜とお) is the native 1-to-10 counting system and the escape hatch:
// the counter you reach for when you do not know the right one. It reaches only
// 10, so the Sino numbers (いち〜じゅう) come straight after, and everything else
// is built on them. COUNTER_CURRICULUM is that sequence, and the test file pins
// 〜つ ahead of the numbers so a reorder cannot break it.
//
// PHASES AND GATING
// =================
// Phase 1 needs KANA only: every phase-1 form is written in kana, so it has no
// kanji prerequisite (counterKanjiPrereqs returns []). Phase 2 is gated on the
// NUMBER kanji being read: 三本 cannot be read until 三 can, so its prerequisite
// is 三 (the counter kanji 本 is taught by this track, not required ahead of it).
// Phase 3 is the ungated long tail, plain vocab with no new machinery.

import { entryId, factId } from "../lib/fact-id.ts";
import type { EntryId, FactId, FactInfo } from "../types/index.ts";

/**
 * The subject every counter fact carries. It is the WORDS subject on purpose:
 * the owner ruled this "vocab with a track label", so a counter is a word and
 * this track is not a new FactId subject kind. Kept as a literal (rather than
 * importing VOCAB_SUBJECT) so this module does not drag vocab.json's ~3.6 MB in;
 * the two must stay equal, and counters.test.ts asserts it.
 */
export const COUNTERS_SUBJECT = "word";

/** Which stage of the track a form belongs to. 1: kana only. 2: gated on the
 * number kanji, and carrying the h→p/b sound change. 3: the ungated tail. */
export type CounterPhase = 1 | 2 | 3;

/** One counted form, ready to mint into facts and render as a word item. */
export interface CounterForm {
  /** The entry-key seed, namespaced so it can never equal a real keb. */
  readonly key: string;
  /** What it looks like on screen — ひとつ, 三本, 二十歳. */
  readonly glyph: string;
  /** Its reading in kana. Equal to `glyph` for a kana form. */
  readonly reading: string;
  /** The plain-language gloss — the answer to "what does this count/mean". */
  readonly meaning: string;
  /** Which counter this is a form of — "つ", "人", "本" … or "" for a bare
   * number. */
  readonly counter: string;
  readonly phase: CounterPhase;
  /** The number kanji this form must be able to read before it can be taught,
   * or null for a kana form (which needs no kanji at all). */
  readonly numberKanji: string | null;
}

/** A kana form: glyph and reading are the same, no kanji prerequisite. */
function kana(
  key: string,
  glyph: string,
  meaning: string,
  counter: string,
): CounterForm {
  return { key, glyph, reading: glyph, meaning, counter, phase: 1, numberKanji: null };
}

/** A counted form written with a number kanji: 三本 read さんぼん. */
function counted(
  key: string,
  glyph: string,
  reading: string,
  meaning: string,
  counter: string,
  numberKanji: string,
  phase: CounterPhase,
): CounterForm {
  return { key, glyph, reading, meaning, counter, phase, numberKanji };
}

// ─── Phase 1a · 〜つ, the escape hatch, taught FIRST ────────────────────────
// The native counting system, 1 to 10. All kana, all irregular, all certain.
// とお (10) is written 十 in the wild but taught here in kana, because the whole
// point of phase 1 is a counting word you can use before you read any kanji.
const TSU: readonly CounterForm[] = [
  kana("counter:tsu:1", "ひとつ", "one thing", "つ"),
  kana("counter:tsu:2", "ふたつ", "two things", "つ"),
  kana("counter:tsu:3", "みっつ", "three things", "つ"),
  kana("counter:tsu:4", "よっつ", "four things", "つ"),
  kana("counter:tsu:5", "いつつ", "five things", "つ"),
  kana("counter:tsu:6", "むっつ", "six things", "つ"),
  kana("counter:tsu:7", "ななつ", "seven things", "つ"),
  kana("counter:tsu:8", "やっつ", "eight things", "つ"),
  kana("counter:tsu:9", "ここのつ", "nine things", "つ"),
  kana("counter:tsu:10", "とお", "ten things", "つ"),
];

// ─── Phase 1b · the Sino numbers いち〜じゅう ───────────────────────────────
// Kana, so they are usable as sounds before any kanji. The branching readings
// (4, 7, 9) are carried in the gloss, because picking the wrong branch is the
// commonest beginner tell.
const NUMBERS: readonly CounterForm[] = [
  kana("counter:num:1", "いち", "one (1)", ""),
  kana("counter:num:2", "に", "two (2)", ""),
  kana("counter:num:3", "さん", "three (3)", ""),
  kana("counter:num:4", "よん", "four (4), also し", ""),
  kana("counter:num:5", "ご", "five (5)", ""),
  kana("counter:num:6", "ろく", "six (6)", ""),
  kana("counter:num:7", "なな", "seven (7), also しち", ""),
  kana("counter:num:8", "はち", "eight (8)", ""),
  kana("counter:num:9", "きゅう", "nine (9), also く", ""),
  kana("counter:num:10", "じゅう", "ten (10)", ""),
];

// ─── Phase 1c · 〜人, counting people — ONLY the irregulars are memorised ───
// ひとり, ふたり and よにん are their own words, so they are shipped as forms; the
// rest of 〜人 is the plain number plus にん, which the 〜人 GENERATIVE category
// builds (see counter-categories.ts). 四人 is よにん, never よんにん. Kana, phase 1.
const NIN: readonly CounterForm[] = [
  kana("counter:nin:1", "ひとり", "one person", "人"),
  kana("counter:nin:2", "ふたり", "two people", "人"),
  kana("counter:nin:4", "よにん", "four people", "人"),
];

// ─── 11 and up, AND every object counter — TAUGHT GENERATIVELY ─────────────
// The teens, tens, hundreds and thousands are NOT shipped as memorised forms,
// and neither are the object counters (一本…十本, 一匹…十匹, 一枚…十枚, the tail).
// They are regular composition — にじゅういち = に + じゅう + いち, さんぼん = さん +
// (voiced)本 — so drilling spelled-out rows taught nothing the compose/attach
// rule does not. Instead each is a GENERATIVE CATEGORY: a rule taught once, then
// counts generated over the reading engine (src/lib/number-reading.ts, which
// ships every one of these readings). Two number-range categories (tens, big)
// and one per counter (人, 本, 匹, 枚, 個, 台, 冊, 杯, 回, 歳) — see
// src/data/counter-categories.ts for the facts and src/data/number-construction.ts
// for the pages. Each is gated by a MARKER pseudo-fact (counter:gen:*, below)
// claimed when its rule lesson begins, not by a run of forms.

// ─── Phase 3 · the one memorised tail form ─────────────────────────────────
// 二十歳 はたち is the special reading for "twenty years old" — it is not the
// plain number plus 歳, so the 〜歳 category cannot build it and it ships as a
// form. Every other tail count IS generated by its category.
const TAIL: readonly CounterForm[] = [
  counted("counter:sai:20", "二十歳", "はたち", "twenty years old", "歳", "二", 3),
];

/**
 * The whole counters curriculum, in teaching order.
 *
 * 〜つ leads (the escape hatch), then the Sino numbers 1-10. Numbers past ten,
 * and every object counter, are NOT forms in this array — they are taught by the
 * generative CATEGORIES (see src/data/counter-categories.ts and the counter:gen:*
 * markers below), which the scheduler runs as rule-then-round units. The only
 * forms left past the numbers are 〜人's three irregulars (ひとり/ふたり/よにん) and
 * the one special tail reading (二十歳 はたち). counters.test.ts pins 〜つ ahead of
 * the numbers so a reorder cannot break the escape-hatch-first rule.
 */
export const COUNTER_CURRICULUM: readonly CounterForm[] = [
  ...TSU,
  ...NUMBERS,
  ...NIN,
  ...TAIL,
];

/** The five counters taught AS A SYSTEM — each carries the sound-change rule or
 * a key irregular. Not a seventh subject; a labelled set within this track. */
export const SYSTEM_COUNTERS: readonly string[] = ["つ", "人", "本", "枚", "匹"];

/** The tail counters taught as plain vocabulary, no new machinery. */
export const TAIL_COUNTERS: readonly string[] = ["個", "台", "冊", "杯", "回", "歳"];

/** The entry a counter form's facts hang off. Namespaced, so never a vocab keb. */
export function counterEntry(form: CounterForm): EntryId {
  return entryId(COUNTERS_SUBJECT, form.key);
}

/** A counter form is a kana form when its glyph is its reading — no kanji, so no
 * kanji prerequisite and it is teachable the moment kana is known. */
export function isKanaForm(form: CounterForm): boolean {
  return form.glyph === form.reading;
}

/**
 * The kanji a form must be able to read before it can be taught.
 *
 * Phase 1 (kana) returns []: it gates on KANA only. Phase 2/3 returns the single
 * NUMBER kanji — 三 for 三本 — because that is what makes the form readable; the
 * counter kanji (本) is taught by this track, not required ahead of it. This is
 * the gate the task specifies ("phase 2 gated on the number kanji being
 * learned").
 */
export function counterKanjiPrereqs(form: CounterForm): readonly string[] {
  return form.numberKanji ? [form.numberKanji] : [];
}

/**
 * Every counter fact. A kana form has a MEANING fact only (its reading is the
 * word itself, so there is nothing to grade — the same rule buildVocabFacts
 * follows for kana words). A counted form written with kanji has both a reading
 * fact (三本 → さんぼん) and a meaning fact.
 */
export const COUNTER_FACTS: FactInfo[] = buildCounterFacts();

function buildCounterFacts(): FactInfo[] {
  const facts: FactInfo[] = [];
  for (const form of COUNTER_CURRICULUM) {
    const entry = counterEntry(form);
    if (!isKanaForm(form)) {
      facts.push({
        id: factId(entry, "reading"),
        entry,
        glyph: form.glyph,
        answers: [form.reading],
        subject: COUNTERS_SUBJECT,
        meaning: form.meaning,
      });
    }
    facts.push({
      id: factId(entry, "meaning"),
      entry,
      glyph: form.glyph,
      answers: [form.meaning],
      subject: COUNTERS_SUBJECT,
      meaning: form.meaning,
    });
  }
  return facts;
}

/**
 * The TRACK LABEL: every entry that belongs to the counters track.
 *
 * This is the one piece of structure the track adds. src/lib/track-open.ts reads
 * it to route these words to the counters track intro instead of the general
 * words-track intro — the mechanism that makes this "vocab with a track label"
 * rather than a new subject.
 *
 * It carries BOTH the memorised forms' entries AND the generative categories'
 * entries (constructionCategoryEntry): a category is a `word` fact that
 * factType() must file under Counters, so its entry belongs to this label too.
 * Defined below the category machinery so CONSTRUCTION_CATEGORY_ENTRIES exists.
 */

/** The meaning fact of a form — what a lesson teaches and a test names. */
export function counterMeaningFactId(form: CounterForm): FactId {
  return factId(counterEntry(form), "meaning");
}

/** The reading fact of a counted form — 三本 → さんぼん. A kana form has none (it
 * IS its reading), the same rule buildCounterFacts follows; callers guard with
 * isKanaForm. */
export function counterReadingFactId(form: CounterForm): FactId {
  return factId(counterEntry(form), "reading");
}

/** The form an entry names, or undefined for an entry this track did not mint.
 * A lookup, never a parse — the join the Library uses to render a counter's page
 * (its counted form and its reading) without reaching into the id. */
export function counterForm(entry: EntryId): CounterForm | undefined {
  return BY_ENTRY.get(entry);
}

// ─── The generative CATEGORIES, gated by MARKER pseudo-facts ────────────────
// Numbers past ten and every object counter are taught by generative categories
// rather than by rote forms (see the note above and src/data/counter-categories.ts).
// Each category is one scheduler step gated on one MARKER: a synthetic FactId that
// is claimable (postClaim writes history.claims[marker]) and read by the counters
// scheduler's isFresh as "range taught", but is NOT the drillable fact — it is
// deliberately absent from COUNTER_FACTS / ALL_FACTS. Its string is namespaced
// (counter:gen:*) so it can never collide with a real counter fact
// (word:counter:.../aspect). The scheduler, the completion path and the known
// tracker share these ids through this registry.

/**
 * Every construction category, in teaching order: the two bare-number ranges
 * (tens, big), then one per counter in the order the counter pages are shown
 * (人, 本, 匹, 枚, then the tail 個, 台, 冊, 杯, 回, 歳). The ids match the
 * NumberConstruction ids in src/data/number-construction.ts one-to-one, so a
 * category, its Library page, its rule card and its drill config all name the
 * same thing.
 */
export const CONSTRUCTION_CATEGORY_IDS = [
  "tens",
  "big",
  "nin",
  "hon",
  "hiki",
  "mai",
  "ko",
  "dai",
  "satsu",
  "hai",
  "kai",
  "sai",
] as const;

export type ConstructionCategoryId = (typeof CONSTRUCTION_CATEGORY_IDS)[number];

/** The MARKER pseudo-fact that gates and records a category's teaching. Claimed
 * when the category's rule lesson begins (see home-feed.tsx), read as "taught"
 * by the scheduler and the known tracker. Namespaced counter:gen:<id>. */
export function constructionMarker(id: string): FactId {
  return `counter:gen:${id}` as FactId;
}

/** The DRILLABLE category fact's entry — a `word` entry (so it drills and scores
 * as a word) namespaced counter:cat:<id>, kept distinct from the Library page's
 * own `numbers:<id>` entry. In COUNTER_ENTRIES, so factType() files it under
 * Counters (see src/lib/practice-types.ts). */
export function constructionCategoryEntry(id: string): EntryId {
  return entryId(COUNTERS_SUBJECT, `counter:cat:${id}`);
}

/** Every category entry, for the COUNTER_ENTRIES label and quick membership. */
export const CONSTRUCTION_CATEGORY_ENTRIES: ReadonlySet<EntryId> = new Set(
  CONSTRUCTION_CATEGORY_IDS.map(constructionCategoryEntry),
);

/** The track label — the memorised forms' entries and the categories' entries.
 * See the doc above; defined here so CONSTRUCTION_CATEGORY_ENTRIES is in scope. */
export const COUNTER_ENTRIES: ReadonlySet<EntryId> = new Set([
  ...COUNTER_CURRICULUM.map(counterEntry),
  ...CONSTRUCTION_CATEGORY_ENTRIES,
]);

/** The category id a counter:gen:* marker names, or null for a non-marker. The
 * one place a marker string is turned back into a category, so the scheduler and
 * the teach walk pick a category's rule card / config without reaching into the
 * id. */
export function constructionCategoryOfMarker(fact: FactId): ConstructionCategoryId | null {
  for (const id of CONSTRUCTION_CATEGORY_IDS) {
    if (constructionMarker(id) === fact) return id;
  }
  return null;
}

/** The "tens" unit's marker — claimed once the 11-99 compose range is taught. */
export const NUMBER_UNIT_TENS_MARKER = constructionMarker("tens");
/** The "big" unit's marker — claimed once the 100-9999 range is taught. */
export const NUMBER_UNIT_BIG_MARKER = constructionMarker("big");

/** Both bare-number unit markers, in curriculum order (tens, then big). */
export const NUMBER_UNIT_MARKERS: readonly FactId[] = [
  NUMBER_UNIT_TENS_MARKER,
  NUMBER_UNIT_BIG_MARKER,
];

/** Is this fact one of the generative NUMBER-range markers (tens / big)? Kept as
 * the narrow bare-number predicate the lesson walk and tests already use; the
 * general counter-category predicate is constructionCategoryOfMarker. */
export function isNumberUnitMarker(fact: FactId): boolean {
  return fact === NUMBER_UNIT_TENS_MARKER || fact === NUMBER_UNIT_BIG_MARKER;
}

/** Which bare-number unit a marker names ("tens" | "big"), or null. */
export function numberUnitKind(fact: FactId): "tens" | "big" | null {
  if (fact === NUMBER_UNIT_TENS_MARKER) return "tens";
  if (fact === NUMBER_UNIT_BIG_MARKER) return "big";
  return null;
}

const BY_ENTRY: ReadonlyMap<EntryId, CounterForm> = new Map(
  COUNTER_CURRICULUM.map((f) => [counterEntry(f), f]),
);
