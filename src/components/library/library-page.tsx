"use client";

// The Library — search, and shelves when you haven't searched.
//
// ONE NAV ITEM, NOT THE FRONT DOOR. The user: "the reference should exist as an
// easy way to look things up, not as the product." The ranked drill is what the
// app is for; this is how you get at things. So this page has no dashboard, no
// progress, no suggestions, and nothing that competes with Home for the first
// thing you do. It has a search box, because that is the front door OF THIS TAB
// and nothing else on it matters as much.

import {
  useCallback,
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { Dock } from "@/components/dock";
import { EntryRow } from "@/components/library/entry-tile";
import { FilterDropdown } from "@/components/library/filter-dropdown";
import { Shelf } from "@/components/library/shelves";
import { visibleShelfIds, type ShelfSection } from "@/lib/library/shelf-view";
import { SliceBar } from "@/components/library/slice-bar";
import { StickySearch } from "@/components/library/sticky-search";
import { Card, Chip, GhostBtn, Hint, Lbl, PageTitle } from "@/components/ui";
import { markFor } from "@/data/marks";
// SAK-104: the raw index/search functions used to be a bundled import; this
// page still legitimately needs the whole thing (it is the library's own
// search-as-you-type + browse-everything reference view), so the DATA now
// arrives through these Server Actions instead — see server-lookups.ts's
// "LIBRARY BROWSE/SEARCH" section for the full design note. The Known/Not-
// known/standing FILTER (`keep`, below) stays exactly the client-side
// predicate it always was; it just reads `entry.knownFacts` (attached by the
// action) instead of calling the now-guarded `knownFactsOf`.
import {
  getActiveMixupEntries,
  getEverythingSlice,
  getSelectionSlice,
  searchLibraryByType,
  searchLibraryOneKind,
  type BrowseEntry,
  type BrowseShelfSection,
} from "@/lib/library/server-lookups";
import { useServerLookup } from "@/lib/library/use-server-lookup";
import { KIND_LABEL, KINDS, type Kind } from "@/lib/library/kinds";
import type { LibEntry } from "@/lib/library/entries";
import { allTabBrowseKinds } from "@/lib/library/all-tab";
import {
  addRange,
  EMPTY_SELECTION,
  toggleEntry as toggleEntryIn,
  toggleSection as toggleSectionIn,
  type Selection,
} from "@/lib/library/selection";
import { standingOf, type Standing } from "@/lib/library/standing";
import { isKnownForDisplay } from "@/lib/library/known-mark";
import { useLiveFacts } from "@/lib/library/use-live-facts";
import type { Claims } from "@/lib/claims";
import {
  ALL_KINDS,
  ALL_STATES,
  isNoKindFilter,
  isNoStateFilter,
  kindsFromParams,
  libraryUrl,
  queryFromParams,
  statesFromParams,
  type StatusFilter,
} from "@/lib/library/url-state";
import { useLists } from "@/lib/use-lists";
import { useQuizConfig } from "@/lib/quiz-config";
import { sentenceTierMarkerFact } from "@/lib/sentence-ordering-progress";
import { useHistory } from "@/lib/use-history";
import { useHistoryWrites } from "@/lib/history-writes";
import type { EntryId, FactAggregate, FactId } from "@/types";

/** The Kind dropdown's items, in curriculum teaching order — the same order
 * the old chip row used, and the order every kind-scoped list on this page
 * already reads in. */
const KIND_ITEMS: readonly { value: Kind; label: string }[] = KINDS.map((k) => ({
  value: k,
  label: KIND_LABEL[k],
}));

/** The Status dropdown's items. NO "All" ITEM (the owner's second round of
 * feedback): a multi-select with every box checked already IS "all", so a
 * dedicated All button was redundant the moment this became a checklist —
 * that redundancy is exactly why she asked for it gone. */
const STATUS_ITEMS: readonly { value: StatusFilter; label: string }[] = [
  { value: "known", label: "Known" },
  { value: "unknown", label: "Not known" },
  { value: "solid", label: "Solid" },
  { value: "shaky", label: "Shaky" },
  { value: "getting-there", label: "Getting there" },
  { value: "mixup", label: "Mix-ups" },
  { value: "slipping", label: "Slipping" },
];

const FILTER_LABEL: Record<StatusFilter, string> = {
  known: "known",
  unknown: "not-known",
  solid: "solid",
  shaky: "shaky",
  "getting-there": "getting-there",
  mixup: "mix-up",
  slipping: "slipping",
};

/** One checked status, as a predicate over an entry — the same test the old
 * single-select filter always ran, just callable per-item now that several can
 * be checked at once. Module scope (not inline in the `keep` memo below) keeps
 * that memo's own body a plain map + union, which is what the React Compiler
 * needs to keep hand-writing `useMemo` here worth doing at all. */
function statusPredicate(
  value: StatusFilter,
  liveFacts: Record<FactId, FactAggregate>,
  claims: Claims,
  now: number,
  activeMixupEntries: ReadonlySet<string>,
): (entry: BrowseEntry) => boolean {
  if (value === "known" || value === "unknown") {
    const wantKnown = value === "known";
    // isKnownForDisplay (known-mark.ts) — the shared "known" definition, taking
    // the fetched knownFacts field directly rather than calling the guarded
    // knownFactsOf itself; see server-lookups.ts's BrowseEntry/withKnown, and
    // known-mark.ts's own header for why this is the one other entry point
    // into that chain.
    return (entry) =>
      isKnownForDisplay(entry.knownFacts, liveFacts, claims, now) === wantKnown;
  }
  if (value === "mixup") {
    return (entry) => activeMixupEntries.has(entry.id);
  }
  const wanted: Standing = value;
  return (entry) =>
    entry.knownFacts.some(
      (fact) => standingOf(liveFacts[fact], claims[fact], now).standing === wanted,
    );
}

/** The active Status selection, as words — "known, solid". Only ever built
 * for the narrowed-copy case (search's "No … entries match", a shelf's
 * FilterEmpty): the predicate itself (`keep`, below) does the actual
 * filtering. SAK-167: every call site now guards with `isNoStateFilter`
 * first, so this is never reached with an empty set in practice — the
 * "unfiltered" fallback below is a safety net, not a real UI string, since an
 * empty selection no longer means "matches nothing" the way it used to. */
function statesLabel(states: ReadonlySet<StatusFilter>): string {
  if (states.size === 0) return "unfiltered";
  return STATUS_ITEMS.filter((i) => states.has(i.value))
    .map((i) => FILTER_LABEL[i.value])
    .join(", ");
}

interface LibraryUrlState {
  kinds: ReadonlySet<Kind>;
  query: string;
  states: ReadonlySet<StatusFilter>;
}

function readUrlState(search: string): LibraryUrlState {
  const params = new URLSearchParams(search);
  return {
    kinds: kindsFromParams(params),
    query: queryFromParams(params),
    states: statesFromParams(params),
  };
}

// SAK-104 had this component fetch ALL kinds' sections in one batched Server
// Action call (getLibraryShelves) on mount, via useServerLookup. SAK-121
// moved that call server-side instead — page.tsx now `await`s it and passes
// the result down as `initialShelves` — so there is no client fetch here at
// all any more; `shelfFor` just reads the prop (kept in state, see below).
const EMPTY_SECTIONS: readonly ShelfSection[] = [];

export function LibraryPageClient({
  initialSearch,
  initialShelves,
}: {
  /** The server-read query string, so the complete Library is in the first
   * response. URL changes after mount are mirrored into local state below. */
  initialSearch: string;
  /** SAK-121: every kind's shelf sections, already resolved server-side
   * (page.tsx's own `await getLibraryShelves()`) and shipped as part of this
   * page's first HTML response — see page.tsx's header note. This is now the
   * ONLY source for `shelvesByKind`; there is no client-side fetch to seed it
   * from, so it is never `undefined` and the old "Loading…" gate is gone. */
  initialShelves: Record<string, BrowseShelfSection[]>;
}) {
  const { history, loaded: historyLoaded } = useHistory();
  // The optimistic write path (see history-writes.ts): claim/unclaim update
  // the screen immediately and post in the background, instead of the
  // blocking postClaim()+refresh() round trip this page used before. Reused
  // for both the single-entry "I know these" (unchanged behaviour, faster
  // now) and the new bulk "Mark as not known" the owner asked back for.
  const writes = useHistoryWrites();
  const { cfg } = useQuizConfig();
  const { lists } = useLists();

  // SAK-121: every kind's shelf sections arrive as a prop, already resolved
  // server-side — see the component's own doc comment above and page.tsx's
  // header note. Kept in state (not read as a plain prop) only because
  // `shelfFor`/callers below expect a stable reference across this
  // component's other re-renders; it never refetches or changes after mount.
  const [shelvesByKind] = useState(initialShelves);
  const shelfFor = useCallback(
    (k: Kind): { sections: readonly ShelfSection[] } => ({
      sections: shelvesByKind[k as unknown as string] ?? EMPTY_SECTIONS,
    }),
    [shelvesByKind],
  );

  // THE URL IS THE STATE, for the kinds, statuses and the box. It is seeded by
  // the server instead of `useSearchParams`: that hook forced the whole page
  // behind a null Suspense fallback, so every reload first painted an empty
  // Library and waited for hydration. Native history writes update this state
  // directly; Back/Forward synchronize through popstate.
  const [urlState, setUrlState] = useState<LibraryUrlState>(() =>
    readUrlState(initialSearch),
  );

  useEffect(() => {
    const syncFromLocation = () => setUrlState(readUrlState(window.location.search));
    // The App Router may remount this cached page after the browser's popstate
    // has already fired. Read the restored URL on mount/pageshow as well as on
    // the event itself, so Back cannot fall back to the server's older seed and
    // clear the checked kinds, statuses or query.
    syncFromLocation();
    window.addEventListener("popstate", syncFromLocation);
    window.addEventListener("pageshow", syncFromLocation);
    return () => {
      window.removeEventListener("popstate", syncFromLocation);
      window.removeEventListener("pageshow", syncFromLocation);
    };
  }, []);

  // THE KIND, FILTER AND QUERY MOVE THROUGH THE NATIVE History API, NOT
  // router.push/replace — and that is a root-cause fix, not a stylistic one.
  //
  // These controls only ever change the QUERY STRING of the page you are
  // already on (`/library?kind=…&q=…&state=…`); the route segment never moves.
  // For that, `window.history.pushState`/`replaceState` is the tool the App
  // Router docs themselves reach for (see "Native History API" in
  // node_modules/next/dist/docs/.../linking-and-navigating.md — the worked
  // example is a sort param), and it syncs `usePathname`/`useSearchParams` just
  // like the router does.
  //
  // router.push, by contrast, is for ROUTE navigations, and on Next 16 it has a
  // bfcache hazard this page reproduced: after the App Router preserves and then
  // restores this page's tree in an <Activity> boundary (which happens on a
  // back→forward→back through a detail page), a subsequent SAME-SEGMENT,
  // search-params-only push/replace is silently dropped — the reducer no-ops it,
  // no URL change, no re-render. Segment-changing navigations (a detail tile, a
  // sidebar link) still work, which is why only the dropdowns and the search box
  // went dead until a full reload. The History API takes a different path
  // through the router and is unaffected, so they keep working across any
  // history dance.
  //
  // pushState/replaceState also give us the two behaviours we relied on
  // router's options for, for free: they add NO scroll (the `scroll: false` the
  // old chip nav wanted), and pushState still writes one history entry so Back
  // undoes a checkbox toggle exactly as it undid a chip switch before.
  const pushUrl = useCallback(
    (url: string) => {
      window.history.pushState(null, "", url);
      setUrlState(readUrlState(new URL(url, window.location.origin).search));
    },
    [],
  );
  const replaceUrl = useCallback(
    (url: string) => {
      window.history.replaceState(null, "", url);
      setUrlState(readUrlState(new URL(url, window.location.origin).search));
    },
    [],
  );
  // THE CHECKED KINDS — the Kind dropdown's own selection, NO kind checked by
  // default (SAK-167: unchecked means unfiltered now). No kind checked spans
  // every subject (browse) and buckets a search by type, exactly like the old
  // "All" tab; a narrower (non-empty) set behaves like that same All view
  // filtered down to only the checked subjects — see `isNoKindFilter` and the
  // render below, which generalise the old All-tab code path
  // (allTabBrowseKinds) rather than duplicating it for the narrowed case.
  const kinds = urlState.kinds;
  const urlQuery = urlState.query;
  // THE CHECKED STATUSES — the Status dropdown's own selection, NO status
  // checked by default (SAK-167). An empty check-set filters nothing (same as
  // the old fully-checked default did — "known" and "not known" alone already
  // partition every entry, so there is nothing left to narrow). Like the
  // kinds, it lives in the URL so a link carries it and Back steps through it,
  // and it spans every kind: it governs both the browse shelf and the search
  // results, so "which kanji don't I know" is the same question whether you
  // are browsing or searching.
  const states = urlState.states;

  // THE BOX IS TYPED INTO AND THE URL IS NOT TYPED INTO, so the box keeps a
  // local copy. A controlled input whose value round-trips through the router
  // on every keystroke is a field that can drop characters; this one is
  // instant, and the URL catches up (see `commitQuery`).
  const [query, setQuery] = useState(urlQuery);
  // The last query WE wrote to the URL. Anything else the URL says arrived from
  // outside — Back, Forward, a pasted link — and must win over what is in the
  // box. Without this the effect below would fight the debounce and undo the
  // character you just typed.
  const ownQuery = useRef(urlQuery);
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (urlQuery === ownQuery.current) return;
    ownQuery.current = urlQuery;
    if (debounce.current) clearTimeout(debounce.current);
    setQuery(urlQuery);
  }, [urlQuery]);

  useEffect(() => () => {
    if (debounce.current) clearTimeout(debounce.current);
  }, []);

  // TYPING REPLACES, CHECKING A BOX PUSHES.
  //
  // A push per keystroke means "shirasu" buries the previous page under seven
  // history entries and Back becomes a stuck key. So the query is a `replace`,
  // and debounced on top of it (250ms) — replace alone still runs a router
  // transition per character, which is the expensive half on a page that paints
  // a 2,136-tile shelf. What you get back is one URL that always describes the
  // box, and a Back that leaves the Library in one press from a typed word.
  //
  // A checkbox toggle, by contrast, IS a navigation: you unchecked Kanji, you
  // can expect Back to recheck it. That is a `push`, and it is the behaviour
  // the old single-select chips already had — this only widens WHAT the push
  // carries, from one chosen value to a whole checked set.
  const commitQuery = useCallback(
    (value: string) => {
      setQuery(value);
      if (debounce.current) clearTimeout(debounce.current);
      debounce.current = setTimeout(() => {
        ownQuery.current = value;
        replaceUrl(libraryUrl({ kinds, query: value, states }));
      }, 250);
    },
    [kinds, states, replaceUrl],
  );

  // TOGGLE ONE ITEM / SELECT EVERY ITEM / CLEAR EVERY ITEM, built twice (Kind,
  // Status) rather than once behind a generic hook: two call sites of a
  // four-line closure read plainer than a hook whose only job is to avoid four
  // lines twice. Each flushes the pending query first — same reason
  // `selectTab`/`selectState` always did (see the file's TYPING
  // REPLACES/CHECKING A BOX PUSHES note above): a checkbox click carries
  // whatever is in the box RIGHT NOW, not whatever the debounce last got
  // around to writing, or the new history entry would disagree with the screen.
  //
  // SAK-167: `clear*` now pushes the SAME empty set the page defaults to
  // (unfiltered — every entry shows), not a "hide everything" state the way
  // it did before the flip; `selectAll*` still writes every box explicitly
  // checked (ALL_KINDS/ALL_STATES), a distinct-but-reach-equivalent state that
  // round-trips through the URL as `all` — see url-state.ts's file header for
  // why an explicit "select nothing" affordance was dropped rather than kept
  // under a new name.
  const toggleKind = useCallback(
    (k: Kind) => {
      if (debounce.current) clearTimeout(debounce.current);
      ownQuery.current = query;
      const next = new Set(kinds);
      if (next.has(k)) next.delete(k);
      else next.add(k);
      pushUrl(libraryUrl({ kinds: next, query, states }));
    },
    [kinds, query, states, pushUrl],
  );
  const selectAllKinds = useCallback(() => {
    if (debounce.current) clearTimeout(debounce.current);
    ownQuery.current = query;
    pushUrl(libraryUrl({ kinds: ALL_KINDS, query, states }));
  }, [query, states, pushUrl]);
  const clearKinds = useCallback(() => {
    if (debounce.current) clearTimeout(debounce.current);
    ownQuery.current = query;
    pushUrl(libraryUrl({ kinds: new Set(), query, states }));
  }, [query, states, pushUrl]);

  const toggleState = useCallback(
    (s: StatusFilter) => {
      if (debounce.current) clearTimeout(debounce.current);
      ownQuery.current = query;
      const next = new Set(states);
      if (next.has(s)) next.delete(s);
      else next.add(s);
      pushUrl(libraryUrl({ kinds, query, states: next }));
    },
    [kinds, query, states, pushUrl],
  );
  const selectAllStates = useCallback(() => {
    if (debounce.current) clearTimeout(debounce.current);
    ownQuery.current = query;
    pushUrl(libraryUrl({ kinds, query, states: ALL_STATES }));
  }, [kinds, query, pushUrl]);
  const clearStates = useCallback(() => {
    if (debounce.current) clearTimeout(debounce.current);
    ownQuery.current = query;
    pushUrl(libraryUrl({ kinds, query, states: new Set() }));
  }, [kinds, query, pushUrl]);

  // The search runs over 9,761 entries per keystroke. That is ~1–2ms and would
  // be fine synchronously; `useDeferredValue` is here for the RENDER, which is
  // the expensive half — a section of 8 rows is cheap but a shelf of 2,136 tiles
  // is not, and typing into a box that repaints the kanji shelf under it drops
  // frames. Deferring lets the field stay live while the results catch up.
  const deferred = useDeferredValue(query);
  // THE SELECTION — a global, cross-kind set of toggled entries you build a
  // drill from. It is NOT reset when the checked kinds change: select a
  // hiragana row, uncheck Kana, and it is still in here and still in the bar's
  // count.
  const [selected, setSelected] = useState<Selection>(EMPTY_SELECTION);
  // SELECT MODE — the explicit opt-in a plain click needs before it toggles a
  // tile/row into the selection above. Off by default, so the homepage's "look
  // up any kana" click actually looks it up (see entry-tile.tsx's file header)
  // instead of the old behaviour where the primary click always built a drill
  // and viewing an entry needed a barely-discoverable hover-only ↗.
  //
  // NOT reset by anything that resets selection elsewhere, and NOT cleared by
  // its own toggle either: turning it off mid-build keeps `selected` exactly as
  // it was, so a learner can flip it off to peek at an entry via a plain click
  // (Next's Activity-boundary back/forward preserves this component's state
  // across that trip — see the frame comment below) and flip it back on to keep
  // adding. Only the existing "Clear N selected" control empties the set.
  const [selectMode, setSelectMode] = useState(false);
  // THE SHIFT-CLICK ANCHOR — the last item picked WITHOUT Shift, the fixed end a
  // range extends from. A plain click sets it; a Shift-click reads it and leaves
  // it put (so you can sweep a range wider or narrower from the same anchor).
  // Null until the first plain click, and reset when the selection is cleared.
  const [anchor, setAnchor] = useState<EntryId | null>(null);
  // ONE `now` per mount, not `Date.now()` per render. Two calls a millisecond
  // apart cannot disagree about whether a fact is solid — but a `now` that
  // changes identity on every render makes every memo below useless, and a page
  // whose bar and table were computed against two different clocks is a bug
  // waiting for a slow render to expose it.
  const [now] = useState(() => Date.now());

  const q = deferred.trim();
  // A stable identity for the claims map, so the memos that now depend on it
  // (the knowledge filter's `keep`) don't recompute every render just because
  // `?? {}` minted a fresh empty object. `history.claims` is the only input.
  const claims = useMemo(() => history.claims ?? {}, [history.claims]);

  // Committed aggregate + the in-progress run, folded at read time, so a card
  // missed mid-drill reads shaky here NOW rather than on End session. Falls back
  // to history.facts (same reference) when nothing is in progress. Every
  // standing surface on this page reads THIS, not history.facts.
  const liveFacts = useLiveFacts(history.facts, now);
  // SAK-104: activeWeaknessPairs+factEntryOf need the guarded fact registry,
  // so this is now a Server Action call — once per history/graduateRuns
  // change (not per render, not per keystroke), same as before. Empty until
  // it resolves (the mixup Status filter simply matches nothing for that one
  // frame, same fallback `resultActiveMixupEntries` already had to tolerate a
  // freshly-mounted page).
  const activeMixupEntriesArr = useServerLookup(getActiveMixupEntries, [
    history,
    cfg.graduateRuns,
  ]);
  const activeMixupEntries = useMemo(
    () => new Set(activeMixupEntriesArr ?? []),
    [activeMixupEntriesArr],
  );

  /** Entries you have filed. Search sorts these to the front of a section. */
  const pinned = useMemo(() => {
    const set = new Set<string>();
    for (const l of lists) if (l.kind === "fixed") for (const e of l.entries) set.add(e);
    return set;
  }, [lists]);

  // THE STATUS FILTER AS A PREDICATE, in one place, so search and browse apply
  // the identical test. Undefined when no status is checked (SAK-167: that is
  // now the default, unfiltered state) — the callers treat "no keep" as "keep
  // everything", so the common (default) case adds no per-entry work.
  // Otherwise an entry passes if it matches ANY checked status (a union, not
  // an intersection — checking both Known and Solid means "known OR solid",
  // the same "widen what you see" reading multi-select checkboxes always
  // have): each status resolves through the same predicates the single-select
  // filter always used, just OR'd together instead of switched on one.
  //
  // WHICH facts define "known" is `knownFactsOf`'s call, not this predicate's:
  // all of them for most kinds, but a KANJI on its MEANING alone — the fact the
  // curriculum teaches, claims and shows as the character's standing. That is
  // what makes 人 ("Meaning: you know this" on its page) filter as Known here,
  // instead of failing because its ten unlearned readings looked like work.
  const keep = useMemo(() => {
    // No box checked is "no filter" (SAK-167), same fast path every-checked
    // used to fill — the predicates loop below only ever runs for a genuine,
    // non-empty narrowing, so an empty `states` never needs a branch there.
    if (isNoStateFilter(states)) return undefined;
    const predicates = [...states].map((value) =>
      statusPredicate(value, liveFacts, claims, now, activeMixupEntries),
    );
    // Typed over LibEntry (not BrowseEntry) so this still satisfies
    // allTabBrowseKinds/visibleShelfIds/<Shelf>'s existing `keep` prop type —
    // every entry actually flowing through this page now carries knownFacts
    // (fetched via getLibraryShelves/searchLibrary*, see BrowseEntry), so the
    // cast is safe at every real call site.
    return (entry: LibEntry) => predicates.some((p) => p(entry as BrowseEntry));
  }, [states, liveFacts, claims, now, activeMixupEntries]);

  // SEARCH FOLLOWS THE CHECKED KINDS. Exactly one kind checked keeps today's
  // richer single-subject search, sectioned by HOW you matched (exact / prefix
  // / means that / …) — the same experience narrowing to one subject has always
  // given. Anything else — no kind checked (the SAK-167 default) or two-plus
  // checked — reuses the All-tab's grouping BY TYPE — a Kanji block, a Words
  // block, in teaching order — restricted to whichever kinds are checked, or
  // to every kind when none are (`isNoKindFilter`); "no filter behaves like
  // the old All tab, a checked subset behaves like All-but-filtered" is the
  // same rule the browse view below follows. Both come back as
  // `{ key, label, hits }` so one render draws either.
  //
  // SAK-104: the actual match-finding moved into two Server Actions
  // (searchLibraryOneKind/searchLibraryByType — search.ts needs the guarded
  // index). `keep` is NOT sent over: it stays a client-side predicate exactly
  // as before (see statusPredicate above), applied to the returned hits here.
  // That is behaviourally identical to passing `keep` into search() itself —
  // search.ts's own opts.keep is a plain `continue` in its classify loop, so
  // filtering the fetched hits afterward (and dropping any section that comes
  // up empty as a result, same as a keep'd search() never populating it)
  // produces the same sections.
  const onlyKind = kinds.size === 1 ? [...kinds][0] : null;
  const pinnedArr = useMemo(() => [...pinned], [pinned]);
  const oneKindHits = useServerLookup(
    searchLibraryOneKind,
    q && onlyKind ? [q, onlyKind, pinnedArr] : null,
  );
  const byTypeHits = useServerLookup(
    searchLibraryByType,
    // Every case that is not "exactly one kind checked" — zero (no filter) or
    // two-plus — reads the grouped-by-type search, same as onlyKind above
    // reads the narrow one; the two are mutually exclusive and exhaustive.
    q && kinds.size !== 1 ? [q, pinnedArr] : null,
  );
  const resultSections = useMemo(() => {
    if (!q) return [];
    const raw =
      kinds.size === 1
        ? (oneKindHits ?? [])
        : (byTypeHits ?? []).filter((s) => isNoKindFilter(kinds) || kinds.has(s.kind));
    return raw
      .map((s) => ({
        key: s.key,
        label: s.label,
        hits: keep ? s.hits.filter((h) => keep(h.entry)) : s.hits,
      }))
      .filter((s) => s.hits.length > 0);
  }, [q, kinds, oneKindHits, byTypeHits, keep]);

  // Every hit, unsectioned — what the drill bar's slice is over when searching,
  // and what "show the other 140" would expand. `resultSections` already holds
  // every match uncapped (see the comment above), so this is a flatten of it
  // rather than a second search call: the two used to be separate queries
  // (`search`/`searchAll` run twice with slightly different options) that
  // happened to agree on the same entries; deriving one from the other makes
  // that agreement structural instead of coincidental.
  const resultHits = useMemo(
    () => resultSections.flatMap((s) => s.hits),
    [resultSections],
  );

  // Shelves are cut lazily per shown kind now — see shelfFor above. The kanji
  // shelf is sectioned by the "everyday" teaching order, the one the curriculum
  // actually teaches in.

  // WHAT A SHIFT-CLICK RANGE MAY REACH — the ids currently ON SCREEN, in display
  // order. Search view flattens its result sections (which now show every hit);
  // the browse shelf hands off to `visibleShelfIds`,
  // which mirrors the shelf's own render (word cap, knowledge filter, section
  // caps). Either way it excludes everything hidden, so a range is bounded by
  // what you can see. The order is the flattened top-to-bottom reading order
  // across sections (and, in search, across kinds), which is the order a range
  // follows.
  //
  // ONE FORMULA COVERS EVERY CHECKED-KIND SIZE — zero (SAK-167: no filter, so
  // every kind stays in), one, a subset, or every kind checked explicitly —
  // because `allTabBrowseKinds` already enumerates in teaching order and drops
  // whatever the Status filter emptied; filtering ITS output by which kinds
  // are checked (or keeping all of it when none are) is the "no filter is the
  // old All tab, a checked subset is All-but-filtered" rule applied to
  // Shift-range order the same way it is applied to the render below.
  const visibleIds = useMemo<EntryId[]>(() => {
    if (q) return resultSections.flatMap((s) => s.hits.map((h) => h.entry.id));
    return allTabBrowseKinds(keep, (k) => shelfFor(k).sections)
      .filter((k) => isNoKindFilter(kinds) || kinds.has(k))
      .flatMap((k) => visibleShelfIds(k, shelfFor(k).sections, keep));
  }, [q, resultSections, kinds, keep, shelfFor]);

  // A CLICK ON A TILE OR ROW. Without Shift it toggles the entry and drops the
  // anchor there. With Shift, IF there is a live anchor still on screen, it adds
  // the visible range from the anchor to here (additive — see addRange); the
  // anchor stays so the range can be re-swept. A Shift-click with no usable
  // anchor (none set yet, or it scrolled out under a filter change) degrades to
  // a plain toggle that re-anchors, so the gesture is never a dead click.
  const onToggleEntry = (id: EntryId, shiftKey = false) => {
    const canRange = shiftKey && anchor !== null && visibleIds.includes(anchor);
    setSelected((s) => (canRange ? addRange(s, visibleIds, anchor, id) : toggleEntryIn(s, id)));
    if (!canRange) setAnchor(id);
  };
  const onToggleSection = (ids: readonly EntryId[]) =>
    setSelected((s) => toggleSectionIn(s, ids));

  const [collapsedAllKinds, setCollapsedAllKinds] = useState<ReadonlySet<Kind>>(() => new Set());
  const toggleAllKind = (k: Kind) =>
    setCollapsedAllKinds((prev) => {
      const next = new Set(prev);
      if (next.has(k)) next.delete(k); else next.add(k);
      return next;
    });

  const [collapsedSearch, setCollapsedSearch] = useState<ReadonlySet<string>>(() => new Set());
  const toggleSearch = (key: string) =>
    setCollapsedSearch((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });

  // WHAT THE BAR IS POINTING AT, in one place.
  //
  //   a selection .... the drill you BUILT — the union of everything toggled,
  //                    across kinds. This wins over everything else: once you
  //                    are assembling a selection, the bar is about it.
  //   searching ...... the results. The sections already show every hit, and the
  //                    bar means the same set: you asked for で and the bar means で.
  //   browsing ....... whatever the checked kinds currently show — the whole
  //                    library when no kind is checked (SAK-167's unfiltered
  //                    default), or the union of the checked subjects'
  //                    shelves otherwise.
  // SAK-104: the two branches below that need the FULL entry list (a built
  // selection, in canonical library order; "Everything", no kind checked and
  // nothing selected) now fetch it via Server Actions instead of reading
  // the bundled LIB_ENTRIES. The "Everything, no status filter" case (the
  // page's DEFAULT state) is given a stable cache key that ignores
  // liveFacts/claims — getEverythingSlice doesn't need them for that case
  // either — so it fetches once rather than refetching on every fact tested.
  const selectedIdsArr = useMemo(() => [...selected], [selected]);
  const selectionSliceFetched = useServerLookup(
    getSelectionSlice,
    selected.size > 0 ? [selectedIdsArr] : null,
  );
  const noStateFilter = isNoStateFilter(states);
  const wantEverything = selected.size === 0 && !q && isNoKindFilter(kinds);
  const everythingSliceFetched = useServerLookup(
    getEverythingSlice,
    wantEverything
      ? noStateFilter
        ? [[], true, {}, {}, 0, []]
        : [[...states], false, liveFacts, claims, now, [...activeMixupEntries]]
      : null,
  );

  const slice = useMemo(() => {
    if (selected.size > 0) {
      return selectionSliceFetched ?? { label: `${selected.size} selected`, entries: [] };
    }
    if (q) {
      // The bar means every search hit under the same scope as the visible
      // results, reusing the computed hit set.
      return { label: q, entries: resultHits.map((h) => h.entry.id) };
    }
    // No kind checked, nothing selected (SAK-167's unfiltered default): the
    // bar is the whole library (the "drill everything" a single checked
    // kind's shelf generalises to). Reads straight off LIB_ENTRIES rather
    // than summing every kind's own visibleShelfIds: the counters shelf's
    // sections weave in entries from other kinds (see counter-shelf.ts), so a
    // per-kind sum only matters once the checked set stops being "everything"
    // and the union actually needs deriving from what's on screen — see the
    // branch below. A fully, explicitly checked set (every box literally
    // ticked) does NOT take this fast path any more — it falls through to the
    // generic checked-subset branch below, which happens to sum to the same
    // entries.
    if (isNoKindFilter(kinds)) {
      return { label: "Everything", entries: everythingSliceFetched ?? [] };
    }
    // A checked subset (including "every box literally checked"): the bar
    // means exactly what the checked shelves SHOW —
    // the same visible, keep-filtered id list a Shift-range selects over
    // (visibleIds above), not each kind's raw LIB_ENTRIES_BY_KIND set. The two
    // diverge on "Counting", whose sections are assembled from
    // several kinds (the construction reference pages and the number kanji
    // 一…十, not just COUNTER_KIND entries — see counterShelfSections):
    // counting the raw set there names only the handful of memorised counter
    // forms and undercounts the shelf. Deriving from the sections keeps the
    // count, the selection range and the painted rows one set.
    const shownKinds = KINDS.filter((k) => kinds.has(k));
    return {
      label: shownKinds.map((k) => KIND_LABEL[k]).join(", "),
      entries: shownKinds.flatMap((k) => visibleShelfIds(k, shelfFor(k).sections, keep)),
    };
  }, [
    selected,
    selectionSliceFetched,
    q,
    kinds,
    keep,
    resultHits,
    everythingSliceFetched,
    shelfFor,
  ]);

  // Sentence rules are the ONE place this page needs the assembly corpus
  // (`tierAssemblyFacts` resolves a tier's pool of sentence facts, which needs
  // the corpus module itself, not precomputable like the rest of the page's
  // list/search data). Loading it eagerly would put the ~9.5MB dictionary back on every
  // /library visit for a feature only a sentence-rule-mark selection ever
  // touches. So it is DYNAMICALLY IMPORTED, and only once the current slice
  // actually contains a sentence-rule mark — `hasSentenceMark` below is a cheap
  // check (marks.ts is a small fixed table) that gates the import.
  const hasSentenceMark = useMemo(
    () => slice.entries.some((id) => markFor(id)?.shelf === "sentence"),
    [slice.entries],
  );
  const [sentenceAssembly, setSentenceAssembly] = useState<
    typeof import("@/data/assembly") | null
  >(null);
  useEffect(() => {
    if (!hasSentenceMark || sentenceAssembly) return;
    let alive = true;
    void import("@/data/assembly").then((m) => {
      if (alive) setSentenceAssembly(m);
    });
    return () => {
      alive = false;
    };
  }, [hasSentenceMark, sentenceAssembly]);

  // Sentence rules are reference entries backed by a learn-track completion
  // marker rather than ordinary entry facts. Add those markers (and the same
  // readable assembly facts the Learn card claims) for whichever sentence-rule
  // rows the current shelf/search/selection slice contains. This keeps the
  // standard shelf-wide “I know these” action without making writing marks
  // pretend to be quiz facts. Empty until `sentenceAssembly` lands — a one-frame
  // gap the first time a learner ever selects a sentence-rule mark.
  const sentenceRuleClaimFacts = useMemo(() => {
    if (!sentenceAssembly) return [];
    const out = new Set<FactId>();
    for (const entryId of slice.entries) {
      const mark = markFor(entryId);
      if (mark?.shelf !== "sentence") continue;
      const tier = sentenceAssembly.SENTENCE_ORDERING_TIERS.find(
        (candidate) =>
          candidate.id === mark.id.replace("sentence-rule-", ""),
      );
      if (!tier) continue;
      for (const fact of sentenceAssembly.tierAssemblyFacts(tier, history)) {
        out.add(fact);
      }
      out.add(sentenceTierMarkerFact(tier.id));
    }
    return [...out];
  }, [slice.entries, history, sentenceAssembly]);

  const sentenceRuleActions = useMemo(() => {
    if (slice.entries.length === 0) return null;
    if (!sentenceAssembly) return null;
    const tiers = slice.entries.map((entryId) => {
      const mark = markFor(entryId);
      if (mark?.shelf !== "sentence") return null;
      return sentenceAssembly.SENTENCE_ORDERING_TIERS.find(
        (candidate) =>
          candidate.id === mark.id.replace("sentence-rule-", ""),
      ) ?? null;
    });
    // A mixed selection still gets the combined “I know these” action above,
    // but it cannot honestly be one quiz: sentence assembly and ordinary fact
    // questions use different modes.
    if (tiers.some((tier) => tier === null)) return null;

    const tierFacts = tiers.map((tier) => ({
      tier: tier!,
      facts: sentenceAssembly.tierAssemblyFacts(tier!, history),
    }));
    const quizFacts = [
      ...new Set(
        tierFacts.flatMap(({ tier, facts }) => [
          ...facts,
          sentenceTierMarkerFact(tier.id),
        ]),
      ),
    ];
    const nextTeach = tierFacts.find(
      ({ tier, facts }) =>
        facts.length > 0 &&
        claims[sentenceTierMarkerFact(tier.id)] === undefined,
    );
    const unclaimedLessonCount = tierFacts.filter(
      ({ tier }) =>
        claims[sentenceTierMarkerFact(tier.id)] === undefined,
    ).length;
    return {
      quizFacts,
      teachPlan: nextTeach
        ? {
            facts: [
              ...nextTeach.facts,
              sentenceTierMarkerFact(nextTeach.tier.id),
            ],
            teach: nextTeach.facts,
            what: `Sentence ordering · tier ${nextTeach.tier.id}`,
            mode: "assembly" as const,
            displayCount: unclaimedLessonCount,
          }
        : undefined,
    };
  }, [slice.entries, history, claims, sentenceAssembly]);

  return (
    // THE LIBRARY IS ITS OWN THREE-ROW FRAME, NOT PART OF THE PAGE SCROLL.
    //
    // SAK-204: every page shares ONE 3-row frame now (app/layout.tsx) — a
    // frozen header, the one scrolling middle row, and a frozen footer, `main`
    // itself pinned to exactly one viewport tall. This page used to build its
    // OWN separate copy of that same frame (a `-mb-15 h-[calc(...)]` wrapper
    // right here); now it just docks its header/footer into the shell's own
    // slots and renders its middle content plainly — see `<Dock>`'s own header
    // for why portalling AFTER the SSR/hydration paint doesn't reintroduce the
    // header-flashing-in problem that once ruled portalling out here.
    <>
      <Dock slot="top">
        {/* THE FROZEN HEADER. Title, search and filter controls. pb-2 sets it
            off from the scroll region below. */}
        <div className="pb-2">
          <PageTitle
            title="Library"
            sub="Every character, reading and word the app knows."
          />

      <StickySearch
        bare
        value={query}
        onChange={commitQuery}
        placeholder="Search anything: し, shi, 生, せんせい, telephone…"
      >
        {/* KIND AND STATUS, AS DROPDOWNS, ON THE LEFT UNDER THE SEARCH BAR — the
            owner's second round of feedback on this ticket: two chip ROWS (one
            item always on, changing what you SEE) became two CHECKLISTS (any
            number of items on, all checked by default), so they no longer need
            a whole line each to lay their options out — a trigger chip per
            filter says how much of it is checked, and the checkboxes live in
            the popover. "Select multiple" and "Clear N selected" move into the
            same row, since they are the same kind of control (a mode/filter
            toggle for this view), not pushed to the far right of it any more. */}
        <div className="flex flex-wrap items-center gap-2">
          <FilterDropdown
            label="Kind"
            items={KIND_ITEMS}
            selected={kinds}
            onToggle={toggleKind}
            onSelectAll={selectAllKinds}
            onClear={clearKinds}
          />
          <FilterDropdown
            label="Status"
            items={STATUS_ITEMS}
            selected={states}
            onToggle={toggleState}
            onSelectAll={selectAllStates}
            onClear={clearStates}
          />
          {/* SELECT MODE — off by default, so a plain click opens an entry (the
              "look up any kana" pitch). Turning this on is the explicit opt-in
              that repurposes the same click to build a drill instead — see
              entry-tile.tsx's file header and the `selectMode` state above. */}
          <Chip on={selectMode} onClick={() => setSelectMode((v) => !v)}>
            {selectMode ? "Done selecting" : "Select multiple"}
          </Chip>
          {selected.size > 0 ? (
            <GhostBtn
              className="text-xs"
              onClick={() => {
                setSelected(EMPTY_SELECTION);
                setAnchor(null);
              }}
            >
              Clear {selected.size} selected
            </GhostBtn>
          ) : null}
        </div>
        </StickySearch>
        </div>
      </Dock>

      {/* THE MIDDLE CONTENT. Renders straight into the shell's own shared
          scroll region now (app/layout.tsx) — no wrapper of its own needed.
          This is also the load-bearing gap graphite needs: the first result
          Card here is not preceded by a `sticky` sibling any more, so it never
          matches graphite's `[class~="sticky"] + card` lit-hairline rule and
          so never wears the active-quiz detail. */}
      <>
        {/* SAK-167: no kind checked is the unfiltered default now, not a dead
            end — it browses/searches every kind, so there is no longer a
            branch here for "nothing to browse or search". */}
        {q ? (
          resultSections.length === 0 ? (
            <Card>
              <p className="text-[13px]">
                {isNoStateFilter(states) ? (
                  <>
                    Nothing matches <b>{q}</b>.
                  </>
                ) : (
                  <>
                    No <b>{statesLabel(states)}</b>{" "}
                    entries match <b>{q}</b>.
                  </>
                )}
              </p>
              <p className="mt-1.5">
                <Hint>
                  {isNoStateFilter(states) ? (
                    <>
                      Searching an inflected form won&rsquo;t find its dictionary
                      word yet. 読んで doesn&rsquo;t reach 読む. That&rsquo;s a
                      known gap, not a missing word.
                    </>
                  ) : (
                    <>Check more boxes in the Status dropdown to see every match.</>
                  )}
                </Hint>
              </p>
            </Card>
          ) : (
            resultSections.map((s, index) => {
              const expanded = !collapsedSearch.has(s.key);
              return (
              <Card
                key={s.key}
                className={index === 0 ? undefined : "mt-5 border-t border-border/50 pt-5"}
              >
                <div className="mb-2 flex items-center gap-2">
                  <button
                    type="button"
                    aria-expanded={expanded}
                    onClick={() => toggleSearch(s.key)}
                    className="flex size-6 shrink-0 cursor-pointer items-center justify-center rounded text-xl leading-none text-text-muted hover:bg-panel hover:text-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                  >
                    <span aria-hidden className={`block transition-transform ${expanded ? "rotate-90" : ""}`}>›</span>
                  </button>
                <Lbl>
                  {s.label}
                  {s.hits.length > 0 ? (
                    <span className="ml-1.5 font-normal normal-case tracking-normal">
                      <Hint>
                        · {s.hits.length} matches
                        {pinned.size > 0 ? " · your lists first" : ""}
                      </Hint>
                    </span>
                  ) : null}
                </Lbl>
                </div>
                {expanded && s.hits.map((h) => (
                  <EntryRow
                    key={h.entry.id}
                    entry={h.entry}
                    note={h.entry.sub}
                    voice={cfg.voiceName}
                    selected={selected.has(h.entry.id)}
                    selectMode={selectMode}
                    onToggleSelect={(shift) => onToggleEntry(h.entry.id, shift)}
                  />
                ))}
              </Card>
              );
            })
          )
        ) : (
          // THE BROWSE — every checked kind with something to show, in teaching
          // order, each its own shelf, or every kind when none are checked
          // (SAK-167's unfiltered default). A subject the filter empties drops
          // out entirely (allTabBrowseKinds), so no empty headers; if the
          // checked set or the filter empties them ALL, one message stands in.
          // This is the SAME render the unfiltered default always used (the
          // old All tab), now just restricted to whichever kinds are checked
          // when any are — see the file header's note on generalising rather
          // than duplicating this path.
          (() => {
            const shownKinds = allTabBrowseKinds(
              keep,
              (k) => shelfFor(k).sections,
            ).filter((k) => isNoKindFilter(kinds) || kinds.has(k));
            if (shownKinds.length === 0) {
              return (
                <Card>
                  <p className="text-[13px] text-text-muted">
                    Nothing matches the {statesLabel(states)} filter.{" "}
                    <Hint>
                      Check more boxes in the Status dropdown to see every subject, or search.
                    </Hint>
                  </p>
                </Card>
              );
            }
            return shownKinds.map((k) => {
              const expanded = !collapsedAllKinds.has(k);
              return (
              <div key={k}>
                <div className="flex items-center gap-1.5 pb-1 pt-2">
                  <button
                    type="button"
                    aria-expanded={expanded}
                    onClick={() => toggleAllKind(k)}
                    className="flex size-5 shrink-0 cursor-pointer items-center justify-center rounded text-lg leading-none text-text-muted hover:bg-panel hover:text-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                  >
                    <span aria-hidden className={`block transition-transform ${expanded ? "rotate-90" : ""}`}>›</span>
                  </button>
                  <Lbl>{KIND_LABEL[k]}</Lbl>
                </div>
                {expanded && (
                <Shelf
                  kind={k}
                  sections={shelfFor(k).sections}
                  selected={selected}
                  onToggleEntry={onToggleEntry}
                  onToggleSection={onToggleSection}
                  voice={cfg.voiceName}
                  keep={keep}
                  filter={statesLabel(states)}
                  selectMode={selectMode}
                />)}
              </div>
              );
            });
          })()
        )}
      </>

      {/* THE FROZEN SLICE BAR — docked into the shell's own bottom slot
          (app/layout.tsx), the same shared frame every other page uses now. */}
      <Dock slot="bottom">
        <SliceBar
          slice={slice}
          facts={history.facts}
          claims={claims}
          history={history}
          now={now}
          onClaim={writes.claim}
          /* Bulk "Mark as not known": only meaningful once the reader has
           * hand-picked a selection. SliceBar itself gates the button on
           * claimedFacts within THIS slice being non-empty, and the whole bar
           * only mounts while hasSelection is true (see below), so it is safe
           * to always pass this — there is never a search/browse slice with
           * nothing selected reaching it. */
          onUnclaim={writes.unclaim}
          hasSelection={selected.size > 0}
          includeSolid={selected.size > 0}
          claimFacts={sentenceRuleClaimFacts}
          quizFacts={sentenceRuleActions?.quizFacts}
          quizMode={sentenceRuleActions ? "assembly" : undefined}
          teachPlan={sentenceRuleActions?.teachPlan}
          progressReady={historyLoaded}
        />
      </Dock>
    </>
  );
}
