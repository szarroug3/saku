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

import { EntryRow } from "@/components/library/entry-tile";
import { FilterDropdown } from "@/components/library/filter-dropdown";
import { Shelf, shelfSections } from "@/components/library/shelves";
import { visibleShelfIds, type ShelfSection } from "@/lib/library/shelf-view";
import { SliceBar } from "@/components/library/slice-bar";
import { StickySearch } from "@/components/library/sticky-search";
import { Card, Chip, GhostBtn, Hint, Lbl, PageTitle } from "@/components/ui";
import { markFor } from "@/data/marks";
import { activeWeaknessPairs } from "@/lib/confusions";
import {
  KIND_LABEL,
  KINDS,
  knownFactsOf,
  LIB_ENTRIES,
  LIB_ENTRIES_BY_KIND,
  factEntryOf,
} from "@/lib/library/library-index";
import type { Kind, LibEntry } from "@/lib/library/entries";
import { search, searchByType } from "@/lib/library/search";
import { allTabBrowseKinds } from "@/lib/library/all-tab";
import {
  addRange,
  EMPTY_SELECTION,
  selectionSlice,
  toggleEntry as toggleEntryIn,
  toggleSection as toggleSectionIn,
  type Selection,
} from "@/lib/library/selection";
import { standingOf, type Standing } from "@/lib/library/standing";
import { isEntryKnownForDisplay } from "@/lib/library/known-mark";
import { useLiveFacts } from "@/lib/library/use-live-facts";
import type { Claims } from "@/lib/claims";
import {
  ALL_KINDS,
  ALL_STATES,
  isEveryKind,
  isEveryState,
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
): (entry: LibEntry) => boolean {
  if (value === "known" || value === "unknown") {
    const wantKnown = value === "known";
    return (entry) =>
      isEntryKnownForDisplay(entry, liveFacts, claims, now) === wantKnown;
  }
  if (value === "mixup") {
    return (entry) => activeMixupEntries.has(entry.id);
  }
  const wanted: Standing = value;
  return (entry) =>
    knownFactsOf(entry).some(
      (fact) => standingOf(liveFacts[fact], claims[fact], now).standing === wanted,
    );
}

/** The active Status selection, as words — "known, solid", or "no status" for
 * a fully-cleared dropdown. Only ever built for the empty-state copy (search's
 * "No … entries match", a shelf's FilterEmpty): the predicate itself
 * (`keep`, below) does the actual filtering. */
function statesLabel(states: ReadonlySet<StatusFilter>): string {
  if (states.size === 0) return "no status";
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

// A shelf's sections and entries, cut LAZILY and cached at module scope. It used
// to build every kind up front on Library mount — including the 12,553-word sort
// — even when the default Kana tab never renders them. `shelfSections(k,
// "everyday")` depends only on the shipped tables (the knowledge filter is
// applied later, at render), so the cut is the same for every learner and every
// mount: compute each kind on first use and keep it for the app's lifetime.
const SHELF_CACHE = new Map<Kind, { sections: ShelfSection[]; entries: LibEntry[] }>();
function shelfFor(k: Kind): { sections: ShelfSection[]; entries: LibEntry[] } {
  let v = SHELF_CACHE.get(k);
  if (!v) {
    v = {
      sections: shelfSections(k, "everyday"),
      entries: [...(LIB_ENTRIES_BY_KIND.get(k) ?? [])],
    };
    SHELF_CACHE.set(k, v);
  }
  return v;
}

export function LibraryPageClient({
  initialSearch,
}: {
  /** The server-read query string, so the complete Library is in the first
   * response. URL changes after mount are mirrored into local state below. */
  initialSearch: string;
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
  // THE CHECKED KINDS — the Kind dropdown's own selection, every kind checked by
  // default. Every kind checked spans every subject (browse) and buckets a
  // search by type, exactly like the old "All" tab; a narrower set behaves like
  // that same All view filtered down to only the checked subjects — see
  // `isEveryKind` and the render below, which generalise the old All-tab code
  // path (allTabBrowseKinds) rather than duplicating it for the narrowed case.
  const kinds = urlState.kinds;
  const urlQuery = urlState.query;
  // THE CHECKED STATUSES — the Status dropdown's own selection, every status
  // checked by default (which filters nothing — "known" and "not known" alone
  // already partition every entry, so a full check-set is reach-equivalent to
  // the old "All" chip). Like the kinds, it lives in the URL so a link carries
  // it and Back steps through it, and it spans every kind: it governs both the
  // browse shelf and the search results, so "which kanji don't I know" is the
  // same question whether you are browsing or searching.
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
  const activeMixupEntries = useMemo(() => {
    const entries = new Set<string>();
    for (const pair of activeWeaknessPairs(
      history,
      cfg.graduateRuns,
      factEntryOf,
    )) {
      entries.add(pair.a);
      entries.add(pair.b);
    }
    return entries;
  }, [history, cfg.graduateRuns]);

  /** Entries you have filed. Search sorts these to the front of a section. */
  const pinned = useMemo(() => {
    const set = new Set<string>();
    for (const l of lists) if (l.kind === "fixed") for (const e of l.entries) set.add(e);
    return set;
  }, [lists]);

  // THE STATUS FILTER AS A PREDICATE, in one place, so search and browse apply
  // the identical test. Undefined when every status is checked — the callers
  // treat "no keep" as "keep everything", so the common (default) case adds no
  // per-entry work. Otherwise an entry passes if it matches ANY checked status
  // (a union, not an intersection — checking both Known and Solid means "known
  // OR solid", the same "widen what you see" reading multi-select checkboxes
  // always have): each status resolves through the same predicates the single-
  // select filter always used, just OR'd together instead of switched on one.
  //
  // WHICH facts define "known" is `knownFactsOf`'s call, not this predicate's:
  // all of them for most kinds, but a KANJI on its MEANING alone — the fact the
  // curriculum teaches, claims and shows as the character's standing. That is
  // what makes 人 ("Meaning: you know this" on its page) filter as Known here,
  // instead of failing because its ten unlearned readings looked like work.
  const keep = useMemo(() => {
    if (isEveryState(states)) return undefined;
    // Every box unchecked is not "no filter", it is "filter everything out" —
    // the Status dropdown's Clear button, taken at its word. An empty
    // `predicates` array falls straight out of `.some()` below (vacuously
    // false for every entry), so that case needs no branch of its own.
    const predicates = [...states].map((value) =>
      statusPredicate(value, liveFacts, claims, now, activeMixupEntries),
    );
    return (entry: LibEntry) => predicates.some((p) => p(entry));
  }, [states, liveFacts, claims, now, activeMixupEntries]);

  // SEARCH FOLLOWS THE CHECKED KINDS. Exactly one kind checked keeps today's
  // richer single-subject search, sectioned by HOW you matched (exact / prefix
  // / means that / …) — the same experience narrowing to one subject has always
  // given. Two or more (including every kind, the default) reuses the All-tab's
  // grouping BY TYPE — a Kanji block, a Words block, in teaching order —
  // restricted to whichever kinds are still checked; "every kind checked
  // behaves like the old All tab, a subset behaves like All-but-filtered" is
  // the same rule the browse view below follows. Both come back as
  // `{ key, label, hits }` so one render draws either.
  const resultSections = useMemo(() => {
    if (!q || kinds.size === 0) return [];
    if (kinds.size === 1) {
      const [onlyKind] = kinds;
      return search(q, {
        kind: onlyKind,
        pinned,
        keep,
        perSection: Number.MAX_SAFE_INTEGER,
      }).map((s) => ({
        key: s.why as string,
        label: s.label,
        hits: s.hits,
      }));
    }
    // SEARCH SHOWS EVERYTHING IT FOUND. No per-section cap: the owner wants a
    // search to render every match, not the first 8 with a "+N more" footer. So
    // `perSection` is unbounded and every section's `hits` holds all of them.
    return searchByType(q, {
      pinned,
      keep,
      perSection: Number.MAX_SAFE_INTEGER,
    })
      .filter((s) => kinds.has(s.kind))
      .map((s) => ({
        key: s.kind as string,
        label: s.label,
        hits: s.hits,
      }));
  }, [q, kinds, pinned, keep]);

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
  // ONE FORMULA COVERS EVERY CHECKED-KIND SIZE — zero, one, a subset, or every
  // kind — because `allTabBrowseKinds` already enumerates in teaching order and
  // drops whatever the Status filter emptied; filtering ITS output by which
  // kinds are checked is the "All-tab-but-filtered-to-a-subset" rule applied to
  // Shift-range order the same way it is applied to the render below.
  const visibleIds = useMemo<EntryId[]>(() => {
    if (q) return resultSections.flatMap((s) => s.hits.map((h) => h.entry.id));
    return allTabBrowseKinds(keep, (k) => shelfFor(k).sections)
      .filter((k) => kinds.has(k))
      .flatMap((k) => visibleShelfIds(k, shelfFor(k).sections, keep));
  }, [q, resultSections, kinds, keep]);

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
  //                    library when every kind is checked, or the union of the
  //                    checked subjects' shelves otherwise.
  const slice = useMemo(() => {
    if (selected.size > 0) return selectionSlice(selected, LIB_ENTRIES);
    if (q) {
      // The bar means every search hit under the same scope as the visible
      // results, reusing the computed hit set.
      return { label: q, entries: resultHits.map((h) => h.entry.id) };
    }
    if (kinds.size === 0) return { label: "Nothing", entries: [] };
    // Every kind checked, nothing selected: the bar is the whole library (the
    // "drill everything" a single checked kind's shelf generalises to). Reads
    // straight off LIB_ENTRIES rather than summing every kind's own
    // visibleShelfIds: the counters shelf's sections weave in entries from
    // other kinds (see counter-shelf.ts), so a per-kind sum only matters once
    // the checked set stops being "everything" and the union actually needs
    // deriving from what's on screen — see the branches below.
    if (isEveryKind(kinds)) {
      const entries = keep ? LIB_ENTRIES.filter(keep) : LIB_ENTRIES;
      return { label: "Everything", entries: entries.map((e) => e.id) };
    }
    // A checked subset: the bar means exactly what the checked shelves SHOW —
    // the same visible, keep-filtered id list a Shift-range selects over
    // (visibleIds above), not each kind's raw LIB_ENTRIES_BY_KIND set. The two
    // diverge on "Numbers and counters", whose sections are assembled from
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
  }, [selected, q, kinds, keep, resultHits]);

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
    // The app's shell scrolls the window (see layout.tsx), and this page used to
    // ride that: one window scroll, a `sticky top-0` header, and the shelves
    // sliding up UNDER it — which is why the header had to occlude with a
    // `kq-band` backdrop-filter that re-snapshotted the mesh every scroll frame.
    // That per-frame snapshot was the kiri scroll lag.
    //
    // Instead this is a viewport-tall flex column: a fixed header, a middle
    // region that is the ONLY thing that scrolls, and a fixed slice bar. Nothing
    // ever passes behind the header or the bar (they are siblings of the scroll
    // box, not over it), so there is nothing to occlude and NO backdrop-filter on
    // the scroll path at all.
    //
    // The height math cancels the shell chrome we can't edit: kq-scroll wraps us
    // in `pt-3 pb-15` and the flex row adds `py-6`, so `-mb-15` reclaims that
    // 60px of dead space below the bar and the height is `100dvh` minus the
    // remaining 24px (py-6 top) + 12px (pt-3) above and 24px (py-6) below = 60px.
    // The whole document then equals the viewport: no window scroll to fight the
    // frozen rows. Everything stays in this server-rendered tree (no portalling),
    // so the SSR DOM and the hydrated DOM match and no control reflows on mount.
    <div className="-mb-15 flex h-[calc(100dvh-60px)] flex-col">
      {/* THE FROZEN HEADER. Title, search and filter controls. `shrink-0` keeps
          it at its natural height at the top of the frame; it does not scroll
          and nothing scrolls behind it, so it needs no occluding material. pb-2
          sets it off from the scroll region below. */}
        <div className="shrink-0 pb-2">
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

      {/* THE ONLY SCROLL REGION. It begins at the bottom of the frozen header
          and ends at the top of the frozen slice bar, and its content is clipped
          to that box — nothing passes behind the header or the bar. `flex-1
          min-h-0` lets it take the remaining height and shrink below its content
          so `overflow-y-auto` actually scrolls; `overflow-x-clip` keeps wide
          shelves from bleeding sideways. `kq-scroll` gives it the app's thin
          styled scrollbar. This div is also the load-bearing gap graphite needs:
          it is NOT `sticky`, so the first result Card inside it never matches
          graphite's `[class~="sticky"] + card` lit-hairline rule and so never
          wears the active-quiz detail. */}
      <div className="kq-scroll min-h-0 flex-1 overflow-x-clip overflow-y-auto">
        {kinds.size === 0 ? (
          // No kind is checked at all — nothing to browse or search, and a
          // distinct message from "the Status filter emptied everything": this
          // one names the OTHER dropdown, so it never reads as a dead end.
          <Card>
            <p className="text-[13px] text-text-muted">
              No kind is selected.{" "}
              <Hint>Check at least one in the Kind dropdown to browse or search.</Hint>
            </p>
          </Card>
        ) : q ? (
          resultSections.length === 0 ? (
            <Card>
              <p className="text-[13px]">
                {isEveryState(states) ? (
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
                  {isEveryState(states) ? (
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
            resultSections.map((s) => {
              const expanded = !collapsedSearch.has(s.key);
              return (
              <Card key={s.key}>
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
          // order, each its own shelf. A subject the filter empties drops out
          // entirely (allTabBrowseKinds), so no empty headers; if the checked
          // set or the filter empties them ALL, one message stands in. This is
          // the SAME render every kind checked always used (the old All tab),
          // now just restricted to whichever kinds are checked — see the file
          // header's note on generalising rather than duplicating this path.
          (() => {
            const shownKinds = allTabBrowseKinds(
              keep,
              (k) => shelfFor(k).sections,
            ).filter((k) => kinds.has(k));
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
      </div>

      {/* THE FROZEN SLICE BAR. The last row of the frame, `shrink-0` so it keeps
          its height at the bottom while the region above scrolls. It stays in
          this server-rendered tree (no portalling — that used to place it after
          every shelf on the first response and visibly snap into view on
          hydration), and it needs no sticky positioning now: as a sibling below
          the scroll box it is frozen by the layout, and nothing scrolls behind
          it. */}
      <div className="shrink-0">
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
      </div>
    </div>
  );
}
