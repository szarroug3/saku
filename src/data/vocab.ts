// The vocabulary subject: 8,045 everyday words from JMdict.
//
// WHICH WORDS, AND WHY NOT ALL 190,000
// ====================================
// JMdict has ~190k entries. This takes the ones tagged `ichi1` — the
// hand-curated common list — that are written entirely in jōyō kanji. Two
// reasons, and neither is about file size:
//
//  - `ichi1` is a HAND-CURATED list of everyday words. It is not the newspaper
//    `freq` rank, and the difference is the whole point: `freq`'s top band
//    holds 安保 (the security treaty), 委員会 and 欧州, while 食べる sits in
//    band 25 (~12,000th) and 人 has no rank at all. JMdict's own editors tagged
//    日本 `spec1` — a manual override meaning "common no matter what the corpus
//    says" — which tells you they knew the corpus was wrong. A quiz seeded from
//    `freq` teaches you to read a newspaper you cannot order lunch in.
//  - All-jōyō is what makes parts-first honest. A word with a non-jōyō kanji
//    can never be built from taught components, so it could only ever be
//    presented as a whole-word memorisation, which is the thing the component
//    graph exists to avoid.
//
// The remaining ~182k words are not lost — they are in the dictionary, and
// re-cutting this file is one flag in scripts/ingest/build.py. They are simply
// not everyday words, and a beginner quiz that can serve 錻 has a scope bug,
// not a feature.

import vocabJson from "./generated/vocab.json" with { type: "json" };
import { entryId, factId } from "../lib/fact-id.ts";
import type { EntryId, FactId, FactInfo } from "../types/index.ts";

export const VOCAB_SUBJECT = "word";

/** One everyday word. */
export interface VocabRow {
  /** The written form. 先生. */
  readonly keb: string;
  /** Its reading, in kana. せんせい. */
  readonly reb: string;
  /** English glosses of the first sense, best first. */
  readonly glosses: readonly string[];
  /**
   * JMdict part-of-speech tags.
   *
   * `vs` IS NOT A VERB. It is the most common tag on this list and it marks a
   * NOUN that takes する: 勉強 is `n`+`vs`, and not one of the 14,354 `vs`
   * entries carries a conjugation class, because there is nothing to conjugate
   * — you conjugate する, not 勉強. Anything that reads `vs` as "this is a verb"
   * and looks for a class finds nothing and is wrong twice: 勉強 is not a verb,
   * and 勉強して is still a form the user will meet on day one. Dropping `vs`
   * entries to dodge this makes 勉強して unresolvable and deletes する-nouns
   * from a beginner's vocabulary, which is most of it. See `conjugateSuruNoun`.
   */
  readonly pos: readonly string[];
  /**
   * JMdict's `nf` band, 1–48, or null.
   *
   * NEWSPAPER band, and named that way for the same reason as KanjiRow's rank.
   * Note it is NOT independent of the `news1`/`news2` tags it ships beside:
   * `news1` means nf01–24 and `news2` means nf25–48 — the same 12,000 words
   * from the same corpus, strictly nested. Filtering on both is redundant, not
   * an intersection. (`ichi1` is the genuinely independent signal, and 17% of
   * it carries no band at all — which is exactly the everyday vocabulary a
   * newspaper corpus is worst at seeing.)
   */
  readonly newspaperBand: number | null;
  /**
   * Per-kanji reading breakdown: [kanji, surface-in-this-word, base reading].
   *
   * null when the word CANNOT be aligned — 2.6% of these, and they are the
   * jukujikun: 大人/おとな, 為替/かわせ, お母さん/おかあさん. There is no
   * per-kanji reading to teach in 大人; おとな belongs to the word, not to 大
   * and 人. So the word keeps its own facts and contributes no kanji evidence,
   * and that is the correct outcome rather than a gap: a made-up per-kanji
   * split would be a fact that cannot be graded, which is the one thing this
   * model exists to prevent.
   */
  readonly align: readonly (readonly [string, string, string])[] | null;
}

export const VOCAB: readonly VocabRow[] = vocabJson as readonly VocabRow[];

const BY_KEB: ReadonlyMap<string, VocabRow> = new Map(VOCAB.map((w) => [w.keb, w]));

export function vocabRow(keb: string): VocabRow | undefined {
  return BY_KEB.get(keb);
}

export function wordEntry(keb: string): EntryId {
  return entryId(VOCAB_SUBJECT, keb);
}

export function wordReadingFactId(keb: string): FactId {
  return factId(wordEntry(keb), "reading");
}

export function wordMeaningFactId(keb: string): FactId {
  return factId(wordEntry(keb), "meaning");
}

/**
 * Every vocabulary fact: 8,045 readings + 8,045 meanings.
 *
 * A word has ONE reading fact, unqualified — unlike a kanji, which never does.
 * That asymmetry is the model working, not an inconsistency: "what is 先生
 * read as" has exactly one answer, so it can be graded, while "what is 生 read
 * as" has nine and cannot.
 */
export const VOCAB_FACTS: FactInfo[] = buildVocabFacts();

function buildVocabFacts(): FactInfo[] {
  const facts: FactInfo[] = [];
  for (const w of VOCAB) {
    const meaning = w.glosses[0] ?? null;
    facts.push({
      id: wordReadingFactId(w.keb),
      entry: wordEntry(w.keb),
      glyph: w.keb,
      answers: [w.reb],
      subject: VOCAB_SUBJECT,
      meaning,
    });
    facts.push({
      id: wordMeaningFactId(w.keb),
      entry: wordEntry(w.keb),
      glyph: w.keb,
      answers: w.glosses,
      subject: VOCAB_SUBJECT,
      meaning,
    });
  }
  return facts;
}
