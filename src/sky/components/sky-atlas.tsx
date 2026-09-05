"use client";

// The Atlas: everything Saku holds, labelled. Tracked as SAK-323 to SAK-328.
//
// The sky is yours and it is a place; the Atlas is everything and it is a
// tool. You arrive having met something in the wild, so it behaves like a
// reference and never asks you to answer anything.
//
// One call from the route: the shelves (every cut of every collection, in
// teaching order, with the true size of the whole collection and the
// learner's standings over all of it), and two lookups the route provides,
// search and entry, which reach the app's own index. The shape is Sam's
// prototype (2026-09-05): search across the top, the collections and the
// learner's status down the left (`AtlasRail`), one collection's grid in
// the middle under its coverage line (`atlas-grid.tsx`), and on the right
// what is selected: one entry as the same card the Lesson uses, in
// reference mode, or several as a list with actions on all of them. With
// nothing selected there is no panel. Selection is `useSelection`; the
// entries fetched are `useEntries`.

import { useCallback, useDeferredValue, useEffect, useMemo, useState, type ComponentType, type PointerEvent as ReactPointerEvent } from "react";

import { LazyTileGrid, TileGrid } from "@/sky/components/atlas-grid";
import { AtlasRail } from "@/sky/components/atlas-rail";
import { CoverageBar } from "@/sky/components/coverage-bar";
import { DetailFrame } from "@/sky/components/detail-frame";
import { LessonCard, type HearComponent, type PitchComponent, type RelatedGroup } from "@/sky/components/lesson-card";
import { RoundButton, SkyButton } from "@/sky/components/sky-button";
import { SkyPageShell } from "@/sky/components/sky-page-shell";
import { useEntries } from "@/sky/components/use-entries";
import { useSelection } from "@/sky/components/use-selection";
import type { CoverageCounts } from "@/sky/lib/coverage";
import { buildGraph } from "@/sky/lib/graph";
import { japaneseFont } from "@/sky/lib/japanese";
import type { LessonTeach } from "@/sky/lib/lesson";
import { STANDING, STANDING_ORDER, type Standing } from "@/sky/lib/standing";
import type { SkyItem, SkyKind } from "@/sky/lib/types";

/** One cut of a shelf: a name and the entries under it. */
export interface AtlasSection {
  id: string;
  label: string;
  items: readonly string[];
  /** Entries in this cut beyond the ones listed, when it is a sample. */
  more?: number;
}

/** One shelf: a kind, its whole size, the learner's standings over all of
 * it, and its cuts in teaching order. */
export interface AtlasShelf {
  id: string;
  /** The sky kind on this shelf. */
  kind: SkyKind;
  title: string;
  /** What one of these is called, for "13 of 2,136 kanji". */
  unit: string;
  /** The size of the whole collection. Never the sample loaded. */
  total: number;
  counts: CoverageCounts;
  sections: readonly AtlasSection[];
  /** How many of the collection are not on the shelf. */
  more: number;
}

export interface SkyAtlasData {
  /** Every entry on the shelves. */
  items: readonly SkyItem[];
  shelves: readonly AtlasShelf[];
  /** What the whole Atlas holds, for the empty search: "14,091 words". */
  holds: ReadonlyArray<{ total: number; unit: string }>;
}

/** The answer to a search: the entries found, by shelf. */
export interface AtlasSearchResult {
  items: readonly SkyItem[];
  sections: readonly AtlasSection[];
}

/** One entry opened: the item with everything under it and around it, what
 * the card teaches, and the groups of related stars. */
export interface AtlasEntry {
  id: string;
  items: readonly SkyItem[];
  teach: LessonTeach;
  related: readonly RelatedGroup[];
}

/** What the stroke-order block takes: the character to draw. */
export type WrittenComponent = ComponentType<{ glyph: string }>;

export interface AtlasLookup {
  search: (query: string) => Promise<AtlasSearchResult>;
  entry: (id: string) => Promise<AtlasEntry>;
}

export interface SkyAtlasProps {
  data: SkyAtlasData;
  lookup: AtlasLookup;
  /** Where "Add to tonight's picks" goes; the picks are appended as `?picks=`. */
  observatoryHref: string;
  /** Where "Quiz me" goes; the picks are appended as `?picks=`. */
  quizHref?: string;
  /** "How it's written" for a character, from whoever has the stroke order. */
  written?: WrittenComponent;
  hear?: HearComponent;
  pitch?: PitchComponent;
  /** The entry open at first, when the route names one. */
  initialEntry?: string;
  /** "I know this": the app's own claim (a skip of the lesson, untested;
   * never mastery). Without it the claim is kept for the visit only. */
  onClaim?: (ids: readonly string[]) => Promise<void>;
  /** "I don't know this": the mirror of the claim, back to brand new. */
  onUnclaim?: (ids: readonly string[]) => Promise<void>;
  height?: string;
}

const SEARCH_DELAY = 180;
/** Labels after a number are title case (Sam's rule): "17 of 214 Radicals Known". */
const titleCase = (s: string) => s.replace(/\b\w/g, (c) => c.toUpperCase());
/** The panel's width to start, and the narrowest it can be dragged. */
const PANEL_WIDTH = 360;

/** The learner's standings over a shelf, with the untouched remainder as
 * "undiscovered", for the status list and the coverage line. */
function tally(shelf: AtlasShelf): Record<Standing, number> {
  const out = Object.fromEntries(STANDING_ORDER.map((s) => [s, shelf.counts[s] ?? 0])) as Record<Standing, number>;
  const seen = STANDING_ORDER.reduce((n, s) => n + (s === "not-seen" ? 0 : out[s]), 0);
  out["not-seen"] = Math.max(0, shelf.total - seen);
  return out;
}

const unknown = (it: SkyItem) => it.standing === "not-seen";

export function SkyAtlas({ data, lookup, observatoryHref, quizHref, written: Written, hear, pitch, initialEntry, onClaim, onUnclaim, height }: SkyAtlasProps) {
  // what is drawn: the shelves' items, plus whatever search and the open
  // entries brought with them, so every tile and card has its parts
  const [extra, setExtra] = useState<readonly SkyItem[]>([]);
  const items = useMemo(() => {
    const byId = new Map(data.items.map((it) => [it.id, it]));
    for (const it of extra) byId.set(it.id, it);
    return [...byId.values()];
  }, [data.items, extra]);
  const graph = useMemo(() => buildGraph(items), [items]);
  const bring = useCallback((more: readonly SkyItem[]) => setExtra((prev) => [...prev, ...more]), []);
  const itemsOf = useCallback((ids: readonly string[]) => ids.map((id) => graph.itemOf(id)).filter((x): x is SkyItem => !!x && !x.group), [graph]);

  // the rail: one collection open at a time, and one status or all
  const [railOpen, setRailOpen] = useState(true);
  const [shelfId, setShelfId] = useState(data.shelves[0]?.id ?? "");
  const shelf = data.shelves.find((s) => s.id === shelfId) ?? data.shelves[0];
  const [status, setStatus] = useState<Standing | null>(null);
  const counts = shelf ? tally(shelf) : undefined;
  const known = counts ? STANDING_ORDER.reduce((n, s) => n + (s === "not-seen" ? 0 : counts[s]), 0) : 0;
  // a term carries no standing (nothing is ever asked about it), so its
  // shelf shows no status list, no coverage, and ignores the status filter
  const tracked = shelf?.kind !== "term";
  const filter = tracked ? status : null;
  // "2,136 Shown", or with a status picked "43 Shaky" (Sam's wording: title case)
  const shownWord = filter ? titleCase(STANDING[filter].label) : "Shown";
  const keep = useCallback((id: string) => { const it = graph.itemOf(id); return !!it && (filter === null || it.standing === filter); }, [graph, filter]);

  // search: the app's answer, by shelf, after a short pause in typing. The
  // answer is kept with the query it answers, so a cleared or changed box
  // shows the shelf, or "Searching", without any state to reset.
  const [query, setQuery] = useState("");
  const deferred = useDeferredValue(query);
  const [answer, setAnswer] = useState<{ query: string; sections: readonly AtlasSection[] } | null>(null);
  useEffect(() => {
    const q = deferred.trim();
    if (!q) return;
    let live = true;
    const t = setTimeout(async () => {
      const found = await lookup.search(q);
      if (!live) return;
      bring(found.items);
      setAnswer({ query: q, sections: found.sections });
    }, SEARCH_DELAY);
    return () => { live = false; clearTimeout(t); };
  }, [deferred, lookup, bring]);
  const asked = deferred.trim();
  const result = asked && answer?.query === asked ? answer : null;
  const searching = !!asked && !result;

  // what the middle shows: the open shelf's cuts, or this collection's
  // search results with a line on what the other collections found
  const found = useMemo(() => result?.sections.map((section) => ({ section, shelf: data.shelves.find((s) => s.id === section.id), shown: section.items.filter(keep) })) ?? [], [result, data.shelves, keep]);
  const here = found.find((f) => f.shelf?.id === shelf?.id);
  const elsewhere = found.filter((f) => f.shelf && f.shelf.id !== shelf?.id);
  const cuts = useMemo(() => shelf?.sections.map((s) => ({ ...s, items: s.items.filter(keep) })).filter((s) => s.items.length > 0) ?? [], [shelf, keep]);
  const shownOnShelf = cuts.reduce((n, s) => n + s.items.length, 0);
  const order = useMemo(() => (result ? (here?.shown ?? []) : cuts.flatMap((c) => c.items)), [result, here, cuts]);

  // the selection, and the entries behind it
  const selection = useSelection(order, initialEntry);
  const entries = useEntries(lookup.entry);
  const { single } = selection;
  const fetchEntry = entries.fetch;
  useEffect(() => {
    if (!single) return;
    let live = true;
    fetchEntry(single).then((entry) => { if (live) bring(entry.items); });
    return () => { live = false; };
  }, [single, fetchEntry, bring]);
  const current = single ? graph.itemOf(single) : undefined;
  const entry = single ? entries.get(single) : undefined;
  const selectedItems = itemsOf(selection.ids);
  const [page, setPage] = useState<{ id: string; at: number } | null>(null);

  // "I know this" and "I don't know this", on one or on several: the
  // app's own claim or its withdrawal, then the items shown as such
  const [marking, setMarking] = useState(false);
  const mark = async (ids: readonly string[], toKnown: boolean) => {
    const these = itemsOf(ids).filter((it) => unknown(it) === toKnown);
    if (these.length === 0) return;
    setMarking(true);
    try {
      await (toKnown ? onClaim : onUnclaim)?.(these.map((it) => it.id));
      bring(these.map((it) => ({ ...it, standing: toKnown ? "claimed" as const : "not-seen" as const })));
    } finally {
      setMarking(false);
    }
  };
  const withPicks = (base: string, ids: readonly string[]) => `${base}${base.includes("?") ? "&" : "?"}picks=${ids.map(encodeURIComponent).join(",")}`;
  const picksHref = (ids: readonly string[]) => withPicks(observatoryHref, ids);
  const quizFor = (ids: readonly string[]) => (quizHref ? withPicks(quizHref, ids) : undefined);

  // the right panel: widened over the rail and the grid, or dragged wider
  // by its left edge (Sam's ask, 2026-09-05)
  const [wide, setWide] = useState(false);
  const [panelWidth, setPanelWidth] = useState(PANEL_WIDTH);
  const showPanel = selection.ids.length > 0;
  const shelvesShown = !(wide && showPanel);
  const columns = !shelvesShown ? "minmax(0, 1fr)" : `${railOpen ? "200px " : ""}minmax(0, 1fr)${showPanel ? ` ${panelWidth}px` : ""}`;
  const startResize = (e: ReactPointerEvent<HTMLDivElement>) => {
    const from = e.clientX, was = panelWidth;
    const max = Math.max(PANEL_WIDTH, Math.floor(window.innerWidth * 0.7));
    const move = (ev: PointerEvent) => setPanelWidth(Math.min(max, Math.max(PANEL_WIDTH, was + (from - ev.clientX))));
    const stop = () => { window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", stop); };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", stop);
    e.preventDefault();
  };
  const toolbar = (
    <>
      <RoundButton label={wide ? "Bring the shelves back" : "Widen this panel"} pressed={wide} onClick={() => setWide(!wide)}>{wide ? "›" : "‹"}</RoundButton>
      <RoundButton label="Close" onClick={selection.clear}>×</RoundButton>
    </>
  );
  const holds = data.holds.map((h) => `${h.total.toLocaleString()} ${h.unit}`);
  const holdsLine = holds.length > 1 ? `${holds.slice(0, -1).join(", ")} and ${holds[holds.length - 1]}` : holds[0] ?? "";

  return (
    <SkyPageShell eyebrow="Atlas" title="What would you like to know?" height={height}>
      <div className="flex min-h-0 flex-1 flex-col gap-3 font-sky-ui">
        <label className="relative block shrink-0">
          <span className="sr-only">Search the Atlas</span>
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search anything: し, shi, 生, せんせい, telephone…"
            className="w-full rounded-xl border border-sky-muted/45 bg-sky-panel px-4 py-2.5 text-[15px] text-sky-ink placeholder:text-sky-muted focus:border-sky-accent focus:outline-none"
          />
        </label>

        <div className="grid min-h-0 flex-1 items-start gap-4" style={{ gridTemplateColumns: columns }}>
          {shelvesShown && railOpen && shelf && (
            <AtlasRail collections={data.shelves} open={shelf.id} onOpen={setShelfId} counts={tracked ? counts : undefined} total={shelf.total} status={status} onStatus={setStatus} onHide={() => setRailOpen(false)} />
          )}

          {shelvesShown && (
            <div className="flex min-h-0 flex-col self-stretch overflow-y-auto pr-1">
              {shelf && (
                <div className="flex shrink-0 items-start gap-3">
                  {!railOpen && <RoundButton label="Show the rail" expanded={false} onClick={() => setRailOpen(true)} className="mt-1">›</RoundButton>}
                  <div className="min-w-0 flex-1">
                    {tracked ? (
                      <>
                        <p className="font-sky-display text-[22px] text-sky-ink">{known.toLocaleString()} <span className="text-[14px] text-sky-muted">of {shelf.total.toLocaleString()} {titleCase(shelf.unit)} Known</span></p>
                        <CoverageBar className="mt-2 h-2" counts={shelf.counts} total={shelf.total} label={shelf.unit} />
                      </>
                    ) : (
                      <p className="font-sky-display text-[22px] text-sky-ink">{shelf.total.toLocaleString()} <span className="text-[14px] text-sky-muted">{titleCase(shelf.unit)}</span></p>
                    )}
                  </div>
                </div>
              )}

              {result ? (
                <>
                  <p className="mt-4 text-[12.5px] text-sky-muted">
                    <span className="font-semibold text-sky-ink">{(here?.shown.length ?? 0).toLocaleString()}</span> {shownWord} · Matching <span className="font-semibold text-sky-ink">{result.query}</span>{here?.section.more ? ` · ${here.section.more.toLocaleString()} More` : ""}
                  </p>
                  {here && here.shown.length > 0 ? (
                    <div className="mt-2"><TileGrid items={itemsOf(here.shown)} selected={selection.set} onPick={selection.pick} onPeek={entries.peek} /></div>
                  ) : (
                    <p className="mt-3 text-[13.5px] text-sky-muted">
                      {found.length === 0 ? <>Nothing matches &ldquo;{result.query}&rdquo;. The Atlas holds {holdsLine}. Try a meaning in English, the character itself, or its romaji reading.</> : `Nothing in ${shelf?.title ?? "this collection"} matches${filter ? " with that status" : ""}.`}
                    </p>
                  )}
                  {elsewhere.length > 0 && (
                    <p className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-[12.5px] text-sky-muted">
                      <span>Also found:</span>
                      {elsewhere.map((f) => (
                        <button key={f.section.id} type="button" onClick={() => setShelfId(f.shelf!.id)} className="rounded-full border border-sky-line px-2 py-0.5 hover:border-sky-accent hover:text-sky-ink">
                          {(f.section.items.length + (f.section.more ?? 0)).toLocaleString()} {f.shelf!.title}
                        </button>
                      ))}
                    </p>
                  )}
                </>
              ) : shelf ? (
                <>
                  <p className="mt-4 text-[12.5px] text-sky-muted"><span className="font-semibold text-sky-ink">{shownOnShelf.toLocaleString()}</span> {shownWord}</p>
                  {cuts.length === 0 ? (
                    <p className="mt-3 text-[13.5px] text-sky-muted">Nothing here with that status.</p>
                  ) : cuts.map((cut) => (
                    <LazyTileGrid key={cut.id} label={shelf.sections.length > 1 ? cut.label : undefined} items={itemsOf(cut.items)} selected={selection.set} onPick={selection.pick} onPeek={entries.peek} />
                  ))}
                  {shelf.more > 0 && <p className="mt-4 text-[13px] text-sky-muted">{shelf.more.toLocaleString()} More {titleCase(shelf.unit)}. Search for the rest.</p>}
                </>
              ) : null}
              {searching && <p className="mt-3 text-[12.5px] text-sky-muted">Searching…</p>}
            </div>
          )}

          {showPanel && (
            <div className="relative min-h-0 self-stretch">
              {shelvesShown && (
                <div
                  role="separator"
                  aria-orientation="vertical"
                  aria-label="Resize the panel"
                  title="Drag to resize"
                  onPointerDown={startResize}
                  className="absolute -left-3 top-0 z-10 h-full w-3 cursor-col-resize touch-none"
                />
              )}
              {selection.ids.length > 1 ? (
                <DetailFrame
                  scroll
                  toolbar={toolbar}
                  footer={
                    <>
                      {selectedItems.some(unknown) && <SkyButton href={picksHref(selectedItems.filter(unknown).map((it) => it.id))}>Add to lesson</SkyButton>}
                      {selectedItems.some(unknown) && <SkyButton variant="outline" disabled={marking} onClick={() => mark(selection.ids, true)}>{marking ? "Marking…" : "I know these"}</SkyButton>}
                      {selectedItems.some((it) => !unknown(it)) && <SkyButton variant="outline" disabled={marking} onClick={() => mark(selection.ids, false)}>{marking ? "Marking…" : "I don't know these"}</SkyButton>}
                      {quizHref && <SkyButton variant="outline" href={quizFor(selection.ids)}>Quiz me</SkyButton>}
                    </>
                  }
                >
                  <h2 className="shrink-0 text-[13px] font-semibold uppercase tracking-[0.12em] text-sky-muted">{selection.ids.length} selected</h2>
                  <div className="mt-3 flex flex-wrap content-start gap-1.5">
                    {selectedItems.map((it) => (
                      <button key={it.id} type="button" onClick={() => selection.only(it.id)} title={it.english} className="inline-flex items-baseline gap-1.5 rounded-lg border border-sky-line px-2 py-1 text-left hover:border-sky-accent">
                        <span className={`font-sky-display text-[16px] leading-none ${STANDING[it.standing].text} ${japaneseFont(it.glyph)}`}>{it.glyph}</span>
                        {it.english !== it.glyph && <span className="max-w-[10ch] truncate text-[11px] text-sky-muted">{it.english}</span>}
                      </button>
                    ))}
                  </div>
                </DetailFrame>
              ) : current ? (
                <LessonCard
                  scroll
                  item={current}
                  teach={entry?.teach}
                  madeOf={itemsOf(graph.prerequisitesOf(current.id))}
                  partOf={[]}
                  known={false}
                  standing
                  toolbar={toolbar}
                  related={entry?.related ?? []}
                  written={Written && (current.kind === "kanji" || current.kind === "radical" || current.kind === "kana") ? <Written glyph={current.glyph} /> : undefined}
                  hear={hear}
                  pitch={pitch}
                  onSelect={selection.only}
                  page={page?.id === current.id ? page.at : 0}
                  onPage={(at) => setPage({ id: current.id, at })}
                  // a term is a page to read: nothing to pick, claim or quiz
                  footer={current.kind === "term" ? undefined : (
                    <>
                      {unknown(current) ? (
                        <>
                          <SkyButton href={picksHref([current.id])}>Add to lesson</SkyButton>
                          <SkyButton variant="outline" disabled={marking} onClick={() => mark([current.id], true)}>{marking ? "Marking…" : "I know this"}</SkyButton>
                        </>
                      ) : (
                        <SkyButton variant="outline" disabled={marking} onClick={() => mark([current.id], false)}>{marking ? "Marking…" : "I don't know this"}</SkyButton>
                      )}
                      {quizHref && (current.quizzable ?? 0) > 1 && <SkyButton variant="outline" href={quizFor([current.id])}>Quiz me</SkyButton>}
                    </>
                  )}
                />
              ) : null}
            </div>
          )}
        </div>
      </div>
    </SkyPageShell>
  );
}
