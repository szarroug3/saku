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

import { digitVariants } from "@/lib/engine/en-match";
import { KIND_LABEL, KINDS, LIB_ENTRIES } from "@/lib/library/library-index";
import type { Kind, LibEntry } from "@/lib/library/entries";
import { isKanaOnly, toHiragana, toKana } from "@/lib/romaji";

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
  /**
   * Keep only the entries this returns true for — the Library's knowledge
   * filter (Known / Not known). It runs BEFORE the per-section cap, so a filter
   * that drops half the matches still fills the section and the "show the other
   * N" count reflects the filtered population, not the raw one. Absent keeps
   * everything, which is the All filter and every caller that doesn't filter.
   */
  readonly keep?: (entry: LibEntry) => boolean;
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

/** A match kind's rank, from SECTION_ORDER — used by `searchByType`, where one
 * type's block mixes match kinds and must lead with the exact hits. Lower is
 * better; derived from the array so the two orderings cannot drift. */
const MATCH_RANK: Record<MatchKind, number> = Object.fromEntries(
  SECTION_ORDER.map((why, i) => [why, i]),
) as Record<MatchKind, number>;

/**
 * Every entry that matches, one Hit each, UNSECTIONED — the shared first pass
 * both `search` (bucket by WHY) and `searchByType` (bucket by KIND) run before
 * they group. One walk of LIB_ENTRIES, honouring the kind restriction and the
 * knowledge filter; the caller decides how to slice the result.
 */
function collectHits(q: string, lower: string, opts: SearchOpts): Hit[] {
  const pinned = opts.pinned;
  // The romaji query as the kana a reader meant by it — computed ONCE, not per
  // entry, since it depends only on the query. null when the query is not
  // romaji-for-a-pronunciation, which leaves classify on its original paths.
  const romaji = romajiReading(lower);
  const hits: Hit[] = [];
  for (const entry of LIB_ENTRIES) {
    if (opts.kind && entry.kind !== opts.kind) continue;
    if (opts.keep && !opts.keep(entry)) continue;
    const why = classify(entry, q, lower, romaji);
    if (!why) continue;
    hits.push({
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
  }
  return hits;
}

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

  const buckets = new Map<MatchKind, Hit[]>();
  for (const hit of collectHits(q, lower, opts)) {
    const list = buckets.get(hit.why) ?? [];
    list.push(hit);
    buckets.set(hit.why, list);
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

/** One type's block of search results — a Kanji table, a Words table. Same
 * shape as a `Section`, cut a different way: `search` groups the hits by HOW
 * they matched (exact / prefix / …), `searchByType` groups them by WHAT they
 * are, which is what the All tab shows. */
export interface TypeSection {
  readonly kind: Kind;
  /** The shelf's own name — "Kanji", "Radicals", "Words". */
  readonly label: string;
  readonly hits: readonly Hit[];
  /** Hits beyond `hits` — the "＋ N more" count, over the filtered population. */
  readonly more: number;
}

/**
 * A search bucketed BY TYPE — the All tab's answer.
 *
 * One block per subject that has a match, in the curriculum TEACHING ORDER the
 * shelves use (KINDS: kana → radicals → kanji → words → …), so the grouped
 * results read in the same sequence a learner meets the subjects in. A subject
 * with no match is ABSENT — no empty header — exactly the way the filtered
 * shelves drop an emptied section.
 *
 * Within a block the hits mix match kinds (a Words block holds both the word you
 * typed and the words it appears inside), ordered exact-first by MATCH_RANK and
 * then by the same score `search` uses. It ALWAYS spans every kind — the type IS
 * the grouping here, so a `kind` restriction would defeat the purpose; the
 * per-subject tabs, which stay scoped, call `search` with their kind instead.
 */
export function searchByType(query: string, opts: SearchOpts = {}): TypeSection[] {
  const q = query.trim();
  if (!q) return [];
  const lower = q.toLowerCase();
  const perSection = opts.perSection ?? DEFAULT_PER_SECTION;

  const buckets = new Map<Kind, Hit[]>();
  for (const hit of collectHits(q, lower, { ...opts, kind: null })) {
    const list = buckets.get(hit.entry.kind) ?? [];
    list.push(hit);
    buckets.set(hit.entry.kind, list);
  }

  const sections: TypeSection[] = [];
  for (const kind of KINDS) {
    const hits = buckets.get(kind);
    if (!hits?.length) continue;
    hits.sort((a, b) => MATCH_RANK[a.why] - MATCH_RANK[b.why] || a.score - b.score);
    sections.push({
      kind,
      label: KIND_LABEL[kind],
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
function classify(
  entry: LibEntry,
  q: string,
  lower: string,
  romaji: string | null,
): MatchKind | null {
  // A grammar pattern is written with a leading (or middle) 〜 placeholder —
  // 〜てから, 〜は〜より. Nobody types the 〜, so the JP comparisons run over both
  // strings with it stripped: "てから" then EXACTLY matches 〜てから, and surfaces
  // it as the answer rather than burying it under "Appears inside". The strip is
  // a no-op for every non-grammar glyph (none contains 〜), so this costs those
  // nothing and changes none of their results.
  const glyphBare = stripTilde(entry.glyph);
  const qBare = stripTilde(q);
  if (entry.glyph === q || (qBare !== "" && glyphBare === qBare)) return "exact";
  // AN ALIAS, MATCHED EXACTLY. `searchAlso` used to be reachable only through
  // `matchesMeaning`, which bails on any query with no [a-z] in it — so the alias
  // index was English-only, and a Japanese alias was dead weight nobody could
  // type their way to.
  //
  // Marks are what exposed that. "Long vowels" has NO GLYPH (the rule is written
  // ー in katakana and by doubling a vowel in hiragana), so the three glyph tests
  // above can never match it and typing ー — the obvious thing to type — found
  // nothing at all. The alias carries ー; this line is what lets it answer.
  //
  // EXACT, and only exact. An alias is a name someone typed on purpose, so a
  // whole-string hit is as good an answer as a glyph hit; a substring hit is not,
  // and promoting one into the "Exact entry" section is exactly the wrong-answer-
  // in-the-right-place failure this file's ranking exists to avoid.
  if (entry.searchAlso?.some((a) => a === q)) return "exact";
  // A reading typed in kana (せんせい) or a kana's romaji (shi). Both are "you
  // typed how it sounds", and both name exactly one entry, so both are exact.
  if (entry.readings.some((r) => r === q || r.toLowerCase() === lower)) {
    return "exact";
  }
  // The same "you typed how it sounds", but typed as ROMAJI for a JP reading —
  // "shito" for 使徒 (しと), "kore" for これ. `romaji` is the query already
  // converted to kana (or null when it isn't romaji-for-a-reading); we compare it
  // to the entry's kana the way the line above compares raw kana, folding the
  // entry to hiragana so a katakana reading (コーヒー) still answers. A kana
  // entry's readings are romaji, not kana, so they can't collide here — those are
  // matched by the literal-romaji line above.
  if (romaji && matchesRomaji(entry, glyphBare, romaji, (a, b) => a === b)) {
    return "exact";
  }
  if (entry.glyph.startsWith(q) || (qBare !== "" && glyphBare.startsWith(qBare))) {
    return "prefix";
  }
  if (entry.readings.some((r) => r.startsWith(q) || r.toLowerCase().startsWith(lower))) {
    return "prefix";
  }
  if (romaji && matchesRomaji(entry, glyphBare, romaji, (a, b) => a.startsWith(b))) {
    return "prefix";
  }
  if (matchesMeaning(entry, lower)) return "meaning";
  if (entry.glyph.includes(q) || (qBare !== "" && glyphBare.includes(qBare))) {
    return "inside";
  }
  return null;
}

/** The searchable form of a pattern: its 〜 slot markers removed. */
function stripTilde(s: string): string {
  return s.replace(/〜/g, "");
}

/**
 * A romaji query rendered as the kana a reader meant by it, or null when the
 * query is not romaji standing in for a pronunciation.
 *
 * The app already grades romaji answers with this exact converter, so a learner
 * who types "shito" without an IME should be able to FIND 使徒 the same way they
 * can answer it. We run the query through toKana once and hand the result to the
 * kana comparisons classify already does.
 *
 * The isKanaOnly gate is load-bearing. A real English query is romaji-shaped too
 * ("water"), but toKana leaves the letters it can't spell in place ("water" →
 * わてr), so only a query that converts CLEANLY to kana travels this path —
 * exactly the set someone typed as sound. Folded to hiragana so the kana we hand
 * back compares equal against a katakana reading downstream.
 */
function romajiReading(lower: string): string | null {
  if (!/[a-z]/.test(lower)) return null;
  const kana = toKana(lower);
  return isKanaOnly(kana) ? toHiragana(kana) : null;
}

/** Does the entry's kana (its glyph or any reading, folded to hiragana) relate
 * to the romaji-derived `romaji` under `cmp` — whole-string for exact, prefix
 * for prefix? Mirrors the raw-kana glyph/reading tests so romaji is just another
 * spelling of the same comparison, and never runs for a query that isn't romaji.
 */
function matchesRomaji(
  entry: LibEntry,
  glyphBare: string,
  romaji: string,
  cmp: (kana: string, romaji: string) => boolean,
): boolean {
  if (glyphBare !== "" && cmp(toHiragana(glyphBare), romaji)) return true;
  return entry.readings.some((r) => cmp(toHiragana(r), romaji));
}

/**
 * English matching, on WORD BOUNDARIES and not substrings — and now on PHRASES.
 *
 * "raw" must not match "drawer", and a plain `includes` does. The glosses are
 * short phrases ("life, birth, raw"), so both the gloss and the QUERY are split
 * on the same non-letter boundary into tokens, which is cheaper and better than a
 * regex. A single-token query matches when a gloss token STARTS with it, so
 * "tele" finds "telephone" while "raw" does not find "drawer".
 *
 * WHY THE QUERY IS TOKENIZED TOO. It used to be compared INTACT against each
 * single gloss token, so any query with a space or punctuation — "line (of",
 * "line of text" — could never equal a one-word token and found nothing, even
 * against the gloss "line (of text), row, verse" that literally contains it. Now
 * a multi-token query matches when its tokens are a CONSECUTIVE run of the
 * gloss's tokens: every token before the last exactly, the last as a prefix (so
 * "line of te" still reaches "...text"). A single token is just the length-one
 * case of that, so the old behavior is preserved exactly.
 *
 * DIGIT FORM OF A SPELLED NUMBER (SAK-168). A digit query — "4" — also finds a
 * gloss that spells the number out — "four" — the same way the quiz grader
 * accepts a digit in place of a spelled number (en-match.ts's `digitVariants`,
 * its layer 3; see that file for `isNumberToken`/`runValue`, the token-level
 * parsing it composes). Reused, not reimplemented: `digitVariants` is run over
 * the GLOSS's own tokens — already split the same word-boundary way the plain
 * match above uses — and each digit-composed variant is tried as a token run
 * against the query exactly like the raw gloss tokens are. Gated on the query
 * itself containing a digit, both to skip the extra work on the overwhelming
 * majority of queries that could never match this way, and because a query
 * with no digit has nothing for this branch to find (a spelled-word query
 * against a spelled-word gloss is already the plain match above).
 *
 * ONE DIRECTION ONLY, DELIBERATELY. The reverse — typing "four" to find a
 * gloss that already says "4" — was considered and left out: every entry in
 * the current data that carries a bare-digit gloss ("1", "10,000", …) already
 * carries the spelled form as a sibling gloss on the SAME entry ("one", "ten
 * thousand", …), so the plain match above already finds it — the reverse
 * parse would be dead code against real data, not a real gap.
 */
function matchesMeaning(entry: LibEntry, lower: string): boolean {
  // A Latin letter OR a digit — the digit half is SAK-168: "4" alone has no
  // letter, and it must still reach the digit-variant branch below rather than
  // bail out here the way a Japanese-only query (no letters, no digits) does.
  if (!lower || !/[a-z0-9]/.test(lower)) return false;
  const qTokens = lower.split(/[^a-z0-9]+/).filter(Boolean);
  if (qTokens.length === 0) return false;
  const qHasDigit = /\d/.test(lower);
  // The glosses, plus a grammar entry's cluster title — "seems" finds the whole
  // evidential family, not just the one member whose gloss happens to say it.
  for (const m of [...entry.meanings, ...(entry.searchAlso ?? [])]) {
    const gTokens = m.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
    if (phraseRun(gTokens, qTokens)) return true;
    if (qHasDigit) {
      for (const variant of digitVariants(gTokens.join(" "))) {
        if (phraseRun(variant.split(" "), qTokens)) return true;
      }
    }
  }
  return false;
}

/** Do `qTokens` appear as a consecutive run inside `gTokens` — every query token
 * before the last matching a gloss token exactly, the last allowed to be a
 * prefix? This is what keeps the word boundary ("raw" is a whole token, never a
 * loose substring of "drawer") while letting a partial phrase land. */
function phraseRun(gTokens: string[], qTokens: string[]): boolean {
  const last = qTokens.length - 1;
  for (let i = 0; i + last < gTokens.length; i++) {
    let ok = true;
    for (let j = 0; j < qTokens.length; j++) {
      const g = gTokens[i + j];
      const matched = j === last ? g.startsWith(qTokens[j]) : g === qTokens[j];
      if (!matched) {
        ok = false;
        break;
      }
    }
    if (ok) return true;
  }
  return false;
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
