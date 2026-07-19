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
import {
  GRAMMAR_SUBJECT,
  patternEntry,
  patternMeaningFactId,
  patternProductionFactId,
  productionHosts,
} from "@/data/grammar";
import { MARK_SUBJECT, MARKS, markEntry } from "@/data/marks";
import { cluster } from "@/data/grammar/clusters";
import { RECIPES, isProducible, type Recipe } from "@/data/grammar/recipes";
import { buildExample } from "@/lib/grammar/example";
import { HOST_LABEL } from "@/lib/grammar/formula";
import type { EntryId, FactId, FactInfo } from "@/types";

/** Which shelf an entry lives on. The subject id, re-stated as a union so a
 * screen can switch on it — the values come from each subject's own constant,
 * so this cannot drift from what the facts carry. */
export type Kind =
  | typeof KANA_SUBJECT
  | typeof MARK_SUBJECT
  | typeof KANJI_SUBJECT
  | typeof VOCAB_SUBJECT
  | typeof GRAMMAR_SUBJECT;

/** Browse order, and it is teaching order: kana, then the rules about how kana
 * are read, then the things kana spell. Marks sit next to kana because that is
 * the only place they mean anything — ゛ is a fact about か. */
export const KINDS: readonly Kind[] = [
  KANA_SUBJECT,
  MARK_SUBJECT,
  KANJI_SUBJECT,
  VOCAB_SUBJECT,
  GRAMMAR_SUBJECT,
];

/** What a shelf is called on screen. */
export const KIND_LABEL: Record<Kind, string> = {
  [KANA_SUBJECT]: "Kana",
  [MARK_SUBJECT]: "Marks",
  [KANJI_SUBJECT]: "Kanji",
  [VOCAB_SUBJECT]: "Words",
  [GRAMMAR_SUBJECT]: "Grammar",
};

/**
 * Where a lesson's specific type differs from the shelf it lives on. A lesson
 * teaches one word, so the "Words" shelf reads "Word" in the session header;
 * every other non-kana subject's shelf label is already the right singular.
 */
const SUBJECT_LABEL: Partial<Record<Kind, string>> = {
  [VOCAB_SUBJECT]: "Word",
};

/**
 * The specific lesson-type label for a fact — what the session header's subject
 * pip shows. More pointed than KIND_LABEL: a kana lesson is either "Hiragana"
 * or "Katakana" depending on the character's own script, read off CHAR_INDEX by
 * the fact's glyph rather than by parsing its id. Every other subject falls
 * back to SUBJECT_LABEL and then KIND_LABEL. Undefined when the fact is gone.
 */
export function subjectLabel(info: FactInfo | undefined): string | undefined {
  if (!info) return undefined;
  const kind = info.subject as Kind;
  if (kind === KANA_SUBJECT) {
    return CHAR_INDEX[info.glyph]?.setLabel ?? KIND_LABEL[kind];
  }
  return SUBJECT_LABEL[kind] ?? KIND_LABEL[kind];
}

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
  /**
   * What it looks like. し, 生, 先生 — AND SOMETIMES NOTHING.
   *
   * It was safe to assume this was a character for as long as every entry was
   * one. Marks broke that: "long vowels" is a rule written ー in katakana and by
   * doubling a vowel kana in hiragana, so it has no single character and its
   * glyph is the empty string. See `name` below, and src/data/marks.ts.
   *
   * The empty case is SEARCH-INERT and that is worth knowing: `classify` asks
   * `glyph === q`, `glyph.startsWith(q)` and `glyph.includes(q)`, and with a
   * non-empty query (search trims and bails on "") all three are false for "".
   * So a glyphless entry cannot be found by its glyph — it is found by its
   * meanings and its `searchAlso` aliases, which is why the long-vowel mark
   * carries ー as an alias.
   */
  readonly glyph: string;
  /**
   * What to CALL it, when the glyph cannot.
   *
   * Absent for every entry whose glyph IS its name, which is all of kana, kanji,
   * words and grammar — 生 is called 生. Present only where the glyph is empty or
   * is a specimen rather than a name: "Long vowels" has no character at all, and
   * "Small ゃ ゅ ょ" has three. Read it through `entryName`, never directly, so a
   * caller cannot forget the fallback.
   *
   * This is a NAME, not a title: it goes where a glyph would have gone — a
   * breadcrumb crumb, a row's leading cell, an aria-label — and not in place of
   * the meanings a page prints as its heading.
   */
  readonly name?: string;
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
  /**
   * Extra strings SEARCH matches but the screen never renders — an alias index.
   *
   * Grammar is the reason it exists: a pattern's cluster name ("seems", "must")
   * is what you would type to find the whole family, and そう-hearsay's gloss
   * ("I hear that X") does not contain the word "seems". So the cluster title
   * rides here, findable but not shown, and the tile keeps printing the gloss.
   *
   * MARKS ARE THE SECOND REASON, and they widened what this field is for. Two
   * things a learner would type can live nowhere else: the jargon every other
   * resource uses and this app never prints ("sokuon", "yōon", "chōonpu"), and
   * the Japanese tokens an entry is about but whose `glyph` cannot hold — ゃゅょ
   * is one entry with three characters, and "long vowels" has no glyph at all, so
   * ー is findable ONLY from here. That last case is why `classify` now matches an
   * alias exactly as well as through the English-only meaning path.
   *
   * Empty (and absent from the match loop's cost) for every other kind.
   */
  readonly searchAlso?: readonly string[];
  /** The one line under the glyph: "5 strokes", "Everyday word". */
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

/**
 * A kanji's readings, richest evidence first — the WHOLE row, not the flattened
 * FactRow the generic table takes.
 *
 * The entry page's kanji branch needs three things FactRow deliberately drops:
 * `nWords` (how common the reading is, as a real number rather than a bar), the
 * full `words` list (to name the word that OPENS a shut reading, which may be
 * one the four-word `askedIn` sample never reaches), and `anchor` (the word the
 * fact is keyed on). Widening FactRow with kanji-only fields would push subject
 * knowledge into a shape four kinds share; this is a second, narrower accessor
 * for the one kind that needs it.
 *
 * NO FILTER, EVER. Measured: the most readings any kanji has is 8, and it is 生;
 * 1,944 of 2,022 have three or fewer. There is no length to manage, so the page
 * shows them all and the "＋ N more" control that a words list needs has no
 * business here.
 */
export function readingRowsOf(entry: LibEntry): readonly ReadingRow[] {
  if (entry.kind !== KANJI_SUBJECT) return [];
  return readingsOf(entry.glyph);
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

/**
 * What to call an entry where a character would have gone.
 *
 * The glyph for everything that has one, the name for the one kind that doesn't.
 * It exists so that "render the entry's glyph" — a breadcrumb crumb, a row's
 * leading cell, `aria-label={`Open ${…}`}` — has a single answer that is never
 * the empty string. Before this, the long-vowel mark rendered a blank crumb after
 * a "›" and an aria-label reading "Open ", which is a screen reader announcing a
 * button with no name.
 *
 * NOT a replacement for the glyph everywhere. Where the glyph is the SUBJECT
 * rather than a label — the 76px hero on an entry page, `speak(entry.glyph)` —
 * an empty glyph means there is genuinely nothing to show or say, and the right
 * answer is to render nothing, not to render the words "Long vowels" at 76px or
 * read them out in a Japanese voice.
 */
export function entryName(entry: LibEntry): string {
  return entry.glyph || entry.name || entry.id;
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

  // Marks — the reading rules, right after the kana they are rules about.
  //
  // `meanings` HOLDS THE NAME, and `sub` holds the one-line rule. That looks
  // back-to-front for one beat and is the arrangement that makes every existing
  // renderer say the right thing without being told about marks: EntryRow prints
  // `meanings` as its main line and `sub` as the note under it, so the row reads
  // "Dakuten / Two dashes that voice the consonant"; the entry page's PageTitle
  // takes `meanings` and prints `sub` beneath, so the page is headed "Dakuten"
  // and sub-headed with the rule. A mark has no gloss competing for `meanings`,
  // so nothing is displaced — and search over meanings then finds a mark by its
  // name, which is what anyone would type.
  //
  // NO READINGS, deliberately and not for want of a plausible string. ゛ is
  // called "dakuten", but that is its NAME, not how it is read: nothing in
  // Japanese pronounces a bare ゛, and `readings` is exact-matched by search and
  // spoken by the tile's 🔊. A romaji-shaped name in that field would make ゛ a
  // hit for someone sounding out a kana and hand a synthesiser something to say.
  for (const m of MARKS) {
    out.push({
      id: markEntry(m.id),
      kind: MARK_SUBJECT,
      glyph: m.glyph,
      name: m.name,
      readings: [],
      meanings: [m.name],
      searchAlso: m.searchAlso,
      sub: m.summary,
      // Below kana (0) and below grammar (500+), so that when a query hits a
      // mark and something else, the mark leads. There are five of them and they
      // are the answer to a question about a rule; nothing is buried by putting
      // five entries near the front, and typing "dakuten" should not turn up a
      // word first.
      weight: 1,
    });
  }

  for (const k of KANJI) {
    out.push({
      id: kanjiEntry(k.c),
      kind: KANJI_SUBJECT,
      glyph: k.c,
      readings: readingsOf(k.c).map((r) => r.base),
      meanings: k.meanings,
      // Stroke count only. The jōyō grade and the name of the dictionary the
      // row came from were both here and both removed: a grade is a fact about
      // the Japanese school system, not about the character, and a data-source
      // name means nothing to a beginner. Attribution is not lost — the entry
      // page foot credits every source.
      sub: `${k.strokes} stroke${k.strokes === 1 ? "" : "s"}`,
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
      // No source name here either. See the kanji sub-line above.
      sub: "Everyday word",
      weight: 10_000 + (w.newspaperBand ?? 60),
    });
  }

  // Grammar patterns are entries too — the pattern is the glyph, the gloss is
  // the meaning, and there is NO reading because a pattern has no single
  // pronunciation (see the tile, which omits 🔊 for these). They sort last in
  // browse order, after every word.
  RECIPES.forEach((r, i) => {
    const c = r.cluster ? cluster(r.cluster) : undefined;
    out.push({
      id: patternEntry(r.id),
      kind: GRAMMAR_SUBJECT,
      glyph: r.pattern,
      readings: [],
      meanings: [r.gloss],
      searchAlso: c ? [c.title] : undefined,
      sub: c ? `${r.level} pattern · ${c.title}` : `${r.level} pattern`,
      // A LOW weight, below kanji — the one kind that outranks it. This is the
      // owner's "make sure search surfaces grammar properly" as a number: when
      // you type "must", the seven obligation PATTERNS are the answer, and a
      // word like 糾合 ("muster") that merely starts with your letters is not.
      // A high weight would bury the patterns under every incidental match; a
      // low one puts them where "how do I say must" is answered. Only meaning
      // searches pit grammar against other kinds — a pattern's glyph (〜てから)
      // rarely collides with a word or a kanji — so leading there costs the
      // other kinds nothing they were winning.
      weight: 500 + i,
    });
  });

  return out;
}

/** entry id → its recipe, for the grammar-only lookups below. Built off the
 * same RECIPES walk `build()` uses, so it cannot name an entry that walk did
 * not mint. */
const RECIPE_OF_ENTRY: ReadonlyMap<EntryId, Recipe> = new Map(
  RECIPES.map((r) => [patternEntry(r.id), r]),
);

/**
 * The cluster a grammar entry belongs to — the "compare similar patterns" view
 * its detail page links out to. Null for a pattern in no cluster, and for every
 * non-grammar entry.
 */
export function clusterOf(entry: LibEntry): string | null {
  return RECIPE_OF_ENTRY.get(entry.id)?.cluster ?? null;
}

/**
 * The recipe behind a grammar entry, or null for every other kind.
 *
 * The entry page needs the RECIPE and not just its cluster: the formula, the
 * hosts it attaches to and which production facts it carries all live on the
 * recipe, and the page had no way to reach it that was not re-deriving the id.
 * A lookup, never a parse — the same rule `clusterOf` follows and the same map.
 */
export function recipeOf(entry: LibEntry): Recipe | null {
  return RECIPE_OF_ENTRY.get(entry.id) ?? null;
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
    // A mark is not resolved by its glyph either, and for a stronger reason than
    // grammar's: っ IS a kana glyph as well as a mark, ゃゅょ is three glyphs in
    // one entry, and long vowels has none. Mark links are minted from the mark's
    // own id (`markEntry`), so nothing asks this.
    case MARK_SUBJECT:
      return null;
    // A pattern is not resolved by its glyph — 〜て is te-sequence AND te-cause,
    // so a glyph names no single grammar entry. Grammar links are minted from a
    // recipe id, never from a glyph, so nothing asks for this.
    case GRAMMAR_SUBJECT:
      return null;
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
  /**
   * Where this reading's SOUND came from, in beginner English — the answer to
   * "why do 一's いち and ひと sound nothing like each other".
   *
   * The words "on'yomi" and "kun'yomi" are never used. They name the thing for
   * someone who already knows it; the learner reading this table does not, and
   * a label she has to look up is not a label. "from Chinese" / "native
   * Japanese" says the same thing in words that already mean something, and the
   * note under the table carries the one detail the phrase cannot: that the
   * borrowed reading is the compound-word one.
   *
   * `null` for every row that is not a kanji reading (a kana's romaji, a word's
   * reading, a grammar pattern) — those have no such distinction, and printing
   * an empty column for them would invent one.
   */
  readonly origin: "from Chinese" | "native Japanese" | "both" | null;
  /**
   * The kana to SPEAK for this row, or null when there is nothing to say.
   *
   * Null is the common case and the honest one: a grammar pattern has no single
   * pronunciation (the same reason the page's Hear-it button is omitted for
   * grammar), and a meaning row's answer is English. Only a row whose label IS
   * Japanese sound gets a speaker.
   */
  readonly speak: string | null;
}

/**
 * What the entry page's facts table is CALLED, per kind.
 *
 * It used to be a sentence generated from the row count — "一 is one character
 * and 4 things to know" — which was accurate and unreadable, and which lost its
 * only justification when the meaning row left the kanji table. A heading names
 * the thing under it; these do.
 *
 * PER KIND, because the table is not the same table four times. Only kanji and
 * kana hold readings and nothing else. A word holds its reading AND its
 * meaning, which are separately scored and both belong. Grammar holds a meaning
 * and, when the pattern is producible, the form it builds — calling that
 * "Readings" would be false twice over.
 */
export function factsTitle(entry: LibEntry, rows: readonly FactRow[]): string {
  switch (entry.kind) {
    case KANA_SUBJECT:
      return "Reading";
    case KANJI_SUBJECT:
      return rows.length === 1 ? "Reading" : "Readings";
    case VOCAB_SUBJECT:
      return "Reading and meaning";
    case GRAMMAR_SUBJECT:
      // A non-producible pattern (は〜より, たり〜たり) has ONLY the meaning row,
      // so promising a form here would be promising a row that is not there.
      return rows.length > 1 ? "Meaning and form" : "Meaning";
    // A mark never has rows (see factRows), so this string never reaches a
    // screen — the page's `rows.length > 0` guard drops the whole section first.
    // It is here because the switch is exhaustive and because a silent `""` for
    // a kind that later grew a fact would ship a headed table with no heading.
    case MARK_SUBJECT:
      return "Nothing to test";
  }
}

/**
 * The first column's header, which is the same honesty problem one level down.
 *
 * It said "Reading" for every kind. For kanji that is now true (the meaning row
 * that made it false has gone) and for kana it always was. For a word the
 * column holds a reading AND a meaning, and for a pattern a meaning and a
 * build-it; "Reading" names neither. Those get a header that describes the
 * column it actually heads.
 */
export function factsColumnHeader(entry: LibEntry): string {
  return entry.kind === KANA_SUBJECT || entry.kind === KANJI_SUBJECT
    ? "Reading"
    : "What it asks";
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
          origin: null,
          speak: entry.glyph,
        },
      ];
    case KANJI_SUBJECT:
      return kanjiFactRows(entry);
    // A word KEEPS its meaning row. The kanji table could drop one because what
    // remained was still a table; here the two rows ARE the word — its reading
    // and its meaning are separately scored, and dropping either leaves a
    // one-row table that no longer says what the app tests.
    case VOCAB_SUBJECT:
      return [
        {
          id: wordReadingFactId(entry.glyph),
          label: "Reading",
          answer: entry.readings[0] ?? "",
          askedIn: [],
          unattested: false,
          origin: null,
          // The word's own kana. Speaking the reading rather than the written
          // form is the point: 先生 read aloud by a synthesiser is a coin flip,
          // せんせい is not.
          speak: entry.readings[0] ?? null,
        },
        {
          id: wordMeaningFactId(entry.glyph),
          label: "Meaning",
          answer: entry.meanings.join(", "),
          askedIn: [],
          unattested: false,
          origin: null,
          speak: null,
        },
      ];
    case GRAMMAR_SUBJECT:
      return grammarFactRows(entry);
    // A MARK HAS NO FACTS AT ALL, and this empty array is the shape of that
    // rather than a stub. "What is a dakuten" has no gradeable answer; the rule
    // is read, not tested, and the thing that IS testable — きて vs きって — is a
    // question about a WORD and is scored against the word's facts.
    //
    // It follows the precedent this table already sets: no rows, no section. The
    // entry page's `rows.length > 0` guard (there for the 114 kanji with no
    // attested reading) drops the whole box, so a mark page has no facts table
    // instead of an empty one. Nothing here had to be added for that to work.
    case MARK_SUBJECT:
      return [];
  }
}

/**
 * A grammar entry's facts: what it MEANS, and — when it is producible — the form
 * it BUILDS, shown on the fixed representative verb the drill uses. A vacuous or
 * wrap pattern (は〜より, たり〜たり) has only the meaning row, which is the
 * same "shown, never asked" honesty the cluster page keeps.
 */
// HOST_LABEL — what a host is called on screen — used to be a private copy
// here. It is now imported from lib/grammar/formula.ts, because the entry page
// names hosts in three more places (the line under the pattern, the production
// chips, the formula's slot) and four copies of "い-adjective" are four chances
// to disagree about it.

function grammarFactRows(entry: LibEntry): FactRow[] {
  const r = RECIPE_OF_ENTRY.get(entry.id);
  if (!r) return [];
  const rows: FactRow[] = [
    {
      id: patternMeaningFactId(r.id),
      label: "Meaning",
      answer: r.gloss,
      askedIn: [],
      unattested: false,
      origin: null,
      // A pattern is a shape, not a sound — 〜てから has no one pronunciation,
      // which is why the page's Hear-it button is omitted for grammar too.
      speak: null,
    },
  ];
  // ONE ROW PER PRODUCTION FACT, which is one per host that carries one. The
  // page is a list of the entry's FACTS, so a pattern with a separate adjective
  // fact has to show it — otherwise the split exists in the scheduler and the
  // one screen that promises to enumerate what is scored still says there is a
  // single "Build it". The label names the host for the same reason.
  const hosts = isProducible(r) ? productionHosts(r) : [];
  {
    for (const host of hosts) {
      const ex = buildExample(r, host);
      if (!ex) continue;
      rows.push({
        id: patternProductionFactId(r.id, host),
        // The host is named only when there is something to tell apart. One
        // production fact needs no qualifier, and adding "(verb)" to all 45 of
        // them to be uniform would be noise on every page to serve five.
        label: hosts.length > 1 ? `Build it (${HOST_LABEL[host]})` : "Build it",
        answer: `${ex.lemma} → ${ex.form}`,
        askedIn: [],
        unattested: false,
        origin: null,
        speak: null,
      });
    }
  }
  return rows;
}

/** How a reading's KANJIDIC2 type reads to someone who has never heard the
 * words on'yomi and kun'yomi. See FactRow.origin. */
const ORIGIN_LABEL = {
  on: "from Chinese",
  kun: "native Japanese",
  // KANJIDIC2 lists the same reading under both types for different senses.
  // Said out loud rather than resolved: the dictionary declines to choose, so
  // this does too.
  both: "both",
} as const;

/**
 * A kanji's rows: ONE PER READING, and no meaning row.
 *
 * The meaning row used to lead this table, which made the "Reading" column
 * header a lie about its own first row — 一's read as "one, one radical
 * (no.1)", which is neither a reading nor, as it turns out, a meaning. The
 * meaning is already the page's title, so the row was duplicating it; what the
 * row uniquely carried was its own scoring, and that moved to a StandingChip
 * beside the definition rather than being lost. See the entry page.
 */
function kanjiFactRows(entry: LibEntry): FactRow[] {
  const rows: FactRow[] = [];
  for (const r of readingsOf(entry.glyph)) {
    rows.push({
      id: readingFactId(r.k, r.anchor),
      label: r.base,
      origin: r.type ? ORIGIN_LABEL[r.type] : null,
      speak: r.base,
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
