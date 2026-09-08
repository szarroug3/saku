// The vocabulary, built: scripts/build-vocab-runtime.mjs runs this once and
// writes src/data/generated/vocab-runtime.json, which vocab.ts reads. Every
// line here used to run on every cold start of the app (SAK-399).
//
// Inputs: vocab.json (JMdict, ranked), the two words this table lacks, the
// CEJC conversation-frequency tables (which order the words and choose the
// reading to teach), the shipped senses, and the dictionary's definitions.

import cejcReadingFrequencyJson from "./generated/cejc-reading-frequency.json" with { type: "json" };
import vocabJson from "./generated/vocab.json" with { type: "json" };

import {
  jmdictPosFamilies,
  NUMBER_WORD_ALTERNATES,
  readingDefinitionsWith,
  readingUnitsWith,
  SENSES,
  type CejcReadingCounts,
  type JsonVocabRow,
  type ReadingUnit,
  type VocabRow,
  type VocabRuntime,
  type WordSense,
  type WordTeachingMetadata,
} from "./vocab.ts";

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

const CEJC = cejcReadingFrequencyJson as {
  readonly teaching: Readonly<Record<string, WordTeachingMetadata>>;
  readonly words: CejcReadingCounts;
};

const UNOBSERVED: WordTeachingMetadata = {
  category: "unobserved",
  cejcCount: 0,
  categoryCounts: {},
  dominantPosFamily: null,
  teachingRank: null,
  placementRule: "secondary-source-fallback",
};
/** CEJC's teaching metadata for a word (category, rank, placement, the
 * dominant part-of-speech family), or the unobserved default. Build-time
 * and tests; the app reads only the family, through vocab.ts. */
export function wordTeachingMetadata(keb: string): WordTeachingMetadata {
  return CEJC.teaching[keb] ?? UNOBSERVED;
}
const teachingOf = wordTeachingMetadata;

const RAW_WORD_ROWS: readonly JsonVocabRow[] = [
  ...(vocabJson as readonly JsonVocabRow[]),
  ...SUPPLEMENT,
];
const CEJC_HEAD = RAW_WORD_ROWS
  .filter((row) => teachingOf(row.keb).teachingRank !== null)
  .sort(
    (a, b) =>
      teachingOf(a.keb).teachingRank! -
      teachingOf(b.keb).teachingRank!,
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
  const ranked = readingDefinitionsWith(provisional, CEJC.words)
    .flatMap((definition) => definition.readings)
    .find((reading) => senses.some((sense) => sense.reb === reading.reb));
  const desiredFamily = teachingOf(row.keb).dominantPosFamily;
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


/** Everything vocab.ts needs at run time, in one object. */
export function buildVocabRuntime(): VocabRuntime {
  // A row whose one sense is the row itself (12,435 of 12,555) is written
  // without it; vocab.ts puts the sense back at load. Half the file.
  const rows = RAW_WORD_ROWS.map(withSenses).map((row) => {
    const [only, ...more] = row.senses;
    const trivial = !more.length && only && only.definitionId === `${row.keb}:0` && only.reb === row.reb
      && JSON.stringify(only.glosses) === JSON.stringify(row.glosses) && JSON.stringify(only.pos) === JSON.stringify(row.pos)
      && JSON.stringify(only.align) === JSON.stringify(row.align);
    if (!trivial) return row;
    const { senses: _senses, ...bare } = row;
    return bare as VocabRow;
  });
  const legacyReadings: Record<string, string> = {};
  for (const row of RAW_WORD_ROWS) legacyReadings[row.keb] = SENSES[row.keb]?.[0]?.reb ?? row.reb;
  // the reading units that are not the row's own reading and glosses
  const units: Record<string, ReadingUnit[]> = {};
  for (const row of RAW_WORD_ROWS.map(withSenses)) {
    const u = readingUnitsWith(row, CEJC.words);
    const trivial = u.length === 1 && u[0].reb === row.reb && u[0].senseGroups === undefined && JSON.stringify(u[0].glosses) === JSON.stringify(row.glosses);
    if (!trivial) units[row.keb] = u;
  }
  const posFamilies: Record<string, string> = {};
  for (const [keb, meta] of Object.entries(CEJC.teaching)) if (meta.dominantPosFamily) posFamilies[keb] = meta.dominantPosFamily;
  return { rows, posFamilies, readingCounts: CEJC.words, legacyReadings, units };
}
