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
// CHECKED SET — `?kind=kanji,word` browses/searches Kanji and Words only.
//
// SAK-167 FLIPPED WHAT "CHECKED" MEANS. The original design (directly above,
// still true of the mechanics below) defaulted to every box checked and let
// Clear narrow a dimension down to literally nothing — "explicitly empty" was
// a real, distinct state from "param absent". In practice that read backwards:
// an unchecked box looks like "off"/"not filtering", not "hide everything",
// and a learner clearing every kind expecting to see more instead saw a dead
// end. So the meaning is now inverted — UNCHECKED IS THE DEFAULT, and it means
// "no filter for this dimension, show everything":
//
//   missing/empty ................ no kind (or status) checked — the default,
//                                 what a plain `/library` opens on, AND what
//                                 shows every entry (no filtering applied).
//   `all` ......................... every kind (or status) explicitly checked
//                                 — a real, distinct state from the default
//                                 above (it round-trips through the URL so a
//                                 shared "everything, deliberately selected"
//                                 link still reads as checked in the UI), but
//                                 functionally the same "show everything"
//                                 result as the empty default.
//   a comma list ................. exactly those, each validated the same way
//                                 a single value always was; an unrecognised
//                                 token is dropped, and if NONE of them survive
//                                 that the whole thing falls back to the empty
//                                 default (garbage is not a deliberate
//                                 narrowing, so it should show everything too).
//
// THE OLD `none` TOKEN — "every box explicitly unchecked", kept apart from a
// missing param — no longer has a role. Unchecked already IS the default now,
// so there is nothing left for a dedicated "explicitly nothing" state to mean;
// the one thing the old design could express that this one cannot is "filter
// this dimension down to showing zero entries", and nothing in the app asked
// for that as its own feature — it was a side effect of the checked-by-default
// model, not a request in its own right. `none` is still ACCEPTED on read (an
// old shared link keeps working) and is treated exactly like an absent param;
// it is just never written any more, and there is no dropdown control that
// produces it. If a real "show nothing" affordance is wanted later, it needs
// its own name/control now that plain unchecked means unfiltered.
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

/** The old "explicitly every box unchecked" sentinel. Still ACCEPTED on read
 * (see the file header's SAK-167 note) so a link written before the flip
 * keeps working, but treated exactly like a missing param — both are now the
 * same "no filter" default — and `libraryUrl` never writes it any more. */
const NONE_TOKEN = "none";
/** The single-select "All tab"'s old sentinel, and now also the token
 * `libraryUrl` writes for "every kind explicitly checked" (SAK-167): a real,
 * distinct, round-tripping state from the empty default, even though both
 * show the same "every entry" result. A link written before this became a
 * checklist (`/library?kind=all`) keeps meaning what it always meant. */
const ALL_TOKEN = "all";

/** Every kind, checked — what the Kind dropdown's "Select all" button
 * produces, and the explicit (as opposed to default-by-omission) way to check
 * every box. NOT the default any more (SAK-167) — see the file header. */
export const ALL_KINDS: ReadonlySet<Kind> = new Set(KINDS);

/**
 * The set of kinds a URL's `?kind=` asks for.
 *
 * `?kind=kanji,word` checks Kanji and Words only; `?kind=kanji` (no comma) is
 * exactly the breadcrumb link the entry page has always written, and still
 * checks Kanji alone. A missing or empty param is the SAK-167 default — no
 * kind checked, which callers read as "no filter, show every kind" (see
 * `isNoKindFilter` below) — and the old `none` token reads identically, kept
 * only so a pre-flip link still round-trips. The literal `all` token is every
 * kind explicitly checked. Anything else is read token by token, each
 * validated against KINDS the same way a single value always was — an
 * unrecognised token is dropped, and if the whole list turns out empty
 * (`?kind=banana`, `?kind=,,`) that is garbage, not a deliberate selection, so
 * it falls back to the same "no filter" default as an absent param.
 */
export function kindsFromParams(params: ReadableParams): ReadonlySet<Kind> {
  const raw = params.get(KIND_PARAM);
  if (raw === null || raw === "" || raw === NONE_TOKEN) return new Set();
  if (raw === ALL_TOKEN) return ALL_KINDS;
  const picked = raw.split(",").filter((tok) => KINDS.includes(tok as Kind));
  return picked.length > 0 ? new Set(picked as Kind[]) : new Set();
}

// ---------- STATUS, as the Library's own multi-select ----------

/**
 * The knowledge-filter values the Status dropdown offers as checkboxes.
 * There is deliberately no `all` item any more — the owner's own reasoning:
 * "multi-select with everything checked already IS all", so a dedicated All
 * button is redundant once checking every item is reach-equivalent to no
 * filter at all (SAK-167 made that reach-equivalence exact: unchecked now
 * means the same "every entry passes" default that all-checked always did).
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

/** Every status, checked explicitly — what the Status dropdown's "Select
 * all" button produces (known and unknown alone already partition every
 * entry, so checking every item here filters nothing — reach-equivalent to
 * the default). NOT the default any more (SAK-167) — see the file header. */
export const ALL_STATES: ReadonlySet<StatusFilter> = new Set(STATUS_VALUES);

/**
 * The set of statuses a URL's `?state=` asks for. Same shape as
 * `kindsFromParams`: a missing or empty param (or the old `none` token,
 * accepted for back-compat) is the SAK-167 default — no status checked, read
 * as "no filter, every status passes" (see `isNoStateFilter` below) — the
 * literal `all` token is every status explicitly checked, a comma list is
 * read token by token with unrecognised tokens dropped, and an all-garbage
 * list falls back to the same "no filter" default as an absent param.
 */
export function statesFromParams(
  params: ReadableParams,
): ReadonlySet<StatusFilter> {
  const raw = params.get(STATE_PARAM);
  if (raw === null || raw === "" || raw === NONE_TOKEN) return new Set();
  if (raw === ALL_TOKEN) return ALL_STATES;
  const picked = raw
    .split(",")
    .filter((tok) => STATUS_VALUES.includes(tok as StatusFilter));
  return picked.length > 0 ? new Set(picked as StatusFilter[]) : new Set();
}

function setEquals<T>(a: ReadonlySet<T>, b: ReadonlySet<T>): boolean {
  if (a.size !== b.size) return false;
  for (const v of a) if (!b.has(v)) return false;
  return true;
}

/** Whether `kinds` is exactly "every kind explicitly checked" — the state
 * `libraryUrl` writes the `all` token for, and the line between "every item
 * literally on" and "a checked subset that happens to include everything".
 * NOT the "no filter" fast path any more — that is `isNoKindFilter`, below. */
export function isEveryKind(kinds: ReadonlySet<Kind>): boolean {
  return setEquals(kinds, ALL_KINDS);
}

/** Whether `states` is exactly "every status explicitly checked" — same role
 * as `isEveryKind`, for the Status dropdown. */
export function isEveryState(states: ReadonlySet<StatusFilter>): boolean {
  return setEquals(states, ALL_STATES);
}

/** Whether `kinds` means "no filter for this dimension" — SAK-167's fast
 * path callers use to skip kind filtering entirely and show every kind, the
 * role `isEveryKind` used to fill before the empty/full meanings flipped. The
 * empty set is the only value this is true for; a fully-checked set still
 * goes through the ordinary per-kind path (see `isEveryKind` above) even
 * though the two produce the same visible result. */
export function isNoKindFilter(kinds: ReadonlySet<Kind>): boolean {
  return kinds.size === 0;
}

/** Whether `states` means "no filter for this dimension" — same fast path,
 * for the Status dropdown's checked set. */
export function isNoStateFilter(states: ReadonlySet<StatusFilter>): boolean {
  return states.size === 0;
}

/**
 * The Library URL for a given state.
 *
 * No kind checked, an empty query, and no status checked are OMITTED (SAK-167:
 * that is now the default, unchecked-by-default state), so the plain
 * `/library` stays plain: a page that rewrote itself to
 * `/library?kind=…&q=&state=…` the moment it mounted would put a URL in the
 * address bar the user never asked for, and make the first Back press a no-op
 * that only undoes our own tidying. An explicitly fully-checked dimension
 * still round-trips — it writes the `all` token rather than being folded into
 * the same omission as empty — so a "select all" link keeps reading as
 * checked in the UI even though it shows the same entries the default does.
 * The two multi-select params serialise in KINDS/STATUS_VALUES order (not
 * selection order), so the same checked set always writes the same URL
 * regardless of the order the boxes were ticked in.
 */
export function libraryUrl({
  kinds = new Set(),
  query,
  states = new Set(),
}: {
  kinds?: ReadonlySet<Kind>;
  query: string;
  states?: ReadonlySet<StatusFilter>;
}): string {
  const params = new URLSearchParams();
  if (kinds.size > 0) {
    params.set(
      KIND_PARAM,
      isEveryKind(kinds) ? ALL_TOKEN : KINDS.filter((k) => kinds.has(k)).join(","),
    );
  }
  if (query !== "") params.set(QUERY_PARAM, query);
  if (states.size > 0) {
    params.set(
      STATE_PARAM,
      isEveryState(states)
        ? ALL_TOKEN
        : STATUS_VALUES.filter((s) => states.has(s)).join(","),
    );
  }
  const qs = params.toString();
  return qs ? `/library?${qs}` : "/library";
}
