// The words the curriculum teaches: WHICH words, in WHAT order, and what each
// one owes.
//
// WHAT THIS FILE STOPPED BEING
// ============================
// It used to be a scheduler as well. It walked beginnerRank, asked of every word
// whether all its kanji were known yet, stepped over the ones that were not, and
// handed the next few teachable ones to a card of its own, with a lock card for
// the very common case where the best word to teach was behind kanji the learner
// did not have. That was a second scheduler running beside kanji's over the same
// climb, and the lock was it apologising for the other one.
//
// curriculum-order.ts folded both into ONE order: a word is placed after every
// kanji it is written with, so "is this teachable yet" is answered by the
// sequence rather than asked of history. curriculum-lesson.ts cuts that sequence
// into lessons and is the only scheduler now. What is left here is the source of
// truth that order is built from: the word list, its cut, and the prerequisite
// rule.
//
// THE ORDER
// =========
// `beginnerRank` is a single TOTAL ordering over every word in VOCAB (see its
// doc comment in vocab.ts): CEJC lexical frequency for the words CEJC's
// conversation corpus actually observed, falling back to a JLPT/OpenSubtitles
// blend for everything else. The curriculum sorts by it directly — there is no
// second cut here.
//
// Kana-only words still lead, and for the same reason they always did: a word
// written with no kanji (これ, もう, とても) owes nothing, so it arrives with no
// run-up, while a kanji word of a LOWER rank (何 is rank 1) arrives behind its
// kanji. beginnerRank order is preserved; what a word owes is what spaces them
// out.
//
// WHERE THE CURRICULUM ENDS
// =========================
// At (almost) every dictionary row. VOCAB is already JMdict's own curated
// "everyday" set (ichi1/spec1/spec2 — see vocab.ts), so a word CEJC's specific
// recordings never happened to use, or that JLPT's lists never gated, is not
// evidence it is rare: 図書館, 郵便局, 飛行機 are exactly this shape, ordinary
// nouns a conversation corpus rarely has occasion to say. Two things are
// excluded: the words the COUNTERS track already teaches under its own
// spoken-form entry (COUNTER_TRACK_KEBS/COUNTER_KANJI_GLYPHS, below), and the
// core case/binding particles the GRAMMAR track already teaches as their own
// pattern, examples included (PARTICLE_TRACK_KEBS, below). Everything else is
// taught, CEJC/JLPT order first, frequency-tail order after. A grammar-role
// WORD with no recipe of its own (e.g. くださる) is still a word with a plain
// meaning worth teaching, so it stays — the exclusion is for a word that would
// otherwise be taught TWICE, once thinly here and once properly there.
//
// PARTICLE_TRACK_KEBS reverses an earlier call on this same file: だけ used to
// be the worked example of "a grammar-role word is still worth teaching here".
// It still is, in isolation — the call that changed is that だけ (like
// か/は/が/に/で/を/へ/まで/しか) is no longer isolated: each is now ALSO a
// meaning recipe with a real example sentence (src/data/grammar/recipes.ts,
// authored.ts), reached from the SAME pattern page as its production siblings.
// A bare vocab gloss ("indicates the subject of a sentence") with no sentence
// under it, surfaced by raw reading frequency in the first lesson or two (か
// and で are among the very first pronunciation units taught — see
// docs/interleaved-schedule-findings.md), was a worse first meeting with these
// than the grammar track's own page gives; excluding them here removes the
// worse copy rather than leaving both.
//
// This was a considered decision, not a default: an earlier version of this
// file stopped at CEJC/JLPT coverage (~7,537 words) and treated the remaining
// ~5,000 as Library-only reference material. Verified before widening: those
// 5,000 are not junk that slipped past a filter — VOCAB's own curation already
// screened for everyday commonness, so JLPT-gate/CEJC-observation status marks
// *how a word's teaching order was computed*, not *whether it is worth
// teaching*. See docs/interleaved-schedule-findings.md.

import { kanjiKnown } from "@/lib/kanji-known";
import { VOCAB, VOCAB_SUBJECT, type VocabRow } from "@/data/vocab";
import { COUNTER_KANJI_GLYPHS } from "@/data/counters";
import type { HistoryFile } from "@/types";

// The words-per-lesson default and clamp live in the DATA-FREE
// src/lib/lesson-sizing.ts so the always-mounted QuizConfigProvider can seed a
// config without importing this module's VOCAB curriculum. Imported for this
// module's own internal use and re-exported so its consumers are unchanged.
import { WORDS_PER_LESSON_DEFAULT, clampWordsPerLesson } from "@/lib/lesson-sizing";

export { WORDS_PER_LESSON_DEFAULT, clampWordsPerLesson };

const HAN = /\p{Script=Han}/u;

/** The iteration mark 々 (U+3005). Unicode files it under Han script, so the
 * HAN test matches it, but it is NOT a kanji: it is a writing rule that repeats
 * the character before it (時々 is 時 written twice), and it is taught exactly
 * like okurigana — a lesson card fired ahead of the first word that uses it, in
 * the teach walk (see ITERATION_MARK in src/lib/lesson-steps.ts), not a shape in
 * the kanji track. lesson-steps.ts already excludes it from its own KANJI test
 * for this reason; this is the same call, one file over.
 *
 * Left in the prerequisite list it becomes a debt nothing can pay: there is no
 * kanji lesson for 々, so `kanjiKnown("々")` is always false, and every 々 word
 * (時々, 様々, 少々, …) would owe a shape the curriculum never teaches. Excluded
 * here so a 々 word owes the kanji it repeats, which is already in the list, and
 * learns the mark itself inline when it is taught. */
const ITERATION_MARK = "々";

/**
 * The kanji in a word's written form — every Han character, in order, deduped,
 * excluding the iteration mark (see ITERATION_MARK).
 *
 * Used for the gate: a word is teachable once EVERY kanji here is known. All
 * curriculum words are all-jōyō (see vocab.ts), so each has a card; a Han
 * character with no card simply never reads as "known" and keeps the word
 * locked, which is the truthful answer for material outside the kanji track.
 */
export function wordKanji(keb: string): string[] {
  const out: string[] = [];
  for (const c of keb) {
    if (c === ITERATION_MARK) continue;
    if (HAN.test(c) && !out.includes(c)) out.push(c);
  }
  return out;
}

/** A word written with no kanji at all — これ, もう, とても. It has no kanji
 * prerequisite, so it is teachable the moment the track opens. */
export function isKanaOnlyWord(w: VocabRow): boolean {
  return !HAN.test(w.keb);
}

/**
 * The words the track teaches, in CEJC teaching order. Computed once — it is a
 * property of source data plus the approved cadence, not of the user.
 *
 * Excludes vocab entries that are owned by the counters track so learners don't
 * see the same concept in two places: number kanji (一–万), native 〜つ counting
 * words (一つ–九つ), people-counting forms (一人, 二人), and any kanji counter
 * form in COUNTER_CURRICULUM.
 */

// Kanji counter forms — COUNTER_KANJI_GLYPHS, imported above from
// src/data/counters.ts (see its doc comment there for why it lives on the data
// module rather than here): derived from COUNTER_CURRICULUM, kana-only forms
// (ひとつ, いち …) omitted to avoid matching unrelated kana words (に, さん …).

// Counting words that are already covered by the counters track, so the words
// track does not teach them a second time.
//
// SAK-164: the Sino numbers 一…十 ARE now here, reversing an earlier call on this
// same file (see git history) that kept them out because "the counters track no
// longer ships a spoken number form, so their reading and meaning are taught by
// their WORD role here". That reasoning was checked against SAK-163 (which made
// the counters track's day/month teaching generative) and turned out to depend on
// something else entirely, unrelated to SAK-163: curriculum-order.ts's `rolesOf`
// grants the WORD role to any single-Han-character dictionary word
// (`isSingleCharWordGlyph`) REGARDLESS of CURRICULUM_WORDS membership — the exact
// mechanism that already keeps 百/千/万 fully taught (meaning AND reading, via
// their kanji item's fold) despite their own exclusion below. So removing
// 一…十 from CURRICULUM_WORDS does not drop their "二 = に = two" teaching: it still
// rides in on the kanji item the moment 二 is first needed (as a component of
// some other word, or in the counters track's own `tens` unit prereqs — see
// UNIT_KANJI in counter-lesson.ts), exactly like 百/千/万 already do. What
// excluding them here changes is bookkeeping only — they stop being counted or
// listed as their own CURRICULUM_WORDS entry — never the actual teaching.
const COUNTER_TRACK_KEBS: ReadonlySet<string> = new Set([
  // Bare Sino numbers — counters track's `tens` unit teaches these kanji as its
  // own prereqs, and (like 百/千/万 below) their word-role reading/meaning still
  // rides in on the kanji item via isSingleCharWordGlyph even though they are cut
  // from CURRICULUM_WORDS here.
  "一", "二", "三", "四", "五", "六", "七", "八", "九", "十",
  // Big base words — counters track's `big` unit teaches these with their rule.
  "百", "千", "万",
  // Native 〜つ counting words (counters track: ひとつ〜ここのつ)
  "一つ", "二つ", "三つ", "四つ", "五つ", "六つ", "七つ", "八つ", "九つ",
  // Irregular people-counting forms (counters track: ひとり, ふたり)
  "一人", "二人",
  // SAK-177: vocab.json's real 割/階/円 series — now taught generatively by
  // the counters track's wari/floor/en categories (see counters.ts's
  // COUNTER_VOCAB_DUPLICATE_KEBS for the matching Library-dedup side of this
  // same cut). Bare 円/階 (the ordinary nouns "yen"/"floor") are NOT here —
  // only the counted forms these categories generate are duplicates.
  "１割", "二割", "１階", "二階", "一円", "１０００円",
]);

// The core case/binding particles (か/は/が/に/で/を/へ/まで/だけ/しか), so the words
// track does not teach them a second time. Each is already a MEANING recipe in
// the grammar track (src/data/grammar/recipes.ts) — with, unlike here, a real
// example sentence and its role explained alongside the other patterns that use
// it — so a bare vocab card ("indicates the subject of a sentence", no context)
// is a worse copy of a lesson the grammar track already owns, not a second one
// worth keeping. までに is not excluded: it has a grammar recipe but no VOCAB
// row of its own, so there's nothing here to duplicate it.
//
// SAK-174 adds だ/です/ね/も/よ/って/と/ない for the exact same reason, once their
// own bare-form recipes shipped (da/desu/ne/yo/mo/tte/to-and/ga-nai in
// recipes.ts). Membership here is what actually keeps a word out of the live
// Vocab track — CEJC's category:"grammar"/teachingRank:null (cejc-reading-
// -frequency.json, fixed by this same ticket) only demotes a word's CEJC-
// frequency PRIORITY within CURRICULUM_WORDS, it does not exclude the word;
// orderedUnits() in lib/content/teach-unit.ts resorts by raw CEJC occurrence
// count regardless of category, so without this exclusion these 8 words (tens
// of thousands of raw occurrences each) would land at/near the TOP of the live
// Vocab track by frequency alone, category fix notwithstanding. と/ない keep
// their OTHER existing grammar coverage too (to-conditional's "whenever" と,
// nai-form's negative-verb-suffix ない) — this only removes their bare-vocab
// duplicate now that ga-nai/to-and cover the sense that was actually missing.
//
// SAK-175 adds the OTHER multi-character particles/connectives that already
// had grammar coverage BEFORE SAK-174 landed — から/ので/のに/たら/たり/ながら/
// にくい/たい/たがる/させる/らしい/かもしれない/でしょう/ませんか/ましょうか/
// ことができる/ことにする/ことになる/なければならない/なくてはならない/
// なくてはいけない/ために/おかげで/ようになる/ようにする/について/として — each
// an EXACT match against a recipe in recipes.ts (see GRAMMAR_VOCAB_DUPLICATE_
// KEBS's doc comment in src/data/grammar/index.ts for the full method: pattern
// cross-reference, then a check against word-senses.json and cejc-reading-
// frequency.json's classification, same bar SAK-174 used). Five exact matches
// were checked and deliberately KEPT here because that check found a real
// independent sense the recipe does not teach — そう, そうだ, つもり, はず, なら
// — so those five stay in CURRICULUM_WORDS untouched.
const PARTICLE_TRACK_KEBS: ReadonlySet<string> = new Set([
  "か", "は", "が", "に", "で", "を", "へ", "まで", "だけ", "しか",
  "だ", "です", "ね", "も", "よ", "って", "と", "ない",
  "から", "ので", "のに", "たら", "たり", "ながら", "にくい", "たい", "たがる",
  "させる", "らしい", "かもしれない", "でしょう", "ませんか", "ましょうか",
  "ことができる", "ことにする", "ことになる",
  "なければならない", "なくてはならない", "なくてはいけない",
  "ために", "おかげで", "ようになる", "ようにする", "について", "として",
]);

export const CURRICULUM_WORDS: readonly VocabRow[] = [...VOCAB]
  .filter(
    (w) =>
      !COUNTER_TRACK_KEBS.has(w.keb) &&
      !COUNTER_KANJI_GLYPHS.has(w.keb) &&
      !PARTICLE_TRACK_KEBS.has(w.keb),
  )
  .sort((a, b) => a.beginnerRank - b.beginnerRank);

/**
 * How many words the track teaches — the denominator on the lesson card.
 *
 * COUNTED, not copied from the last teaching rank: counter-track forms are
 * deliberately removed after the CEJC sequence is built, so the two numbers
 * make different claims.
 */
export const WORDS_CURRICULUM_TOTAL = CURRICULUM_WORDS.length;

/**
 * Is this word teachable right now? Kana-only words always are; a kanji word is
 * teachable only once EVERY one of its kanji is known. 電車 is not teachable
 * until both 電 and 車 are learned, because presenting a compound built from
 * parts you don't have is teaching a shape with nothing under it.
 *
 * NO LONGER A FILTER, AND THAT IS THE POINT. The words scheduler used to call
 * this on every candidate and step over the ones that failed. The spine places a
 * word after every kanji it is written with, so teaching the sequence in order
 * satisfies this by construction. It survives as the STATEMENT of the rule, and
 * curriculum-lesson.test.ts holds the packing to it: walk the lessons in order,
 * and every word is teachable by the time it arrives. A rule the scheduler no
 * longer has to enforce is exactly the rule worth checking.
 *
 * "Known" is `kanjiKnown`: seen, claimed, or tested, read through the one
 * definition in src/lib/kanji-known.ts. A second copy here would drift, and a
 * second copy always forgets `claims`.
 */
export function wordTeachable(w: VocabRow, history: HistoryFile): boolean {
  if (isKanaOnlyWord(w)) return true;
  return wordKanji(w.keb).every((c) => kanjiKnown(c, history));
}

/** The subject these lessons belong to. Re-exported so a caller holding a
 * lesson never has to reach into the data file to name it. */
export { VOCAB_SUBJECT };
