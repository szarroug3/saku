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
  /** How many things a quiz could ask about it: one for a kana, several
   * for a rule. A quiz is offered only when there is more than one. */
  quizzable: number;
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
  /** "I know this": claims the entry, the app's own claim (a skip of the
   * lesson, untested; never mastery). Without it the claim is kept for
   * the visit only. */
  onClaim?: (ids: readonly string[]) => Promise<void>;
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
/** How a tile was clicked: plain opens it alone, cmd or ctrl adds it to
 * the selection, shift takes the run from the last one clicked to it. */
export interface Pick { toggle: boolean; range: boolean }
type OnPick = (id: string, pick: Pick) => void;

function Tile({ item, selected, onOpen }: { item: SkyItem; selected: boolean; onOpen: OnPick }) {
  const lone = [...item.glyph].length <= 1;
  return (
    <button
      type="button"
      onClick={(e) => onOpen(item.id, { toggle: e.metaKey || e.ctrlKey, range: e.shiftKey })}
      aria-pressed={selected}
      title={`${item.glyph} ${item.english}`}
      className={`flex aspect-square min-w-0 flex-col items-center justify-center gap-0.5 rounded-lg border px-1 transition-colors ${selected ? "border-sky-accent bg-sky-card-strong" : "border-transparent bg-sky-card hover:bg-sky-card-strong"}`}
    >
      <span className={`max-w-full truncate font-sky-display leading-none ${lone ? "text-[24px]" : "text-[15px]"} ${STANDING[item.standing].text} ${japaneseFont(item.glyph)}`}>{item.glyph}</span>
      {item.english !== item.glyph && <span className="max-w-full truncate text-[9.5px] text-sky-muted">{item.english}</span>}
    </button>
  );
}

function Grid({ ids, graph, selected, onOpen }: { ids: readonly string[]; graph: ReturnType<typeof buildGraph>; selected: ReadonlySet<string>; onOpen: OnPick }) {
  return (
    <div className="grid grid-cols-[repeat(auto-fill,minmax(64px,1fr))] gap-1.5">
      {ids.map((id) => { const it = graph.itemOf(id); return it ? <Tile key={id} item={it} selected={selected.has(id)} onOpen={onOpen} /> : null; })}
    </div>
  );
}

/** A cut of a shelf whose tiles mount only as it comes into view, so a
 * shelf of twelve thousand words costs nothing until it is scrolled to.
 * Until then it holds the room its rows will take. */
function LazySection({ label, ids, graph, selected, onOpen }: { label?: string; ids: readonly string[]; graph: ReturnType<typeof buildGraph>; selected: ReadonlySet<string>; onOpen: OnPick }) {
  const ref = useRef<HTMLDivElement>(null);
  const [near, setNear] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || near) return;
    const io = new IntersectionObserver(([entry]) => { if (entry.isIntersecting) setNear(true); }, { rootMargin: "600px 0px" });
    io.observe(el);
    return () => io.disconnect();
  }, [near]);
  // about eight tiles a row at the narrowest the grid gets; only a guess
  // at the room, replaced by the real rows once mounted
  const rows = Math.ceil(ids.length / 8);
  return (
    <div ref={ref} className="mt-3" style={near ? undefined : { minHeight: `${rows * 70 + (label ? 22 : 0)}px` }}>
      {label && <p className="mb-1.5 text-[11.5px] font-semibold text-sky-muted">{label}</p>}
      {near && <Grid ids={ids} graph={graph} selected={selected} onOpen={onOpen} />}
    </div>
  );
}

/** A rail row: a name with a count on the right, and a dot before it when
 * the row stands for a standing (the collections carry no dot: Sam found
 * the kind colours confusing, 2026-09-05). */
function RailRow({ on, dot, label, capitalize = false, count, onClick }: { on: boolean; dot?: ReactNode; label: string; capitalize?: boolean; count?: number; onClick: () => void }) {
  return (
    <button type="button" aria-pressed={on} onClick={onClick} className={`flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-[13px] ${on ? "bg-sky-card-strong font-semibold text-sky-ink" : "text-sky-muted hover:bg-sky-card hover:text-sky-ink"}`}>
      {dot}
      <span className={`min-w-0 flex-1 truncate ${capitalize ? "capitalize" : ""}`}>{label}</span>
      {count !== undefined && <span className="text-[11px] tabular-nums text-sky-faint">{count.toLocaleString()}</span>}
    </button>
  );
}

const RAIL_HEADING_TEXT = "text-[10.5px] font-semibold uppercase tracking-[0.12em] text-sky-muted";
const RAIL_HEADING = `mb-1.5 ${RAIL_HEADING_TEXT}`;
const ROUND_BTN = "flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-sky-line text-[13px] leading-none text-sky-muted hover:border-sky-accent hover:text-sky-ink";
const BTN_SOLID = "rounded-[10px] bg-sky-accent px-3.5 py-2 text-[13px] font-semibold text-sky-accent-ink";
const BTN_OUTLINE = "rounded-[10px] border border-sky-accent px-3.5 py-2 text-[13px] font-semibold text-sky-accent disabled:opacity-60";

export function SkyAtlas({ data, lookup, observatoryHref, quizHref, written: Written, hear, pitch, initialEntry, onClaim, height }: SkyAtlasProps) {
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

  // the rail: one collection open at a time, and one status or all of
  // them; it folds to its dots to give the grid the room
  const [railOpen, setRailOpen] = useState(true);
  // the right panel widened over the rail and the grid
  const [wide, setWide] = useState(false);
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

  // the selection: one tile opens its entry on the right; several (cmd or
  // ctrl to add, shift for a run) open a panel of actions on all of them;
  // none, and there is no panel (Sam's call, 2026-09-05)
  const [selected, setSelected] = useState<readonly string[]>(initialEntry ? [initialEntry] : []);
  const selectedSet = useMemo(() => new Set(selected), [selected]);
  const anchor = useRef<string | null>(initialEntry ?? null);
  const single = selected.length === 1 ? selected[0] : null;

  // the entry fetched for a single selection
  const [open, setOpen] = useState<AtlasEntry | null>(null);
  const panel = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!single) return;
    let live = true;
    lookup.entry(single).then((entry) => {
      if (!live) return;
      bring(entry.items);
      setOpen(entry);
      panel.current?.scrollTo({ top: 0 });
    });
    return () => { live = false; };
  }, [single, lookup, bring]);
  // the card opens at once on what a tile knows; the teaching fills in
  const current = single ? graph.itemOf(single) : undefined;
  const entry = single && open?.id === single ? open : null;
  const setOpening = (id: string) => { anchor.current = id; setSelected([id]); };

  // "I know this" and "I know these": the claim, then the entries as
  // claimed, here and on their tiles
  const [claiming, setClaiming] = useState(false);
  const claimIds = async (ids: readonly string[]) => {
    const unknown = ids.map((id) => graph.itemOf(id)).filter((it): it is SkyItem => !!it && it.standing === "not-seen");
    if (unknown.length === 0) return;
    setClaiming(true);
    try {
      await onClaim?.(unknown.map((it) => it.id));
      bring(unknown.map((it) => ({ ...it, standing: "claimed" as const })));
      if (open && unknown.some((it) => it.id === open.id)) setOpen({ ...open, known: true });
    } finally {
      setClaiming(false);
    }
  };
  const claim = () => current && claimIds([current.id]);
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

  // the tiles in the order they are on screen, for a shift-click's run
  const order = result ? (here?.shown ?? []) : shelfSections.flatMap((sec) => sec.items);
  const pick: OnPick = (id, how) => {
    if (how.range && anchor.current) {
      const a = order.indexOf(anchor.current), b = order.indexOf(id);
      if (a >= 0 && b >= 0) {
        const run = order.slice(Math.min(a, b), Math.max(a, b) + 1);
        setSelected((prev) => [...new Set([...prev, ...run])]);
        return;
      }
    }
    anchor.current = id;
    if (how.toggle) setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
    else setSelected([id]);
  };
  const clear = () => setSelected([]);
  const selectedItems = itemsOf(selected);
  const picksHref = (ids: readonly string[]) => `${observatoryHref}${observatoryHref.includes("?") ? "&" : "?"}picks=${ids.map(encodeURIComponent).join(",")}`;
  const showPanel = selected.length > 0;
  // the panel's own row of controls: widen it over the rail and the grid
  // (or bring them back) at the far left, close at the right
  const toolbar = (
    <>
      <button type="button" aria-pressed={wide} onClick={() => setWide(!wide)} title={wide ? "Bring the shelves back" : "Widen this panel"} className={ROUND_BTN}>
        <span aria-hidden>{wide ? "›" : "‹"}</span><span className="sr-only">{wide ? "Bring the shelves back" : "Widen this panel"}</span>
      </button>
      <button type="button" onClick={clear} title="Close" className={ROUND_BTN}>
        <span aria-hidden>×</span><span className="sr-only">Close</span>
      </button>
    </>
  );

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

        <div className={`grid min-h-0 flex-1 items-start gap-4 ${wide && showPanel ? "lg:grid-cols-[minmax(0,1fr)]" : railOpen ? (showPanel ? "lg:grid-cols-[200px_minmax(0,1fr)_360px]" : "lg:grid-cols-[200px_minmax(0,1fr)]") : showPanel ? "lg:grid-cols-[minmax(0,1fr)_360px]" : "lg:grid-cols-[minmax(0,1fr)]"}`}>
          {railOpen && !(wide && showPanel) && (
          <nav aria-label="Collections and status" className="flex min-h-0 flex-col gap-5 self-stretch overflow-y-auto rounded-2xl border border-sky-line bg-sky-panel p-3">
            {(
              <>
                <div>
                  <div className="mb-1.5 flex items-center justify-between">
                    <p className={RAIL_HEADING_TEXT}>Collections</p>
                    <button type="button" aria-expanded onClick={() => setRailOpen(false)} title="Hide the rail" className={ROUND_BTN}>
                      <span aria-hidden>‹</span><span className="sr-only">Hide the rail</span>
                    </button>
                  </div>
                  {data.shelves.map((s) => (
                    <RailRow key={s.id} on={s.id === shelf?.id} label={s.title} count={s.total} onClick={() => setShelfId(s.id)} />
                  ))}
                </div>
                {counts && (
                  <div>
                    <p className={RAIL_HEADING}>Your status</p>
                    <RailRow on={status === null} dot={<span aria-hidden className="inline-block h-2 w-2 shrink-0 rounded-full border border-sky-line" />} label="Everything" count={shelf?.total} onClick={() => setStatus(null)} />
                    {STANDING_ORDER.map((s) => (
                      <RailRow key={s} on={status === s} dot={<span aria-hidden className={`inline-block h-2 w-2 shrink-0 rounded-full ${STANDING[s].dot}`} />} label={STANDING[s].label} capitalize count={counts[s]} onClick={() => setStatus(status === s ? null : s)} />
                    ))}
                  </div>
                )}
              </>
            )}
          </nav>
          )}

          {!(wide && showPanel) && (
          <div className="flex min-h-0 flex-col self-stretch overflow-y-auto pr-1">
            {shelf && (
              <div className="flex shrink-0 items-start gap-3">
                {!railOpen && (
                  <button type="button" aria-expanded={false} onClick={() => setRailOpen(true)} title="Show the rail" className={`${ROUND_BTN} mt-1`}>
                    <span aria-hidden>›</span><span className="sr-only">Show the rail</span>
                  </button>
                )}
                <div className="min-w-0 flex-1">
                  <p className="font-sky-display text-[22px] text-sky-ink">{known.toLocaleString()} <span className="text-[14px] text-sky-muted">of {shelf.total.toLocaleString()} {shelf.unit} known</span></p>
                  <CoverageBar className="mt-2 h-2" counts={shelf.counts} total={shelf.total} label={shelf.unit} />
                </div>
              </div>
            )}

            {result ? (
              <>
                <p className="mt-4 text-[12.5px] text-sky-muted">
                  <span className="font-semibold text-sky-ink">{(here?.shown.length ?? 0).toLocaleString()}</span> shown · matching <span className="font-semibold text-sky-ink">{result.query}</span>{status ? ` · ${STANDING[status].label}` : ""}{here?.section.more ? ` · ${here.section.more.toLocaleString()} more` : ""}
                </p>
                {here && here.shown.length > 0 ? (
                  <div className="mt-2"><Grid ids={here.shown} graph={graph} selected={selectedSet} onOpen={pick} /></div>
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
                  <LazySection key={section.id} label={shelf.sections.length > 1 ? section.label : undefined} ids={section.items} graph={graph} selected={selectedSet} onOpen={pick} />
                ))}
                {shelf.more > 0 && <p className="mt-4 text-[13px] text-sky-muted">{shelf.more.toLocaleString()} more {shelf.unit}. Search for the rest.</p>}
              </>
            ) : null}
            {searching && <p className="mt-3 text-[12.5px] text-sky-muted">Searching…</p>}
          </div>
          )}

          {showPanel && (
            <div ref={panel} className="min-h-0 self-stretch">
              {selected.length > 1 ? (
                <section className="flex h-full flex-col rounded-2xl border border-sky-line bg-sky-panel p-5 font-sky-ui text-sky-ink">
                  <div className="mb-3 flex shrink-0 items-center justify-between gap-2">{toolbar}</div>
                  <h2 className="shrink-0 text-[13px] font-semibold uppercase tracking-[0.12em] text-sky-muted">{selected.length} selected</h2>
                  <div className="mt-3 flex min-h-0 flex-1 flex-wrap content-start gap-1.5 overflow-y-auto">
                    {selectedItems.map((it) => (
                      <button key={it.id} type="button" onClick={() => setOpening(it.id)} title={it.english} className="inline-flex items-baseline gap-1.5 rounded-lg border border-sky-line px-2 py-1 text-left hover:border-sky-accent">
                        <span className={`font-sky-display text-[16px] leading-none ${STANDING[it.standing].text} ${japaneseFont(it.glyph)}`}>{it.glyph}</span>
                        {it.english !== it.glyph && <span className="max-w-[10ch] truncate text-[11px] text-sky-muted">{it.english}</span>}
                      </button>
                    ))}
                  </div>
                  <div className="mt-3 flex shrink-0 flex-wrap gap-2 border-t border-sky-line pt-3">
                    {selectedItems.some((it) => it.standing === "not-seen") && <a href={picksHref(selectedItems.filter((it) => it.standing === "not-seen").map((it) => it.id))} className={BTN_SOLID}>Add to tonight&apos;s picks</a>}
                    {selectedItems.some((it) => it.standing === "not-seen") && <button type="button" onClick={() => claimIds(selected)} disabled={claiming} className={BTN_OUTLINE}>{claiming ? "Marking…" : "I know these"}</button>}
                    {quizHref && <a href={quizHref} className={BTN_OUTLINE}>Quiz me</a>}
                  </div>
                </section>
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
                  onSelect={setOpening}
                  footer={
                    <>
                      {current.standing === "not-seen" ? (
                        <>
                          <a href={picksHref([current.id])} className={BTN_SOLID}>Add to tonight&apos;s picks</a>
                          <button type="button" onClick={claim} disabled={claiming} className={BTN_OUTLINE}>{claiming ? "Marking…" : "I know this"}</button>
                        </>
                      ) : (
                        <span className="text-[12.5px] text-sky-muted">Already in your sky.</span>
                      )}
                      {quizHref && (entry?.quizzable ?? 0) > 1 && <a href={quizHref} className={BTN_OUTLINE}>Quiz me</a>}
                    </>
                  }
                />
              ) : null}
            </div>
          )}
        </div>
      </div>
    </SkyPageShell>
  );
}
