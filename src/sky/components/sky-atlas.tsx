"use client";

// The Atlas: everything Saku holds, labelled. Tracked as SAK-323 to SAK-328.
//
// The sky is yours and it is a place; the Atlas is everything and it is a
// tool. You arrive having met something in the wild, so it behaves like a
// reference and never asks you to answer anything. It is the one place a
// constellation is labelled: every tile is the entry's constellation with
// its glyph and meaning under it.
//
// One call from the route: the shelves (the first stretch of each kind, in
// teaching order, with the true size of the whole collection and the
// learner's standings over all of it), and two lookups the route provides,
// search and entry, which reach the app's own index. Search replaces the
// shelves with the app's answer by kind; picking anything opens it in the
// panel on the right, with the same card the Lesson uses in reference mode:
// the standing, cross-links both ways, and a footer that sends a thing not
// yet learned to tonight's picks.

import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState, type ComponentType } from "react";

import { ConstellationTile } from "@/sky/components/constellation-tile";
import { CoverageBar } from "@/sky/components/coverage-bar";
import { LessonCard, type HearComponent, type PitchComponent, type RelatedGroup } from "@/sky/components/lesson-card";
import { SkyPageShell } from "@/sky/components/sky-page-shell";
import { SkyPanel } from "@/sky/components/sky-panel";
import { StandingLegend } from "@/sky/components/standing-legend";
import { useStandingFilter } from "@/sky/components/use-standing-filter";
import type { CoverageCounts } from "@/sky/lib/coverage";
import { buildGraph } from "@/sky/lib/graph";
import type { LessonTeach } from "@/sky/lib/lesson";
import { STANDING_ORDER } from "@/sky/lib/standing";
import type { SkyItem } from "@/sky/lib/types";

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

/** A tile's sky: room for a constellation, less for a lone star (a kana, a
 * piece), so a shelf of single stars is not a field of empty boxes. */
const TILE = 56;
const LONE_TILE = 32;
const SEARCH_DELAY = 180;

function Tile({ graph, id, selected, onOpen }: { graph: ReturnType<typeof buildGraph>; id: string; selected: boolean; onOpen: (id: string) => void }) {
  const item = graph.itemOf(id);
  if (!item) return null;
  const lone = graph.constellationOf(id).nodes.length <= 1;
  return (
    <button
      type="button"
      onClick={() => onOpen(id)}
      aria-pressed={selected}
      className={`rounded-xl border px-1 pb-1.5 pt-1 text-left transition-colors ${selected ? "border-sky-accent bg-sky-panel" : "border-transparent hover:border-sky-muted/45 hover:bg-sky-panel"}`}
    >
      <ConstellationTile graph={graph} id={id} size={lone ? LONE_TILE : TILE} className="w-[88px]" />
    </button>
  );
}

function Shelf({ shelf, graph, keep, selected, onOpen }: { shelf: AtlasShelf; graph: ReturnType<typeof buildGraph>; keep: (id: string) => boolean; selected: string | null; onOpen: (id: string) => void }) {
  const known = STANDING_ORDER.filter((s) => s !== "not-seen").reduce((n, s) => n + (shelf.counts[s] ?? 0), 0);
  const sections = shelf.sections.map((s) => ({ ...s, items: s.items.filter(keep) })).filter((s) => s.items.length > 0);
  return (
    <SkyPanel title={shelf.title} aside={`${known.toLocaleString()} of ${shelf.total.toLocaleString()} ${shelf.unit}`}>
      <CoverageBar className="mt-3 h-2" counts={shelf.counts} total={shelf.total} label={shelf.unit} />
      {sections.length === 0 ? (
        <p className="mt-3 text-[13px] text-sky-muted">Nothing on this shelf matches the filter.</p>
      ) : sections.map((section) => (
        <div key={section.id} className="mt-4">
          {(shelf.sections.length > 1 || section.label !== shelf.title) && <p className="mb-1.5 text-[12px] font-semibold text-sky-muted">{section.label}</p>}
          <div className="flex flex-wrap gap-1">
            {section.items.map((id) => <Tile key={id} graph={graph} id={id} selected={id === selected} onOpen={onOpen} />)}
          </div>
          {section.more ? <p className="mt-1.5 text-[12px] text-sky-muted">{section.more.toLocaleString()} more in this cut.</p> : null}
        </div>
      ))}
      {shelf.more > 0 && <p className="mt-4 text-[13px] text-sky-muted">{shelf.more.toLocaleString()} more {shelf.unit}. Search for the rest.</p>}
    </SkyPanel>
  );
}

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

  // search: the app's answer, by kind, after a short pause in typing. The
  // answer is kept with the query it answers, so a cleared or changed box
  // shows the shelves, or "Searching", without any state to reset.
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

  // the filters: which kinds and which standings show on the shelves
  const [kind, setKind] = useState<string | null>(null);
  const filter = useStandingFilter(STANDING_ORDER);
  const keep = (id: string) => { const it = graph.itemOf(id); return !!it && filter.selected.has(it.standing); };

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

  const shelves = kind ? data.shelves.filter((s) => s.id === kind) : data.shelves;
  const holds = data.holds.map((h) => `${h.total.toLocaleString()} ${h.unit}`);
  const holdsLine = holds.length > 1 ? `${holds.slice(0, -1).join(", ")} and ${holds[holds.length - 1]}` : holds[0] ?? "";

  const chip = (label: string, on: boolean, onClick: () => void) => (
    <button key={label} type="button" aria-pressed={on} onClick={onClick} className={`rounded-full border px-2.5 py-0.5 text-[12.5px] ${on ? "border-sky-accent bg-sky-card-strong text-sky-ink" : "border-transparent bg-sky-card text-sky-muted hover:text-sky-ink"}`}>{label}</button>
  );

  return (
    <SkyPageShell eyebrow="Atlas" title="Atlas" lede="Everything Saku holds, labelled. Look anything up; nothing here asks you to answer." height={height}>
      <div className="flex min-h-0 flex-1 flex-col gap-3 font-sky-ui">
        <div className="flex shrink-0 flex-wrap items-center gap-x-4 gap-y-2">
          <label className="relative block w-full max-w-[420px]">
            <span className="sr-only">Search the Atlas</span>
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="A meaning, a character, or its romaji"
              className="w-full rounded-full border border-sky-muted/45 bg-sky-panel px-4 py-2 text-[14px] text-sky-ink placeholder:text-sky-muted focus:border-sky-accent focus:outline-none"
            />
          </label>
          <div className="flex flex-wrap items-center gap-1.5">
            {chip("All", kind === null, () => setKind(null))}
            {data.shelves.map((s) => chip(s.title, kind === s.id, () => setKind(kind === s.id ? null : s.id)))}
          </div>
          <StandingLegend className="text-[12px]" onToggle={filter.toggle} selected={filter.selected} />
        </div>

        <div className="grid min-h-0 flex-1 items-start gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
          <div className="flex min-h-0 flex-col gap-4 self-stretch overflow-y-auto pr-1">
            {result ? (
              result.sections.length === 0 ? (
                <SkyPanel title="Nothing matches">
                  <p className="mt-2 text-[14px] text-sky-muted">Nothing matches &ldquo;{result.query}&rdquo;. The Atlas holds {holdsLine}. Try a meaning in English, the character itself, or its romaji reading.</p>
                </SkyPanel>
              ) : result.sections.map((section) => {
                const shown = section.items.filter(keep);
                return (
                  <SkyPanel key={section.id} title={section.label} aside={`${shown.length.toLocaleString()} shown${section.more ? ` · ${section.more.toLocaleString()} more` : ""} · matching ${result.query}`}>
                    {shown.length === 0 ? (
                      <p className="mt-2 text-[13px] text-sky-muted">Every match here is hidden by the filter.</p>
                    ) : (
                      <div className="mt-3 flex flex-wrap gap-1">
                        {shown.map((id) => <Tile key={id} graph={graph} id={id} selected={id === openId} onOpen={setOpening} />)}
                      </div>
                    )}
                  </SkyPanel>
                );
              })
            ) : (
              shelves.map((shelf) => <Shelf key={shelf.id} shelf={shelf} graph={graph} keep={keep} selected={openId} onOpen={setOpening} />)
            )}
            {searching && <p className="text-[12.5px] text-sky-muted">Searching…</p>}
          </div>

          <div ref={panel} className="min-h-0 self-stretch overflow-y-auto pr-1">
            {current && open ? (
              <div className="flex min-h-full flex-col gap-3">
                <div className="flex shrink-0 justify-center rounded-2xl border border-sky-line bg-sky-panel py-2">
                  <ConstellationTile graph={graph} id={current.id} size={120} caption="none" />
                </div>
                <LessonCard
                  className="flex-1"
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
              </div>
            ) : (
              <SkyPanel title={opening ? "Opening" : "Nothing open"} className="min-h-full">
                <p className="mt-2 text-[14px] text-sky-muted">{opening ? "One moment." : "Pick anything on a shelf, or search, and it opens here."}</p>
              </SkyPanel>
            )}
          </div>
        </div>
      </div>
    </SkyPageShell>
  );
}
