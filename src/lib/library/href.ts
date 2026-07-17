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

/** Where an entry's page lives. */
export function entryHref(id: EntryId): string {
  return `/library/${encodeURIComponent(id)}`;
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
  try {
    return decodeURIComponent(param) as EntryId;
  } catch {
    return param as EntryId;
  }
}
