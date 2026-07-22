// An entry's URL.
//
// WHY IT IS /library/kanji/生 AND NOT /library/生
// ==============================================
// The design mocks the entry page at `/library/生`, and it is prettier. It is
// also not implementable, because of the one rule the id model has:
//
//   A GLYPH IS NOT AN IDENTITY. FactInfo.glyph says so in its own comment —
//   "DISPLAY ONLY: it is not an identity and two entries may legitimately share
//   one." And they do, right now, in the shipped data: 生 is a jōyō kanji AND an
//   everyday word (なま, "raw"), so `kanji:生` and `word:生` are two entries with
//   one glyph and two different pages. 気, 目, 手, 花 and ~600 others are the
//   same. `/library/生` cannot say which one it means.
//
// THE KIND SEGMENT IS WHAT MAKES A READABLE URL POSSIBLE. `/library/kanji/生`
// and `/library/word/生` are two paths, so a glyph only has to be unique WITHIN
// its kind — which it is, because each subject's table is keyed by it. The
// segment is not a `?kind=` bolted onto a glyph: it is the shelf, it is in every
// breadcrumb already, and a reader can tell what page they are on from the URL.
//
// NOTHING HERE PARSES AN ID, and that is why the slug is not "the id after the
// colon" even though that is what it looks like. Every slug comes from the
// SOURCE DATA — a glyph from CHAR_INDEX/KANJI/RADICALS/VOCAB, `Recipe.id`,
// `Mark.id`, a `VerbPair`'s two written forms — paired with the id its own
// subject's minter produces for that same row. So the index is a join, exactly
// like the rest of the Library (see entries.ts), and if id grammar changes
// tomorrow nothing in this file notices.
//
// WHY ROMAJI FOR KANA AND ONLY FOR KANA
// =====================================
// Romaji reads better than a glyph for a thing that IS a sound: `/library/
// hiragana/kya` says more than `/library/hiragana/きゃ`. It does not generalise.
// Measured over the shipped data, 15.3% of words and 80.1% of kanji collide on
// romaji — "kou" alone is 50 kanji — so romaji would turn most of the Library
// into `kou-37`. Kana are ~unique: 204 of 214 have a unique first spelling, and
// the 10 that collide (じ/ぢ, ず/づ and the three yōon pairs) each carry an
// alternate in their own `r` array, so first-unclaimed-wins in table order
// resolves them with no special case. See href.test.ts, which asserts the
// outcome rather than the rule.
//
// THE KIND SEGMENT FOR KANA IS THE SCRIPT — `hiragana` or `katakana`, not
// `kana`. It has to be: あ and ア are one kind and two entries with the same
// romaji, so `kana` alone could not tell them apart, and the script is the word
// a reader would have used anyway.
//
// JAPANESE CHARACTERS IN THE PATH ARE INTENDED. What this file GENERATES is
// unencoded — a browser shows `/library/kanji/生` in the bar and encodes on the
// wire by itself. What it READS is decoded first, because Next hands a page the
// raw path segment: see `glyphFromParam`.
//
// LEGACY URLS STILL RESOLVE. `/library/<encoded-id>` is what every bookmark and
// stored link made before this change says, so the one-segment `[entry]` route
// stays and `entryFromParam` still unwraps it.

import type { EntryId } from "@/types";
import { CHAR_INDEX, KANA_SUBJECT } from "@/data/characters";
import { MARKS, markEntry } from "@/data/marks";
import { TERMS, termEntry } from "@/data/terms";
import { patternEntry } from "@/data/grammar";
import { RECIPES } from "@/data/grammar/recipes";
import { VERB_PAIRS } from "@/data/transitivity";
import { pairEntry } from "@/data/transitivity-facts";
import { KEIGO_SETS, keigoSetEntry } from "@/data/keigo";
import { LIB_ENTRIES, type LibEntry } from "@/lib/library/entries";

const ENTRY_PATH = new Map<EntryId, string>();
const SLUG_TO_ENTRY = new Map<string, EntryId>();

/** Where an entry's page lives. */
export function entryHref(id: EntryId): string {
  return ENTRY_PATH.get(id) ?? `/library/${encodeURIComponent(id)}`;
}

/**
 * The entry id for a kind/slug Library route, or null.
 *
 * BOTH HALVES ARE DECODED FIRST. Next 16 hands a page the raw path segment, and
 * what lands there depends on who typed it: a click from inside the app arrives
 * as `生`, a paste of the same URL out of a browser bar arrives as `%E7%94%9F`,
 * and both name the same page. The index is keyed by the decoded form, so both
 * are decoded before the lookup rather than one being guessed at.
 *
 * The result is unvalidated by construction — a URL can say anything — but this
 * is a Map lookup, so a stranger comes back null and the route 404s.
 */
export function entryFromSlug(kind: string, slug: string): EntryId | null {
  const key = `${glyphFromParam(kind)}/${glyphFromParam(slug)}`;
  return SLUG_TO_ENTRY.get(key) ?? null;
}

/**
 * Where a radical primitive's page lives — /radical/%E3%83%8E for ノ.
 *
 * THE GLYPH IS THE ID HERE, and that is not a contradiction of everything
 * above. The argument against /library/生 is that a glyph names no entry
 * uniquely: 生 is a kanji AND a word, two entries, one shape. A primitive has
 * the opposite property by construction — the 82 are exactly the components
 * with NO entry of any kind (see data/components.ts), so `｜` names one thing
 * or nothing, and there is no id to be opaque about because these are not
 * entries and have no ids. The route is separate from /library for the same
 * reason /grammar/[cluster] is: what is on the page is not an entry, has no
 * facts and is never scored.
 *
 * The encode is transport, exactly as above; the route decodes with
 * `entryFromParam`'s twin and hands the result to a Map lookup that answers
 * undefined for a stranger.
 */
export function radicalHref(glyph: string): string {
  return `/radical/${encodeURIComponent(glyph)}`;
}

/**
 * The id a LEGACY one-segment route param carries.
 *
 * IT DECODES, and that is not obvious — this function was a bare cast for an
 * hour, on the reasonable-sounding belief that the router hands a page its
 * params already decoded. IT DOES NOT: Next 16 delivers the raw path segment, so
 * `/library/kanji%3A%E7%94%9F` arrives as the 17-character string
 * "kanji%3A%E7%94%9F", the Map lookup misses, and every entry page in the app
 * 404s. It type-checks perfectly — `string` in, `EntryId` out, a valid brand on
 * a value that names nothing — and the only way to find it is to open one.
 *
 * `decodeURIComponent` throws on a malformed sequence ("%E0%A4%A"), which a URL
 * bar can produce, so a bad escape reads as "no such entry" rather than as a
 * 500. The caller has to handle that anyway: a URL can say anything, so what
 * comes out of here is unvalidated by construction and must go through
 * `libEntry()`, which is a lookup and answers undefined for a stranger.
 */
export function entryFromParam(param: string): EntryId {
  return glyphFromParam(param) as EntryId;
}

/**
 * A path segment, decoded — the same unwrap `entryFromParam` does, without the
 * brand, for the radical route whose param is a bare glyph.
 *
 * `decodeURIComponent` throws on a malformed sequence ("%E0%A4%A") that a URL
 * bar can produce, so a bad escape comes back unchanged and reads as "no such
 * thing" at the lookup rather than as a 500.
 */
export function glyphFromParam(param: string): string {
  try {
    return decodeURIComponent(param);
  } catch {
    return param;
  }
}

// ---------- the index ----------

/**
 * ONE PATH PER ENTRY, BUILT FROM LIB_ENTRIES AND NOT FROM ALL_ENTRIES.
 *
 * That distinction is the whole of a bug this file used to have. `ALL_ENTRIES`
 * is facts.ts's list, so it holds every entry that has something ASKABLE about
 * it — and the nine writing rules do not: ゛ is a rule you read, never a
 * question you are asked (see marks.ts, "NO READINGS, deliberately"). They were
 * therefore the only kind absent from this index, and silently fell through
 * `entryHref`'s fallback to the old one-segment URL. `LIB_ENTRIES` is the
 * Library's own list — what is BROWSABLE, which is exactly what needs a page —
 * and it has all 15,276 across all seven kinds.
 */
function buildEntryPathIndex(): void {
  const claimed = new Set<string>();
  for (const entry of LIB_ENTRIES) {
    const segment = kindSegment(entry);
    const base = baseSlug(entry, segment, claimed);
    const slug = uniqueSlug(segment, base, entry.id);
    claimed.add(`${segment}/${slug}`);
    ENTRY_PATH.set(entry.id, `/library/${segment}/${slug}`);
    SLUG_TO_ENTRY.set(`${segment}/${slug}`, entry.id);
  }
}

/**
 * The first path segment: the shelf, EXCEPT for kana, where it is the script.
 *
 * あ and ア are both `kana` and both romaji "a", so the shelf name cannot tell
 * them apart and `hiragana`/`katakana` can. The script is read off CHAR_INDEX
 * rather than decided here, so it is the same string the shelf's own filter and
 * the section labels use.
 */
function kindSegment(entry: LibEntry): string {
  if (entry.kind === KANA_SUBJECT) {
    const set = CHAR_INDEX[entry.glyph]?.set;
    if (set) return set;
  }
  return entry.kind;
}

/**
 * What an entry is called in its URL.
 *
 * Kana get romaji (see the header). Everything else gets the thing itself: a
 * glyph where the entry IS a character, and its own stable data id where it is
 * not — a grammar pattern is `te-request` because 〜てください is a formula, not a
 * name, and a verb pair is `開く-開ける` because a pair is two words and has no
 * single glyph at all (its `LibEntry.glyph` is the empty string).
 *
 * `/` IS THE ONE CHARACTER THAT CANNOT SURVIVE. A pair's key joins its two verbs
 * with a slash, which in a path is a segment break, so it becomes `-`. Nothing
 * reads it back apart — the round trip is a Map lookup on the whole string.
 */
function baseSlug(entry: LibEntry, segment: string, claimed: Set<string>): string {
  if (entry.kind === KANA_SUBJECT) {
    for (const r of CHAR_INDEX[entry.glyph]?.r ?? []) {
      const romaji = slugify(r);
      if (romaji && !claimed.has(`${segment}/${romaji}`)) return romaji;
    }
  }
  const key = SLUG_KEY.get(entry.id);
  if (key) return key;
  if (entry.glyph) return entry.glyph;
  return encodeURIComponent(entry.id);
}

/**
 * The slug for every entry whose name is not its glyph, keyed by the id its own
 * subject minted for the same row.
 *
 * BUILT BY RE-MINTING, never by taking an id apart. `patternEntry(r.id)` is the
 * function that made the id in the first place, so this pairs `grammar:te-
 * request` with `te-request` without this file knowing that ids have a colon in
 * them. Recipe.id and Mark.id both say "Never parsed" in their own comments;
 * this does not parse them, it carries them.
 */
const SLUG_KEY: ReadonlyMap<EntryId, string> = buildSlugKeys();

function buildSlugKeys(): Map<EntryId, string> {
  const map = new Map<EntryId, string>();
  for (const m of MARKS) map.set(markEntry(m.id), m.id);
  for (const t of TERMS) map.set(termEntry(t.id), t.id);
  for (const r of RECIPES) map.set(patternEntry(r.id), r.id);
  for (const p of VERB_PAIRS) {
    map.set(pairEntry(p), `${p.happens.word}-${p.doIt.word}`);
  }
  // A keigo set has no glyph either (its LibEntry.glyph is the empty string), so
  // its URL is its own stable set id — /library/keigo/eat — the same treatment a
  // verb pair gets.
  for (const s of KEIGO_SETS) map.set(keigoSetEntry(s), s.id);
  return map;
}

/**
 * A last-resort disambiguator. Kana, kanji, radicals, grammar and writing rules
 * are unique by construction and never reach the suffix — href.test.ts asserts
 * that, so if a data change ever introduces a collision in one of them the test
 * says so rather than a `-2` appearing quietly in a URL.
 */
function uniqueSlug(segment: string, base: string, id: EntryId): string {
  let slug = base;
  let n = 2;
  while (true) {
    const existing = SLUG_TO_ENTRY.get(`${segment}/${slug}`);
    if (!existing || existing === id) return slug;
    slug = `${base}-${n++}`;
  }
}

function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

// LAST, not at the top of the file, because it reads SLUG_KEY — a `const`, so
// calling this any earlier is a temporal-dead-zone crash at module load.
buildEntryPathIndex();
