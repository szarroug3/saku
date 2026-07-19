// The kanji subject: 2,136 jōyō kanji from KANJIDIC2, plus the reading facts
// that everyday vocabulary proves.
//
// WHY THE DATA IS GENERATED JSON AND NOT A TS TABLE
// =================================================
// Hand-authored data belongs in a TS table (see LOOKALIKE_KANJI in
// src/data/confusable.ts) — comments, compile-time checking, no build step.
// This is not hand-authored. It is 2,136 kanji and 8,045 words derived from
// 78MB of dictionaries by scripts/ingest/build.py, and nobody will ever edit it
// by hand; a diff here means the ingest changed. So it ships as JSON:
//
//   - The JSON is COMMITTED. `pnpm dev` and `pnpm build` read it straight off
//     disk with no generation step, no dep, and no 78MB of sources in the repo.
//     Git is the sync, and 2.7MB of it costs nothing that matters here.
//   - Regenerating is explicit (`python3 scripts/ingest/build.py --src …`), so
//     the dictionaries can be re-cut on an EDRDG release without anything
//     silently drifting under a normal build.
//   - `resolveJsonModule` was already on, so the import is typed at the edge
//     (see the `as` casts below, the one place the JSON's shape is asserted).
//
// WHAT A KANJI FACT IS
// ====================
// One meaning fact, and one reading fact PER DISTINCT READING — 生 has 9, not
// one and not fifty. The reading is keyed on (kanji, word), because "what is
// the reading of 生" has nine answers and cannot be graded, while "what is 生
// read as in 人生" has exactly one. That is the whole reason entries and facts
// are different things.
//
// The anchor word is not decoration: it is what makes the fact askable, and it
// is the join to the vocabulary subject. 人生 is a word entry AND the evidence
// for 生's セイ reading — the same card pays both debts. Nothing here treats
// kanji and vocabulary as separate material; they are separate SUBJECTS only in
// the sense that they publish two arrays.

import kanjiJson from "./generated/kanji.json" with { type: "json" };
import orderJson from "./generated/order.json" with { type: "json" };
import readingsJson from "./generated/readings.json" with { type: "json" };
import { entryId, factId, readingAspect } from "../lib/fact-id.ts";
import type { EntryId, FactId, FactInfo, NewKanjiOrder } from "../types/index.ts";

export const KANJI_SUBJECT = "kanji";

/** One jōyō kanji, as KANJIDIC2 has it. */
export interface KanjiRow {
  readonly c: string;
  readonly meanings: readonly string[];
  /** Jōyō school grade: 1–6 or 8. THERE IS NO GRADE 7 — jōyō is grades 1–6
   * plus 8, exactly 2,136 kanji. Anything iterating 1..9 invents a grade. */
  readonly grade: number;
  readonly strokes: number;
  /**
   * KANJIDIC2's frequency rank, 1–2,501 (the DTD says 2,500 and is off by
   * one), or null for the ~10,600 unranked.
   *
   * NEWSPAPER frequency, and named that way on purpose. It is a survey of
   * newspaper corpora, it is NOT "most common", and it must never be shown to a
   * user under that word. Its own top band contains 安保 (the security treaty)
   * while 人 — the single most useful kanji there is — ranks 5 here but its
   * WORD 人 carries no newspaper band at all. This is a different corpus from
   * the band on VocabRow, and the two do not compare.
   */
  readonly newspaperFreq: number | null;
  /** KRADFILE decomposition. Components are not all kanji: ｜, ノ, ハ, マ, ユ,
   * ヨ are radical primitives with no KANJIDIC2 entry at all. */
  readonly comps: readonly string[];
}

/** One reading of one kanji, and the everyday word that proves it. */
export interface ReadingRow {
  readonly k: string;
  /** The KANJIDIC2 reading, in hiragana. Rendaku and gemination are folded in
   * here: 口 has TWO readings (くち, こう), not three — 出口's ぐち is くち
   * voiced, and scoring it apart would split one piece of knowledge in two. */
  readonly base: string;
  /** The word this fact asks in. */
  readonly anchor: string;
  /** How `base` actually surfaces in `anchor` — usually identical, since the
   * anchor is chosen to be an unvoiced example where one exists. */
  readonly surface: string;
  /** How many everyday words attest this reading. Evidence weight, not a score. */
  readonly nWords: number;
  readonly words: readonly string[];
  /**
   * KANJIDIC2's `r_type` for this reading, folded onto the normalised base.
   *
   * "on"   — on'yomi: a pronunciation borrowed from Chinese when the character
   *          was. Turns up mostly inside compound words (一年 いちねん).
   * "kun"  — kun'yomi: the native Japanese word the character was assigned to.
   *          Usually the character standing alone (一つ ひとつ).
   * "both" — KANJIDIC2 lists this same reading under BOTH types, for different
   *          senses. 20 of 3,496 facts. It is not a tie to break: picking one
   *          would state something the dictionary does not.
   *
   * This is THE answer to "why do いち and ひと sound nothing alike" — they are
   * two different languages' worth of pronunciation wearing one character. No
   * screen may print the words "on'yomi"/"kun'yomi" at a beginner; see the
   * entry page for the wording that ships.
   *
   * Optional because a base the aligner derived is occasionally not one
   * KANJIDIC2 lists verbatim. Zero rows are untyped as shipped; the field stays
   * optional so a future re-cut cannot make the JSON un-loadable.
   */
  readonly type?: "on" | "kun" | "both";
}

/** One item of the default teaching order. */
export interface OrderRow {
  readonly c: string;
  /** 0-based position in `ramp B`. */
  readonly i: number;
  /**
   * Why this kanji is here at all.
   *
   * "merit"  — picked for its own everyday-word utility.
   * "prereq" — dragged in by `pulledFor`'s parts-first closure.
   *
   * READ THIS WITH `everydayWords`, NEVER ALONE. "prereq" does NOT mean "not a
   * lesson": 100 items enter this way and 91 of them are ordinary lessons that
   * a later kanji merely happened to reach first — 口 (31 everyday words) and
   * 目 (44) are both "prereq". Only the 9 items that are BOTH "prereq" AND
   * `everydayWords === 0` are parts rather than lessons; `PREREQUISITE_ONLY`
   * below is that set, already computed. Use it instead of re-deriving.
   */
  readonly enteredVia: "merit" | "prereq";
  /** The kanji whose closure pulled this one in, for "you need this for 気". */
  readonly pulledFor: string | null;
  /** Distinct everyday words containing this kanji. The honest utility number. */
  readonly everydayWords: number;
  /**
   * Strokes this item introduces that no earlier item did, CHARGING EVERY
   * COMPONENT — jōyō or not.
   *
   * The predecessor of this number only charged components that were themselves
   * jōyō kanji, which quietly made every non-jōyō primitive free and let the
   * old order claim "100% buildable" while teaching 無 (= ｜ノ一杰乞) before
   * anything had paid for 杰, an 8-stroke non-jōyō primitive. Here 杰 is
   * charged to 点 at item 123, which is the first item that actually contains
   * it, and 無 arrives at 152 owing nothing.
   */
  readonly novelStrokes: number;
}

/**
 * KANJIDIC2 files a character's RADICAL INDEX as if it were an English
 * meaning: 一 is `["one", "one radical (no.1)"]` and 二 is `["two", "two
 * radical (no. 7)"]`. That is catalogue metadata about the Kangxi radical
 * table, not what the character means, and 19 of the shipped 2,136 jōyō rows
 * carry one.
 *
 * It is a CORRECTNESS bug, not a cosmetic one. Every consumer reads `meanings`:
 * it became an accepted answer and a multiple-choice distractor in
 * src/lib/engine/question.ts, and the page title of the Library entry. So it is
 * stripped HERE, at the one place the JSON is turned into the app's data, and
 * every consumer benefits without knowing this happened.
 *
 * THE PATTERN IS THE NUMBER, NOT THE WORD "RADICAL". 基 genuinely means
 * "radical (chem)" — a chemical radical — and 偏 genuinely means "left-side
 * radical". Matching the word would delete correct meanings; only the numbered
 * `radical (no. N)` form is metadata. scripts/ingest/readingtype.py holds the
 * same regex for a full re-cut, and src/data/ingest.test.ts pins both halves.
 */
export const RADICAL_INDEX_MEANING = /\bradical\s*\(no\.\s*\d+\s*\)/i;

export const KANJI: readonly KanjiRow[] = (kanjiJson as readonly KanjiRow[]).map(
  (k) =>
    k.meanings.some((m) => RADICAL_INDEX_MEANING.test(m))
      ? { ...k, meanings: k.meanings.filter((m) => !RADICAL_INDEX_MEANING.test(m)) }
      : k,
);
export const READINGS: readonly ReadingRow[] = readingsJson as readonly ReadingRow[];

/**
 * The default teaching order: `ramp B`.
 *
 * Everyday-word utility seeded from JMdict's `ichi1` — the hand-curated common
 * list, NOT the newspaper `freq` rank — with strict parts-first over jōyō and a
 * stroke ceiling (≤6 for items 1–30, ≤8 to 80, ≤10 to 150, ≤12 to 300, then
 * free). It reads 701 of 8,045 everyday words at 100 items against 704 for the
 * same build with no ceiling: the ceiling costs three words and caps item 40 at
 * 8 strokes instead of 12. It beats school-grade order on both axes at once.
 *
 * scripts/ingest/build.py asserts the first 40 against the published sequence,
 * so this cannot drift silently.
 */
export const KANJI_ORDER: readonly OrderRow[] = orderJson as readonly OrderRow[];

const BY_CHAR: ReadonlyMap<string, KanjiRow> = new Map(KANJI.map((k) => [k.c, k]));
const ORDER_BY_CHAR: ReadonlyMap<string, OrderRow> = new Map(
  KANJI_ORDER.map((o) => [o.c, o]),
);

/** A kanji's KANJIDIC2 row. */
export function kanjiRow(c: string): KanjiRow | undefined {
  return BY_CHAR.get(c);
}

/** Where a kanji sits in the default order, and why. */
export function orderRow(c: string): OrderRow | undefined {
  return ORDER_BY_CHAR.get(c);
}

/**
 * The 9 items that are genuinely parts and not lessons: pulled in by a
 * successor's closure AND appearing in no everyday word at all.
 *
 * 乙 is item 6 only because 気 needs it. A UI may say so — "this is a part you
 * need for what's next" — and should, because presenting 乙 as a lesson is a
 * small lie the user will notice.
 *
 * It is a shorter list than it looks like it should be. 乞 (1 everyday word),
 * 弓 (1) and 尚 (2) are also closure-pulled and also nearly useless on their
 * own, but "nearly" is not "not", and a card that unlocks one real word is a
 * lesson. The cut is at zero on purpose; move it and you start calling real
 * words parts.
 */
export const PREREQUISITE_ONLY: readonly string[] = KANJI_ORDER.filter(
  (o) => o.enteredVia === "prereq" && o.everydayWords === 0,
).map((o) => o.c);

/**
 * The queue of kanji, in the order the user asked for — all 2,136, every mode.
 *
 * A TOTAL ORDER IN ALL THREE CASES, and the tie-breaks are why this is a
 * function and not three `.sort()` calls at three call sites. `grade` puts 1,026
 * kanji in grades 1–6 and 1,110 in grade 8; `newspaperFreq` is null for every
 * kanji outside KANJIDIC2's 2,501-strong survey. Sorting on either alone leaves
 * hundreds of items in whatever order the JSON happened to be written in, which
 * is a stable-looking sequence that is nobody's curriculum. Every mode below
 * falls through to the character itself, so the queue is reproducible.
 *
 * NOTHING HERE IS "MOST COMMON", AND `newspaper` LEAST OF ALL. KanjiRow's own
 * comment holds the receipts; the short version is that its top band carries 安保
 * (the security treaty) and 食べる is not the kind of word it counts. The label
 * on screen says newspaper, because that is what was measured.
 */
export function kanjiTeachOrder(mode: NewKanjiOrder): readonly string[] {
  switch (mode) {
    // Already sequenced, and expensively — parts-first closure plus a decaying
    // stroke ceiling, asserted against a published prefix by the ingest. Read
    // it; never re-derive it.
    case "everyday":
      return EVERYDAY_ORDER;
    case "grade":
      return GRADE_ORDER;
    case "newspaper":
      return NEWSPAPER_ORDER;
  }
}

/** Unranked in the newspaper survey — ~10,600 kanji, 99 of them jōyō. Sorts
 * last rather than first, which sorting on `null` numerically would do. */
const UNRANKED = Number.MAX_SAFE_INTEGER;

const EVERYDAY_ORDER: readonly string[] = KANJI_ORDER.map((o) => o.c);

const GRADE_ORDER: readonly string[] = [...KANJI]
  .sort(
    (a, b) =>
      a.grade - b.grade ||
      (a.newspaperFreq ?? UNRANKED) - (b.newspaperFreq ?? UNRANKED) ||
      (a.c < b.c ? -1 : a.c > b.c ? 1 : 0),
  )
  .map((k) => k.c);

const NEWSPAPER_ORDER: readonly string[] = [...KANJI]
  .sort(
    (a, b) =>
      (a.newspaperFreq ?? UNRANKED) - (b.newspaperFreq ?? UNRANKED) ||
      a.grade - b.grade ||
      (a.c < b.c ? -1 : a.c > b.c ? 1 : 0),
  )
  .map((k) => k.c);

/** Reading facts of one kanji, richest evidence first. Subject-local: FactInfo
 * is deliberately thin, so the anchor word lives here and is read by the kanji
 * screens, exactly as CHAR_INDEX carries kana's rows. */
export const READING_INDEX: ReadonlyMap<FactId, ReadingRow> = new Map(
  READINGS.map((r) => [readingFactId(r.k, r.anchor), r]),
);

export function kanjiEntry(c: string): EntryId {
  return entryId(KANJI_SUBJECT, c);
}

export function meaningFactId(c: string): FactId {
  return factId(kanjiEntry(c), "meaning");
}

export function readingFactId(c: string, inWord: string): FactId {
  return factId(kanjiEntry(c), readingAspect(inWord));
}

/** Every kanji fact: 2,136 meanings + 3,178 readings. */
export const KANJI_FACTS: FactInfo[] = buildKanjiFacts();

function buildKanjiFacts(): FactInfo[] {
  const facts: FactInfo[] = [];
  for (const k of KANJI) {
    facts.push({
      id: meaningFactId(k.c),
      entry: kanjiEntry(k.c),
      glyph: k.c,
      answers: k.meanings,
      subject: KANJI_SUBJECT,
      meaning: k.meanings[0] ?? null,
    });
  }
  for (const r of READINGS) {
    const k = BY_CHAR.get(r.k);
    if (!k) continue;
    facts.push({
      id: readingFactId(r.k, r.anchor),
      entry: kanjiEntry(r.k),
      glyph: r.k,
      // The answer is how the reading SURFACES in the anchor word — 口 in 出口
      // is ぐち, and marking ぐち wrong there would be marking Japanese wrong.
      answers: r.surface === r.base ? [r.surface] : [r.surface, r.base],
      subject: KANJI_SUBJECT,
      meaning: k.meanings[0] ?? null,
    });
  }
  return facts;
}
