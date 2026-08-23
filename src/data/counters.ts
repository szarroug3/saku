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
// PHASES, AND WHY NOTHING GATES ON KANJI ANY MORE
// ===============================================
// Phase 1 is written in kana (〜つ and the Sino numbers いち…じゅう). Phase 2/3 is
// written with kanji, but the track now TEACHES those kanji in-track, keigo-style:
// the number kanji (一…十) and each counter kanji ride into a lesson as prereq
// tiles ahead of the material that uses them (see src/lib/counter-lesson.ts). So
// there is no number-kanji GATE — a form is always reachable and its unknown kanji
// are taught first. `counterKanjiPrereqs`/`numberKanji` survive as DATA (only
// 二十歳 still carries a number kanji), no longer as a step-over gate.

import { entryId, factId } from "../lib/fact-id.ts";
import type { EntryId, FactId, FactInfo } from "../types/index.ts";
import { numberConstructionEntry } from "./number-construction-id.ts";

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
  /** A second reading the same number branches into — し for よん (4), しち for
   * なな (7), く for きゅう (9). Empty for a form with one reading. It is a
   * READING, so it belongs on the reading side, never in the meaning gloss;
   * picking the wrong branch is the commonest beginner tell, so it is still
   * shown. See the NUMBERS block below. */
  readonly altReading: string;
}

/** A kana form: glyph and reading are the same, no kanji prerequisite. The
 * optional altReading carries a second reading of the same number (よん also し). */
function kana(
  key: string,
  glyph: string,
  meaning: string,
  counter: string,
  altReading = "",
): CounterForm {
  return {
    key,
    glyph,
    reading: glyph,
    meaning,
    counter,
    phase: 1,
    numberKanji: null,
    altReading,
  };
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
  return { key, glyph, reading, meaning, counter, phase, numberKanji, altReading: "" };
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

// ─── The Sino numbers 1-10 are NOT rote kana forms any more ────────────────
// いち〜じゅう used to ship here as memorised kana forms (counter:num:1..10). They
// were a DUPLICATE: the number KANJI 一…十 already teach their reading and meaning
// as WORD facts (二 = に = two, 四 = し = four …, minted from vocab.json and now
// scheduled by the words track — see COUNTER_TRACK_KEBS in word-lesson.ts), and
// the counters track teaches each 一…十 kanji in-track as a prereq of the tens
// unit. A separate spoken-number card taught nothing the kanji's word role did
// not. So the numbers are gone from this curriculum; the number kanji carry them.
//
// THE BRANCHING READINGS (4, 7, 9) ARE PRESERVED. The kana forms carried a second
// reading each — よん also し, なな also しち, きゅう also く. vocab.json's word role
// gives only し / しち / きゅう, so the OTHER branch of each (よん, なな, く) is kept
// in the tens construction rule card (NUMBERS_COMPOSE in phase-intros.ts), which
// now names all three pairs, and the reading engine still accepts every branch
// when grading a generated round (acceptableNumberReadings). Nothing is lost.

// ─── 〜人's irregulars are NOT rote forms any more ──────────────────────────
// ひとり (一人), ふたり (二人) and よにん (四人) used to ship as memorised kana forms.
// They are now taught by the 〜人 GENERATIVE category alone: its rule card shows
// them in an "Irregular" table (counterReading(1|2|4, "nin") is exactly these) and
// its generated round is irregular-first, so counts 1, 2 and 4 always surface. A
// standalone rote copy would drill the same three words the category already
// teaches, so they are gone from the curriculum. Everything else in 〜人 is the
// plain number plus にん, which the category builds. See counter-categories.ts.

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

// ─── Phase 3 · day-of-month (〜日), a CLOSED set — memorised, not generated ──
// SAK-163: day-of-month readings are irregular from the 1st through the 10th
// (ついたち, ふつか, みっか, …), irregular again at the 14th/24th (じゅうよっか /
// にじゅうよっか — the よっか branch, not よん+にち) and at the 20th (はつか — a
// standalone word, not に+とお+か), and only regular -にち in between and after
// (11th-13th, 15th-19th, 21st-23rd, 25th-31st). That 20日 breaks the SAME
// tens-plus-ones composition every other counter follows (see counterReading's
// d===0 branch in number-reading.ts) is why this is NOT a generative CounterKind
// there: the engine's prefix+unit mechanism has no way to special-case one
// multiple-of-ten inside an otherwise-regular range without a day-specific hack
// leaking into a shared, unbounded-range engine built for counters that never
// have that shape. Day-of-month also never scales past 31 — there is no "regular
// composition" argument for generating it (see the note above GENERATIVE
// categories) — so it ships the same way TSU and TAIL do: a memorised, pinned
// list. The readings are sourced verbatim from vocab.json (JMdict already carries
// all 31 as plain VOCAB entries, which is the SAK-147 bug this ticket's caller
// exists to fix — see the file header); duplicating them here under a namespaced
// key follows the same "brief duplication" pattern as 一つ/一人/一匹/一台/一冊/一杯
// (see the header note). SAK-164 removes the vocab originals from the words
// track; this file only builds the destination.
const DAYS: readonly CounterForm[] = [
  counted("counter:day:1", "１日", "ついたち", "the 1st day of the month", "日", "日", 3),
  counted("counter:day:2", "２日", "ふつか", "the 2nd day of the month", "日", "日", 3),
  counted("counter:day:3", "３日", "みっか", "the 3rd day of the month", "日", "日", 3),
  counted("counter:day:4", "４日", "よっか", "the 4th day of the month", "日", "日", 3),
  counted("counter:day:5", "５日", "いつか", "the 5th day of the month", "日", "日", 3),
  counted("counter:day:6", "６日", "むいか", "the 6th day of the month", "日", "日", 3),
  counted("counter:day:7", "７日", "なのか", "the 7th day of the month", "日", "日", 3),
  counted("counter:day:8", "８日", "ようか", "the 8th day of the month", "日", "日", 3),
  counted("counter:day:9", "９日", "ここのか", "the 9th day of the month", "日", "日", 3),
  counted("counter:day:10", "１０日", "とおか", "the 10th day of the month", "日", "日", 3),
  counted("counter:day:11", "１１日", "じゅういちにち", "the 11th day of the month", "日", "日", 3),
  counted("counter:day:12", "１２日", "じゅうににち", "the 12th day of the month", "日", "日", 3),
  counted("counter:day:13", "１３日", "じゅうさんにち", "the 13th day of the month", "日", "日", 3),
  counted("counter:day:14", "１４日", "じゅうよっか", "the 14th day of the month", "日", "日", 3),
  counted("counter:day:15", "１５日", "じゅうごにち", "the 15th day of the month", "日", "日", 3),
  counted("counter:day:16", "１６日", "じゅうろくにち", "the 16th day of the month", "日", "日", 3),
  counted("counter:day:17", "１７日", "じゅうしちにち", "the 17th day of the month", "日", "日", 3),
  counted("counter:day:18", "１８日", "じゅうはちにち", "the 18th day of the month", "日", "日", 3),
  counted("counter:day:19", "１９日", "じゅうくにち", "the 19th day of the month", "日", "日", 3),
  counted("counter:day:20", "２０日", "はつか", "the 20th day of the month", "日", "日", 3),
  counted("counter:day:21", "２１日", "にじゅういちにち", "the 21st day of the month", "日", "日", 3),
  counted("counter:day:22", "２２日", "にじゅうににち", "the 22nd day of the month", "日", "日", 3),
  counted("counter:day:23", "２３日", "にじゅうさんにち", "the 23rd day of the month", "日", "日", 3),
  counted("counter:day:24", "２４日", "にじゅうよっか", "the 24th day of the month", "日", "日", 3),
  counted("counter:day:25", "２５日", "にじゅうごにち", "the 25th day of the month", "日", "日", 3),
  counted("counter:day:26", "２６日", "にじゅうろくにち", "the 26th day of the month", "日", "日", 3),
  counted("counter:day:27", "２７日", "にじゅうしちにち", "the 27th day of the month", "日", "日", 3),
  counted("counter:day:28", "２８日", "にじゅうはちにち", "the 28th day of the month", "日", "日", 3),
  counted("counter:day:29", "２９日", "にじゅうくにち", "the 29th day of the month", "日", "日", 3),
  counted("counter:day:30", "３０日", "さんじゅうにち", "the 30th day of the month", "日", "日", 3),
  counted("counter:day:31", "３１日", "さんじゅういちにち", "the 31st day of the month", "日", "日", 3),
];

// ─── Phase 3 · month-of-year (〜月), a CLOSED set — memorised, not generated ─
// SAK-163: month-of-year is almost entirely regular (number + がつ), but a
// generative CounterKind exists in this codebase specifically for ranges that
// keep composing past their first ten counts (1-99, 1-9999 — see the header
// note on the generative categories). 月 never does: there is no 13月, so there
// is nothing for a compose rule to generate beyond the 12 forms below, and
// building a whole ConstructionCategory (a Library "how it's built" page, a
// NumberQuizConfig, a marker-gated unit) for a fixed 12-item lookup would be
// the exact over-engineering the header note warns against ("drilling
// spelled-out rows taught nothing the compose/attach rule does not"). Unlike
// the truly regular counters, 月 also carries three of its own irregular
// readings (４月 しがつ, ７月 しちがつ, ９月 くがつ — the SAME alternate branch
// readings that NUMBERS_COMPOSE already teaches for し/しち/く, but here they are
// the ONLY correct reading, not an alternate), so it is memorised the same way
// TSU and TAIL are, matching precedent for a small closed set. Sourced verbatim
// from vocab.json, duplicating the existing VOCAB entries under a namespaced key
// (see the DAYS note above and the file header); SAK-164 removes the originals.
const MONTHS: readonly CounterForm[] = [
  counted("counter:month:1", "１月", "いちがつ", "January", "月", "月", 3),
  counted("counter:month:2", "２月", "にがつ", "February", "月", "月", 3),
  counted("counter:month:3", "３月", "さんがつ", "March", "月", "月", 3),
  counted("counter:month:4", "４月", "しがつ", "April", "月", "月", 3),
  counted("counter:month:5", "５月", "ごがつ", "May", "月", "月", 3),
  counted("counter:month:6", "６月", "ろくがつ", "June", "月", "月", 3),
  counted("counter:month:7", "７月", "しちがつ", "July", "月", "月", 3),
  counted("counter:month:8", "８月", "はちがつ", "August", "月", "月", 3),
  counted("counter:month:9", "９月", "くがつ", "September", "月", "月", 3),
  counted("counter:month:10", "１０月", "じゅうがつ", "October", "月", "月", 3),
  counted("counter:month:11", "１１月", "じゅういちがつ", "November", "月", "月", 3),
  counted("counter:month:12", "１２月", "じゅうにがつ", "December", "月", "月", 3),
];

/**
 * The whole counters curriculum, in teaching order.
 *
 * 〜つ leads (the escape hatch, the native 1-10). The Sino numbers 1-10 are NOT
 * forms here any more — the number kanji 一…十 carry them (their word role, plus
 * the tens unit's in-track prereq; see the note above). Numbers past ten and every
 * object counter are taught by the generative CATEGORIES (see counter-categories.ts
 * and the counter:gen:* markers below), which the scheduler runs as rule-then-round
 * units. The only memorised form left is the one special tail reading (二十歳
 * はたち), which no category can build. 〜人's ひとり/ふたり/よにん are taught by the
 * 〜人 category (see the note above). DAYS (〜日) and MONTHS (〜月) are two more
 * closed, memorised sets — see the notes above DAYS and MONTHS for why they are
 * forms, not generative categories.
 */
export const COUNTER_CURRICULUM: readonly CounterForm[] = [
  ...TSU,
  ...TAIL,
  ...DAYS,
  ...MONTHS,
];

/**
 * The KANJI-written forms in COUNTER_CURRICULUM, keyed by their glyph — 二十歳,
 * every day-of-month (１日…３１日) and every month-of-year (１月…１２月). Kana-only
 * forms (ひとつ, とお, …) are excluded, so this cannot be mistaken for "every
 * counter form" and used to match an unrelated kana word (に, さん — the number
 * kanji's OWN word role is what teaches those; see COUNTER_TRACK_KEBS in
 * word-lesson.ts).
 *
 * Derived here, once, because it is a fact about THIS DATA (which forms happen
 * to be kanji-written), not about either of its two consumers. word-lesson.ts
 * reads it to keep the words track from teaching a glyph the counters track
 * already owns; src/lib/library/entries.ts reads the SAME set to keep the
 * Library's word-kind shelf from listing a row the counters shelf already
 * carries under its own COUNTER_KIND entry (built from this same
 * COUNTER_CURRICULUM, a few lines below in entries.ts's build()). A local copy
 * in either consumer is exactly how SAK-147 happened: entries.ts had no way to
 * know SAK-163 had widened this set to include day/month forms. One export,
 * two readers, cannot drift.
 */
export const COUNTER_KANJI_GLYPHS: ReadonlySet<string> = new Set(
  COUNTER_CURRICULUM.filter((f) => f.glyph !== f.reading).map((f) => f.glyph),
);

/** The five counters taught AS A SYSTEM — each carries the sound-change rule or
 * a key irregular. Not a seventh subject; a labelled set within this track. */
export const SYSTEM_COUNTERS: readonly string[] = ["つ", "人", "本", "枚", "匹"];

/** The tail counters taught as plain vocabulary, no new machinery. */
export const TAIL_COUNTERS: readonly string[] = ["個", "台", "冊", "杯", "回", "歳"];

/** The entry a counter form's facts hang off. Namespaced, so never a vocab keb. */
export function counterEntry(form: CounterForm): EntryId {
  return entryId(COUNTERS_SUBJECT, form.key);
}

/** Whether a form is a bare number (いち, に, きゅう) rather than a counted form
 * welded to a thing (三本). A bare number carries no counter. */
export function isBareNumber(form: CounterForm): boolean {
  return form.counter === "";
}

/**
 * The one-line note under a form's role heading in the teach view, or null for a
 * bare number. A number needs no gloss of its role: the heading and the say-it
 * panel already say what it is, so there is nothing to add. A counter does, since
 * the number-plus-thing join is something a learner has not met yet.
 */
export function counterRoleNote(form: CounterForm): string | null {
  if (isBareNumber(form)) return null;
  return "This is a counting word. It joins a number to the thing you count.";
}

/** A counter form is a kana form when its glyph is its reading — no kanji, so no
 * kanji prerequisite and it is teachable the moment kana is known. */
export function isKanaForm(form: CounterForm): boolean {
  return form.glyph === form.reading;
}

/**
 * The number kanji a form carries as DATA. A kana form has none; only 二十歳 still
 * names one (二). It NO LONGER GATES teaching — the track teaches the number kanji
 * in-track now (see src/lib/counter-lesson.ts), so this survives as a data
 * accessor the tests pin, not as the step-over prerequisite it once was.
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
 * entries (numberConstructionEntry): a category is a `word` fact that
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

/** Every category entry, for the COUNTER_ENTRIES label and quick membership. */
export const CONSTRUCTION_CATEGORY_ENTRIES: ReadonlySet<EntryId> = new Set(
  CONSTRUCTION_CATEGORY_IDS.map(numberConstructionEntry),
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
