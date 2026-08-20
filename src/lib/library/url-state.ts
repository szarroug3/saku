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
//
// KIND AND STATUS ARE MULTI-SELECT NOW (SAK-63, second round). The owner:
// "make the two labels 'kind' and 'status' drop downs with the items... all
// items should be checked by default." A single chosen tab widened to a
// CHECKED SET — `?kind=kanji,word` browses/searches Kanji and Words only — and
// the encoding keeps the same "garbage is not an error, the default is
// omitted" discipline the single-value version already had:
//
//   missing/empty/`all` ......... every kind (or status) checked — the default,
//                                 and what a plain `/library` opens on.
//   `none` ....................... every kind (or status) UNCHECKED — the
//                                 Kind/Status dropdown's Clear button. Needs
//                                 its own token because an omitted param and an
//                                 empty comma-list would otherwise collide.
//   a comma list ................. exactly those, each validated the same way
//                                 a single value always was; an unrecognised
//                                 token is dropped, and if NONE of them survive
//                                 that the whole thing falls back to "every kind
//                                 checked" rather than reading as `none`.
//
// `kindFromParams` — a single, always-real `Kind` — is kept exactly as it was:
// it answers a different question ("what ONE shelf does a lookup need") than
// the multi-select `kindsFromParams` does, and nothing about widening the
// Library's own UI to a checklist changes what a shelf lookup wants.

// SAK-104: KINDS/Kind come from the small unguarded kinds.ts, not
// entries.ts/library-index.ts (both server-only) — this file is read from a
// client component (library-page.tsx) on every render, so it cannot afford a
// Server Action round trip just to enumerate/validate the kind list. See
// kinds.ts's own header for why duplicating these literals is safe.
import { KINDS, type Kind } from "@/lib/library/kinds";
import { KANA_SUBJECT } from "@/data/characters";

/** The shelf(s) you are browsing. */
export const KIND_PARAM = "kind";
/** What you typed in the search box. */
export const QUERY_PARAM = "q";
/** The knowledge-state filter(s), or absent for all. */
export const STATE_PARAM = "state";

/** The SUBJECT a per-kind lookup falls back to when a URL names no real kind.
 * This is only the fallback for `kindFromParams`, which must return a real
 * `Kind` for a shelf lookup, so it cannot be "every kind". Kept as the
 * lightest shelf so a garbage `?kind=` still resolves to something cheap. */
export const DEFAULT_KIND: Kind = KANA_SUBJECT;

/** Just enough of `URLSearchParams` to read one — which is also all of the
 * read-only view `useSearchParams()` hands back. */
export interface ReadableParams {
  get(name: string): string | null;
}

/**
 * The one kind a URL is asking for.
 *
 * A MISSING OR UNKNOWN KIND IS NOT AN ERROR. Anyone can type this URL, an old
 * link can name a shelf that no longer exists, and the page below has a `!` on
 * `shelvesByKind.get(kind)` that would throw on a value that is merely a string
 * shaped like a Kind. So the gate is membership in KINDS — the same list the
 * dropdown's checkboxes are rendered from, so it cannot drift — and anything
 * else quietly reads as the default rather than 500ing a reference screen.
 *
 * Kept separate from `kindsFromParams` below: the many callers that genuinely
 * want ONE real `Kind` (a shelf lookup, a fact subject) are not handed a set
 * they cannot use.
 */
export function kindFromParams(params: ReadableParams): Kind {
  const raw = params.get(KIND_PARAM);
  return KINDS.find((k) => k === raw) ?? DEFAULT_KIND;
}

/** What the search box should contain. Absent reads as empty, never "null". */
export function queryFromParams(params: ReadableParams): string {
  return params.get(QUERY_PARAM) ?? "";
}

// ---------- KIND, as the Library's own multi-select ----------

/** A literal token for "nothing checked" — the Kind/Status dropdown's Clear
 * button. Needed because an OMITTED param already means "everything checked"
 * (the default); without a distinct token for empty, clearing a dropdown down
 * to zero items could never round-trip through the URL — an empty comma-list
 * and a missing param would parse identically. */
const NONE_TOKEN = "none";
/** The old single-select "All tab"'s sentinel, still honoured so a link
 * written before this became a checklist (`/library?kind=all`) keeps meaning
 * what it always meant: every kind. */
const ALL_TOKEN = "all";

/** Every kind, checked — the default selection, and what a plain `/library`
 * browses and searches. Reach-equivalent to the old "All" tab. */
export const ALL_KINDS: ReadonlySet<Kind> = new Set(KINDS);

/**
 * The set of kinds a URL's `?kind=` asks for.
 *
 * `?kind=kanji,word` checks Kanji and Words only; `?kind=kanji` (no comma) is
 * exactly the breadcrumb link the entry page has always written, and still
 * checks Kanji alone. A missing, empty, or literal `all` param is every kind
 * checked; `none` is every kind UNCHECKED. Anything else is read token by
 * token, each validated against KINDS the same way a single value always was —
 * an unrecognised token is dropped, and if the whole list turns out empty
 * (`?kind=banana`, `?kind=,,`) that is garbage, not a deliberate Clear, so it
 * falls back to every kind checked rather than being mistaken for `none`.
 */
export function kindsFromParams(params: ReadableParams): ReadonlySet<Kind> {
  const raw = params.get(KIND_PARAM);
  if (raw === null || raw === "" || raw === ALL_TOKEN) return ALL_KINDS;
  if (raw === NONE_TOKEN) return new Set();
  const picked = raw.split(",").filter((tok) => KINDS.includes(tok as Kind));
  return picked.length > 0 ? new Set(picked as Kind[]) : ALL_KINDS;
}

// ---------- STATUS, as the Library's own multi-select ----------

/**
 * The knowledge-filter values the Status dropdown offers as checkboxes.
 * There is deliberately no `all` item any more — the owner's own reasoning:
 * "multi-select with everything checked already IS all", so a dedicated All
 * button is redundant once every item defaults to checked.
 */
export type StatusFilter =
  | "known"
  | "unknown"
  | "solid"
  | "shaky"
  | "getting-there"
  | "mixup"
  | "slipping";

const STATUS_VALUES: readonly StatusFilter[] = [
  "known",
  "unknown",
  "solid",
  "shaky",
  "getting-there",
  "mixup",
  "slipping",
];

/** Every status, checked — the default, equivalent to the old "All" filter
 * chip (known and unknown alone already partition every entry, so checking
 * every item here filters nothing, exactly like the old default did). */
export const ALL_STATES: ReadonlySet<StatusFilter> = new Set(STATUS_VALUES);

/**
 * The set of statuses a URL's `?state=` asks for. Same shape as
 * `kindsFromParams`: a missing/empty/literal-`all` param is every status
 * checked, `none` is every status unchecked (the dropdown's Clear), a comma
 * list is read token by token with unrecognised tokens dropped, and an
 * all-garbage list falls back to every status checked rather than reading as
 * a deliberate Clear.
 */
export function statesFromParams(
  params: ReadableParams,
): ReadonlySet<StatusFilter> {
  const raw = params.get(STATE_PARAM);
  if (raw === null || raw === "" || raw === ALL_TOKEN) return ALL_STATES;
  if (raw === NONE_TOKEN) return new Set();
  const picked = raw
    .split(",")
    .filter((tok) => STATUS_VALUES.includes(tok as StatusFilter));
  return picked.length > 0 ? new Set(picked as StatusFilter[]) : ALL_STATES;
}

function setEquals<T>(a: ReadonlySet<T>, b: ReadonlySet<T>): boolean {
  if (a.size !== b.size) return false;
  for (const v of a) if (!b.has(v)) return false;
  return true;
}

/** Whether `kinds` is exactly "every kind checked" — the fast path callers use
 * to skip filtering entirely, and the line between "behaves like the old All
 * tab" and "behaves like All-but-filtered-to-a-subset". */
export function isEveryKind(kinds: ReadonlySet<Kind>): boolean {
  return setEquals(kinds, ALL_KINDS);
}

/** Whether `states` is exactly "every status checked" — same fast path, for
 * the Status dropdown. */
export function isEveryState(states: ReadonlySet<StatusFilter>): boolean {
  return setEquals(states, ALL_STATES);
}

/**
 * The Library URL for a given state.
 *
 * Every-kind-checked, an empty query, and every-status-checked are OMITTED, so
 * the plain `/library` stays plain: a page that rewrote itself to
 * `/library?kind=…&q=&state=…` the moment it mounted would put a URL in the
 * address bar the user never asked for, and make the first Back press a no-op
 * that only undoes our own tidying. The two multi-select params serialise in
 * KINDS/STATUS_VALUES order (not selection order), so the same checked set
 * always writes the same URL regardless of the order the boxes were ticked in.
 */
export function libraryUrl({
  kinds = ALL_KINDS,
  query,
  states = ALL_STATES,
}: {
  kinds?: ReadonlySet<Kind>;
  query: string;
  states?: ReadonlySet<StatusFilter>;
}): string {
  const params = new URLSearchParams();
  if (!isEveryKind(kinds)) {
    params.set(
      KIND_PARAM,
      kinds.size === 0 ? NONE_TOKEN : KINDS.filter((k) => kinds.has(k)).join(","),
    );
  }
  if (query !== "") params.set(QUERY_PARAM, query);
  if (!isEveryState(states)) {
    params.set(
      STATE_PARAM,
      states.size === 0
        ? NONE_TOKEN
        : STATUS_VALUES.filter((s) => states.has(s)).join(","),
    );
  }
  const qs = params.toString();
  return qs ? `/library?${qs}` : "/library";
}
