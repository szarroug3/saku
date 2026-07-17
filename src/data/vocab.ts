// The vocabulary subject: 12,553 everyday words from JMdict.
//
// WHICH WORDS, AND WHY NOT ALL 190,000
// ====================================
// JMdict has ~190k entries. This takes the union of its HAND-CURATED
// commonness tags — `ichi1`, `spec1`, `spec2` — written entirely in jōyō
// kanji, or in kana. Two reasons, and neither is about file size:
//
//  - Those tags are hand-curated everyday vocabulary. They are not the
//    newspaper `freq` rank, and the difference is the whole point: `freq`'s
//    top band holds 安保 (the security treaty), 委員会 and 欧州, while 食べる
//    sits in band 25 (~12,000th) and 人 has no rank at all.
//  - All-jōyō is what makes parts-first honest. A word with a non-jōyō kanji
//    can never be built from taught components, so it could only ever be
//    presented as a whole-word memorisation, which is the thing the component
//    graph exists to avoid.
//
// A UNION, NOT AN INTERSECTION — and it is not `ichi1` alone
// ---------------------------------------------------------
// These tags are separate SOURCES, not axes to intersect. `news1` ⟺ nf01–24
// and `news2` ⟺ nf25–48 are the same newspaper corpus, strictly nested;
// intersecting them narrows nothing. `ichi1` is an independent hand-curated
// list (25.2% of it carries no nf band at all). `spec1`/`spec2` are a separate
// editorial judgement — "common no matter what the corpus says".
//
// 日本 is the proof. It is `spec1` + `news2`/`nf25` and carries NO `ichi1`, so
// a filter on `ichi1` drops 日本 — and this comment used to cite 日本 as an
// example of a word that filter kept. It never did. JMdict's editors reaching
// for `spec1` is them overriding the corpus, and taking only `ichi1` threw
// that judgement away.
//
// `news1`/`nfXX` is deliberately NOT in the union: "common in a newspaper" is
// not "common for a beginner", and no filter can fix that — it is a property
// of the corpus. Admitting news1 would add ~6,200 words and is a product
// decision, not a bug fix.
//
// The remaining ~178k words are not lost — they are in the dictionary, and
// re-cutting this file is one flag in scripts/ingest/build.py. They are simply
// not everyday words, and a beginner quiz that can serve 錻 has a scope bug,
// not a feature.

import vocabJson from "./generated/vocab.json" with { type: "json" };
import { entryId, factId } from "../lib/fact-id.ts";
import type { EntryId, FactId, FactInfo } from "../types/index.ts";

export const VOCAB_SUBJECT = "word";

/** One everyday word. */
export interface VocabRow {
  /**
   * The written form. 先生.
   *
   * For a word JMdict marks `uk` ("usually written using kana alone") or that
   * has no kanji spelling at all, this is the KANA form and `keb === reb`:
   * これ, とても, もう. That is the word as it is actually written — これ has
   * eight kanji spellings (此れ, 是, 之 …) and nobody writes any of them.
   * `isKana` is exactly this equality; see `buildVocabFacts`.
   */
  readonly keb: string;
  /** Its reading, in kana. せんせい. For a kana word, identical to `keb`. */
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
   * from the same corpus, strictly nested (verified against JMdict: zero
   * entries violate it). Filtering on both is redundant, not an intersection.
   * (`ichi1` is a genuinely independent signal, and 25.2% of it carries no
   * band at all — which is exactly the everyday vocabulary a newspaper corpus
   * is worst at seeing.)
   *
   * null for most kana words: これ is `ichi1` with no band, because a
   * newspaper corpus is precisely what cannot see it.
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

/** A word written in kana is its own reading: keb === reb. これ, とても, もう. */
export function isKanaWord(w: VocabRow): boolean {
  return w.keb === w.reb;
}

/**
 * Every vocabulary fact: 10,427 readings + 12,553 meanings.
 *
 * A word has ONE reading fact, unqualified — unlike a kanji, which never does.
 * That asymmetry is the model working, not an inconsistency: "what is 先生
 * read as" has exactly one answer, so it can be graded, while "what is 生 read
 * as" has nine and cannot.
 *
 * A KANA WORD HAS NO READING FACT, which is why the two counts differ. "What
 * is これ read as?" has the answer これ printed in the question — it is not a
 * question, and grading it teaches nothing. これ still carries its MEANING
 * fact ("this one"), which is the thing a learner actually has to know. This
 * is the same rule as the jukujikun `align === null` case: emit the fact that
 * can be graded, and decline to invent the one that cannot.
 */
export const VOCAB_FACTS: FactInfo[] = buildVocabFacts();

function buildVocabFacts(): FactInfo[] {
  const facts: FactInfo[] = [];
  for (const w of VOCAB) {
    const meaning = w.glosses[0] ?? null;
    if (!isKanaWord(w)) {
      facts.push({
        id: wordReadingFactId(w.keb),
        entry: wordEntry(w.keb),
        glyph: w.keb,
        answers: [w.reb],
        subject: VOCAB_SUBJECT,
        meaning,
      });
    }
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
