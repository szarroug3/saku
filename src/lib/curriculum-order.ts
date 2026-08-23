// ONE SPINE: every radical, kanji and word the curriculum teaches, in the single
// order a learner meets them.
//
// WHAT THIS IS FOR
// ================
// The app ships three tracks that each own a slice of the same material. The
// radical track hands a shape to the kanji track, the kanji track hands a
// character to the words track, and the learner sees three progress numbers for
// what is really one climb. This module answers the question none of the three
// can answer alone: what is the NEXT thing, out of everything, and what did it
// take to get here?
//
// It is pure data in, data out. It reads the shipped tables and nothing else:
// no history, no config, no clock, no user. The sequence is a property of the
// curriculum data, so it is computed once at module load and shared.
//
// RUNTIME CODE SHOULD NOT IMPORT THIS MODULE (SAK-161). buildSequence() below
// is cheap in isolation, but "computed once at module load" means once per
// Vercel serverless cold start on the server, and once per client bundle load
// in the browser — this module has no server/client boundary of its own to stop
// either. scripts/build-curriculum-sequence.mjs runs this walk once, at build
// time, and serializes CURRICULUM_SEQUENCE to curriculum-sequence.json; every
// runtime consumer (server or client) should read that frozen array via
// @/lib/curriculum-sequence instead, which exposes the same CURRICULUM_SEQUENCE
// / curriculumPosition shape as data. This file remains the SOURCE the build
// script reads from, and the place types (CurriculumItem, CurriculumRole) are
// defined — curriculum-sequence.ts re-exports both, type-only.
//
// (See curriculum-sequence.equiv.test.ts for the byte-for-byte equivalence
// check between this module's live output and the frozen artifact.)
//
// THE SHAPE OF THE SEQUENCE
// =========================
// Words lead, because a word is the only item here a learner has a reason to
// want. CURRICULUM_WORDS is already the CEJC teaching order (core vocabulary
// interleaved with conversational essentials), and each word is preceded by everything it owes: the kanji
// it is written with, and ahead of each of those, recursively, everything THOSE
// are built from. 電車 pulls 電 and 車; 電 pulls 雨 and 田, and 雨 pulls what 雨 is
// built from, all the way down to shapes that are nothing but strokes.
//
// Then the tail, which is completeness and not curriculum:
//
//   1. The jōyō kanji that appear in NO curriculum word and that nothing pulled
//      in as a component. They owe nothing to any word, so they follow all of
//      them, in the everyday teaching order (kanjiTeachOrder) so the tail is a
//      ramp and not an accident of the table.
//   2. The radical-only shapes no taught kanji ever pulled in. Those index no
//      jōyō kanji at all, so there is no first consumer to ride in with.
//
// THE PREREQUISITE RULE: ORDER EVERYTHING, TIE ONLY RADICALS
// ==========================================================
// The owner's rule, and it is two rules wearing one sentence:
//
//   "any requirements for the kanji should be taught before the kanji. if the
//    prerequisite is a kanji, it doesn't need to be in the same lesson as the
//    kanji. if the prerequisite is a radical, they should be in the same lesson."
//
// So ORDER applies to every component, and the TIE applies only to radicals:
//
//   - ORDER. A kanji is never taught before something it is built from, whether
//     that something is a radical-only shape or a jōyō kanji in its own right.
//     This is recursive: 何 owes 人, and whatever 人 owes comes before 人. That
//     is what makes 人 item 1 and 何 item 2, where an earlier cut of this module
//     opened on 何 with 人 nowhere in sight.
//   - TIE. A radical-only shape is not a lesson a learner would sit through on
//     its own: it is the piece the very next character is made of, and it means
//     nothing until that character shows up. So it is WELDED to the kanji that
//     first needs it, immediately before it, and phase 3's packer must not split
//     the pair across a lesson boundary. That is the same weld `packUnits`
//     already builds in kanji-lesson.ts, carried here as data.
//     A kanji prerequisite gets no weld. 人 is a whole lesson by itself, and 何
//     is happy to meet it a week earlier, so the packer is free to put the two
//     wherever the cost fits.
//
// The weld is `tiedTo` on the item, and the packing itself is NOT done here. This
// module says what must be true; the packer decides where the cuts fall.
//
// WHAT COUNTS AS A COMPONENT
// ==========================
// `comps` (KanjiVG, via KanjiRow) plus the character's filed-under radical
// (`radicalOfKanji`), deduped, and each component classified by what it IS:
//
//   - a jōyō kanji (kanjiRow) is a KANJI prerequisite: ordered before, resolved
//     recursively, not tied.
//   - a Kangxi radical that is no kanji (气, 宀) is a RADICAL prerequisite:
//     ordered immediately before, and tied.
//   - a bound form with no card of its own (亻, 氵, 扌, 艹) is the debt of the
//     character it is a FORM OF, resolved through the variant map. See below.
//   - anything else (丶 and the other bare shapes) is NOT a prerequisite. There
//     is no card for it, and no meaning or reading exists for it anywhere in the
//     data; it is simply drawn when the character is drawn.
//
// `comps` and NOT `costParts`. The two decompositions disagree, and the argument
// is not depth, it is truth: costParts is KRADFILE, which files 亻 under 化 and
// so claims 何 is built from 化, a character that has nothing to do with it. Read
// as a debt that puts 化 (and 匕, which 化 needs) at the head of the entire
// curriculum, ahead of 何, which is the first word a beginner meets. `comps` is
// KanjiVG's actual glyph hierarchy: 何 is 亻 + 可, which is what is on the page.
// It is the same data the "Made of" row already shows a learner, so what the
// curriculum makes you pay for and what the card says the character is made of
// are now the same claim. `kanjiCost` keeps reading costParts, deliberately: its
// numbers are a stroke-level draw-and-assembly estimate the owner calibrated by
// hand against exactly that decomposition, and cost is not prerequisite.
//
// VARIANT FORMS
// =============
// KanjiVG names 58 bound forms as variants of another character (`kvg:original`,
// published as `variantOriginal`), and every one of them turns up in `comps`. A
// variant is resolved to its original ONLY when it has no card of its own, so
// nothing ever teaches 亻 and 人 as two separate items:
//
//   - 亻→人, 氵→水, 扌→手, 刂→刀, 忄→心 … the original is a jōyō kanji, so the
//     debt is that KANJI: ordered, untied.
//   - 艹→艸, ⻏→邑, 攵→攴, 罒→网, 𠂊→勹 … the original is a radical-only shape,
//     so the debt is that RADICAL: welded.
//   - 日→曰, 月→肉, 王→玉, 士→土, 川→巛, 斉 竜 麦 黒 歯 … THE MAP IS NOT FOLLOWED.
//     Each of these is a jōyō kanji in its own right with its own meaning,
//     readings and page, and the mapping is etymology (月 in 服 descends from
//     肉). A learner meeting 明 is meeting 日. Same for 儿, 冫, 匸, 厶, 毋, which
//     are Kangxi radicals with cards of their own.
//   - ⺍→つ, ⺕→彑, 㐮→襄, 戌→戍 … the original has no card either, so there is
//     still nothing to owe and the shape is drawn, not taught.
//
// ⻌→辶 was the fourth case until the shape with no card behind it turned out to
// be radical 162, which the table holds under its traditional glyph 辵 while
// every character that uses it is drawn with 辶. `radicalByWrittenForm` is that
// one edge, and it lands 辵 in front of the 52 characters drawn with the shape.
//
// The map is followed for ONE hop and never chased, because it contains a mutual
// pair (戌→戍 and 戍→戌) that a transitive walk would not get out of.
//
// CYCLES. Joining a drawing decomposition to a filing table can close a loop:
// 王 is filed under 玉 while 玉 is drawn as 王 plus a dot, and over the whole
// 2,136 that is the only one. It is resolved where it is made, in `componentsOf`
// (the drawing wins), so the walk itself sees a DAG. The walk still marks a
// character taught before walking its components, as a backstop that turns any
// future loop into an arbitrary break instead of a stack overflow, and as the
// guard for self-reference (a radical filed under itself: 八 小 己 火 玉 示 肉 阜).
//
// ONE ITEM PER GLYPH — EXCEPT A WORD, WHICH IS ONE ITEM PER READING (SAK-162)
// =============================================================================
// 山 is a Kangxi radical, a jōyō kanji, and a curriculum word. In three separate
// tracks it is three cards. Here it is ONE item that carries all three roles,
// because the learner meets the character once and everything else is a label on
// that one meeting. So an item is a glyph plus the SET of roles it plays, and
// the roles are pure membership, the same lookup `characterRole` does: is there
// a radical row, is there a kanji row, is it a curriculum word.
//
// Two consequences the rest of this file exists to honour:
//
//   - A both-role character (人, 大, 乙, 火) is taught AS ITS KANJI, never as a
//     separate radical item. It is a kanji, so it is a kanji prerequisite, and
//     its item honestly says radical AND kanji.
//   - A word whose written form is exactly one kanji is FOLDED into that kanji's
//     item. Teaching 山 at the moment 火山 first needs it delivers the word 山 as
//     well, so 山 is not emitted a second time when its own beginnerRank comes
//     round. Hundreds of words arrive this way, most of them early, which is
//     the point: the run-up to a compound is paying for words too.
//
// A WORD OWES ONE ITEM PER READING IT IS TAUGHT WITH, NOT ONE ITEM TOTAL. 七 is
// spoken both しち and なな (`readingUnits`, SAK-150), and each is its own scored
// fact, so each earns its own slot: `reading` on the item names which one. The
// radical/kanji roles never repeat — a glyph's shape is taught exactly once,
// whichever reading arrives first — so `reading` is null on every item except a
// word occupying its own item, where it is always set.
//
//   - The FIRST reading a word is taught with — its VocabRow's own `.reb`, the
//     same primary reading `readingOf`/`meaningOf`/the word's Library page
//     already show — rides wherever the word's kanji arrive: folded into the
//     kanji item for a single-character word, or its own item for a
//     multi-character one, in `CURRICULUM_WORDS` (teachingRank) order. This is
//     BYTE-IDENTICAL to the pre-SAK-162 sequence for the ~94% of words with only
//     one taught reading, and it is what keeps the CEJC-curated bootstrap +
//     core/essential interleave (scripts/ingest/cejc_reading_frequency.py's
//     `scheduled_teaching_rows`) exactly where it was: that cadence is a
//     PER-WORD ordinal over PRIMARY readings only, and nothing below ever moves
//     one primary reading relative to another — the weave only ever inserts
//     extra items between them.
//   - A word's OTHER readings (しち, once なな has ridden 七's kanji item) owe
//     NOTHING further — the kanji is already taught, so only the reading's own
//     word item enters the sequence — but they are not batched into one tail
//     block sorted among themselves, either. An earlier cut of this module did
//     exactly that (collect every extra reading as the main pass finds it, sort
//     the whole batch by its own CEJC count, append it as one run right after
//     the main word pass), and it breaks the actual point of pronunciation-
//     frequency teaching: a second reading spoken more often than half the
//     curriculum would still sit in that one run, waiting for every other
//     word's extra readings to be found first. Each secondary reading is now
//     WOVEN into its own genuine frequency-derived position instead, mixed in
//     among primary readings and everything else — see THE WEAVE below.
//
// THE WEAVE: A SECONDARY READING HAS NO CURATED RANK OF ITS OWN
// ===============================================================
// `teachingRank` is a CURATED ordinal — the bootstrap-and-interleave cadence
// `scheduled_teaching_rows` bakes in — not a raw frequency sort, and it is
// minted once per WORD, never for a reading past the first. So a secondary
// reading cannot simply be sorted into the curated order by its own
// `readingFrequency(keb, reb)` count: that count lives on a different scale
// than an ordinal position, and comparing them directly is comparing a speed to
// a rank.
//
// The bridge is the one thing every PRIMARY reading already carries: its own
// raw `readingFrequency(keb, primaryReb)`, sitting right where the curated
// order put it. Read across every primary reading in curated order, that is a
// DISTRIBUTION — one raw count per curated position — and a secondary reading's
// own raw count can be measured against it the way a percentile is read off a
// curve: count how many primary readings CEJC observed MORE often than this
// one, and that count IS the position — insert the secondary reading
// immediately before the primary reading holding that rank. A secondary
// reading spoken more often than the top 12 primary readings lands among the
// first 12 items; one CEJC never observed as that specific reading lands
// wherever the curriculum's own observed-frequency data runs dry (deep in
// CEJC_HEAD, well ahead of the un-ranked JLPT/OpenSubtitles fallback words that
// never had a count to begin with, only a dictionary rank). 七's two readings
// show the ordinary case: なな (673 CEJC occurrences) is the word's primary and
// rides 七's own kanji item as always; しち (328) is roughly half as common and
// is woven in among the primary readings CEJC observed a similar number of
// times — nowhere near なな, and nowhere near the very end of the curriculum
// either, which is what the old batched tail would have done to it.
//
// ONE GUARD: A READING NEVER PRECEDES ITS OWN WORD. The primary reading is
// chosen by dominant part-of-speech and definition order (`withSenses`), not by
// which reading CEJC counted most — so the reading picked "primary" is
// sometimes NOT the one CEJC observed most often. 何's primary is なに (5,253
// CEJC occurrences); its other reading なん is spoken almost five times more
// often (26,067). Ranked purely by that count, なん would land ahead of なに
// itself — asking a learner to read a pronunciation of a word whose kanji have
// not been taught yet, which is not a position, it is a bug. So the rank-
// derived position is a TARGET, clamped to never sit earlier than immediately
// after the word's own primary-reading item: なん still gets pulled as early as
// a secondary reading this common deserves, right up against なに and no
// earlier — the same "pulled forward, never past what it owes" shape the fold
// itself already uses for a single-kanji word.
//
// Nothing is emitted twice. Every one of the 2,136 kanji, every radical-only
// shape, and every (word, reading) pair CEJC teaches appears exactly once in
// CURRICULUM_SEQUENCE.

import { kanjiRow, kanjiTeachOrder, variantOriginal } from "@/data/kanji";
import {
  radicalByGlyph,
  radicalByWrittenForm,
  radicalOfKanji,
  type RadicalRow,
} from "@/data/radicals";
import { RADICAL_TEACHING_ORDER } from "@/lib/radical-order";
import {
  isSingleCharWordGlyph,
  readingFrequency,
  readingUnits,
  vocabRow,
  type VocabRow,
} from "@/data/vocab";
import { CURRICULUM_WORDS, wordKanji } from "@/lib/word-lesson";

/**
 * What an item IS. A set, not a choice: 山 plays all three, 何 is a kanji and a
 * word, 气 is only ever a building block, あなた is only ever a word.
 */
export type CurriculumRole = "radical" | "kanji" | "word";

/** One item of the spine: a character or a written form, every role it plays,
 * and the weld, if any, to the item after it. */
export interface CurriculumItem {
  /** The glyph to teach: 气, 山, 電車, あなた. */
  readonly glyph: string;
  /** Every role this glyph plays, always in the order radical, kanji, word, so
   * two items with the same roles compare equal element by element. Never
   * empty. */
  readonly roles: readonly CurriculumRole[];
  /**
   * The kanji this item is WELDED to, for a radical-only shape pulled in as a
   * component; null for everything else.
   *
   * A promise to the packer, in two parts: the tied item sits in the same lesson
   * as that kanji, and it sits immediately before it. A kanji needing two
   * radical-only shapes yields two tied items in a row, then the kanji, and the
   * whole run travels together.
   *
   * Only a radical is ever tied. A kanji prerequisite is ordered earlier and
   * nothing more, so it carries null and the packer may put a hundred items
   * between it and the character that wanted it.
   */
  readonly tiedTo: string | null;
  /**
   * Which reading this item teaches the word as, when `roles` includes "word";
   * null for every other item. `roles.includes("word") === (reading !== null)`
   * always — a word role never rides without naming which pronunciation it is.
   *
   * A word with N teachable readings (`readingUnits`) occupies N separate items,
   * each with this field set to a different `reb`: 七 is `{glyph: "七", ...,
   * reading: "しち"}` at one position and `{glyph: "七", ..., reading: "なな"}`
   * at a later one. See the header (A WORD OWES ONE ITEM PER READING) for why
   * they can land far apart. A glyph's radical/kanji roles never repeat across
   * these items — only the first (primary-reading) item for a folded
   * single-character word carries them; every later reading of the same glyph
   * is a `roles: ["word"]` item, because the shape is already taught.
   */
  readonly reading: string | null;
}

/** The curriculum words by written form, for the membership question this module
 * asks of every item. Keys are unique across CURRICULUM_WORDS. */
const WORD_KEBS: ReadonlySet<string> = new Set(CURRICULUM_WORDS.map((w) => w.keb));

/**
 * The roles a glyph plays, by membership alone.
 *
 * The same pure question `characterRole` asks, with the third table joined in:
 * a radical row makes it a radical, a kanji row makes it a kanji, a curriculum
 * word entry makes it a word. Nothing here knows or cares WHERE the glyph is
 * taught, which is the ordering problem below and a different question.
 */
function rolesOf(glyph: string): CurriculumRole[] {
  const roles: CurriculumRole[] = [];
  // Asked of every glyph, with no "single character" shortcut in front of it.
  // 𠮟 is one kanji and two JS units, so a `length === 1` guard would silently
  // strip the kanji role off it; the tables are keyed by the whole glyph and a
  // written form like 電車 is simply not in them.
  if (radicalByGlyph(glyph) !== undefined) roles.push("radical");
  if (kanjiRow(glyph) !== undefined) roles.push("kanji");
  // The word role is granted to a scheduled word (WORD_KEBS, which covers the
  // multi-character written forms like 電車) AND to any single Han character that
  // is a dictionary word — so a character already ordered here as a radical or
  // kanji that is ALSO a word on its own (十, 羊) gains its word facts and cost
  // where it already sits, taught whole. This adds only the role: these
  // characters carry no CURRICULUM_WORDS entry, so nothing schedules them as new
  // word items and the sequence order is unchanged. See isSingleCharWordGlyph.
  if (WORD_KEBS.has(glyph) || isSingleCharWordGlyph(glyph)) roles.push("word");
  return roles;
}

/** What one kanji owes, split by how the debt is paid. See the header: kanji
 * parts are ordered before and resolved recursively, radical parts are ordered
 * immediately before and welded, bare strokes are owed nothing. */
interface Components {
  readonly kanji: readonly string[];
  readonly radicals: readonly RadicalRow[];
}

/**
 * The components of one kanji, classified and deduped, in a stable order.
 *
 * Two sources, and the second is not redundant. `comps` is KanjiVG's depth-1
 * hierarchy, which is what the glyph is drawn from; `radicalOfKanji` is the one
 * classical radical the character is FILED under, which the decomposition does
 * not always name (and which is the debt the radical track has always
 * collected). 気 is drawn from 气 and 㐅, and it is filed under 气 as well; 到 is
 * drawn from 至 and 刂, and filed under 刀, which the drawing only implies.
 *
 * Computed once per kanji and cached: the walk asks for the same character's
 * components every time another one is built from it.
 */
const COMPONENTS = new Map<string, Components>();

function componentsOf(c: string): Components {
  const cached = COMPONENTS.get(c);
  if (cached) return cached;

  const kanji: string[] = [];
  const radicals: RadicalRow[] = [];
  const seenKanji = new Set<string>();
  const seenRadicals = new Set<number>();

  const addKanji = (part: string) => {
    if (seenKanji.has(part)) return;
    seenKanji.add(part);
    kanji.push(part);
  };
  const addRadical = (rad: RadicalRow) => {
    if (seenRadicals.has(rad.num)) return;
    seenRadicals.add(rad.num);
    radicals.push(rad);
  };

  const classify = (part: string) => {
    // A character is not its own prerequisite, and some decompositions list it
    // among its own parts. Repeats are dropped by the two `seen` sets, which
    // matters straight away: 可 decomposes as 丁 口 丁.
    if (part === c) return;
    // A COMPONENT WITH A CARD OF ITS OWN IS TAUGHT AS ITSELF, and the variant map
    // is not consulted. It names 日 a form of 曰 and 月 a form of 肉, which is
    // etymology; the learner meeting 明 is meeting 日, a jōyō kanji with its own
    // meaning, readings and page. Same for the shapes that are radicals in their
    // own right (儿 is Kangxi 10, whatever it descends from).
    if (kanjiRow(part) !== undefined) return addKanji(part);
    // `radicalByWrittenForm`, not `radicalByGlyph`: a decomposition names the
    // shape as it is written, and for radical 162 that shape is 辶 while the
    // table holds 辵. See the bridge in src/data/radicals.ts.
    const own = radicalByWrittenForm(part);
    if (own) return addRadical(own);
    // NO CARD OF ITS OWN: a bound form (亻, 氵, 扌, 艹) that exists only inside
    // other characters. The debt is the character it is a form of, so nothing
    // ever teaches 亻 and 人 as two separate items.
    const orig = variantOriginal(part);
    // 耂 is a form of 老, and it is how 老 itself is drawn, so resolving the
    // variant can land back on the character asking the question. Not a debt: a
    // character is not built from itself.
    if (orig !== undefined && orig !== c) {
      if (kanjiRow(orig) !== undefined) return addKanji(orig);
      const rad = radicalByWrittenForm(orig);
      if (rad) return addRadical(rad);
    }
    // A primitive with nothing behind it: 丶, ⺍ (a form of つ), 戌. There is no
    // card, no meaning and no reading anywhere in the data for these, so there
    // is nothing to owe. It is drawn when the character is drawn.
  };

  for (const part of kanjiRow(c)?.comps ?? []) classify(part);
  const filed = radicalOfKanji(c);
  // THE ONE PLACE THE TWO SOURCES CONTRADICT EACH OTHER: 王 is FILED under 玉,
  // and 玉 is DRAWN as 王 plus a dot, so each is the other's prerequisite and
  // whichever is reached first would teach the other one late. The drawing wins:
  // 玉 visibly contains 王, and filing is a catalogue fact about where the
  // character sits in the Kangxi table. So the filed-under edge is dropped when
  // the radical is itself built from this character. src/data/radicals.ts has
  // the same pair on file as the reason 玉 cannot merge into one kanji lesson.
  if (filed && !kanjiRow(filed.glyph)?.comps.includes(c)) {
    classify(filed.glyph);
  }

  const out: Components = { kanji, radicals };
  COMPONENTS.set(c, out);
  return out;
}

/** A word's PRIMARY reading — the one its VocabRow's own `.reb` names (the same
 * CEJC-preferred, dominant-POS-aware pick `readingOf`/the word's Library page
 * already show), guarded against a `.reb` that `readingUnits` itself does not
 * carry (should not happen — `withSenses` always selects from the row's own
 * senses — but a missing match falls back to the first teachable reading rather
 * than naming a reading the sequence never schedules a fact for). */
function primaryReadingOf(row: VocabRow): string {
  const units = readingUnits(row);
  if (units.some((u) => u.reb === row.reb)) return row.reb;
  return units[0]?.reb ?? row.reb;
}

/** One (word, reading) pair still owed a position — queued by `queueSecondary`
 * as its word's other readings are found, and woven into the base sequence once
 * (see `weaveSecondaryReadings`) after every primary reading has a fixed index.
 * See the header, THE WEAVE. */
interface PendingSecondaryReading {
  readonly keb: string;
  readonly reb: string;
  /** CEJC's count for this exact (word, reading) pair — the value the weave
   * ranks against the DISTRIBUTION of every primary reading's own count. */
  readonly freq: number;
  /** The word's own beginnerRank, the tie-break when two secondary readings
   * (of different words) land at the same computed rank — keeps the weave
   * deterministic without leaning on object/Map iteration order. */
  readonly rank: number;
  /** The index, in the base (pre-weave) sequence, of this word's OWN primary
   * reading item — the earliest position this secondary reading may ever sit,
   * since nothing can teach a reading of a word before the word (and the kanji
   * it rides in on) has been taught. See the header, ONE GUARD. */
  readonly primaryIndex: number;
}

/**
 * Weave every queued secondary reading into `base` (the primary-only sequence:
 * every kanji, every radical-only shape, and every word's PRIMARY reading, each
 * already at its final index) by genuine frequency, and return the combined
 * array. See the header, THE WEAVE.
 *
 * THE DISTRIBUTION. `base`'s own word-role items — one per taught word, in
 * curated order — each carry their glyph's PRIMARY reading, and each has its
 * own raw `readingFrequency`. Read off in curated order and then sorted
 * descending, those counts are the scale a secondary reading's raw count is
 * measured against: `rankOf(f)` counts how many primary readings CEJC observed
 * MORE often than `f`, by binary search over the sorted counts. That count IS
 * the position — the secondary reading is inserted immediately before the
 * primary-reading item holding that rank in `base`'s own (curated, not
 * frequency-sorted) order, `wordItemIndex[rankOf(f)]`. A count higher than
 * every primary reading's own (rank 0) inserts before the very first word item;
 * a count of 0 inserts wherever `base`'s own primary counts hit 0 — deep in
 * CEJC_HEAD's tail, well ahead of the un-ranked JLPT/OpenSubtitles fallback
 * words that never had a CEJC count at all.
 *
 * THE GUARD. That rank-derived index is a TARGET, not a promise: it can land
 * earlier than the reading's OWN word's primary-reading item when the "other"
 * reading is the one CEJC actually observed more (何's なん outranks なに this
 * way). Nothing may teach a reading of a word before the word itself, so the
 * target is clamped to `max(target, primaryIndex + 1)` — pulled forward as far
 * as its own frequency earns, never past what it owes.
 *
 * THE OTHER GUARD: A WELD IS ATOMIC. `base` can hold a radical-only shape
 * immediately before the kanji it is welded to (`tiedTo`), and the packer's one
 * hard promise is that nothing ever comes between them — see the header, THE
 * PREREQUISITE RULE. A rank-derived target can land exactly on that boundary
 * (要's own word item is a wordItemIndex entry, and 襾 rides tied immediately
 * before it), so a target that would separate a tied item from what it is tied
 * to is pushed forward past the whole weld run instead: the boundary before a
 * tied item is never a valid insertion point, only the boundary before or
 * after the run as a whole is.
 *
 * DETERMINISM. Insertions are computed independently (no insertion shifts
 * another's target index, because targets are read off `base`'s fixed indices,
 * not the growing output), then merged into `base` in one left-to-right pass.
 * Two secondary readings landing at the same target index keep the order
 * `ordered` already gives them: most-spoken first, then the tie-breaks below.
 */
function weaveSecondaryReadings(
  base: readonly CurriculumItem[],
  pending: readonly PendingSecondaryReading[],
): CurriculumItem[] {
  if (pending.length === 0) return [...base];

  const wordItemIndex: number[] = [];
  for (let i = 0; i < base.length; i++) {
    if (base[i]!.reading !== null) wordItemIndex.push(i);
  }
  // Every primary reading's own raw CEJC count, sorted most-spoken first, so
  // `rankOf` can binary-search "how many are greater than f" in O(log n).
  const primaryFreqsDesc = wordItemIndex
    .map((i) => readingFrequency(base[i]!.glyph, base[i]!.reading!))
    .sort((a, b) => b - a);

  const rankOf = (f: number): number => {
    let lo = 0;
    let hi = primaryFreqsDesc.length;
    while (lo < hi) {
      const mid = (lo + hi) >>> 1;
      if (primaryFreqsDesc[mid]! > f) lo = mid + 1;
      else hi = mid;
    }
    return lo;
  };

  // Most-spoken first, then the word's own rank, then plain string order —
  // never object/Map iteration — so the weave is deterministic run to run, and
  // so two readings sharing a target index keep this order in the output.
  const ordered = [...pending].sort(
    (a, b) =>
      b.freq - a.freq ||
      a.rank - b.rank ||
      (a.reb < b.reb ? -1 : a.reb > b.reb ? 1 : 0) ||
      (a.keb < b.keb ? -1 : a.keb > b.keb ? 1 : 0),
  );

  // Never a valid insertion boundary: splitting a tied item from what it is
  // tied to. Pushed forward past the whole run, to the boundary right after it.
  const pastWeld = (index: number): number => {
    let i = index;
    while (i > 0 && i <= base.length && base[i - 1]!.tiedTo !== null) i++;
    return i;
  };

  const insertions: { index: number; item: CurriculumItem }[] = ordered.map((sr) => {
    const target =
      rankOf(sr.freq) < wordItemIndex.length ? wordItemIndex[rankOf(sr.freq)]! : base.length;
    return {
      index: pastWeld(Math.max(target, sr.primaryIndex + 1)),
      item: { glyph: sr.keb, roles: ["word"], tiedTo: null, reading: sr.reb },
    };
  });
  // Stable: equal-index insertions keep `ordered`'s relative order (Array#sort
  // has been a stable sort since ES2019, and the whole toolchain here targets
  // Node 24 / modern browsers, both well past that).
  insertions.sort((a, b) => a.index - b.index);

  const out: CurriculumItem[] = [];
  let ii = 0;
  for (let i = 0; i < base.length; i++) {
    while (ii < insertions.length && insertions[ii]!.index === i) {
      out.push(insertions[ii]!.item);
      ii++;
    }
    out.push(base[i]!);
  }
  while (ii < insertions.length) {
    out.push(insertions[ii]!.item);
    ii++;
  }
  return out;
}

/** The whole spine, built once. */
function buildSequence(): CurriculumItem[] {
  const items: CurriculumItem[] = [];
  const taughtKanji = new Set<string>();
  const taughtRadicals = new Set<number>();
  // Every (keb, reading) pair already given a position — the reading-grained
  // twin of the old `deliveredWords`. Keyed on both halves because a word can
  // now occupy more than one position, one per reading; see the header.
  const deliveredReadings = new Set<string>();
  const readingKey = (keb: string, reb: string) => `${keb} ${reb}`;

  const push = (
    glyph: string,
    tiedTo: string | null,
    roles: readonly CurriculumRole[],
    reading: string | null,
  ) => {
    items.push({ glyph, roles, tiedTo, reading });
  };

  // Readings still owed a position, queued as `pushGlyph`/the main word loop
  // finds them and woven into `items` in one pass once the base sequence (every
  // primary reading at its final index) is complete. See `weaveSecondaryReadings`.
  const pendingSecondary: PendingSecondaryReading[] = [];

  /** Queue every OTHER teachable reading of `row` (not `primary`, already
   * delivered by the caller and already at `primaryIndex` in `items`) for the
   * weave. Guarded against a reading somehow already delivered, so a caller
   * never has to know whether this word has been seen from another angle
   * first. */
  const queueSecondary = (keb: string, row: VocabRow, primary: string, primaryIndex: number) => {
    for (const unit of readingUnits(row)) {
      if (unit.reb === primary) continue;
      if (deliveredReadings.has(readingKey(keb, unit.reb))) continue;
      deliveredReadings.add(readingKey(keb, unit.reb));
      pendingSecondary.push({
        keb,
        reb: unit.reb,
        freq: readingFrequency(keb, unit.reb),
        rank: row.beginnerRank,
        primaryIndex,
      });
    }
  };

  /** Push a radical-only shape or a kanji, first-time-taught: `rolesOf` alone
   * when it plays no word role, or — when it does (a folded single-character
   * word, 山, or an un-scheduled dictionary character, 十, see
   * `isSingleCharWordGlyph`) — that role set WITH the word's primary reading
   * folded in, its other readings queued for the weave. Called exactly once per
   * glyph (the caller's `taughtKanji`/`taughtRadicals` guard), so there is no
   * risk of queuing the same word's secondary readings twice. */
  const pushGlyph = (glyph: string, tiedTo: string | null) => {
    const roles = rolesOf(glyph);
    if (!roles.includes("word")) {
      push(glyph, tiedTo, roles, null);
      return;
    }
    const row = vocabRow(glyph);
    if (!row) {
      // Cannot happen — rolesOf's own word test requires a vocab row — but an
      // item that claims the role needs something to read a reading from, and
      // an honest miss (no reading) beats a crash.
      push(glyph, tiedTo, roles, null);
      return;
    }
    const primary = primaryReadingOf(row);
    deliveredReadings.add(readingKey(glyph, primary));
    push(glyph, tiedTo, roles, primary);
    queueSecondary(glyph, row, primary, items.length - 1);
  };

  const teachKanji = (c: string) => {
    if (taughtKanji.has(c)) return;
    // Marked taught BEFORE the component walk, so a decomposition that loops
    // back on itself resolves instead of recursing forever. See CYCLES in the
    // header. It is still emitted after its components, because the push below
    // is what puts it in the sequence.
    taughtKanji.add(c);
    const parts = componentsOf(c);
    // Kanji first, radicals second, so the welded radicals end up in the run
    // immediately before this character with nothing between.
    for (const k of parts.kanji) teachKanji(k);
    for (const rad of parts.radicals) {
      if (taughtRadicals.has(rad.num)) continue;
      taughtRadicals.add(rad.num);
      pushGlyph(rad.glyph, c);
    }
    // THE FOLD. If the character is itself a curriculum word, this item
    // delivers the word's PRIMARY reading as well (pushGlyph), and the word's
    // own turn later will find that reading already paid — only its other
    // readings, if it has any, still owe a position.
    pushGlyph(c, null);
  };

  for (const w of CURRICULUM_WORDS) {
    // What the word owes, from the words track's own gate (`wordKanji` drops the
    // iteration mark 々, which is a writing rule and not a kanji to teach), so
    // the spine and the gate cannot disagree about a word's prerequisites.
    for (const c of wordKanji(w.keb)) teachKanji(c);
    const primary = primaryReadingOf(w);
    const primaryKey = readingKey(w.keb, primary);
    // Folded already: a single-kanji word's primary reading was delivered by
    // its kanji item, at the point some earlier word first needed the
    // character (or, for a word reached before anything else needs it, one
    // line above). A multi-character word is never folded, so this always
    // fires for it.
    if (deliveredReadings.has(primaryKey)) continue;
    deliveredReadings.add(primaryKey);
    push(w.keb, null, rolesOf(w.keb), primary);
    queueSecondary(w.keb, w, primary, items.length - 1);
  }

  // THE ORPHAN KANJI. The jōyō kanji no curriculum word is written with and no
  // taught character is built from. They follow every word, in the everyday
  // order, which is the ramp the kanji track already teaches by. One of these
  // can rarely itself be an un-scheduled dictionary word with more than one
  // reading (百, 千, 万 — excluded from CURRICULUM_WORDS by the counters track,
  // see word-lesson.ts), and its extra readings are queued exactly the same way.
  for (const c of kanjiTeachOrder("everyday")) teachKanji(c);

  // THE ORPHAN RADICALS. Every kanji is taught by now, so any radical-only shape
  // still missing is in nothing at all (爿 瓜 韭 …) and has no first consumer to
  // ride in with. Untied, for the same reason: there is no kanji to weld it to.
  // RADICAL_TEACHING_ORDER already sorts those last among themselves, in Kangxi
  // number order.
  for (const r of RADICAL_TEACHING_ORDER) {
    if (kanjiRow(r.glyph) !== undefined) continue;
    if (taughtRadicals.has(r.num)) continue;
    taughtRadicals.add(r.num);
    pushGlyph(r.glyph, null);
  }

  // Every primary reading now sits at its final index — `items` is the base
  // sequence THE WEAVE (header) measures every secondary reading's own CEJC
  // count against — so every secondary reading found across all three passes
  // above is woven in now, in one pass, genuinely interleaved by frequency
  // rather than batched. See `weaveSecondaryReadings`.
  return weaveSecondaryReadings(items, pendingSecondary);
}

/**
 * Every item the curriculum teaches, in order. Words in beginnerRank order
 * (each word's primary reading) with their prerequisites woven in ahead of
 * them, then the orphan kanji, then the orphan radicals — and, woven genuinely
 * into all of that by frequency rather than batched onto the end of it, every
 * word's OTHER readings, each at the position its own CEJC count earns against
 * the distribution of every primary reading's own count (see the header, THE
 * WEAVE).
 *
 * Computed once at module load, like KANJI_ORDER and RADICAL_TEACHING_ORDER: it
 * is a property of the shipped data, no user input reaches it, and building it
 * is one walk of the CEJC word curriculum and 2,136 kanji against hash sets,
 * plus one weave of the (small — 98 today) set of extra readings found along
 * the way.
 */
export const CURRICULUM_SEQUENCE: readonly CurriculumItem[] = buildSequence();

/**
 * Where a glyph FIRST becomes taught in the spine, or -1 for anything the
 * curriculum does not teach.
 *
 * A radical-only shape or a kanji occupies exactly one item, so this is
 * unambiguous for it, same as before SAK-162. A word with more than one taught
 * reading (七) now occupies more than one item — this returns the EARLIEST one
 * (first occurrence wins), which is always the word's PRIMARY reading: the
 * right answer for "when does this glyph's shape/meaning become available",
 * which is what every existing caller (glyphDifficulty, the Library shelves,
 * the transitivity track's ordering) actually asks. A caller that wants ONE
 * specific reading's own position uses `curriculumReadingPosition` instead.
 */
const POSITION: ReadonlyMap<string, number> = (() => {
  const map = new Map<string, number>();
  for (let i = 0; i < CURRICULUM_SEQUENCE.length; i++) {
    const glyph = CURRICULUM_SEQUENCE[i].glyph;
    if (!map.has(glyph)) map.set(glyph, i);
  }
  return map;
})();

export function curriculumPosition(glyph: string): number {
  return POSITION.get(glyph) ?? -1;
}

/**
 * Where ONE specific (word, reading) pair sits in the spine, or -1 when the
 * curriculum does not teach that glyph as that reading. For a glyph with only
 * one taught reading this agrees with `curriculumPosition`; for 七 (しち, なな)
 * it is the one way to ask "where specifically is なな", which
 * `curriculumPosition("七")` (first-occurrence) cannot answer on its own.
 */
const READING_POSITION: ReadonlyMap<string, number> = (() => {
  const map = new Map<string, number>();
  for (let i = 0; i < CURRICULUM_SEQUENCE.length; i++) {
    const item = CURRICULUM_SEQUENCE[i];
    if (item.reading === null) continue;
    map.set(`${item.glyph} ${item.reading}`, i);
  }
  return map;
})();

export function curriculumReadingPosition(glyph: string, reading: string): number {
  return READING_POSITION.get(`${glyph} ${reading}`) ?? -1;
}
