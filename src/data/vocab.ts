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
import wordSensesJson from "./generated/word-senses.json" with { type: "json" };
import { entryId, factId, meaningAspect, readingAspect } from "../lib/fact-id.ts";
import type { EntryId, FactId, FactInfo } from "../types/index.ts";

export const VOCAB_SUBJECT = "word";

/**
 * One reading a written form has, and what it means when it is read that way.
 *
 * 人 has three: ひと a person, じん the -ian suffix, にん the counter for people.
 * They are the same four fields the word row carries, because they are the same
 * kind of thing — a reading with a meaning, a word class and a per-kanji
 * breakdown. The word row IS its first sense; see `SENSES`.
 */
export interface WordSense {
  /** The reading, in kana. */
  readonly reb: string;
  /** English glosses for this reading, best first. */
  readonly glosses: readonly string[];
  /** JMdict part-of-speech tags for this reading. See `VocabRow.pos`. */
  readonly pos: readonly string[];
  /** Per-kanji breakdown of THIS reading. See `VocabRow.align`. */
  readonly align: readonly (readonly [string, string, string])[] | null;
}

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
  /**
   * Most-useful-first ordering for a beginner. 1 is the first word a beginner
   * should meet; the field is TOTAL and unique — every word has one, so the
   * Words Track can sort by it with no missing keys.
   *
   * NOT `newspaperBand`. That signal ranks 委員会 (committee) and 与党 (ruling
   * party) at the very front and buries 食べる — it teaches you to read a paper
   * you cannot order lunch in. `beginnerRank` blends a two-list JLPT consensus
   * (which BAND a word sits in) with OpenSubtitles conversational frequency
   * (the ORDER within a band); see scripts/ingest/beginnerrank.py.
   *
   * The ~50% of words that join neither JLPT list are the advanced/rare tail:
   * they are given ranks that sort AFTER the whole beginner curriculum, ordered
   * among themselves by subtitle frequency. So a large `beginnerRank` means
   * "not part of the beginner core", never "unknown".
   */
  readonly beginnerRank: number;
  /**
   * Every reading this written form has, primary first, with what each means.
   *
   * Never empty: a word with one reading has one sense, and `reb`, `glosses`,
   * `pos` and `align` above are a copy of `senses[0]`. So the lesson can print
   * the whole list without asking whether there is a list, and the quiz can go
   * on asking the word's own fields without knowing there are others.
   *
   * SHOWN IN FULL, DRILLED ON THE PRIMARY. 人 shows ひと, じん and にん and is
   * only ever asked ひと. That is the rule the kanji readings table already
   * follows, one level up: it lists all five of 人's readings and asks a reading
   * only inside a word that proves it.
   */
  readonly senses: readonly WordSense[];
}

/**
 * Words the app teaches that JMdict's curated commonness tags do not carry, added
 * by hand because the ingest cannot reach them.
 *
 * いらっしゃる is the one that matters and the reason this array exists: it is the
 * honorific of the three most common verbs in the language (行く / 来る / いる),
 * the first word said in any shop, and the core of the keigo track — and it is
 * simply absent from the `ichi1`/`spec1`/`spec2` cut (verified: zero hits in
 * vocab.json). A generated file cannot be hand-edited, so the word is supplied
 * here instead, in the same VocabRow shape everything downstream already reads.
 *
 * It is a KANA word (keb === reb): いらっしゃる is written in kana far more often
 * than 居らっしゃる, so it follows the same `uk` rule as これ and もう and carries
 * no reading fact. Its class is the -aru special godan (v5aru — いらっしゃいます,
 * not いらっしゃります), pinned through the descriptive pos string POS_TO_CLASS
 * reads, so the form fan conjugates it correctly. Its beginnerRank sits at the
 * very end of the tail (VOCAB.length): the dense-permutation invariant
 * (ingest.test.ts) requires 1..N with no gaps, and appending one word past the
 * old max keeps that true without renumbering 12,553 rows.
 */
const SUPPLEMENT: readonly JsonVocabRow[] = [
  {
    keb: "いらっしゃる",
    reb: "いらっしゃる",
    glosses: ["to come", "to go", "to be (honorific)"],
    pos: ["Godan verb - -aru special class", "intransitive verb"],
    newspaperBand: null,
    align: null,
    beginnerRank: (vocabJson as readonly JsonVocabRow[]).length + 1,
  },
];

/** A row as vocab.json ships it: one reading, no sense list. */
type JsonVocabRow = Omit<VocabRow, "senses">;

/**
 * The forms JMdict files under more than one reading, cut by the same ingest
 * (scripts/ingest/build.py, the `dump("word-senses.json", …)` block) and joined
 * on here.
 *
 * WHY THE JOIN HAPPENS AT LOAD AND NOT IN vocab.json
 * ==================================================
 * The merge belongs to the ingest and now lives there, but vocab.json cannot be
 * re-cut to carry its result. Its `beginnerRank` was computed from JMdict as it
 * stood when the file was cut, and that number orders the ENTIRE curriculum
 * (curriculum-order.ts). Rebuilding it from today's dictionary would move ranks
 * for reasons that have nothing to do with senses — the dictionary has drifted,
 * and 37 of the shipped forms are no longer in the cut at all. So the sense
 * lists ship beside the ranks instead of inside them, and every word keeps the
 * position it has.
 *
 * A form listed here takes its primary from `senses[0]`, which is how 人 stops
 * being taught as a suffix. The rank stays whatever vocab.json says. When
 * vocab.json is next re-cut the two agree by construction, and ranks for these
 * 117 forms will move once, deliberately, because a rank computed from ひと is
 * not the rank of じん.
 */
// Through `unknown` because the JSON import types each `align` row as string[]
// and `WordSense` says what it really is, a 3-tuple. Same widening vocab.json's
// own rows carry; the ingest is what guarantees the arity.
const SENSES = wordSensesJson as unknown as Readonly<Record<string, readonly WordSense[]>>;

function withSenses(row: JsonVocabRow): VocabRow {
  const senses = SENSES[row.keb];
  if (!senses?.length) {
    const { reb, glosses, pos, align } = row;
    return { ...row, senses: [{ reb, glosses, pos, align }] };
  }
  const primary = senses[0];
  return {
    ...row,
    reb: primary.reb,
    glosses: primary.glosses,
    pos: primary.pos,
    align: primary.align,
    senses,
  };
}

export const VOCAB: readonly VocabRow[] = [
  ...(vocabJson as readonly JsonVocabRow[]),
  ...SUPPLEMENT,
].map(withSenses);

const BY_KEB: ReadonlyMap<string, VocabRow> = new Map(VOCAB.map((w) => [w.keb, w]));

export function vocabRow(keb: string): VocabRow | undefined {
  return BY_KEB.get(keb);
}

export function wordEntry(keb: string): EntryId {
  return entryId(VOCAB_SUBJECT, keb);
}

/** The PRIMARY reading's fact (the first reading-unit). Unqualified, so every
 * consumer that means "the word's reading" keeps working. */
export function wordReadingFactId(keb: string): FactId {
  return factId(wordEntry(keb), "reading");
}

export function wordMeaningFactId(keb: string): FactId {
  return factId(wordEntry(keb), "meaning");
}

/** A NON-primary reading-unit's fact, qualified by its reading (日's か-unit is
 * `word:日/reading@か`). The primary unit uses the bare functions above. */
export function wordUnitReadingFactId(keb: string, reb: string): FactId {
  return factId(wordEntry(keb), readingAspect(reb));
}

export function wordUnitMeaningFactId(keb: string, reb: string): FactId {
  return factId(wordEntry(keb), meaningAspect(reb));
}

/** A word written in kana is its own reading: keb === reb. これ, とても, もう. */
export function isKanaWord(w: VocabRow): boolean {
  return w.keb === w.reb;
}

/**
 * One READING of a word, with every meaning it carries when read that way.
 *
 * The unit the quiz asks and difficulty counts. JMdict senses repeat a reading
 * — あの is "that" AND "well/um", both read あの — so raw senses are the wrong
 * grain: "read あの, mean what?" would have two unrelated answers. Grouping by
 * reading fixes it: one reading is one thing to learn, its meaning the union of
 * every sense read that way. A word with one reading has one unit; 日 has two
 * (ひ = day, か = a day-counter), each its own scored skill.
 */
export interface ReadingUnit {
  readonly reb: string;
  readonly glosses: readonly string[];
}

export function readingUnits(w: VocabRow): ReadingUnit[] {
  const order: string[] = [];
  const byReb = new Map<string, string[]>();
  for (const s of w.senses) {
    let gl = byReb.get(s.reb);
    if (!gl) {
      gl = [];
      byReb.set(s.reb, gl);
      order.push(s.reb);
    }
    for (const g of s.glosses) if (!gl.includes(g)) gl.push(g);
  }
  return order.map((reb) => ({ reb, glosses: byReb.get(reb)! }));
}

/** One reading-unit of a word paired with the fact ids it mints. `reading` is
 * null for a kana word, whose reading IS the shown word and so carries no reading
 * fact (see `buildVocabFacts`). */
export interface WordUnitFacts {
  readonly unit: ReadingUnit;
  readonly reading: FactId | null;
  readonly meaning: FactId;
}

/**
 * Every reading-unit of a word, primary first, each paired with its reading and
 * meaning fact ids — the PRIMARY unit's unqualified ids, the rest qualified by
 * their reading (日's にち-unit → `word:日/meaning@にち`), exactly as
 * `buildVocabFacts` mints them.
 *
 * The ONE enumeration of a word's facts. `buildVocabFacts` (which builds the
 * registry), the lesson walk (`factsOf`) and the Library all read it, so none of
 * them can drift about which facts a word teaches or how their ids are keyed.
 * Empty for a keb the vocabulary does not carry.
 */
export function wordUnitFacts(keb: string): WordUnitFacts[] {
  const row = vocabRow(keb);
  if (!row) return [];
  const kana = isKanaWord(row);
  return readingUnits(row).map((unit, i) => {
    const primary = i === 0;
    return {
      unit,
      reading: kana
        ? null
        : primary
          ? wordReadingFactId(keb)
          : wordUnitReadingFactId(keb, unit.reb),
      meaning: primary
        ? wordMeaningFactId(keb)
        : wordUnitMeaningFactId(keb, unit.reb),
    };
  });
}

/**
 * Every fact a word mints, in mint order: per reading-unit (primary first) its
 * reading fact (unless the word is kana) then its meaning fact. Derived from
 * `wordUnitFacts`, so it is the SAME SET the registry holds for the word.
 */
export function wordFactIds(keb: string): FactId[] {
  const out: FactId[] = [];
  for (const u of wordUnitFacts(keb)) {
    if (u.reading) out.push(u.reading);
    out.push(u.meaning);
  }
  return out;
}

/** fact id → the reading-unit it asks about (both its reading and meaning fact
 * map here). The question layer reads the OTHER half off this: a reading card
 * shows the meaning as context, a meaning card shows the reading. Keeps the
 * question from parsing the id or re-deriving the grouping. */
const READING_UNIT_OF = new Map<FactId, { keb: string; unit: ReadingUnit }>();

/** The reading-unit a word fact asks about — its reading (`reb`) and the union
 * of meanings read that way — or null for a non-word fact. */
export function wordReadingUnit(
  fact: FactId,
): { keb: string; unit: ReadingUnit } | null {
  return READING_UNIT_OF.get(fact) ?? null;
}

/**
 * Every word READING fact, primary AND qualified — the membership set that
 * answers "is this fact a word's reading (vs its meaning)?" without parsing the
 * id. Built in `buildVocabFacts` right beside `READING_UNIT_OF`, as each reading
 * fact is minted.
 *
 * The one honest discriminator: `wordReadingFactId(keb)` only ever names the
 * PRIMARY unit's unqualified id, so testing `wordReadingFactId(glyph) === fact`
 * mis-classifies a qualified reading fact (`word:日/reading@にち`) as a meaning
 * fact. Consumers that mean "which KIND of fact is this" must use this instead.
 */
const WORD_READING_FACTS = new Set<FactId>();

/** Whether `fact` is a word's READING fact — primary or qualified. A word
 * MEANING fact is false; so is any non-word fact. Membership, never parsing. */
export function isWordReadingFact(fact: FactId): boolean {
  return WORD_READING_FACTS.has(fact);
}

/**
 * Every vocabulary fact: 23,171 in all — 10,522 readings + 12,649 meanings.
 *
 * COUNTED PER READING-UNIT, NOT PER WORD
 * ======================================
 * The grain is the reading-unit (see `readingUnits`), not the word: a word mints
 * one meaning fact and (unless it is kana) one reading fact for EACH way it is
 * read. So the meaning count, 12,649, is the number of reading-units across the
 * vocabulary, not the 12,554 rows — 日 alone contributes two (ひ = day, か = a
 * day-counter) and 人 three (ひと, じん, にん), each its own scored skill. じん and
 * にん are graded now, as qualified facts (`word:人/reading@じん`); they are no
 * longer merely shown. This is why meaning facts outnumber words.
 *
 * WHY READINGS ARE FEWER THAN MEANINGS
 * ------------------------------------
 * Every reading-unit carries a meaning fact, so meanings equal reading-units
 * exactly. Readings fall short by 2,127: a KANA WORD HAS NO READING FACT. "What
 * is これ read as?" has the answer これ printed in the question — it is not a
 * question, and grading it teaches nothing. これ still carries its MEANING fact
 * ("this one"), which is the thing a learner actually has to know. This is the
 * same rule as the jukujikun `align === null` case: emit the fact that can be
 * graded, and decline to invent the one that cannot.
 *
 * A word's reading fact is unqualified on its primary reading-unit and qualified
 * on the rest — unlike a kanji, which mints no unqualified reading fact at all.
 * That asymmetry is the model working: "what is 先生 read as" has exactly one
 * answer, so it can be graded, while "what is 生 read as" has nine and cannot.
 */
export const VOCAB_FACTS: FactInfo[] = buildVocabFacts();

function buildVocabFacts(): FactInfo[] {
  const facts: FactInfo[] = [];
  for (const w of VOCAB) {
    // The single enumeration `factsOf` and the Library also walk, so the registry
    // cannot mint a fact those two never teach, nor miss one they do.
    for (const { unit, reading, meaning } of wordUnitFacts(w.keb)) {
      const def = unit.glosses[0] ?? null;
      // The READING fact — asked "kanji + meaning → reading". Absent (null) for a
      // kana word, whose reading IS the shown word (これ read as? — これ is printed).
      if (reading) {
        READING_UNIT_OF.set(reading, { keb: w.keb, unit });
        WORD_READING_FACTS.add(reading);
        facts.push({
          id: reading,
          entry: wordEntry(w.keb),
          glyph: w.keb,
          answers: [unit.reb],
          subject: VOCAB_SUBJECT,
          meaning: def,
        });
      }
      // The MEANING fact — asked "kanji + reading → meaning", accepting any of the
      // meanings read that way.
      READING_UNIT_OF.set(meaning, { keb: w.keb, unit });
      facts.push({
        id: meaning,
        entry: wordEntry(w.keb),
        glyph: w.keb,
        answers: unit.glosses,
        subject: VOCAB_SUBJECT,
        meaning: def,
      });
    }
  }
  return facts;
}
