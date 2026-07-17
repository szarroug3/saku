// The Library's index: every entry in the app, in one shape, with the links
// between them precomputed.
//
// WHY THIS EXISTS RATHER THAN THREE SCREENS
// =========================================
// src/lib/facts.ts already knows every entry (`ALL_ENTRIES`) — but only as an
// id and a glyph, because FactInfo is deliberately thin and each subject keeps
// its own material to itself. That is the right shape for the drill, which does
// not care what it is asking about. It is the wrong shape for a screen whose
// entire job is to show you what a thing IS.
//
// So the Library does the one thing facts.ts refuses to: it reaches into each
// subject's own module and builds a browsing view. That is a legitimate reversal
// and not a leak, on one condition — it happens HERE, in one file, and what
// comes out the other side is subject-agnostic again. A Library screen renders
// `LibEntry`. It does not know that kanji have grades.
//
// NOTHING HERE PARSES AN ID. Ids are minted by each subject's own minter
// (`kanaEntry`, `kanjiEntry`, `wordEntry`, `kanaFact`, `meaningFactId`,
// `readingFactId`, `wordReadingFactId`, `wordMeaningFactId`) and resolved by
// lookup. The join back to CHAR_INDEX / KANJI / VOCAB is by GLYPH, which is the
// key those tables are already keyed by — not by taking an id apart.
//
// COST
// ====
// Built once at module load: ~9,761 entries and three maps over them. It is the
// work the search box would otherwise redo on every keystroke, and it is what
// lets search be ranked instead of a filter.

import {
  CHAR_INDEX,
  KANA_SUBJECT,
  kanaEntry,
  kanaFact,
  LOOK_GROUP,
} from "@/data/characters";
import { CONFUSABLE_WITH } from "@/data/confusable";
import {
  KANJI,
  KANJI_SUBJECT,
  kanjiEntry,
  kanjiRow,
  meaningFactId,
  READINGS,
  readingFactId,
  type ReadingRow,
} from "@/data/kanji";
import {
  VOCAB,
  VOCAB_SUBJECT,
  vocabRow,
  wordEntry,
  wordMeaningFactId,
  wordReadingFactId,
} from "@/data/vocab";
import type { EntryId, FactId } from "@/types";

/** Which shelf an entry lives on. The subject id, re-stated as a union so a
 * screen can switch on it — the values come from each subject's own constant,
 * so this cannot drift from what the facts carry. */
export type Kind = typeof KANA_SUBJECT | typeof KANJI_SUBJECT | typeof VOCAB_SUBJECT;

export const KINDS: readonly Kind[] = [KANA_SUBJECT, KANJI_SUBJECT, VOCAB_SUBJECT];

/** What a shelf is called on screen. */
export const KIND_LABEL: Record<Kind, string> = {
  [KANA_SUBJECT]: "Kana",
  [KANJI_SUBJECT]: "Kanji",
  [VOCAB_SUBJECT]: "Words",
};

/**
 * One thing you can look up.
 *
 * The whole of what a Library screen is allowed to know. Everything
 * subject-specific that survives is a STRING already fit to print (`sub`), not
 * a grade or a band a screen could start branching on.
 */
export interface LibEntry {
  readonly id: EntryId;
  readonly kind: Kind;
  /** What it looks like. し, 生, 先生. */
  readonly glyph: string;
  /**
   * How it is READ — し's romaji, 生's nine readings, 先生's せんせい. Searched.
   *
   * RICHEST FIRST for a kanji (most attesting words), which is the same order
   * the entry page's table uses. It is NOT "the reading" — 生's is い in raw
   * data order and せい by evidence, and neither is the answer to "how is 生
   * read", because that question has nine answers and is the reason facts exist.
   * A caller printing `readings[0]` as if it were the reading is making the
   * mistake the whole entry/fact split exists to prevent; see EntryRow, which
   * prints one only when there IS only one.
   */
  readonly readings: readonly string[];
  /** What it MEANS, in English. Searched. Empty for a kana. */
  readonly meanings: readonly string[];
  /** The one-line provenance under the glyph: "Jōyō grade 1 · 5 strokes". */
  readonly sub: string;
  /**
   * Tie-break weight for search: LOWER sorts first. Not shown, ever.
   *
   * A rough everyday-ness, and deliberately crude: a kana beats any kanji, which
   * beats the 8,045th word. Inside a kind it falls back to the newspaper band,
   * WHICH IS A BAD NUMBER (see VocabRow.newspaperBand — its top band holds 安保
   * and not 食べる). It is used anyway, for the one job it is fit for: breaking
   * ties in a list that is already sectioned by HOW you matched. It never ranks
   * anything on its own and it never reaches a screen.
   */
  readonly weight: number;
}

// ---------- readings, grouped (needed by the build below) ----------

const BY_KANJI_READINGS: ReadonlyMap<string, readonly ReadingRow[]> = groupReadings();

function groupReadings(): Map<string, ReadingRow[]> {
  const map = new Map<string, ReadingRow[]>();
  for (const r of READINGS) {
    const list = map.get(r.k);
    if (list) list.push(r);
    else map.set(r.k, [r]);
  }
  for (const list of map.values()) list.sort((a, b) => b.nWords - a.nWords);
  return map;
}

/** Every ReadingRow of one kanji, RICHEST EVIDENCE FIRST — the reading you meet
 * in the most words is the one worth reading first, and the one the ingest is
 * surest of.
 *
 * The sort happens once, here, at build, rather than in the two places that
 * want the order (LibEntry.readings and the entry page's table). They were
 * drifting already: the raw READINGS order put 生's い first — attested by 9
 * words — ahead of せい, which 33 words attest, so a row printing "the first
 * reading" printed the fifth most useful one. */
function readingsOf(c: string): readonly ReadingRow[] {
  return BY_KANJI_READINGS.get(c) ?? [];
}

// ---------- the index ----------

/** Every entry in the app, in browse order: kana, then kanji, then words. */
export const LIB_ENTRIES: readonly LibEntry[] = build();

const BY_ID: ReadonlyMap<EntryId, LibEntry> = new Map(
  LIB_ENTRIES.map((e) => [e.id, e]),
);

/** An entry, by its opaque id. A lookup, like everything else that resolves an
 * id — see src/lib/facts.ts. Undefined for an id this build has no data for,
 * which a screen must handle: a URL outlives a re-cut of the dictionaries. */
export function libEntry(id: EntryId): LibEntry | undefined {
  return BY_ID.get(id);
}

function build(): LibEntry[] {
  const out: LibEntry[] = [];

  for (const [c, info] of Object.entries(CHAR_INDEX)) {
    out.push({
      id: kanaEntry(c),
      kind: KANA_SUBJECT,
      glyph: c,
      readings: info.r,
      meanings: [],
      sub: `${info.setLabel} · ${info.secLabel}`,
      weight: 0,
    });
  }

  for (const k of KANJI) {
    out.push({
      id: kanjiEntry(k.c),
      kind: KANJI_SUBJECT,
      glyph: k.c,
      readings: readingsOf(k.c).map((r) => r.base),
      meanings: k.meanings,
      // There is no grade 7 (see KanjiRow.grade), so this prints what the data
      // says and never "grade 8 of 8".
      sub: `Jōyō grade ${k.grade} · ${k.strokes} stroke${
        k.strokes === 1 ? "" : "s"
      } · KANJIDIC2`,
      weight: 1000 + (k.newspaperFreq ?? 3000),
    });
  }

  for (const w of VOCAB) {
    out.push({
      id: wordEntry(w.keb),
      kind: VOCAB_SUBJECT,
      glyph: w.keb,
      readings: [w.reb],
      meanings: w.glosses,
      sub: "Everyday word · JMdict",
      weight: 10_000 + (w.newspaperBand ?? 60),
    });
  }

  return out;
}

// ---------- the links ----------

/** kanji glyph → every everyday word containing it, in vocab order. The join
 * that makes 人生 both a word AND the evidence for 生's セイ. */
const APPEARS_IN: ReadonlyMap<string, readonly string[]> = buildAppearsIn();

function buildAppearsIn(): Map<string, string[]> {
  const map = new Map<string, string[]>();
  for (const w of VOCAB) {
    for (const c of new Set(w.keb)) {
      if (!kanjiRow(c)) continue;
      const list = map.get(c);
      if (list) list.push(w.keb);
      else map.set(c, [w.keb]);
    }
  }
  return map;
}

/**
 * The words an entry appears inside.
 *
 * For a kanji, every everyday word written with it — 生 has ~219. For a word or
 * a kana, nothing: containment is a KANJI relation here, because that is the one
 * the data attests. A kana appears in nearly every reading in the language,
 * which is not a link, it is noise.
 */
export function appearsIn(entry: LibEntry): readonly string[] {
  if (entry.kind !== KANJI_SUBJECT) return [];
  return APPEARS_IN.get(entry.glyph) ?? [];
}

/**
 * The KRADFILE components a kanji is written with — 生 = 丿 + 土.
 *
 * NOT ALL COMPONENTS ARE ENTRIES. ｜, ノ, ハ, マ, ユ, ヨ are radical primitives
 * with no KANJIDIC2 row at all (see KanjiRow.comps), so each comes back with its
 * entry id or null and the screen renders a link or plain text. Minting an entry
 * for ノ so the link always works would put a page in the Library with nothing
 * on it.
 */
export function madeOf(entry: LibEntry): Array<{ c: string; id: EntryId | null }> {
  if (entry.kind !== KANJI_SUBJECT) return [];
  return (kanjiRow(entry.glyph)?.comps ?? []).map((c) => ({
    c,
    id: kanjiRow(c) ? kanjiEntry(c) : null,
  }));
}

/**
 * Entries this one might get mixed up with — A GUESS, and the screen must say
 * so.
 *
 * Shape only: LOOK_GROUP for kana, CONFUSABLE_WITH for kanji. It is not a record
 * of anything you have done. What you have ACTUALLY mixed up is a different
 * question with a different source (src/lib/confusions.ts, over history); this
 * is the app guessing before it has evidence, which is the only time a guess is
 * worth anything — and the entry page prints that in as many words, because a
 * guess must never read as a report.
 */
export function confusableWith(entry: LibEntry): EntryId[] {
  if (entry.kind === KANA_SUBJECT) {
    return (LOOK_GROUP[entry.glyph] ?? [])
      .filter((c) => CHAR_INDEX[c])
      .map((c) => kanaEntry(c));
  }
  if (entry.kind === KANJI_SUBJECT) {
    return (CONFUSABLE_WITH.get(entry.glyph) ?? [])
      .filter((c) => kanjiRow(c))
      .map((c) => kanjiEntry(c));
  }
  return [];
}

/**
 * The entry a glyph names on a given shelf, when the glyph is all a link has —
 * an "appears in" word, a component kanji.
 *
 * Null when there is no such entry, which the caller must handle rather than
 * mint an id for data it does not have. A minted id that resolves to nothing is
 * a broken link that type-checks.
 */
export function entryForGlyph(kind: Kind, glyph: string): EntryId | null {
  switch (kind) {
    case KANA_SUBJECT:
      return CHAR_INDEX[glyph] ? kanaEntry(glyph) : null;
    case KANJI_SUBJECT:
      return kanjiRow(glyph) ? kanjiEntry(glyph) : null;
    case VOCAB_SUBJECT:
      return vocabRow(glyph) ? wordEntry(glyph) : null;
  }
}

// ---------- an entry's facts, with what a screen needs to LABEL them ----------
//
// factsOf(entry) gives ids and nothing else, by design. The entry page has to
// say what each one ASKS — and that is subject knowledge, so it is resolved
// here, once, rather than every screen learning which subjects have anchors.

/** One row of the entry page's facts table. */
export interface FactRow {
  readonly id: FactId;
  /** "Meaning", "セイ", "い(きる)" — what this fact asks about. */
  readonly label: string;
  /** The answer. The entry page SHOWS it: this is a reference, not a quiz, and
   * a reference that withholds the answer is a quiz with no marking. */
  readonly answer: string;
  /**
   * The words this fact is asked in — 学生 · 先生 for 生's セイ.
   *
   * The reason the fact exists. A kanji reading fact is keyed on (kanji, word)
   * precisely because the word is what makes it gradeable, so a table showing
   * the reading without the word would be showing a question the app cannot ask.
   * Empty for a meaning fact and for kana, which have no anchor and need none.
   */
  readonly askedIn: readonly string[];
  /** A reading the ingest found no everyday word for: here to be READ, never
   * asked. The design's "＋ 4 rarer readings — here if you look, never asked." */
  readonly unattested: boolean;
}

/**
 * An entry's facts, in table order, each with what it asks.
 *
 * 生 comes back as 1 meaning + one row per distinct reading — the model's whole
 * thesis, made visible. This is the closest thing the app has to a proof that
 * "what is the reading of 生" is not a question.
 */
export function factRows(entry: LibEntry): FactRow[] {
  switch (entry.kind) {
    case KANA_SUBJECT:
      return [
        {
          id: kanaFact(entry.glyph),
          label: "Reading",
          answer: entry.readings.join(" / "),
          askedIn: [],
          unattested: false,
        },
      ];
    case KANJI_SUBJECT:
      return kanjiFactRows(entry);
    case VOCAB_SUBJECT:
      return [
        {
          id: wordReadingFactId(entry.glyph),
          label: "Reading",
          answer: entry.readings[0] ?? "",
          askedIn: [],
          unattested: false,
        },
        {
          id: wordMeaningFactId(entry.glyph),
          label: "Meaning",
          answer: entry.meanings.join(", "),
          askedIn: [],
          unattested: false,
        },
      ];
  }
}

function kanjiFactRows(entry: LibEntry): FactRow[] {
  const rows: FactRow[] = [
    {
      id: meaningFactId(entry.glyph),
      label: "Meaning",
      answer: entry.meanings.join(", "),
      askedIn: [],
      unattested: false,
    },
  ];
  for (const r of readingsOf(entry.glyph)) {
    rows.push({
      id: readingFactId(r.k, r.anchor),
      label: r.base,
      // How the reading SURFACES in its anchor — 口 in 出口 is ぐち, and the
      // fact accepts both (see buildKanjiFacts). The table shows the surface,
      // because that is what you would actually say.
      answer: r.surface,
      askedIn: r.words.slice(0, 4),
      unattested: r.nWords === 0,
    });
  }
  return rows;
}
