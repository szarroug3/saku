"use client";

// The Library — search, and shelves when you haven't searched.
//
// ONE NAV ITEM, NOT THE FRONT DOOR. The user: "the reference should exist as an
// easy way to look things up, not as the product." The ranked drill is what the
// app is for; this is how you get at things. So this page has no dashboard, no
// progress, no suggestions, and nothing that competes with Home for the first
// thing you do. It has a search box, because that is the front door OF THIS TAB
// and nothing else on it matters as much.

import { useDeferredValue, useMemo, useState } from "react";

import { AttributionLink } from "@/components/library/attribution-link";
import { EntryRow } from "@/components/library/entry-tile";
import { Shelf, shelfSections, type ShelfSection } from "@/components/library/shelves";
import { SliceBar } from "@/components/library/slice-bar";
import { StickySearch } from "@/components/library/sticky-search";
import { Card, Chip, GhostBtn, Hint, Lbl, PageTitle } from "@/components/ui";
import { KANA_SUBJECT } from "@/data/characters";
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
import { useLists } from "@/lib/use-lists";
import { useQuizConfig } from "@/lib/quiz-config";
import { useHistory } from "@/lib/use-history";
import type { EntryId, FactId } from "@/types";

export default function LibraryPage() {
  const { history, refresh } = useHistory();
  const { cfg } = useQuizConfig();
  const { lists } = useLists();

  const [query, setQuery] = useState("");
  // The search runs over 9,761 entries per keystroke. That is ~1–2ms and would
  // be fine synchronously; `useDeferredValue` is here for the RENDER, which is
  // the expensive half — a section of 8 rows is cheap but a shelf of 2,136 tiles
  // is not, and typing into a box that repaints the kanji shelf under it drops
  // frames. Deferring lets the field stay live while the results catch up.
  const deferred = useDeferredValue(query);
  // `null` kind is the "All" view — every kind's shelf stacked, and a search
  // that spans kinds. The DEFAULT is Kana, not All: the unfiltered page used to
  // fall back to the kana shelf while a highlighted "All" chip claimed to be
  // showing kanji and words it wasn't. Defaulting to Kana ends that lie and
  // keeps first paint light (214 tiles); All is now an explicit, honest choice.
  const [kind, setKind] = useState<Kind | null>(KANA_SUBJECT);
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

  const sections = useMemo(
    () => search(q, { kind, pinned }),
    [q, kind, pinned],
  );

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

  /** The kinds whose shelves are on screen: one when filtered, all three under
   * "All". */
  const shownKinds: readonly Kind[] = kind ? [kind] : KINDS;

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
  //   All, unselected  nothing — "All" is 9,761 entries, and a drill of all of
  //                    them is meaningless. Select something; the bar says so.
  const slice = useMemo(() => {
    if (selected.size > 0) return selectionSlice(selected, LIB_ENTRIES);
    if (q) {
      const hits = searchAll(q, { kind, pinned });
      return { label: q, entries: hits.map((h) => h.entry.id) };
    }
    if (kind) {
      return {
        label: KIND_LABEL[kind],
        entries: shelvesByKind.get(kind)!.entries.map((e) => e.id),
      };
    }
    return { label: "Library", entries: [] as EntryId[] };
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
        onChange={setQuery}
        placeholder="Search anything — し, shi, 生, せんせい, telephone…"
      >
        {/* The kind chips change what you SEE, never what you have SELECTED —
            the selection outlives them. "All" (kind null) stacks every shelf and
            searches across kinds; the other three filter to one. */}
        <Chip on={kind === null} onClick={() => setKind(null)}>
          All
        </Chip>
        {KINDS.map((k) => (
          <Chip
            key={k}
            on={kind === k}
            onClick={() => setKind(kind === k ? null : k)}
          >
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
          shownKinds.map((k) => {
            const sh = shelvesByKind.get(k)!;
            return (
              <Shelf
                key={k}
                kind={k}
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
          })
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
