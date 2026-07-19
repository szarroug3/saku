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
//      always pointed at `/library?kind=kanji` (see library/[entry]/page.tsx),
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

import { KINDS, type Kind } from "@/lib/library/entries";
import { KANA_SUBJECT } from "@/data/characters";

/** The shelf you are browsing. */
export const KIND_PARAM = "kind";
/** What you typed in the search box. */
export const QUERY_PARAM = "q";
/** The knowledge-state filter: `known`, `unknown`, or absent for all. */
export const STATE_PARAM = "state";

/** The shelf a Library with no opinion in its URL opens on — the lightest
 * first paint, and what the page defaulted to before the URL carried it. */
export const DEFAULT_KIND: Kind = KANA_SUBJECT;

/**
 * The knowledge filter, in one of three states. `all` is the default and, like
 * the default kind and an empty query, is OMITTED from the URL — the plain
 * `/library` shows everything, which is what a reference is for.
 */
export type KnowledgeFilter = "all" | "known" | "unknown";
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
  return raw === "known" || raw === "unknown" ? raw : DEFAULT_STATE;
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
  kind: Kind;
  query: string;
  state?: KnowledgeFilter;
}): string {
  const params = new URLSearchParams();
  if (kind !== DEFAULT_KIND) params.set(KIND_PARAM, kind);
  if (query !== "") params.set(QUERY_PARAM, query);
  if (state !== DEFAULT_STATE) params.set(STATE_PARAM, state);
  const qs = params.toString();
  return qs ? `/library?${qs}` : "/library";
}
