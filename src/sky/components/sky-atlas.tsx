"use client";

// The Atlas: everything Saku holds, labelled. Tracked as SAK-323 to SAK-328.
//
// The sky is yours and it is a place; the Atlas is everything and it is a
// tool. You arrive having met something in the wild, so it behaves like a
// reference and never asks you to answer anything.
//
// One call from the route: the shelves (the first stretch of each kind, in
// teaching order, with the true size of the whole collection and the
// learner's standings over all of it), and two lookups the route provides,
// search and entry, which reach the app's own index. The shape is Sam's
// prototype (2026-09-05): search across the top, the collections and the
// learner's status down the left with their counts, one collection's grid
// in the middle under its coverage line, and the open entry on the right,
// the same card the Lesson uses in reference mode: the standing,
// cross-links both ways, and a footer that sends a thing not yet learned
// to tonight's picks. A tile is the glyph in its standing's colour with
// its meaning under it: no constellation here, the Atlas is a grid to scan.

import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState, type ComponentType, type ReactNode } from "react";

import { CoverageBar } from "@/sky/components/coverage-bar";
import { LessonCard, type HearComponent, type PitchComponent, type RelatedGroup } from "@/sky/components/lesson-card";
import { SkyPageShell } from "@/sky/components/sky-page-shell";
import { SkyPanel } from "@/sky/components/sky-panel";
import type { CoverageCounts } from "@/sky/lib/coverage";
import { buildGraph } from "@/sky/lib/graph";
import { japaneseFont } from "@/sky/lib/japanese";
import type { LessonTeach } from "@/sky/lib/lesson";
import { STANDING, STANDING_ORDER, type Standing } from "@/sky/lib/standing";
import { KIND_DOT } from "@/sky/lib/tokens";
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
 * it, and the first stretch of it in teaching order. */
export interface AtlasShelf {
  id: string;
  /** The sky kind on this shelf, for its dot and for matching search results by kind. */
  kind: SkyKind;
  title: string;
  /** What one of these is called, for "13 of 2,136 kanji". */
  unit: string;
  /** The size of the whole collection. Never the sample loaded. */
  total: number;
  counts: CoverageCounts;
  sections: readonly AtlasSection[];
  /** How many of the collection are not on the shelf: "2,036 more. Search for the rest." */
  more: number;
}

export interface SkyAtlasData {
  /** Every entry on the shelves, with every part under them. */
  items: readonly SkyItem[];
  shelves: readonly AtlasShelf[];
  /** What the whole Atlas holds, for the empty search: "14,091 words". */
  holds: ReadonlyArray<{ total: number; unit: string }>;
}

/** The answer to a search: the entries found, by kind. */
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
  /** Whether the learner has this in their sky. */
  known: boolean;
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
  /** Where "Add to tonight's picks" goes; the pick is appended as `?picks=`. */
  observatoryHref: string;
  /** Where "Quiz me" goes for something already known. */
  quizHref?: string;
  /** "How it's written" for a character, from whoever has the stroke order. */
  written?: WrittenComponent;
  hear?: HearComponent;
  pitch?: PitchComponent;
  /** The entry open at first, when the route names one. */
  initialEntry?: string;
  height?: string;
}

const SEARCH_DELAY = 180;

/** The learner's standings over a shelf, with the untouched remainder as
 * "undiscovered", for the status list and the coverage line. */
function tally(shelf: AtlasShelf): Record<Standing, number> {
  const out = Object.fromEntries(STANDING_ORDER.map((s) => [s, shelf.counts[s] ?? 0])) as Record<Standing, number>;
  const seen = STANDING_ORDER.reduce((n, s) => n + (s === "not-seen" ? 0 : out[s]), 0);
  out["not-seen"] = Math.max(0, shelf.total - seen);
  return out;
}

/** A tile: the glyph in its standing's colour, its meaning under it. No
 * constellation (Sam's call, 2026-09-05): the Atlas is a grid to scan. */
function Tile({ item, selected, onOpen }: { item: SkyItem; selected: boolean; onOpen: (id: string) => void }) {
  const lone = [...item.glyph].length <= 1;
  return (
    <button
      type="button"
      onClick={() => onOpen(item.id)}
      aria-pressed={selected}
      title={`${item.glyph} ${item.english}`}
      className={`flex aspect-square min-w-0 flex-col items-center justify-center gap-0.5 rounded-lg border px-1 transition-colors ${selected ? "border-sky-accent bg-sky-card-strong" : "border-transparent bg-sky-card hover:bg-sky-card-strong"}`}
    >
      <span className={`max-w-full truncate font-sky-display leading-none ${lone ? "text-[24px]" : "text-[15px]"} ${STANDING[item.standing].text} ${japaneseFont(item.glyph)}`}>{item.glyph}</span>
      {item.english !== item.glyph && <span className="max-w-full truncate text-[9.5px] text-sky-muted">{item.english}</span>}
    </button>
  );
}

function Grid({ ids, graph, selected, onOpen }: { ids: readonly string[]; graph: ReturnType<typeof buildGraph>; selected: string | null; onOpen: (id: string) => void }) {
  return (
    <div className="grid grid-cols-[repeat(auto-fill,minmax(64px,1fr))] gap-1.5">
      {ids.map((id) => { const it = graph.itemOf(id); return it ? <Tile key={id} item={it} selected={id === selected} onOpen={onOpen} /> : null; })}
    </div>
  );
}

/** A rail row: a dot, a name, a count on the right. */
function RailRow({ on, dot, label, count, onClick }: { on: boolean; dot: ReactNode; label: string; count?: number; onClick: () => void }) {
  return (
    <button type="button" aria-pressed={on} onClick={onClick} className={`flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-[13px] ${on ? "bg-sky-card-strong font-semibold text-sky-ink" : "text-sky-muted hover:bg-sky-card hover:text-sky-ink"}`}>
      {dot}
      <span className="min-w-0 flex-1 truncate">{label}</span>
      {count !== undefined && <span className="text-[11px] tabular-nums text-sky-faint">{count.toLocaleString()}</span>}
    </button>
  );
}

const RAIL_HEADING = "mb-1.5 text-[10.5px] font-semibold uppercase tracking-[0.12em] text-sky-muted";

export function SkyAtlas({ data, lookup, observatoryHref, quizHref, written: Written, hear, pitch, initialEntry, height }: SkyAtlasProps) {
  // what is drawn: the shelves' items, plus whatever search and the open
  // entry brought with them, so every tile and card has its parts
  const [extra, setExtra] = useState<readonly SkyItem[]>([]);
  const items = useMemo(() => {
    const byId = new Map(data.items.map((it) => [it.id, it]));
    for (const it of extra) byId.set(it.id, it);
    return [...byId.values()];
  }, [data.items, extra]);
  const graph = useMemo(() => buildGraph(items), [items]);
  const bring = useCallback((more: readonly SkyItem[]) => setExtra((prev) => [...prev, ...more]), []);

  // the rail: one collection open at a time, and one status or all of them
  const [shelfId, setShelfId] = useState(data.shelves[0]?.id ?? "");
  const shelf = data.shelves.find((s) => s.id === shelfId) ?? data.shelves[0];
  const [status, setStatus] = useState<Standing | null>(null);
  const counts = shelf ? tally(shelf) : undefined;
  const keep = (id: string) => { const it = graph.itemOf(id); return !!it && (status === null || it.standing === status); };

  // search: the app's answer, by kind, after a short pause in typing. The
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

  // the open entry
  const [open, setOpen] = useState<AtlasEntry | null>(null);
  const [opening, setOpening] = useState<string | null>(initialEntry ?? null);
  const panel = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!opening) return;
    let live = true;
    lookup.entry(opening).then((entry) => {
      if (!live) return;
      bring(entry.items);
      setOpen(entry);
      setOpening(null);
      panel.current?.scrollTo({ top: 0 });
    });
    return () => { live = false; };
  }, [opening, lookup, bring]);
  const openId = open?.id ?? null;
  const current = openId ? graph.itemOf(openId) : undefined;
  const itemsOf = (ids: readonly string[]) => ids.map((id) => graph.itemOf(id)).filter((x): x is SkyItem => !!x && !x.group);

  const holds = data.holds.map((h) => `${h.total.toLocaleString()} ${h.unit}`);
  const holdsLine = holds.length > 1 ? `${holds.slice(0, -1).join(", ")} and ${holds[holds.length - 1]}` : holds[0] ?? "";

  // what the middle shows: the open shelf, or this collection's search
  // results, with a line on what the other collections found
  const kindOf = (section: AtlasSection) => data.shelves.find((s) => s.id === section.id);
  const found = result?.sections.map((section) => ({ section, shelf: kindOf(section), shown: section.items.filter(keep) })) ?? [];
  const here = found.find((f) => f.shelf?.id === shelf?.id);
  const elsewhere = found.filter((f) => f.shelf && f.shelf.id !== shelf?.id);
  const known = counts ? STANDING_ORDER.reduce((n, s) => n + (s === "not-seen" ? 0 : counts[s]), 0) : 0;
  const shelfSections = shelf?.sections.map((s) => ({ ...s, items: s.items.filter(keep) })).filter((s) => s.items.length > 0) ?? [];
  const shownOnShelf = shelfSections.reduce((n, s) => n + s.items.length, 0);

  return (
    <SkyPageShell eyebrow="Atlas" title="What would you like to know?" height={height}>
      <div className="flex min-h-0 flex-1 flex-col gap-3 font-sky-ui">
        <label className="relative block shrink-0">
          <span className="sr-only">Search the Atlas</span>
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by meaning, reading, or character"
            className="w-full rounded-xl border border-sky-muted/45 bg-sky-panel px-4 py-2.5 text-[15px] text-sky-ink placeholder:text-sky-muted focus:border-sky-accent focus:outline-none"
          />
        </label>

        <div className="grid min-h-0 flex-1 items-start gap-4 lg:grid-cols-[200px_minmax(0,1fr)_360px]">
          <nav aria-label="Collections and status" className="flex min-h-0 flex-col gap-5 self-stretch overflow-y-auto rounded-2xl border border-sky-line bg-sky-panel p-3">
            <div>
              <p className={RAIL_HEADING}>Collections</p>
              {data.shelves.map((s) => (
                <RailRow key={s.id} on={s.id === shelf?.id} dot={<span aria-hidden className={`inline-block h-2 w-2 shrink-0 rounded-full ${KIND_DOT[s.kind]}`} />} label={s.title} count={s.total} onClick={() => setShelfId(s.id)} />
              ))}
            </div>
            {counts && (
              <div>
                <p className={RAIL_HEADING}>Your status</p>
                <RailRow on={status === null} dot={<span aria-hidden className="inline-block h-2 w-2 shrink-0 rounded-full border border-sky-line" />} label="Everything" count={shelf?.total} onClick={() => setStatus(null)} />
                {STANDING_ORDER.map((s) => (
                  <RailRow key={s} on={status === s} dot={<span aria-hidden className={`inline-block h-2 w-2 shrink-0 rounded-full ${STANDING[s].dot}`} />} label={STANDING[s].label} count={counts[s]} onClick={() => setStatus(status === s ? null : s)} />
                ))}
              </div>
            )}
          </nav>

          <div className="flex min-h-0 flex-col self-stretch overflow-y-auto pr-1">
            {shelf && (
              <div className="shrink-0">
                <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                  <p className="font-sky-display text-[22px] text-sky-ink">{known.toLocaleString()} <span className="text-[14px] text-sky-muted">of {shelf.total.toLocaleString()} {shelf.unit} known</span></p>
                  <p className="text-[12px] text-sky-muted">{shelf.more > 0 ? `the first ${(shelf.total - shelf.more).toLocaleString()} are here, in the order Saku teaches them` : "the whole collection is here"}</p>
                </div>
                <CoverageBar className="mt-2 h-2" counts={shelf.counts} total={shelf.total} label={shelf.unit} />
              </div>
            )}

            {result ? (
              <>
                <p className="mt-4 text-[12.5px] text-sky-muted">
                  <span className="font-semibold text-sky-ink">{(here?.shown.length ?? 0).toLocaleString()}</span> shown · matching <span className="font-semibold text-sky-ink">{result.query}</span>{status ? ` · ${STANDING[status].label}` : ""}{here?.section.more ? ` · ${here.section.more.toLocaleString()} more` : ""}
                </p>
                {here && here.shown.length > 0 ? (
                  <div className="mt-2"><Grid ids={here.shown} graph={graph} selected={openId} onOpen={setOpening} /></div>
                ) : (
                  <p className="mt-3 text-[13.5px] text-sky-muted">
                    {found.length === 0 ? <>Nothing matches &ldquo;{result.query}&rdquo;. The Atlas holds {holdsLine}. Try a meaning in English, the character itself, or its romaji reading.</> : `Nothing in ${shelf?.title ?? "this collection"} matches${status ? ` with that status` : ""}.`}
                  </p>
                )}
                {elsewhere.length > 0 && (
                  <p className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-[12.5px] text-sky-muted">
                    <span>Also found:</span>
                    {elsewhere.map((f) => (
                      <button key={f.section.id} type="button" onClick={() => setShelfId(f.shelf!.id)} className="rounded-full border border-sky-line px-2 py-0.5 hover:border-sky-accent hover:text-sky-ink">
                        {f.section.items.length.toLocaleString()}{f.section.more ? "+" : ""} {f.shelf!.title.toLowerCase()}
                      </button>
                    ))}
                  </p>
                )}
              </>
            ) : shelf ? (
              <>
                <p className="mt-4 text-[12.5px] text-sky-muted"><span className="font-semibold text-sky-ink">{shownOnShelf.toLocaleString()}</span> shown{status ? ` · ${STANDING[status].label}` : ""}</p>
                {shelfSections.length === 0 ? (
                  <p className="mt-3 text-[13.5px] text-sky-muted">Nothing here with that status.</p>
                ) : shelfSections.map((section) => (
                  <div key={section.id} className="mt-3">
                    {shelf.sections.length > 1 && <p className="mb-1.5 text-[11.5px] font-semibold text-sky-muted">{section.label}</p>}
                    <Grid ids={section.items} graph={graph} selected={openId} onOpen={setOpening} />
                    {section.more ? <p className="mt-1.5 text-[12px] text-sky-muted">{section.more.toLocaleString()} more in this cut.</p> : null}
                  </div>
                ))}
                {shelf.more > 0 && <p className="mt-4 text-[13px] text-sky-muted">{shelf.more.toLocaleString()} more {shelf.unit}. Search for the rest.</p>}
              </>
            ) : null}
            {searching && <p className="mt-3 text-[12.5px] text-sky-muted">Searching…</p>}
          </div>

          <div ref={panel} className="min-h-0 self-stretch overflow-y-auto pr-1">
            {current && open ? (
              <LessonCard
                className="min-h-full"
                item={current}
                teach={open.teach}
                madeOf={itemsOf(graph.prerequisitesOf(current.id))}
                partOf={[]}
                known={false}
                standing
                related={open.related}
                written={Written && (current.kind === "kanji" || current.kind === "radical" || current.kind === "kana") ? <Written glyph={current.glyph} /> : undefined}
                hear={hear}
                pitch={pitch}
                onSelect={setOpening}
                footer={
                  open.known ? (
                    quizHref && <a href={quizHref} className="rounded-[10px] bg-sky-accent px-3.5 py-2 text-[13px] font-semibold text-sky-accent-ink">Quiz me</a>
                  ) : (
                    <a href={`${observatoryHref}${observatoryHref.includes("?") ? "&" : "?"}picks=${encodeURIComponent(current.id)}`} className="rounded-[10px] bg-sky-accent px-3.5 py-2 text-[13px] font-semibold text-sky-accent-ink">Add to tonight&apos;s picks</a>
                  )
                }
              />
            ) : (
              <SkyPanel title={opening ? "Opening" : "Nothing open"} className="min-h-full">
                <p className="mt-2 text-[14px] text-sky-muted">{opening ? "One moment." : "Pick anything from the grid, or search, and it opens here."}</p>
              </SkyPanel>
            )}
          </div>
        </div>
      </div>
    </SkyPageShell>
  );
}
