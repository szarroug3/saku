"use client";

// The Library — search, and shelves when you haven't searched.
//
// ONE NAV ITEM, NOT THE FRONT DOOR. The user: "the reference should exist as an
// easy way to look things up, not as the product." The ranked drill is what the
// app is for; this is how you get at things. So this page has no dashboard, no
// progress, no suggestions, and nothing that competes with Home for the first
// thing you do. It has a search box, because that is the front door OF THIS TAB
// and nothing else on it matters as much.

import { useSearchParams } from "next/navigation";
import {
  Suspense,
  useCallback,
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { AttributionLink } from "@/components/library/attribution-link";
import { EntryRow } from "@/components/library/entry-tile";
import { Shelf, shelfSections } from "@/components/library/shelves";
import { visibleShelfIds, type ShelfSection } from "@/lib/library/shelf-view";
import { SliceBar } from "@/components/library/slice-bar";
import { StickySearch } from "@/components/library/sticky-search";
import { Dock } from "@/components/dock";
import { Card, Chip, GhostBtn, Hint, Lbl, PageTitle } from "@/components/ui";
import { factsOf } from "@/lib/facts";
import {
  KIND_LABEL,
  KINDS,
  knownFactsOf,
  LIB_ENTRIES,
  type Kind,
  type LibEntry,
} from "@/lib/library/entries";
import { search, searchAll } from "@/lib/library/search";
import {
  addRange,
  EMPTY_SELECTION,
  selectionSlice,
  toggleEntry as toggleEntryIn,
  toggleSection as toggleSectionIn,
  type Selection,
} from "@/lib/library/selection";
import { entryStanding, entryIsKnown } from "@/lib/library/standing";
import {
  kindFromParams,
  libraryUrl,
  queryFromParams,
  stateFromParams,
  type KnowledgeFilter,
} from "@/lib/library/url-state";
import { useLists } from "@/lib/use-lists";
import { useQuizConfig } from "@/lib/quiz-config";
import { postClaim } from "@/lib/progress-fetch";
import { useHistory } from "@/lib/use-history";
import type { EntryId, FactId } from "@/types";

/** The knowledge-filter chips, in the order they read: the escape hatch first,
 * then the two narrowings. Their values are the `KnowledgeFilter` the URL
 * carries; the labels are the user's words for them. */
const STATE_CHIPS: readonly { value: KnowledgeFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "known", label: "Known" },
  { value: "unknown", label: "Not known" },
];

/** `useSearchParams` client-side-renders everything up to the nearest Suspense
 * boundary, and a production build of a static page fails without one. The
 * Library reads its tab, query and knowledge filter from the URL, so the
 * boundary is the page and the body below is what it wraps. */
export default function LibraryPage() {
  return (
    <Suspense fallback={null}>
      <LibraryBody />
    </Suspense>
  );
}

function LibraryBody() {
  const { history, refresh } = useHistory();
  const { cfg } = useQuizConfig();
  const { lists } = useLists();

  // THE URL IS THE STATE, for both the tab and the box. See url-state.ts for
  // why (short version: the entry-page breadcrumb has always linked here with a
  // ?kind= that this page ignored, and Back used to leave the Library).
  const searchParams = useSearchParams();

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
  // sidebar link) still work, which is why only the chips and the search box went
  // dead until a full reload. The History API takes a different path through the
  // router and is unaffected, so the chips keep working across any history dance.
  //
  // pushState/replaceState also give us the two behaviours we relied on
  // router's options for, for free: they add NO scroll (the `scroll: false` the
  // chip nav wanted), and pushState still writes one history entry so Back
  // undoes a kind/filter choice exactly as before.
  const pushUrl = useCallback(
    (url: string) => window.history.pushState(null, "", url),
    [],
  );
  const replaceUrl = useCallback(
    (url: string) => window.history.replaceState(null, "", url),
    [],
  );
  // ONE kind is shown at a time — there is no "All" view. Stacking every kind's
  // shelf at once (kana 214 + kanji + words + grammar ≈ thousands of tiles) was
  // genuinely laggy, and its value is already covered: SEARCH spans every kind,
  // and the SELECTION below persists across kind switches, so you can still
  // build a cross-kind drill without a screen that paints all of them. The
  // default is Kana — the lightest first paint.
  const kind = kindFromParams(searchParams);
  const urlQuery = queryFromParams(searchParams);
  // THE KNOWLEDGE FILTER — All / Known / Not known. Like the kind, it lives in
  // the URL so a link carries it and Back steps through it, and it spans every
  // kind: it governs both the browse shelf and the search results, so "which
  // kanji don't I know" is the same question whether you are browsing or
  // searching. Its default is All, and All is omitted from the URL.
  const stateFilter = stateFromParams(searchParams);

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

  // TYPING REPLACES, SWITCHING TABS PUSHES.
  //
  // A push per keystroke means "shirasu" buries the previous page under seven
  // history entries and Back becomes a stuck key. So the query is a `replace`,
  // and debounced on top of it (250ms) — replace alone still runs a router
  // transition per character, which is the expensive half on a page that paints
  // a 2,136-tile shelf. What you get back is one URL that always describes the
  // box, and a Back that leaves the Library in one press from a typed word.
  //
  // The tab, by contrast, IS a navigation: you chose Kanji, you can expect Back
  // to return you to Kana. That is a `push`, and it is the behaviour the
  // breadcrumb was already written as if it had.
  const commitQuery = useCallback(
    (value: string) => {
      setQuery(value);
      if (debounce.current) clearTimeout(debounce.current);
      debounce.current = setTimeout(() => {
        ownQuery.current = value;
        replaceUrl(libraryUrl({ kind, query: value, state: stateFilter }));
      }, 250);
    },
    [kind, stateFilter, replaceUrl],
  );

  const selectKind = useCallback(
    (next: Kind) => {
      // Flush the pending query first — the tab switch carries whatever is in
      // the box RIGHT NOW, not whatever the debounce last got around to
      // writing, or the new history entry would disagree with the screen.
      if (debounce.current) clearTimeout(debounce.current);
      ownQuery.current = query;
      pushUrl(libraryUrl({ kind: next, query, state: stateFilter }));
    },
    [query, stateFilter, pushUrl],
  );

  // The knowledge filter is a navigation like the kind chips: choosing "Known"
  // is a decision you can expect Back to undo, so it PUSHES. It carries the
  // live query for the same reason the tab switch does.
  const selectState = useCallback(
    (next: KnowledgeFilter) => {
      if (debounce.current) clearTimeout(debounce.current);
      ownQuery.current = query;
      pushUrl(libraryUrl({ kind, query, state: next }));
    },
    [kind, query, pushUrl],
  );

  // The search runs over 9,761 entries per keystroke. That is ~1–2ms and would
  // be fine synchronously; `useDeferredValue` is here for the RENDER, which is
  // the expensive half — a section of 8 rows is cheap but a shelf of 2,136 tiles
  // is not, and typing into a box that repaints the kanji shelf under it drops
  // frames. Deferring lets the field stay live while the results catch up.
  const deferred = useDeferredValue(query);
  // THE SELECTION — a global, cross-kind set of toggled entries you build a
  // drill from. It is NOT reset when the kind filter changes: select a hiragana
  // row, switch to kanji, and it is still in here and still in the bar's count.
  const [selected, setSelected] = useState<Selection>(EMPTY_SELECTION);
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

  /** Entries you have filed. Search sorts these to the front of a section. */
  const pinned = useMemo(() => {
    const set = new Set<string>();
    for (const l of lists) if (l.kind === "fixed") for (const e of l.entries) set.add(e);
    return set;
  }, [lists]);

  // THE KNOWLEDGE FILTER AS A PREDICATE, in one place, so search and browse
  // apply the identical test. Undefined for All — the callers treat "no keep"
  // as "keep everything", so the common case adds no per-entry work. For Known
  // and Not known it resolves each entry through `entryStanding`, the same
  // effective-progress-and-claims path the tiles already use, so a thing you
  // marked "I already know this" filters as Known without a Library-only rule.
  //
  // WHICH facts define "known" is `knownFactsOf`'s call, not this predicate's:
  // all of them for most kinds, but a KANJI on its MEANING alone — the fact the
  // curriculum teaches, claims and shows as the character's standing. That is
  // what makes 人 ("Meaning: you know this" on its page) filter as Known here,
  // instead of failing because its ten unlearned readings looked like work.
  const keep = useMemo(() => {
    if (stateFilter === "all") return undefined;
    const wantKnown = stateFilter === "known";
    return (entry: LibEntry) =>
      entryIsKnown(
        entryStanding(knownFactsOf(entry), history.facts, claims, cfg.accuracyMetric, now),
      ) === wantKnown;
  }, [stateFilter, history.facts, claims, cfg.accuracyMetric, now]);

  // SEARCH SPANS EVERY KIND, always — the kind chips govern the browse shelf,
  // not the search. This is what makes removing the "All" tab safe: you lost the
  // stacked all-kinds BROWSE (the laggy part), but a query still reaches kana,
  // kanji, words AND grammar at once, so "must" finds the patterns even while
  // the Kana shelf is the one selected underneath.
  const sections = useMemo(() => search(q, { pinned, keep }), [q, pinned, keep]);

  // Every shelf, cut once. Built for all three kinds up front (cheap array work,
  // no DOM) so switching the kind filter — or the "All" view that shows all
  // three — is a lookup, not a re-cut. Only the kinds actually shown get their
  // tiles rendered, which is where the real cost is.
  //
  // RE-CUT WHEN THE KANJI ORDER CHANGES. The kanji shelf is sectioned by the
  // order you are studying in, so it is the one shelf whose cut is a setting;
  // change it in Settings and the sections have to follow, or the Library shows
  // you a curriculum you are no longer on.
  const shelvesByKind = useMemo(() => {
    const m = new Map<Kind, { sections: ShelfSection[]; entries: LibEntry[] }>();
    for (const k of KINDS) {
      m.set(k, {
        sections: shelfSections(k, cfg.newKanjiOrder),
        entries: LIB_ENTRIES.filter((e) => e.kind === k),
      });
    }
    return m;
  }, [cfg.newKanjiOrder]);

  // WHAT A SHIFT-CLICK RANGE MAY REACH — the ids currently ON SCREEN, in display
  // order. Search view flattens its result sections (only the shown hits, never
  // the "+N more" it withholds); the browse shelf hands off to `visibleShelfIds`,
  // which mirrors the shelf's own render (word cap, knowledge filter, section
  // caps). Either way it excludes everything hidden, so a range is bounded by
  // what you can see. The order is the flattened top-to-bottom reading order
  // across sections (and, in search, across kinds), which is the order a range
  // follows.
  const visibleIds = useMemo<EntryId[]>(() => {
    if (q) return sections.flatMap((s) => s.hits.map((h) => h.entry.id));
    const sh = shelvesByKind.get(kind)!;
    return visibleShelfIds(kind, sh.sections, sh.entries, keep);
  }, [q, sections, kind, shelvesByKind, keep]);

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

  // WHAT THE BAR IS POINTING AT, in one place.
  //
  //   a selection .... the drill you BUILT — the union of everything toggled,
  //                    across kinds. This wins over everything else: once you
  //                    are assembling a selection, the bar is about it.
  //   searching ...... the results. ALL of them, not the 8 per section the page
  //                    had room for: you asked for で and the bar means で.
  //   a single kind .. that whole shelf (the shipped "drill all of Kanji").
  const slice = useMemo(() => {
    if (selected.size > 0) return selectionSlice(selected, LIB_ENTRIES);
    if (q) {
      const hits = searchAll(q, { pinned, keep });
      return { label: q, entries: hits.map((h) => h.entry.id) };
    }
    const entries = shelvesByKind.get(kind)!.entries;
    return {
      label: KIND_LABEL[kind],
      entries: (keep ? entries.filter(keep) : entries).map((e) => e.id),
    };
  }, [selected, q, kind, pinned, keep, shelvesByKind]);

  const standingOfEntry = (entry: LibEntry) =>
    entryStanding(factsOf(entry.id), history.facts, claims, cfg.accuracyMetric, now);

  const claim = async (facts: FactId[]) => {
    // postClaim, not a raw fetch: a signed-out claim (401) is saved to this
    // browser instead of vanishing, and the refresh() below reads it back.
    await postClaim(facts, true);
    await refresh();
  };

  return (
    <>
      {/* THE FROZEN HEADER. Title, search and filter chips, lifted out of the
          scroll into the shell's top dock so they stay put above the shelves. No
          box around it — it sits on the ground like the shelves do, so the header
          and the tiles read as one surface; the dock just keeps it frozen. The
          px-3 matches the scroller's own inset so the header lines up with the
          tiles below it. */}
      <Dock slot="top">
        <div className="px-3">
          <PageTitle
            title="Library"
            sub="Every character, reading and word the app knows. Search it, or open a shelf."
          />

      <StickySearch
        bare
        value={query}
        onChange={commitQuery}
        placeholder="Search anything: し, shi, 生, せんせい, telephone…"
      >
        {/* The kind chips change what you SEE, never what you have SELECTED —
            the selection outlives them. One is always active; there is no "All". */}
        {KINDS.map((k) => (
          <Chip key={k} on={kind === k} onClick={() => selectKind(k)}>
            {KIND_LABEL[k]}
          </Chip>
        ))}
        {/* The knowledge filter, a group of its own — a hairline sets it apart
            from the kind chips so "Kanji" and "Known" don't read as one row of
            equals. Unlike the kinds, "All" IS a chip here: the two states are
            narrowings and All is how you get back out of one. It governs the
            shelf AND the search results below. */}
        <span aria-hidden className="mx-0.5 h-4 w-px bg-border" />
        {STATE_CHIPS.map(({ value, label }) => (
          <Chip
            key={value}
            on={stateFilter === value}
            onClick={() => selectState(value)}
          >
            {label}
          </Chip>
        ))}
        {selected.size > 0 ? (
          <GhostBtn
            className="ml-auto text-xs"
            onClick={() => {
              setSelected(EMPTY_SELECTION);
              setAnchor(null);
            }}
          >
            Clear {selected.size} selected
          </GhostBtn>
        ) : null}
        </StickySearch>
        </div>
      </Dock>

      {/* A plain div between the sticky field and the first Card, and it is
          load-bearing: graphite paints its lit hairline on
          `[class~="sticky"] + [class~="rounded-xl"][class~="bg-card"]` — the
          card following the drill HUD — so without this the first result Card
          would silently wear the active-quiz detail. */}
      <div>
        {q ? (
          sections.length === 0 ? (
            <Card>
              <p className="text-[13px]">
                {stateFilter === "all" ? (
                  <>
                    Nothing matches <b>{q}</b>.
                  </>
                ) : (
                  <>
                    No <b>{stateFilter === "known" ? "known" : "not-known"}</b>{" "}
                    entries match <b>{q}</b>.
                  </>
                )}
              </p>
              <p className="mt-1.5">
                <Hint>
                  {stateFilter === "all" ? (
                    <>
                      Searching an inflected form won&rsquo;t find its dictionary
                      word yet. 読んで doesn&rsquo;t reach 読む. That&rsquo;s a
                      known gap, not a missing word.
                    </>
                  ) : (
                    <>Switch the filter back to All to see every match.</>
                  )}
                </Hint>
              </p>
            </Card>
          ) : (
            sections.map((s) => (
              <Card key={s.why}>
                <Lbl>
                  {s.label}
                  {s.more > 0 ? (
                    <span className="ml-1.5 font-normal normal-case tracking-normal">
                      <Hint>
                        · {s.hits.length + s.more} matches
                        {pinned.size > 0 ? " · your lists first" : ""}
                      </Hint>
                    </span>
                  ) : null}
                </Lbl>
                {s.hits.map((h) => (
                  <EntryRow
                    key={h.entry.id}
                    entry={h.entry}
                    standing={standingOfEntry(h.entry)}
                    note={h.entry.sub}
                    voice={cfg.voiceName}
                    selected={selected.has(h.entry.id)}
                    onToggleSelect={(shift) => onToggleEntry(h.entry.id, shift)}
                  />
                ))}
                {s.more > 0 ? (
                  <p className="pt-2.5">
                    <Hint>
                      ＋ {s.more} more like this. Narrow the search, or use the
                      shelf chips. The bar below already means all{" "}
                      {s.hits.length + s.more}.
                    </Hint>
                  </p>
                ) : null}
              </Card>
            ))
          )
        ) : (
          (() => {
            const sh = shelvesByKind.get(kind)!;
            return (
              <Shelf
                key={kind}
                kind={kind}
                sections={sh.sections}
                allEntries={sh.entries}
                selected={selected}
                onToggleEntry={onToggleEntry}
                onToggleSection={onToggleSection}
                facts={history.facts}
                claims={claims}
                metric={cfg.accuracyMetric}
                now={now}
                voice={cfg.voiceName}
                keep={keep}
                filter={stateFilter}
              />
            );
          })()
        )}
      </div>

      {/* THE FROZEN FOOTER BOX. The slice bar, docked below the frame so it stays
          put while the shelves scroll. Its own box (kq-band), frozen in place. */}
      <Dock slot="bottom">
        <SliceBar
          slice={slice}
          facts={history.facts}
          claims={claims}
          now={now}
          onClaim={claim}
          includeSolid={selected.size > 0}
        />
      </Dock>

      <AttributionLink />
    </>
  );
}
