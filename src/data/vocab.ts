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
import cejcReadingFrequencyJson from "./generated/cejc-reading-frequency.json" with { type: "json" };
import numberWordAlternatesJson from "./number-word-alternates.json" with { type: "json" };
import wordDefinitionsJson from "./generated/word-definitions.json" with { type: "json" };
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
  /** Stable identity of the meaning this reading expresses. Several readings
   * may share it; several English glosses inside it are synonyms, not separate
   * definitions. Never inferred by comparing English strings. */
  readonly definitionId: string;
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
   * The curriculum head comes from CEJC lexical frequency and part of speech:
   * core vocabulary and conversational essentials receive the generated
   * teaching sequence, while grammar, fillers and unobserved reference words
   * follow outside the word track. JLPT/OpenSubtitles survive only as the
   * deterministic fallback order for that unscheduled Library tail.
   */
  readonly beginnerRank: number;
  /**
   * Every reading this written form has, in frozen source order, with what each
   * means. Runtime teaching order comes only from CEJC.
   *
   * Never empty. The row-level fields describe CEJC's first teachable reading;
   * this list retains every source reading-to-sense relationship.
   */
  readonly senses: readonly WordSense[];
}

/**
 * Words the app teaches that JMdict's curated commonness tags do not carry, added
 * by hand because the ingest cannot reach them.
 *
 * えっ supplies the approved fifth bootstrap response, absent from the frozen
 * vocabulary cut. いらっしゃる is the other reason this array exists: it is the
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
    keb: "えっ",
    reb: "えっ",
    glosses: ["huh?", "what?"],
    pos: ["interjection (kandoushi)"],
    newspaperBand: null,
    align: null,
    beginnerRank: (vocabJson as readonly JsonVocabRow[]).length + 1,
  },
  {
    keb: "いらっしゃる",
    reb: "いらっしゃる",
    glosses: ["to come", "to go", "to be (honorific)"],
    pos: ["Godan verb - -aru special class", "intransitive verb"],
    newspaperBand: null,
    align: null,
    beginnerRank: (vocabJson as readonly JsonVocabRow[]).length + 2,
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
 * The rank stays whatever vocab.json says. No ordering in this frozen sidecar
 * is treated as a pronunciation preference: CEJC alone supplies that signal.
 */
// Through `unknown` because the JSON import types each `align` row as string[]
// and `WordSense` says what it really is, a 3-tuple. Same widening vocab.json's
// own rows carry; the ingest is what guarantees the arity.
const SENSES = wordSensesJson as unknown as Readonly<Record<string, readonly WordSense[]>>;

interface SourceDefinition {
  readonly id: string;
  readonly glosses: readonly string[];
  readonly pos: readonly string[];
  readonly readings: readonly string[];
  /** JMdict register/formality tags for this sense (SAK-32), most to least
   * formal, restricted to the five this app annotates: honorific, humble,
   * polite, familiar, colloquial. Absent when the sense carries none. */
  readonly register?: readonly string[];
}

const SOURCE_DEFINITIONS = (wordDefinitionsJson as {
  readonly words: Readonly<Record<string, readonly SourceDefinition[]>>;
}).words;

/**
 * Register/formality tags (SAK-32) for one specific sense of `keb`, or empty.
 *
 * Matched by (reading, glosses) rather than `definitionId`: the source sense
 * boundary lives in word-definitions.json, but a `WordSense` as shown on a
 * word card (from word-senses.json, or the single-sense vocab.json fallback)
 * does not carry a JMdict-comparable id. Reading + exact gloss list is the
 * same join key `readingDefinitions` already trusts to restore JMdict's real
 * sense boundaries, so it is reused here rather than inventing a second one.
 * Per-sense, never promoted to the whole word — see the rendering call site.
 */
export function wordSenseRegister(
  keb: string,
  reb: string,
  glosses: readonly string[],
): readonly string[] {
  const definitions = SOURCE_DEFINITIONS[keb] ?? [];
  const match = definitions.find(
    (definition) =>
      definition.readings.includes(reb) &&
      definition.glosses.length === glosses.length &&
      definition.glosses.every((gloss, i) => gloss === glosses[i]),
  );
  return match?.register ?? [];
}

type CejcReadingCounts = Readonly<Record<string, Readonly<Record<string, number>>>>;

export type WordTeachingCategory =
  | "core"
  | "conversation-essential"
  | "grammar"
  | "excluded"
  | "unobserved";

export interface WordTeachingMetadata {
  readonly category: WordTeachingCategory;
  readonly cejcCount: number;
  readonly categoryCounts: Readonly<Record<string, number>>;
  readonly dominantPosFamily: string | null;
  readonly teachingRank: number | null;
  readonly placementRule: string;
}

const CEJC_TEACHING = (cejcReadingFrequencyJson as {
  readonly teaching: Readonly<Record<string, WordTeachingMetadata>>;
}).teaching;

const UNOBSERVED_TEACHING: WordTeachingMetadata = {
  category: "unobserved",
  cejcCount: 0,
  categoryCounts: {},
  dominantPosFamily: null,
  teachingRank: null,
  placementRule: "secondary-source-fallback",
};

/** CEJC's lexical/POS classification and approved placement policy for a word.
 * JMdict supplies its meanings and senses, never this curriculum decision. */
export function wordTeachingMetadata(keb: string): WordTeachingMetadata {
  return CEJC_TEACHING[keb] ?? UNOBSERVED_TEACHING;
}

/** Content words and meaningful standalone responses belong to the word track.
 * Grammar has its own prerequisite-driven track; fillers and unobserved
 * dictionary reference material stay in Library. */
export function isWordTrackCategory(category: WordTeachingCategory): boolean {
  return category === "core" || category === "conversation-essential";
}

function jmdictPosFamilies(pos: string): ReadonlySet<string> {
  const lower = pos.toLowerCase();
  const families = new Set<string>();
  if (lower.includes("interjection")) families.add("interjection");
  if (lower.includes("particle")) families.add("particle");
  if (lower.includes("auxiliary") || lower.includes("copula")) families.add("auxiliary");
  if (lower.includes("conjunction")) families.add("conjunction");
  if (lower.includes("adverb")) families.add("adverb");
  if (lower.includes("pre-noun adjectival")) families.add("adnominal");
  if (lower.includes("pronoun")) families.add("pronoun");
  if (lower.includes("verb")) families.add("verb");
  if (lower.includes("adjective") || lower.includes("adjectival")) families.add("adjective");
  if (lower.includes("noun") && !lower.includes("adjectival")) families.add("noun");
  if (lower.includes("prefix")) families.add("prefix");
  if (lower.includes("suffix")) families.add("suffix");
  return families;
}

// Preserve beginnerRank as the app-wide total ordering field, but source its
// curriculum head from CEJC. The unscheduled Library tail keeps its previous
// deterministic order until the secondary-frequency migration is complete.
const RAW_WORD_ROWS: readonly JsonVocabRow[] = [
  ...(vocabJson as readonly JsonVocabRow[]),
  ...SUPPLEMENT,
];
const CEJC_HEAD = RAW_WORD_ROWS
  .filter((row) => wordTeachingMetadata(row.keb).teachingRank !== null)
  .sort(
    (a, b) =>
      wordTeachingMetadata(a.keb).teachingRank! -
      wordTeachingMetadata(b.keb).teachingRank!,
  );
const CEJC_HEAD_KEBS = new Set(CEJC_HEAD.map((row) => row.keb));
const ORDERED_WORD_ROWS = [
  ...CEJC_HEAD,
  ...RAW_WORD_ROWS.filter((row) => !CEJC_HEAD_KEBS.has(row.keb)).sort(
    (a, b) => a.beginnerRank - b.beginnerRank,
  ),
];
const CEJC_BEGINNER_RANK = new Map(
  ORDERED_WORD_ROWS.map((row, index) => [row.keb, index + 1]),
);

/** CEJC occurrence totals, reduced to words Saku carries and normalized to the
 * hiragana readings Saku uses. Raw CEJC files are ignored and never shipped. */
const CEJC_READING_COUNTS = (cejcReadingFrequencyJson as {
  readonly words: CejcReadingCounts;
}).words;

/** How often `keb` is spoken as `reb` in CEJC (0 if unobserved). The frequency a
 * pronunciation is ranked by — the only grain CEJC can rank (not senses). */
export function readingFrequency(keb: string, reb: string): number {
  return CEJC_READING_COUNTS[keb]?.[reb] ?? 0;
}

/**
 * Productive counting readings omitted by JMdict's standalone-word cut.
 *
 * 四/七/九 are genuine spoken number words in both branches. Keeping よん,
 * なな and く only in the procedural number engine made generated grading
 * correct while the lesson and word page remained incomplete. Add the missing
 * lexical units here, at the same seam all word readings use, so lessons,
 * Library pages, search and ordinary word quizzes receive them together.
 */
export const NUMBER_WORD_ALTERNATES: Readonly<Record<string, readonly string[]>> = {
  ...numberWordAlternatesJson,
};

function withSenses(row: JsonVocabRow): VocabRow {
  const shipped = SENSES[row.keb];
  const base: readonly WordSense[] = (shipped?.length
    ? shipped
    : [{ reb: row.reb, glosses: row.glosses, pos: row.pos, align: row.align }]
  ).map((sense, i) => ({
    ...sense,
    // The current sidecar predates source sense ids. Keep each source row a
    // separate definition instead of guessing from similar English. A future
    // JMdict recut writes its ent_seq+sense ordinal here directly.
    definitionId:
      "definitionId" in sense && typeof sense.definitionId === "string"
        ? sense.definitionId
        : `${row.keb}:${i}`,
  }));
  const alternates = NUMBER_WORD_ALTERNATES[row.keb] ?? [];
  const senses = [
    ...base,
    ...alternates
      .filter((reb) => !base.some((sense) => sense.reb === reb))
      .map((reb) => ({
        reb,
        // These are explicitly alternate pronunciations of the SAME number
        // meaning, so they join that definition by curation, not gloss matching.
        definitionId: base[0].definitionId,
        glosses: base[0].glosses,
        pos: base[0].pos,
        align: base[0].align,
      })),
  ];
  const provisional: VocabRow = {
    ...row,
    beginnerRank: CEJC_BEGINNER_RANK.get(row.keb) ?? row.beginnerRank,
    senses,
  };
  // JMdict supplies valid readings and their sense relationships, never Saku's
  // primary pronunciation. Definition order stays semantic; CEJC ranks the
  // interchangeable readings inside each definition.
  const ranked = readingDefinitions(provisional)
    .flatMap((definition) => definition.readings)
    .find((reading) => senses.some((sense) => sense.reb === reading.reb));
  const desiredFamily = wordTeachingMetadata(row.keb).dominantPosFamily;
  const sameReading = senses.filter((sense) => sense.reb === ranked?.reb);
  const selected =
    sameReading.find(
      (sense) =>
        sense.definitionId === ranked?.definitionId &&
        desiredFamily !== null &&
        sense.pos.some((pos) => jmdictPosFamilies(pos).has(desiredFamily)),
    ) ??
    sameReading.find(
      (sense) =>
        desiredFamily !== null &&
        sense.pos.some((pos) => jmdictPosFamilies(pos).has(desiredFamily)),
    ) ??
    sameReading.find((sense) => sense.definitionId === ranked?.definitionId) ??
    sameReading[0] ??
    senses[0];
  return {
    ...provisional,
    reb: selected.reb,
    glosses: selected.glosses,
    pos: selected.pos,
    align: selected.align,
  };
}

export interface ReadingDefinition {
  readonly id: string;
  readonly glosses: readonly string[];
  /** Readings common enough for the teaching table. */
  readonly readings: readonly WordSense[];
  /** Valid JMdict readings whose CEJC share is at most 5% of comparable uses.
   * Library reference material only; never silently added to scored facts. */
  readonly referenceReadings: readonly WordSense[];
  /** Present only when CEJC has enough evidence and the leading reading clears
   * the conservative majority, effect-size and confidence thresholds. */
  readonly preferredReading: string | null;
}

function wilsonLower(successes: number, total: number): number {
  if (total === 0) return 0;
  const z = 1.96;
  const p = successes / total;
  const z2 = z * z;
  return (
    (p + z2 / (2 * total) - z * Math.sqrt((p * (1 - p) + z2 / (4 * total)) / total)) /
    (1 + z2 / total)
  );
}

/** Definitions stay in dictionary order. Comparable readings move only WITHIN
 * their own definition, most-to-least common in CEJC; a common reading of
 * definition B can never jump above any reading of definition A. Readings at or
 * below 5% of sufficiently observed comparable usage become Library reference
 * rows rather than ordinary teaching rows. */
export function readingDefinitions(word: VocabRow): readonly ReadingDefinition[] {
  const fallback = new Map<string, { glosses: readonly string[]; readings: WordSense[] }>();
  for (const sense of word.senses) {
    const group = fallback.get(sense.definitionId);
    if (group) {
      const existing = group.readings.find((r) => r.reb === sense.reb);
      if (!existing) group.readings.push(sense);
      continue;
    }
    fallback.set(sense.definitionId, { glosses: sense.glosses, readings: [sense] });
  }

  // Restore JMdict's actual sense boundaries. A reading may participate in
  // several senses, and one sense may accept several readings. When the legacy
  // quiz snapshot has several rows with one sound, consume them in source order.
  // Source-only readings become reference rows below, not new scored facts.
  const byReading = new Map<string, WordSense[]>();
  for (const sense of word.senses) {
    const rows = byReading.get(sense.reb) ?? [];
    rows.push(sense);
    byReading.set(sense.reb, rows);
  }
  const used = new Map<string, number>();
  const covered = new Set<WordSense>();
  const source = SOURCE_DEFINITIONS[word.keb] ?? [];
  const definitions: Array<{ id: string; glosses: readonly string[]; readings: WordSense[] }> = [];
  for (const definition of source) {
    const readings = definition.readings.flatMap((reb) => {
      const candidates = byReading.get(reb) ?? [];
      const at = used.get(reb) ?? 0;
      const candidate = candidates[Math.min(at, candidates.length - 1)];
      if (candidate) {
        used.set(reb, at + 1);
        covered.add(candidate);
      }
      // The source sidecar is reference data for this table. A reading absent
      // from the frozen quiz snapshot is still a real JMdict pronunciation, but
      // displaying it must not mint a new fact and rewrite learner history.
      // Reuse known alignment where possible and otherwise leave it unclaimed.
      const template = candidate ?? word.senses[0];
      if (!template) return [];
      return [{
        ...template,
        definitionId: definition.id,
        reb,
        glosses: definition.glosses,
        pos: definition.pos.length ? definition.pos : template.pos,
        align: candidate?.align ?? null,
      }];
    });
    if (readings.length) definitions.push({ ...definition, readings });
  }
  // A current-app reading absent from today's JMdict is source drift, not a
  // reason to hide something the quiz still asks. Keep its legacy definition at
  // the foot, without merging it by English similarity.
  for (const [id, group] of fallback) {
    const readings = group.readings.filter((sense) => !covered.has(sense));
    if (readings.length) definitions.push({ id, glosses: group.glosses, readings });
  }

  const counts = CEJC_READING_COUNTS[word.keb] ?? {};
  return definitions.map((group) => {
    // CEJC is reading-counted but not sense-tagged. Counts are comparable only
    // when every reading participates in exactly the same set of JMdict senses;
    // otherwise uses belonging to another meaning could inflate one side.
    const coverage = group.readings.map((reading) =>
      source
        .filter((definition) => definition.readings.includes(reading.reb))
        .map((definition) => definition.id)
        .sort()
        .join("|"),
    );
    const comparable =
      source.length > 0 && coverage.every((signature) => signature === coverage[0]);
    const ranked = group.readings
      .map((reading, order) => ({ reading, order, count: counts[reading.reb] }))
      .sort((a, b) => {
        if (!comparable) return a.order - b.order;
        if (a.count == null && b.count == null) return a.order - b.order;
        if (a.count == null) return 1;
        if (b.count == null) return -1;
        return b.count - a.count || a.order - b.order;
      })
      .map((x) => x.reading);

    let preferredReading: string | null = null;
    const hasCorpusEvidence = Object.keys(counts).length > 0;
    const total = ranked.reduce((sum, reading) => sum + (counts[reading.reb] ?? 0), 0);
    if (ranked.length >= 2 && hasCorpusEvidence && comparable) {
      const top = counts[ranked[0].reb];
      // Once CEJC has observations for this written lexeme, a valid alternate
      // reading absent from those observations has an observed count of zero;
      // it is not missing corpus data. This distinction is why the generated
      // lookup retains single-reading matches as well as multi-reading ones.
      const second = counts[ranked[1].reb] ?? 0;
      if (
        top != null &&
        total >= 50 &&
        top / total >= 0.5 &&
        (second === 0 || top / second >= 1.6) &&
        wilsonLower(top, top + second) > 0.5
      ) {
        preferredReading = ranked[0].reb;
      }
    }
    const referenceReadings =
      comparable && total >= 50
        ? ranked.filter(
            (reading, index) =>
              index > 0 && (counts[reading.reb] ?? 0) / total <= 0.05,
          )
        : [];
    const referenceSet = new Set(referenceReadings.map((reading) => reading.reb));
    const readings = ranked.filter((reading) => !referenceSet.has(reading.reb));
    return {
      id: group.id,
      glosses: group.glosses,
      readings,
      referenceReadings,
      preferredReading,
    };
  });
}

/** The frozen word senses that remain teachable after definition-scoped CEJC
 * classification. A sound is removed only when every definition in which it
 * appears puts it in the reference tier; one teaching use keeps the reading in
 * lessons and quizzes. Source-only reference rows were never scored facts. */
export function teachingSenses(word: VocabRow): readonly WordSense[] {
  const definitions = readingDefinitions(word);
  const teachingReadings = new Set(
    definitions.flatMap((definition) => definition.readings.map((reading) => reading.reb)),
  );
  return word.senses.filter((sense) => teachingReadings.has(sense.reb));
}

export const VOCAB: readonly VocabRow[] = [
  ...(vocabJson as readonly JsonVocabRow[]),
  ...SUPPLEMENT,
].map(withSenses);

const BY_KEB: ReadonlyMap<string, VocabRow> = new Map(VOCAB.map((w) => [w.keb, w]));

// Existing unqualified fact ids predate CEJC ranking. Preserve the reading each
// id already means so a corpus update cannot transfer learner history to a
// different pronunciation. Compatibility metadata is not a preference signal.
const LEGACY_UNQUALIFIED_READING: ReadonlyMap<string, string> = new Map(
  [...(vocabJson as readonly JsonVocabRow[]), ...SUPPLEMENT].map((row) => [
    row.keb,
    SENSES[row.keb]?.[0]?.reb ?? row.reb,
  ]),
);

export function legacyUnqualifiedReading(keb: string): string | null {
  return LEGACY_UNQUALIFIED_READING.get(keb) ?? null;
}

export function vocabRow(keb: string): VocabRow | undefined {
  return BY_KEB.get(keb);
}

export function wordEntry(keb: string): EntryId {
  return entryId(VOCAB_SUBJECT, keb);
}

/**
 * Is `glyph` a single Han character the dictionary teaches as a word on its own
 * (十 ten, 羊 sheep, 史 history)?
 *
 * The membership question behind the word role for a folded character. A
 * character the curriculum already teaches as a radical or a kanji that is ALSO
 * a one-character dictionary word is taught WHOLE — its word is shown, drilled
 * and priced, not just its shape. Both role gates (character-role.ts for the
 * lesson display, curriculum-order.ts for the sequence and drill) read this one
 * predicate, so the shown sections and the drilled facts cannot disagree about
 * which characters carry the word role.
 *
 * Single Han character only. A kana (で, と) is a word but not the kind of thing
 * a per-character role is about (no radical, no kanji card, no glyph page), and
 * a multi-character written form (電車) is a scheduled word, not a per-character
 * role — those stay gated on CURRICULUM_WORDS where they are asked. `[...glyph]`
 * counts code points, so a one-kanji two-JS-unit glyph (𠮟) still measures as
 * one.
 */
export function isSingleCharWordGlyph(glyph: string): boolean {
  return (
    [...glyph].length === 1 &&
    /\p{Script=Han}/u.test(glyph) &&
    vocabRow(glyph) !== undefined
  );
}

/** The legacy unqualified reading fact. Its pronunciation identity is frozen
 * for progress compatibility; it is NOT a primary-reading indicator. */
export function wordReadingFactId(keb: string): FactId {
  return factId(wordEntry(keb), "reading");
}

export function wordMeaningFactId(keb: string): FactId {
  return factId(wordEntry(keb), "meaning");
}

/** A reading-qualified fact. The one legacy reading that already owns an
 * unqualified id keeps it solely for progress compatibility. */
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
  const teachable = teachingSenses(w);
  const available = new Set(teachable.map((sense) => sense.reb));
  // Preserve semantic definition order. CEJC is the only authority allowed to
  // reorder pronunciations within a definition.
  const order = [
    ...new Set(
      readingDefinitions(w).flatMap((definition) =>
        definition.readings
          .map((reading) => reading.reb)
          .filter((reb) => available.has(reb)),
      ),
    ),
  ];
  const byReb = new Map<string, string[]>();
  for (const s of teachable) {
    let gl = byReb.get(s.reb);
    if (!gl) {
      gl = [];
      byReb.set(s.reb, gl);
      if (!order.includes(s.reb)) order.push(s.reb);
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
 * Every reading-unit of a word, CEJC-first within each definition, paired with
 * stable fact ids. The historically unqualified unit remains unqualified; all
 * others are qualified by their reading (日's にち-unit →
 * `word:日/meaning@にち`), exactly as
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
  const unqualifiedReading = legacyUnqualifiedReading(keb);
  return readingUnits(row).map((unit) => {
    const legacyUnqualified = unit.reb === unqualifiedReading;
    return {
      unit,
      reading: kana
        ? null
        : legacyUnqualified
          ? wordReadingFactId(keb)
          : wordUnitReadingFactId(keb, unit.reb),
      meaning: legacyUnqualified
        ? wordMeaningFactId(keb)
        : wordUnitMeaningFactId(keb, unit.reb),
    };
  });
}

/**
 * Every fact a word mints, in mint order: per reading-unit (CEJC-first) its
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
 * Every word READING fact, unqualified AND qualified — the membership set that
 * answers "is this fact a word's reading (vs its meaning)?" without parsing the
 * id. Built in `buildVocabFacts` right beside `READING_UNIT_OF`, as each reading
 * fact is minted.
 *
 * The one honest discriminator: `wordReadingFactId(keb)` names only the frozen
 * legacy unit's unqualified id, so testing `wordReadingFactId(glyph) === fact`
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
 * A word's legacy reading fact stays unqualified and the rest are qualified —
 * unlike a kanji, which mints no unqualified reading fact at all. This preserves
 * progress identity while CEJC remains free to change teaching order.
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
