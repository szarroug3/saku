// The Library's URL, read and written in one place.
//
// WHY THE URL AND NOT useState
// ============================
// The kind chips and the search box were plain React state, and that made three
// things wrong at once:
//
//   1. Switching tabs pushed no history entry, so Back left the Library
//      entirely instead of stepping back to the tab you came from.
//   2. Coming back to the Library always landed on Kana, whatever you were
//      looking at.
//   3. THE ENTRY PAGE ALREADY LINKED HERE WITH A KIND. Its breadcrumb has
//      always pointed at `/library?kind=kanji` (see library/[...entry]/page.tsx),
//      and the page ignored it — click "Kanji" above a kanji and you landed on
//      Kana. That link was generated and dropped on the floor.
//
// So this is repair, not a new feature: the URL the app already writes becomes
// the one the page reads. localStorage would have fixed (2) alone and left Back
// broken, the breadcrumb still dead, and a shared link still wrong.
//
// NOTHING HERE TOUCHES THE ROUTER. These are string in / string out so the
// fallback rules below can be tested without a browser — a URL bar can say
// `?kind=banana`, and what that does is a property of this file.

import { KINDS } from "@/lib/library/library-index";
import type { Kind } from "@/lib/library/entries";
import { KANA_SUBJECT } from "@/data/characters";

/** The shelf you are browsing. */
export const KIND_PARAM = "kind";
/** What you typed in the search box. */
export const QUERY_PARAM = "q";
/** The knowledge-state filter: `known`, `unknown`, or absent for all. */
export const STATE_PARAM = "state";

/** The SUBJECT a per-kind lookup falls back to when a URL names no real kind.
 * This is only the fallback for `kindFromParams`, which must return a real
 * `Kind` for a shelf lookup, so it cannot be the All tab. It is NOT what a plain
 * `/library` opens on: that is `DEFAULT_TAB` below. Kept as the lightest shelf so
 * a garbage `?kind=` still renders something cheap rather than the heaviest view. */
export const DEFAULT_KIND: Kind = KANA_SUBJECT;

/**
 * The "All" tab — every subject at once, not one shelf. It is a TAB value, not a
 * `Kind`: no subject is called "all", and the browse/search code branches on it
 * rather than looking it up in a per-kind map. It rides the same `?kind=` param
 * (value `all`) so a link carries it and Back steps through it like any shelf.
 */
export const ALL_TAB = "all" as const;

/** What the kind chips can select: any one subject, or All. The page reads this
 * from the URL and branches — a real `Kind` looks its shelf up; `ALL_TAB` spans
 * every subject (browse) and buckets a search by type. */
export type LibraryTab = Kind | typeof ALL_TAB;

/** What a plain `/library` opens on: All, every subject at once. Promoted from
 * the lightest shelf (kana) now the capped browse (all-tab.ts) is cheap enough
 * to be the default first paint. It is a TAB, not a `Kind`, which is exactly why
 * it is separate from `DEFAULT_KIND`: the subject-lookup fallback must stay a
 * real `Kind`, but the tab the page opens on can be All. Omitted from the URL by
 * libraryUrl, so the bare `/library` IS the All tab. */
export const DEFAULT_TAB: LibraryTab = ALL_TAB;

/**
 * The knowledge filter, in one of three states. `all` is the default and, like
 * the default kind and an empty query, is OMITTED from the URL — the plain
 * `/library` shows everything, which is what a reference is for.
 */
export type KnowledgeFilter =
  | "all"
  | "known"
  | "unknown"
  | "solid"
  | "shaky"
  | "getting-there"
  | "mixup"
  | "slipping";
export const DEFAULT_STATE: KnowledgeFilter = "all";

/** Just enough of `URLSearchParams` to read one — which is also all of the
 * read-only view `useSearchParams()` hands back. */
export interface ReadableParams {
  get(name: string): string | null;
}

/**
 * The kind a URL is asking for.
 *
 * A MISSING OR UNKNOWN KIND IS NOT AN ERROR. Anyone can type this URL, an old
 * link can name a shelf that no longer exists, and the page below has a `!` on
 * `shelvesByKind.get(kind)` that would throw on a value that is merely a string
 * shaped like a Kind. So the gate is membership in KINDS — the same list the
 * chips are rendered from, so it cannot drift — and anything else quietly reads
 * as the default rather than 500ing a reference screen.
 */
export function kindFromParams(params: ReadableParams): Kind {
  const raw = params.get(KIND_PARAM);
  return KINDS.find((k) => k === raw) ?? DEFAULT_KIND;
}

/**
 * The TAB a URL is asking for — a subject, or All.
 *
 * The same forgiving gate as `kindFromParams`, widened by one value: `?kind=all`
 * is the All tab, every real subject is itself, and anything else (missing,
 * misspelled, hostile) falls back to the default shelf. It is a superset of
 * `kindFromParams`, kept separate so the many callers that genuinely want a
 * `Kind` (a shelf lookup, a fact subject) are not handed a value they cannot use.
 */
export function tabFromParams(params: ReadableParams): LibraryTab {
  const raw = params.get(KIND_PARAM);
  if (raw === ALL_TAB) return ALL_TAB;
  // A real subject is itself; anything else (missing, misspelled, hostile) opens
  // on the default tab, which is All. This no longer delegates to kindFromParams,
  // whose own fallback is a real Kind (kana) for shelf lookups, not the tab the
  // page defaults to.
  return KINDS.find((k) => k === raw) ?? DEFAULT_TAB;
}

/** What the search box should contain. Absent reads as empty, never "null". */
export function queryFromParams(params: ReadableParams): string {
  return params.get(QUERY_PARAM) ?? "";
}

/**
 * The knowledge filter a URL is asking for.
 *
 * Like `kindFromParams`, a missing, empty, misspelled or hostile value is not
 * an error: it reads as `all`, so a stale link or a hand-typed `?state=banana`
 * shows the whole shelf rather than an empty one. Only the two non-default
 * words are recognised; everything else, including the literal `all`, collapses
 * to the default so the URL and the chips cannot drift.
 */
export function stateFromParams(params: ReadableParams): KnowledgeFilter {
  const raw = params.get(STATE_PARAM);
  return raw === "known" ||
    raw === "unknown" ||
    raw === "solid" ||
    raw === "shaky" ||
    raw === "getting-there" ||
    raw === "mixup" ||
    raw === "slipping"
    ? raw
    : DEFAULT_STATE;
}

/**
 * The Library URL for a given state.
 *
 * The default kind, an empty query, and the `all` filter are OMITTED, so the
 * plain `/library` stays plain: a page that rewrote itself to
 * `/library?kind=kana&q=&state=all` the moment it mounted would put a URL in the
 * address bar that the user never asked for, and make the first Back press a
 * no-op that only undoes our own tidying.
 */
export function libraryUrl({
  kind,
  query,
  state = DEFAULT_STATE,
}: {
  kind: LibraryTab;
  query: string;
  state?: KnowledgeFilter;
}): string {
  const params = new URLSearchParams();
  // The default tab (All) is omitted, so it round-trips as the bare `/library`.
  // Every other tab writes its `?kind=`, including kana now that it is a chosen
  // shelf rather than the default.
  if (kind !== DEFAULT_TAB) params.set(KIND_PARAM, kind);
  if (query !== "") params.set(QUERY_PARAM, query);
  if (state !== DEFAULT_STATE) params.set(STATE_PARAM, state);
  const qs = params.toString();
  return qs ? `/library?${qs}` : "/library";
}
