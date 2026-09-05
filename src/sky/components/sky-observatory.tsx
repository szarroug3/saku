"use client";

// The Observatory: pick what to learn next. Tracked as SAK-300 to SAK-304.
//
// One call from the route, given the learner's items, what they have
// learned, and the sections on offer. A shop, not a feed (Sam's rule): the
// picker is sections of ItemCards in English only, only what can be taken
// now (nothing locked, nothing finished), each section saying what its kind
// of thing is until it is started; the rail is the preview sky of tonight's
// picks, the piece meter against a comfortable lesson, and the picks with
// their cost, a way to take one out, "I already know these" and the way to
// the lesson. Every number comes from src/sky/lib/cart.ts over the graph,
// so the cart's total is what the lesson will teach.

import { useMemo, useState, useTransition } from "react";

import { ItemCard } from "@/sky/components/item-card";
import { ItemSection } from "@/sky/components/item-section";
import { PieceMeter } from "@/sky/components/piece-meter";
import { SkyField } from "@/sky/components/sky-field";
import { SkyPageShell } from "@/sky/components/sky-page-shell";
import { SkyPanel } from "@/sky/components/sky-panel";
import { cartSummary, COMFORTABLE_PIECES, pickState, withoutPick } from "@/sky/lib/cart";
import { buildGraph } from "@/sky/lib/graph";
import { KIND_LABEL } from "@/sky/lib/tokens";
import type { SkyItem } from "@/sky/lib/types";

export interface ObservatorySection {
  id: string;
  title: string;
  /** What this kind of thing is. */
  intro?: string;
  /** When to start it. */
  when?: string;
  /** What is on offer, in order, by id. The page lays out those that can be
   * taken now, at most `SHOWN` of them. */
  items: readonly string[];
  /** What the whole section is waiting on, when it is: such a section is
   * not shown at all (Sam's call, 2026-09-04), but the reason is kept so a
   * page can say what is coming. */
  gate?: { requirement: string; progress?: { have: number; need: number; unit: string } };
  /** The learner has already started this kind of thing, so its things are
   * laid out straight away; otherwise the section shows what it is and a
   * Start button, and the things appear once that is pressed. */
  started?: boolean;
  /** Nothing left to take: the track is done and is not shown. */
  complete?: boolean;
}

export interface SkyObservatoryData {
  /** Everything on offer and everything under it, plus what the learner has. */
  items: readonly SkyItem[];
  /** What is already in the sky: free, and never charged. */
  learned: readonly string[];
  sections: readonly ObservatorySection[];
}

/** How many of a section are laid out. */
export const SHOWN = 9;

export interface SkyObservatoryProps {
  data: SkyObservatoryData;
  /** How tall the page is; the heading stays put and the picker scrolls. */
  height?: string;
  /** A comfortable lesson, in pieces. */
  cap?: number;
  /** Where "Start tonight's lesson" goes; the picks are appended as
   * `?picks=a,b,c`. A path, not a function: the route is a server component. */
  lessonPath?: string;
  /** Claims the picks ("I already know these"): a server action from the
   * route, given the picked ids. Each pick claims only itself (a word's kanji
   * stay unclaimed; a kana row claims its sounds). Absent when there is no
   * history to write to (a sample, a visitor): the claim then holds for the
   * visit only, so the page still behaves. */
  onClaim?: (ids: readonly string[]) => Promise<void>;
  initialPicks?: readonly string[];
}

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/** What kind of thing a card is: a kana row by its script, grammar as a
 * sentence rule, the rest by the kind's own word. */
function kindLabel(item: SkyItem): string {
  if (item.kind === "kana") return /[\u30a0-\u30ff]/.test(item.glyph) ? "katakana" : "hiragana";
  if (item.kind === "grammar" || item.kind === "sentence") return "sentence rule";
  return KIND_LABEL[item.kind];
}

export function SkyObservatory({ data, cap = COMFORTABLE_PIECES, lessonPath, initialPicks = [], height, onClaim }: SkyObservatoryProps) {
  const graph = useMemo(() => buildGraph(data.items), [data.items]);
  // what is claimed this visit joins what is learned; without a route to
  // write to, that is the whole of the claim
  const [claimed, setClaimed] = useState<readonly string[]>([]);
  const learned = useMemo(() => new Set([...data.learned, ...claimed]), [data.learned, claimed]);
  const [picks, setPicks] = useState<readonly string[]>(initialPicks);
  const [undo, setUndo] = useState<{ removed: string; before: readonly string[] } | null>(null);
  // sections opened with their Start button this visit, on top of those already started
  const [opened, setOpened] = useState<ReadonlySet<string>>(() => new Set());
  const [claiming, startClaim] = useTransition();
  // the last card clicked, for shift-click: everything between it and the next click
  const [anchor, setAnchor] = useState<string | null>(null);

  const summary = cartSummary(graph, picks, learned, cap);
  const over = summary.over > 0;

  const toggle = (id: string) => {
    if (picks.includes(id)) {
      setUndo({ removed: id, before: picks });
      setPicks(withoutPick(graph, picks, id, learned));
    } else if (pickState(graph, id, learned, picks).available) {
      setUndo(null);
      setPicks([...picks, id]);
    }
  };
  /** What a section lays out: only what can be taken now, the first few. */
  const offered = (section: ObservatorySection) => section.items.filter((id) => graph.has(id) && !learned.has(id) && pickState(graph, id, learned, picks).available).slice(0, SHOWN);
  /** A click on a card: shift picks everything from the last click to this
   * one within the section (a range, like files in a list); otherwise toggle. */
  const clickCard = (section: ObservatorySection, id: string, shift: boolean) => {
    const ids = offered(section);
    const from = anchor ? ids.indexOf(anchor) : -1, to = ids.indexOf(id);
    if (shift && from >= 0 && to >= 0 && from !== to) {
      const range = ids.slice(Math.min(from, to), Math.max(from, to) + 1);
      const next = [...picks];
      for (const r of range) if (!next.includes(r) && pickState(graph, r, learned, next).available) next.push(r);
      setUndo(null);
      setPicks(next);
    } else {
      toggle(id);
    }
    setAnchor(id);
  };

  const nameOf = (id: string) => graph.itemOf(id)?.english ?? id;
  const meterNote = summary.pieces === 0
    ? "Pick anything to start."
    : over
      ? `That's ${summary.over} past a comfortable lesson.`
      : summary.pieces === cap
        ? "A full lesson, right at the line."
        : `${cap - summary.pieces} more ${cap - summary.pieces === 1 ? "piece" : "pieces"} before this lesson gets uncomfortably large.`;
  const startLabel = over ? "Start Lesson anyway" : "Start Lesson";

  return (
    <SkyPageShell eyebrow="Observatory" title="What would you like to learn next?" height={height}>
      <div className="grid min-h-0 flex-1 items-start gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="min-h-0 min-w-0 self-stretch overflow-y-auto pb-6 pr-1">
          {data.sections.filter((section) => !section.gate && !section.complete).map((section) => {
            const ids = offered(section);
            // nothing to take right now (everything left waits on something): not shown
            if (ids.length === 0) return null;
            const started = section.started || opened.has(section.id);
            return (
              <ItemSection
                key={section.id}
                title={section.title}
                intro={started ? undefined : section.intro}
                when={started ? undefined : section.when}
                start={started ? undefined : { label: `Start ${section.title.toLowerCase()}`, onClick: () => setOpened((o) => new Set([...o, section.id])), disabled: ids.length === 0 }}
              >
                {started && ids.length > 0 && (
                  <div className="grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-2">
                    {ids.map((id) => {
                      const item = graph.itemOf(id)!;
                      return <ItemCard key={id} item={item} selected={picks.includes(id)} label={kindLabel(item)} onClick={(e) => clickCard(section, id, e.shiftKey)} />;
                    })}
                  </div>
                )}
              </ItemSection>
            );
          })}
        </div>

        <aside className="flex min-h-0 flex-col gap-4 self-stretch lg:pb-6">
          <SkyPanel title="Your sky tonight" className="shrink-0 !p-4">
            <div className="mt-3 overflow-hidden rounded-xl border border-sky-line">
              <SkyField items={data.items} roots={picks} tonight={new Set(picks)} graph={graph} width={340} height={230} pad={16} baseSize={40} seed="planetarium" label="Tonight's picks, as the constellations they will be" />
            </div>
            <p className="mt-2 text-[12.5px] text-sky-muted">
              {picks.length === 0
                ? "Nothing picked yet. Pick something and it appears here."
                : `${plural(picks.length, "new constellation")} for tonight. Stars you already know are lit; the rest wait for the lesson.`}
            </p>
          </SkyPanel>

          <SkyPanel title="This lesson" aside={`${summary.pieces} of ${cap} pieces`} className="shrink-0 !p-4">
            <PieceMeter className="mt-3" pieces={summary.pieces} cap={cap} />
            <p className={`mt-2 text-[12.5px] ${over ? "text-sky-coral" : "text-sky-muted"}`}>{meterNote}</p>
          </SkyPanel>

          <SkyPanel title="Tonight" aside={picks.length ? `${plural(picks.length, "pick")} · ${plural(summary.pieces, "piece")}` : "nothing yet"} className="flex min-h-0 flex-1 flex-col !p-4">
            {picks.length === 0 ? (
              <p className="mt-3 flex-1 text-center text-[12.5px] text-sky-muted">Nothing picked. Your sky stays as it is.</p>
            ) : (
              <ul className="mt-3 flex min-h-0 flex-1 flex-col gap-1.5 overflow-y-auto">
                {summary.lines.map((line) => (
                  <li key={line.id} className="flex items-baseline gap-2 rounded-lg bg-sky-card px-2.5 py-2">
                    <span className="flex-1 text-[13px] font-semibold">{nameOf(line.id)}</span>
                    <span className="text-[11px] tabular-nums text-sky-muted">{line.cost.pieces.length}</span>
                    <button type="button" aria-label={`Remove ${nameOf(line.id)}`} onClick={() => toggle(line.id)} className="pl-1.5 text-[14px] leading-none text-sky-muted hover:text-sky-coral">×</button>
                  </li>
                ))}
              </ul>
            )}
            {undo && (
              <p className="mt-2 shrink-0 text-[12px] text-sky-muted">
                Removed {nameOf(undo.removed)} ·{" "}
                <button type="button" className="underline hover:text-sky-ink" onClick={() => { setPicks(undo.before); setUndo(null); }}>Undo</button>
              </p>
            )}
            {picks.length > 0 && (
              <button
                type="button"
                disabled={claiming}
                onClick={() => startClaim(async () => { if (onClaim) await onClaim(picks); setClaimed((c) => [...c, ...picks]); setPicks([]); setUndo(null); })}
                className="mt-3 block w-full shrink-0 rounded-[10px] border border-sky-accent bg-transparent px-3.5 py-2.5 text-center text-sm font-semibold leading-5 text-sky-accent hover:bg-sky-accent/10 disabled:border-sky-line disabled:text-sky-faint"
              >
                {claiming ? "Claiming…" : "I already know these"}
              </button>
            )}
            {picks.length > 0 && lessonPath ? (
              <a href={`${lessonPath}${lessonPath.includes("?") ? "&" : "?"}picks=${encodeURIComponent(picks.join(","))}`} className={`mt-2 block shrink-0 rounded-[10px] border border-transparent px-3.5 py-2.5 text-center text-sm font-semibold leading-5 ${over ? "bg-sky-coral text-sky-gold-ink" : "bg-sky-accent text-sky-accent-ink"}`}>{startLabel}</a>
            ) : (
              <span aria-disabled className="mt-3 block shrink-0 rounded-[10px] border border-transparent bg-sky-card-strong px-3.5 py-2.5 text-center text-sm font-semibold leading-5 text-sky-faint">Start Lesson</span>
            )}
          </SkyPanel>
        </aside>
      </div>
    </SkyPageShell>
  );
}
