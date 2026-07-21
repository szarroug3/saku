// An entry's URL.
//
// WHY IT IS NOT /library/生
// ========================
// The design mocks the entry page at `/library/生`, and it is prettier. It is
// also not implementable without breaking the one rule the id model has:
//
//   A GLYPH IS NOT AN IDENTITY. FactInfo.glyph says so in its own comment —
//   "DISPLAY ONLY: it is not an identity and two entries may legitimately share
//   one." And they do, right now, in the shipped data: 生 is a jōyō kanji AND an
//   everyday word (なま, "raw"), so `kanji:生` and `word:生` are two entries with
//   one glyph and two different pages. 気, 目, 手, 花 and ~600 others are the
//   same. `/library/生` cannot say which one it means.
//
// The fix is not to add a `?kind=` (that is the id, spelled out in two places),
// and it is CERTAINLY not to have the route parse the glyph back into an id —
// that is `id.startsWith("kanji:")` wearing a hat, and it welds the id grammar
// into the router, which is the exact thing types/index.ts says must never
// happen.
//
// So the URL carries the opaque id, percent-encoded. `/library/kanji%3A%E7%94%9F`
// is ugly in a browser bar and correct everywhere else: encodeURIComponent is
// transport, not parsing — this file never looks INSIDE the string, it wraps and
// unwraps it, and what comes out the other end goes straight to `libEntry()`,
// which is a Map lookup. If ids change grammar tomorrow, every link in the app
// still resolves.

import type { EntryId } from "@/types";
import { CHAR_INDEX, KANA_SUBJECT } from "@/data/characters";
import { ALL_ENTRIES } from "@/lib/facts";
import { type Kind, libEntry } from "@/lib/library/entries";

const ENTRY_PATH = new Map<EntryId, string>();
const SLUG_TO_ENTRY = new Map<string, EntryId>();

buildEntryPathIndex();

/** Where an entry's page lives. */
export function entryHref(id: EntryId): string {
  return ENTRY_PATH.get(id) ?? `/library/${encodeURIComponent(id)}`;
}

/**
 * The entry id for a kind/slug Library route, or null.
 *
 * `slug` is read as the raw path segment Next passes through. For non-kana
 * entries this is often an encoded id-key segment.
 */
export function entryFromSlug(kind: string, slug: string): EntryId | null {
  const direct = SLUG_TO_ENTRY.get(`${kind}/${slug}`);
  if (direct) return direct;

  // Be tolerant if a caller handed us a decoded slug.
  const encoded = encodeURIComponent(glyphFromParam(slug));
  const byEncoded = SLUG_TO_ENTRY.get(`${kind}/${encoded}`);
  if (byEncoded) return byEncoded;

  const maybeId = glyphFromParam(slug) as EntryId;
  const entry = libEntry(maybeId);
  if (entry?.kind === kind) return maybeId;
  return null;
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
 * The id a route param carries.
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

function buildEntryPathIndex(): void {
  for (const id of ALL_ENTRIES) {
    const entry = libEntry(id);
    if (!entry) continue;
    const kind = entry.kind;
    const base = baseSlug(id, kind);
    const slug = uniqueSlug(kind, base, id);
    const path = `/library/${kind}/${slug}`;
    ENTRY_PATH.set(id, path);
    SLUG_TO_ENTRY.set(`${kind}/${slug}`, id);
  }
}

function baseSlug(id: EntryId, kind: Kind): string {
  if (kind === KANA_SUBJECT) {
    const info = CHAR_INDEX[libEntry(id)?.glyph ?? ""];
    if (info?.r?.[0]) {
      const romaji = slugify(info.r[0]);
      if (romaji) return `${info.set}-${romaji}`;
    }
  }
  return encodeURIComponent(id);
}

function uniqueSlug(kind: Kind, base: string, id: EntryId): string {
  let slug = base;
  let n = 2;
  while (true) {
    const key = `${kind}/${slug}`;
    const existing = SLUG_TO_ENTRY.get(key);
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
