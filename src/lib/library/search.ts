// Library search — RANKED AND SECTIONED, which is the whole design.
//
// WHY NOT A FILTER
// ================
// The kana chart's search field is a filter: it keeps every character whose
// glyph or romaji contains the query, in data order. That is correct for 214
// characters, all of which are one keystroke long.
//
// It does not survive 9,761 entries, and not because of speed. Substring-match
// で over the words and 142 results come back IN ARBITRARY ORDER, with the
// particle で — the thing you typed, and the thing you meant — somewhere in the
// middle of them. The result set is right and the answer is missing.
//
// So the query is not "which entries contain this", it is "what did you mean".
// The sections ARE the answer to that, in order:
//
//   Exact entry .................. you typed a thing. Here it is.
//   Starts with .................. you typed the front of a thing.
//   Means that ................... you typed English.
//   Appears inside ............... you typed a part of many things.
//   As a form of something else .. you typed an inflection. NOT BUILT — see the
//                                  seam at the bottom of this file.
//
// A section header does the work a relevance score cannot: it tells you WHY a
// row is in front of you, so the 142 containment hits stop competing with the
// exact hit and become what they are, a separate and honest list underneath it.
//
// COST
// ====
// One pass over LIB_ENTRIES per query — ~9,761 entries, a handful of string ops
// each, ~1–2ms. That is affordable per keystroke and is why there is no trie
// here: an index would buy ~1ms and cost the ability to read this file. If it
// ever stops being affordable, the fix is `useDeferredValue` (already on the
// page) before it is a data structure.

import { CHAR_INDEX } from "@/data/characters";
import { LIB_ENTRIES, type Kind, type LibEntry } from "@/lib/library/entries";

/** Why a row is in the list. The section IS the ranking's explanation. */
export type MatchKind = "exact" | "prefix" | "meaning" | "inside" | "form";

/** What each section is called on screen. */
export const SECTION_LABEL: Record<MatchKind, string> = {
  exact: "Exact entry",
  prefix: "Starts with",
  meaning: "Means that",
  inside: "Appears inside",
  form: "As a form of something else",
};

export interface Hit {
  readonly entry: LibEntry;
  readonly why: MatchKind;
  /** Lower is better, within a section only. Never compared across sections —
   * the section order already decided that. */
  readonly score: number;
}

export interface Section {
  readonly why: MatchKind;
  readonly label: string;
  readonly hits: readonly Hit[];
  /** Hits beyond `hits` — the "Show the other 140 →" count. The rows are not
   * carried: nobody needs 140 objects to render the word "140". */
  readonly more: number;
}

export interface SearchOpts {
  /** Restrict to one shelf — the All / Kana / Kanji / Words chips. */
  readonly kind?: Kind | null;
  /** Rows per section before it collapses to "show the other N". */
  readonly perSection?: number;
  /**
   * Entries you have filed on a list, which sort to the front of a section.
   *
   * The design's "your pinned lists first", and it is the one piece of YOUR
   * state that reaches the ranking. It is a tie-break inside a section and never
   * moves a row between sections: what you have filed changes which of 142
   * containment hits you see first, and does not make a containment hit into an
   * exact one.
   */
  readonly pinned?: ReadonlySet<string>;
}

const DEFAULT_PER_SECTION = 8;

/** The order sections appear in. Not alphabetical, not by hit count — by how
 * likely each is to be what you meant. */
const SECTION_ORDER: readonly MatchKind[] = [
  "exact",
  "prefix",
  "form",
  "meaning",
  "inside",
];

/**
 * What you meant, in sections.
 *
 * An empty query returns no sections at all rather than everything — the
 * Library's browse shelves are a different screen state, not "search for
 * nothing", and returning 9,761 rows here would make that the caller's problem.
 */
export function search(query: string, opts: SearchOpts = {}): Section[] {
  const q = query.trim();
  if (!q) return [];
  const lower = q.toLowerCase();
  const perSection = opts.perSection ?? DEFAULT_PER_SECTION;
  const pinned = opts.pinned;

  const buckets = new Map<MatchKind, Hit[]>();
  for (const entry of LIB_ENTRIES) {
    if (opts.kind && entry.kind !== opts.kind) continue;
    const why = classify(entry, q, lower);
    if (!why) continue;
    const list = buckets.get(why) ?? [];
    list.push({
      entry,
      why,
      score:
        // Pinned first, then the crude everyday-ness, then shorter glyphs. The
        // length tie-break is what puts 出口 above 出入国管理: when nothing else
        // separates two containment hits, the shorter word is the one you are
        // likelier to have meant, and it is the one you can read.
        (pinned?.has(entry.id) ? 0 : 1_000_000) +
        entry.weight * 10 +
        entry.glyph.length,
    });
    buckets.set(why, list);
  }

  const sections: Section[] = [];
  for (const why of SECTION_ORDER) {
    const hits = buckets.get(why);
    if (!hits?.length) continue;
    hits.sort((a, b) => a.score - b.score);
    sections.push({
      why,
      label: SECTION_LABEL[why],
      hits: hits.slice(0, perSection),
      more: Math.max(0, hits.length - perSection),
    });
  }
  return sections;
}

/** Every hit for a query, unsectioned and uncapped — what the drill bar's slice
 * is over, and what "show the other 140" expands. The bar quizzes what the
 * SEARCH found, not what the page happened to have room for. */
export function searchAll(query: string, opts: SearchOpts = {}): Hit[] {
  return search(query, { ...opts, perSection: Number.MAX_SAFE_INTEGER }).flatMap(
    (s) => [...s.hits],
  );
}

/**
 * How `entry` matches `q`, or null. The first match wins, in section order —
 * an entry appears in exactly one section, because "生 is both the exact hit and
 * inside 学生" is not two answers, it is one answer and one distraction.
 */
function classify(entry: LibEntry, q: string, lower: string): MatchKind | null {
  if (entry.glyph === q) return "exact";
  // A reading typed in kana (せんせい) or a kana's romaji (shi). Both are "you
  // typed how it sounds", and both name exactly one entry, so both are exact.
  if (entry.readings.some((r) => r === q || r.toLowerCase() === lower)) {
    return "exact";
  }
  if (entry.glyph.startsWith(q)) return "prefix";
  if (entry.readings.some((r) => r.startsWith(q) || r.toLowerCase().startsWith(lower))) {
    return "prefix";
  }
  if (matchesMeaning(entry, lower)) return "meaning";
  if (entry.glyph.includes(q)) return "inside";
  return null;
}

/**
 * English matching, on WORD BOUNDARIES and not substrings.
 *
 * "raw" must not match "drawer", and a plain `includes` does. The glosses are
 * short phrases ("life, birth, raw"), so splitting on non-letters and comparing
 * whole tokens is both cheaper and better than a regex — and a token that STARTS
 * with the query still counts, so "tele" finds "telephone" while "raw" does not
 * find "drawer".
 */
function matchesMeaning(entry: LibEntry, lower: string): boolean {
  if (!lower || !/[a-z]/.test(lower)) return false;
  for (const m of entry.meanings) {
    for (const token of m.toLowerCase().split(/[^a-z0-9]+/)) {
      if (token && token.startsWith(lower)) return true;
    }
  }
  return false;
}

/**
 * Is this query Japanese? Used by the page to decide whether "Means that" is
 * even worth a chip. Cheap and approximate on purpose — being wrong costs an
 * empty section, which the renderer already drops.
 */
export function isJapanese(q: string): boolean {
  return /[぀-ヿ㐀-鿿]/.test(q);
}

/** True when the query is a kana character the app teaches — the one case where
 * the chart's romaji index is the right answer and the entry index is not. */
export function isKnownKana(q: string): boolean {
  return Boolean(CHAR_INDEX[q]);
}

// ---------- THE DEINFLECTION SEAM ----------
//
// `form` is a real section with a real label and NO PRODUCER. Searching 読んで
// finds nothing today, and that is a decision, not an oversight: the user's
// words were "ship without it for now."
//
// The answer is known and is a separate task — precompute every form FORWARD
// (each verb's ~30 inflections, keyed by surface, ~320KB gzipped) rather than
// deinflecting the query backward, because forward generation is what
// src/lib/conjugate/ already does and it cannot be wrong about a form it
// generated. Backward deinflection has to guess, and guesses have to be ranked,
// and a wrong guess in the "Exact entry" section is worse than an absent one.
//
// When it lands, it lands HERE: one function that maps a query to
// `{ entry, via }` rows, one `buckets.set("form", …)` in `search`, and nothing
// else in this file or any screen changes — the section, its label, its position
// in SECTION_ORDER and its place in the drill slice already exist and are
// already exercised by everything except the data.
//
// The seam is left deliberately EMPTY rather than stubbed with a fake producer.
// A stub that returns [] and a section that never populates look identical on
// screen; a stub also looks tested. This way the absence is the code.
