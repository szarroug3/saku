"use client";

// The Library — search, and shelves when you haven't searched.
//
// ONE NAV ITEM, NOT THE FRONT DOOR. The user: "the reference should exist as an
// easy way to look things up, not as the product." The ranked drill is what the
// app is for; this is how you get at things. So this page has no dashboard, no
// progress, no suggestions, and nothing that competes with Home for the first
// thing you do. It has a search box, because that is the front door OF THIS TAB
// and nothing else on it matters as much.

import { useRouter, useSearchParams } from "next/navigation";
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
import { Shelf, shelfSections, type ShelfSection } from "@/components/library/shelves";
import { SliceBar } from "@/components/library/slice-bar";
import { StickySearch } from "@/components/library/sticky-search";
import { Card, Chip, GhostBtn, Hint, Lbl, PageTitle } from "@/components/ui";
import { factsOf } from "@/lib/facts";
import {
  KIND_LABEL,
  KINDS,
  LIB_ENTRIES,
  type Kind,
  type LibEntry,
} from "@/lib/library/entries";
import { search, searchAll } from "@/lib/library/search";
import {
  EMPTY_SELECTION,
  selectionSlice,
  toggleEntry as toggleEntryIn,
  toggleSection as toggleSectionIn,
  type Selection,
} from "@/lib/library/selection";
import { entryStanding } from "@/lib/library/standing";
import {
  kindFromParams,
  libraryUrl,
  queryFromParams,
} from "@/lib/library/url-state";
import { useLists } from "@/lib/use-lists";
import { useQuizConfig } from "@/lib/quiz-config";
import { useHistory } from "@/lib/use-history";
import type { EntryId, FactId } from "@/types";

/** `useSearchParams` client-side-renders everything up to the nearest Suspense
 * boundary, and a production build of a static page fails without one. The
 * Library reads two params, so the boundary is the page and the body below is
 * what it wraps. */
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
  const router = useRouter();
  const searchParams = useSearchParams();
  // ONE kind is shown at a time — there is no "All" view. Stacking every kind's
  // shelf at once (kana 214 + kanji + words + grammar ≈ thousands of tiles) was
  // genuinely laggy, and its value is already covered: SEARCH spans every kind,
  // and the SELECTION below persists across kind switches, so you can still
  // build a cross-kind drill without a screen that paints all of them. The
  // default is Kana — the lightest first paint.
  const kind = kindFromParams(searchParams);
  const urlQuery = queryFromParams(searchParams);

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
        router.replace(libraryUrl({ kind, query: value }), { scroll: false });
      }, 250);
    },
    [kind, router],
  );

  const selectKind = useCallback(
    (next: Kind) => {
      // Flush the pending query first — the tab switch carries whatever is in
      // the box RIGHT NOW, not whatever the debounce last got around to
      // writing, or the new history entry would disagree with the screen.
      if (debounce.current) clearTimeout(debounce.current);
      ownQuery.current = query;
      router.push(libraryUrl({ kind: next, query }), { scroll: false });
    },
    [query, router],
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
  // ONE `now` per mount, not `Date.now()` per render. Two calls a millisecond
  // apart cannot disagree about whether a fact is solid — but a `now` that
  // changes identity on every render makes every memo below useless, and a page
  // whose bar and table were computed against two different clocks is a bug
  // waiting for a slow render to expose it.
  const [now] = useState(() => Date.now());

  const q = deferred.trim();
  const claims = history.claims ?? {};

  /** Entries you have filed. Search sorts these to the front of a section. */
  const pinned = useMemo(() => {
    const set = new Set<string>();
    for (const l of lists) if (l.kind === "fixed") for (const e of l.entries) set.add(e);
    return set;
  }, [lists]);

  // SEARCH SPANS EVERY KIND, always — the kind chips govern the browse shelf,
  // not the search. This is what makes removing the "All" tab safe: you lost the
  // stacked all-kinds BROWSE (the laggy part), but a query still reaches kana,
  // kanji, words AND grammar at once, so "must" finds the patterns even while
  // the Kana shelf is the one selected underneath.
  const sections = useMemo(() => search(q, { pinned }), [q, pinned]);

  // Every shelf, cut once. Built for all three kinds up front (cheap array work,
  // no DOM) so switching the kind filter — or the "All" view that shows all
  // three — is a lookup, not a re-cut. Only the kinds actually shown get their
  // tiles rendered, which is where the real cost is.
  const shelvesByKind = useMemo(() => {
    const m = new Map<Kind, { sections: ShelfSection[]; entries: LibEntry[] }>();
    for (const k of KINDS) {
      m.set(k, {
        sections: shelfSections(k),
        entries: LIB_ENTRIES.filter((e) => e.kind === k),
      });
    }
    return m;
  }, []);

  const onToggleEntry = (id: EntryId) =>
    setSelected((s) => toggleEntryIn(s, id));
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
      const hits = searchAll(q, { pinned });
      return { label: q, entries: hits.map((h) => h.entry.id) };
    }
    return {
      label: KIND_LABEL[kind],
      entries: shelvesByKind.get(kind)!.entries.map((e) => e.id),
    };
  }, [selected, q, kind, pinned, shelvesByKind]);

  const standingOfEntry = (entry: LibEntry) =>
    entryStanding(factsOf(entry.id), history.facts, claims, cfg.accuracyMetric, now);

  const claim = async (facts: FactId[]) => {
    await fetch("/api/claim", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ facts, known: true }),
    }).catch(() => {});
    await refresh();
  };

  return (
    <>
      <PageTitle
        title="Library"
        sub="Every character, reading and word the app knows. Search it, or open a shelf."
      />

      <StickySearch
        value={query}
        onChange={commitQuery}
        placeholder="Search anything — し, shi, 生, せんせい, telephone…"
      >
        {/* The kind chips change what you SEE, never what you have SELECTED —
            the selection outlives them. One is always active; there is no "All". */}
        {KINDS.map((k) => (
          <Chip key={k} on={kind === k} onClick={() => selectKind(k)}>
            {KIND_LABEL[k]}
          </Chip>
        ))}
        {selected.size > 0 ? (
          <GhostBtn
            className="ml-auto text-xs"
            onClick={() => setSelected(EMPTY_SELECTION)}
          >
            Clear {selected.size} selected
          </GhostBtn>
        ) : null}
      </StickySearch>

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
                Nothing matches <b>{q}</b>.
              </p>
              <p className="mt-1.5">
                <Hint>
                  Searching an inflected form won&rsquo;t find its dictionary
                  word yet — 読んで doesn&rsquo;t reach 読む. That&rsquo;s a
                  known gap, not a missing word.
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
                    onToggleSelect={() => onToggleEntry(h.entry.id)}
                  />
                ))}
                {s.more > 0 ? (
                  <p className="pt-2.5">
                    <Hint>
                      ＋ {s.more} more like this. Narrow the search, or use the
                      shelf chips — the bar below already means all{" "}
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
              />
            );
          })()
        )}
      </div>

      <SliceBar
        slice={slice}
        facts={history.facts}
        claims={claims}
        now={now}
        onClaim={claim}
      />

      <AttributionLink />
    </>
  );
}
