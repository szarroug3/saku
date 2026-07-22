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

// ─── Phase 1c · 〜人, counting people ──────────────────────────────────────
// ひとり and ふたり are the irregulars that matter; 四人 is よにん, never
// よんにん. The rest are regular number + にん. Kana, phase 1.
const NIN: readonly CounterForm[] = [
  kana("counter:nin:1", "ひとり", "one person", "人"),
  kana("counter:nin:2", "ふたり", "two people", "人"),
  kana("counter:nin:3", "さんにん", "three people", "人"),
  kana("counter:nin:4", "よにん", "four people", "人"),
  kana("counter:nin:5", "ごにん", "five people", "人"),
  kana("counter:nin:6", "ろくにん", "six people", "人"),
  kana("counter:nin:7", "しちにん", "seven people, also ななにん", "人"),
  kana("counter:nin:8", "はちにん", "eight people", "人"),
  kana("counter:nin:9", "きゅうにん", "nine people", "人"),
  kana("counter:nin:10", "じゅうにん", "ten people", "人"),
];

// ─── Phase 1d · 11–99, then 百 / 千 / 万 ────────────────────────────────────
// The teens and tens are regular concatenation and taught in kana. Only the
// three big base words (100, 1000, 10000) are shipped here; the compound
// hundreds and thousands carry their own sound changes (三百 さんびゃく,
// 八千 はっせん) and are deliberately left out rather than shipped as guesses —
// see the task report.
const TENS_AND_UP: readonly CounterForm[] = [
  kana("counter:num:11", "じゅういち", "eleven (11)", ""),
  kana("counter:num:12", "じゅうに", "twelve (12)", ""),
  kana("counter:num:13", "じゅうさん", "thirteen (13)", ""),
  kana("counter:num:14", "じゅうよん", "fourteen (14)", ""),
  kana("counter:num:15", "じゅうご", "fifteen (15)", ""),
  kana("counter:num:16", "じゅうろく", "sixteen (16)", ""),
  kana("counter:num:17", "じゅうなな", "seventeen (17)", ""),
  kana("counter:num:18", "じゅうはち", "eighteen (18)", ""),
  kana("counter:num:19", "じゅうきゅう", "nineteen (19)", ""),
  kana("counter:num:20", "にじゅう", "twenty (20)", ""),
  kana("counter:num:30", "さんじゅう", "thirty (30)", ""),
  kana("counter:num:40", "よんじゅう", "forty (40)", ""),
  kana("counter:num:50", "ごじゅう", "fifty (50)", ""),
  kana("counter:num:60", "ろくじゅう", "sixty (60)", ""),
  kana("counter:num:70", "ななじゅう", "seventy (70)", ""),
  kana("counter:num:80", "はちじゅう", "eighty (80)", ""),
  kana("counter:num:90", "きゅうじゅう", "ninety (90)", ""),
  kana("counter:num:100", "ひゃく", "hundred (100)", ""),
  kana("counter:num:1000", "せん", "thousand (1,000)", ""),
  kana("counter:num:10000", "まん", "ten thousand (10,000)", ""),
];

// ─── Phase 2 · 〜本, the h→p/b sound change ─────────────────────────────────
// The canonical teacher of the shift: 1/6/8/10 → っ + ぽん (p), 3 → ぼん (b),
// everything else stays ほん (h). Every reading verified against a reference.
const HON: readonly CounterForm[] = [
  counted("counter:hon:1", "一本", "いっぽん", "one long thin object", "本", "一", 2),
  counted("counter:hon:2", "二本", "にほん", "two long thin objects", "本", "二", 2),
  counted("counter:hon:3", "三本", "さんぼん", "three long thin objects", "本", "三", 2),
  counted("counter:hon:4", "四本", "よんほん", "four long thin objects", "本", "四", 2),
  counted("counter:hon:5", "五本", "ごほん", "five long thin objects", "本", "五", 2),
  counted("counter:hon:6", "六本", "ろっぽん", "six long thin objects", "本", "六", 2),
  counted("counter:hon:7", "七本", "ななほん", "seven long thin objects", "本", "七", 2),
  counted("counter:hon:8", "八本", "はっぽん", "eight long thin objects", "本", "八", 2),
  counted("counter:hon:9", "九本", "きゅうほん", "nine long thin objects", "本", "九", 2),
  counted("counter:hon:10", "十本", "じゅっぽん", "ten long thin objects, also じっぽん", "本", "十", 2),
];

// ─── Phase 2 · 〜匹, the same shift on small animals ────────────────────────
// 1/6/8/10 → っ + ぴき (p), 3 → びき (b), else ひき (h). Same pattern as 本.
const HIKI: readonly CounterForm[] = [
  counted("counter:hiki:1", "一匹", "いっぴき", "one small animal", "匹", "一", 2),
  counted("counter:hiki:2", "二匹", "にひき", "two small animals", "匹", "二", 2),
  counted("counter:hiki:3", "三匹", "さんびき", "three small animals", "匹", "三", 2),
  counted("counter:hiki:4", "四匹", "よんひき", "four small animals", "匹", "四", 2),
  counted("counter:hiki:5", "五匹", "ごひき", "five small animals", "匹", "五", 2),
  counted("counter:hiki:6", "六匹", "ろっぴき", "six small animals", "匹", "六", 2),
  counted("counter:hiki:7", "七匹", "ななひき", "seven small animals", "匹", "七", 2),
  counted("counter:hiki:8", "八匹", "はっぴき", "eight small animals", "匹", "八", 2),
  counted("counter:hiki:9", "九匹", "きゅうひき", "nine small animals", "匹", "九", 2),
  counted("counter:hiki:10", "十匹", "じゅっぴき", "ten small animals, also じっぴき", "匹", "十", 2),
];

// ─── Phase 2 · 〜枚, the clean contrast (regular, no shift) ─────────────────
// 枚 begins with ま, not an h-row sound, so it never shifts: every form is
// number + まい. Taught beside 本 and 匹 precisely to show a counter that does
// NOT change.
const MAI: readonly CounterForm[] = [
  counted("counter:mai:1", "一枚", "いちまい", "one flat object", "枚", "一", 2),
  counted("counter:mai:2", "二枚", "にまい", "two flat objects", "枚", "二", 2),
  counted("counter:mai:3", "三枚", "さんまい", "three flat objects", "枚", "三", 2),
  counted("counter:mai:4", "四枚", "よんまい", "four flat objects", "枚", "四", 2),
  counted("counter:mai:5", "五枚", "ごまい", "five flat objects", "枚", "五", 2),
  counted("counter:mai:6", "六枚", "ろくまい", "six flat objects", "枚", "六", 2),
  counted("counter:mai:7", "七枚", "ななまい", "seven flat objects", "枚", "七", 2),
  counted("counter:mai:8", "八枚", "はちまい", "eight flat objects", "枚", "八", 2),
  counted("counter:mai:9", "九枚", "きゅうまい", "nine flat objects", "枚", "九", 2),
  counted("counter:mai:10", "十枚", "じゅうまい", "ten flat objects", "枚", "十", 2),
];

// ─── Phase 3 · the long tail, ungated plain vocab ──────────────────────────
// One representative form each — no new machinery. 二十歳 はたち is the one
// irregular worth shipping (the special reading for "20 years old"). Only forms
// whose reading is certain are here; the rest are learned in the wild.
const TAIL: readonly CounterForm[] = [
  counted("counter:ko:1", "一個", "いっこ", "one (small object)", "個", "一", 3),
  counted("counter:dai:1", "一台", "いちだい", "one (machine or vehicle)", "台", "一", 3),
  counted("counter:satsu:1", "一冊", "いっさつ", "one (book or volume)", "冊", "一", 3),
  counted("counter:hai:1", "一杯", "いっぱい", "one cupful", "杯", "一", 3),
  counted("counter:kai:1", "一回", "いっかい", "one time (once)", "回", "一", 3),
  counted("counter:sai:1", "一歳", "いっさい", "one year old", "歳", "一", 3),
  counted("counter:sai:20", "二十歳", "はたち", "twenty years old", "歳", "二", 3),
];

/**
 * The whole counters curriculum, in teaching order.
 *
 * 〜つ leads (the escape hatch), then the Sino numbers, then 〜人, then the rest
 * of the numbers, then the phase-2 sound-change set, then the ungated tail.
 * counters.test.ts pins 〜つ ahead of the numbers so a reorder cannot break it.
 */
export const COUNTER_CURRICULUM: readonly CounterForm[] = [
  ...TSU,
  ...NUMBERS,
  ...NIN,
  ...TENS_AND_UP,
  ...HON,
  ...HIKI,
  ...MAI,
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
 */
export const COUNTER_ENTRIES: ReadonlySet<EntryId> = new Set(
  COUNTER_CURRICULUM.map(counterEntry),
);

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

/** Does this entry carry the h→p/b sound change — a phase-2 form of a counter
 * whose reading shifts (本, 匹)? The gate for the sound-change rule card, fired
 * ahead of the first such form in the teach walk (see src/lib/lesson-steps.ts).
 * 枚 is phase 2 but does NOT shift, so it is excluded: it is the contrast, not
 * the rule. */
const SHIFTING_COUNTERS: ReadonlySet<string> = new Set(["本", "匹"]);

export function isSoundChangeEntry(entry: EntryId): boolean {
  const form = BY_ENTRY.get(entry);
  return !!form && form.phase === 2 && SHIFTING_COUNTERS.has(form.counter);
}

const BY_ENTRY: ReadonlyMap<EntryId, CounterForm> = new Map(
  COUNTER_CURRICULUM.map((f) => [counterEntry(f), f]),
);
