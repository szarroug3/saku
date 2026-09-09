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

import { ItemCard, type ItemGate } from "@/sky/components/item-card";
import { ItemSection } from "@/sky/components/item-section";
import { PieceMeter } from "@/sky/components/piece-meter";
import { ResumeLine } from "@/sky/components/quiz-resume";
import { SkyField } from "@/sky/components/sky-field";
import { SkyButton } from "@/sky/components/sky-button";
import { SkyPageShell } from "@/sky/components/sky-page-shell";
import { SkyPanel } from "@/sky/components/sky-panel";
import { UndoLine } from "@/sky/components/undo-line";
import { cartSummary, COMFORTABLE_PIECES, pickState, withoutPick } from "@/sky/lib/cart";
import { buildGraph } from "@/sky/lib/graph";
import { KIND_LABEL } from "@/sky/lib/tokens";
import type { SavedRun } from "@/sky/lib/quiz-run";
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
  /** How many to lay out, when the default nine is the wrong number for this
   * section. Sentence rules is short by construction and ends on the sentence
   * type its rows lead up to (SAK-430), so it shows whole: cutting it one card
   * early would drop the very thing the order exists to reach. */
  show?: number;
  /** What the whole section is waiting on, when it is: such a section is
   * not shown at all (Sam's call, 2026-09-04), but the reason is kept so a
   * page can say what is coming. */
  gate?: ItemGate;
  /** What a single listed item is waiting on, by its id, for the few items
   * that keep their place in the order while they are shut (a sentence type
   * whose grammar the learner has not met, SAK-430). Everything else that
   * cannot be taken is simply left out; see `ItemCard`'s own note. */
  gates?: Readonly<Record<string, ItemGate>>;
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
const SHOWN = 9;

interface SkyObservatoryProps {
  data: SkyObservatoryData;
  /** How tall the page is; the heading stays put and the picker scrolls. */
  height?: string;
  /** A comfortable lesson, in pieces. */
  cap?: number;
  /** Where "Start tonight's lesson" goes, given the picks. From the route
   * layer, which is the only thing that knows what a Sky URL looks like
   * (SAK-367). Absent means the button is there but cannot go anywhere. */
  lessonHref?: (ids: readonly string[]) => string;
  /** Claims the picks ("I already know these"): a server action from the
   * route, given the picked ids. Each pick claims only itself (a word's kanji
   * stay unclaimed; a kana row claims its sounds). Absent when there is no
   * history to write to (a sample, a visitor): the claim then holds for the
   * visit only, so the page still behaves. */
  onClaim?: (ids: readonly string[]) => Promise<void>;
  /** A quiz left part way through, offered back beside the heading
   * (SAK-404). The href is the route's (SAK-367). */
  resume?: { run: SavedRun; href: string };
  initialPicks?: readonly string[];
}

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/** What kind of thing a card is: a kana row by its script, a grammar pattern
 * as a sentence rule, a whole shape of sentence as a sentence type (the two
 * share the "Sentence rules" section and have to read apart on the card), the
 * rest by the kind's own word. */
function kindLabel(item: SkyItem): string {
  if (item.kind === "kana") return /[\u30a0-\u30ff]/.test(item.glyph) ? "katakana" : "hiragana";
  if (item.kind === "grammar") return "sentence rule";
  if (item.kind === "sentence") return "sentence type";
  return KIND_LABEL[item.kind];
}

export function SkyObservatory({ data, cap = COMFORTABLE_PIECES, lessonHref, initialPicks = [], height, onClaim, resume }: SkyObservatoryProps) {
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
  /** What a section lays out: what can be taken now and, in its place, what
   * the section says is shut for a reason. */
  const offered = (section: ObservatorySection) => section.items.filter((id) => graph.has(id) && !learned.has(id) && pickState(graph, id, learned, picks).available).slice(0, section.show ?? SHOWN);
  /** A click on a card: shift picks everything from the last click to this
   * one within the section (a range, like files in a list); otherwise toggle.
   * A gated card is not in the range: it cannot be clicked itself, and a
   * range drawn across it must not pick it either. */
  const clickCard = (section: ObservatorySection, id: string, shift: boolean) => {
    const ids = offered(section).filter((x) => !section.gates?.[x]);
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
  const startLabel = over ? "Start lesson anyway" : "Start lesson";

  return (
    <SkyPageShell eyebrow="Observatory" title="What would you like to learn next?" aside={resume && <ResumeLine run={resume.run} href={resume.href} />} height={height}>
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
                start={started ? undefined : { label: `Start ${section.title.toLowerCase()}`, onClick: () => setOpened((o) => new Set([...o, section.id])) }}
              >
                {started && ids.length > 0 && (
                  <div className="grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-2">
                    {ids.map((id) => {
                      const item = graph.itemOf(id)!;
                      const shut = section.gates?.[id];
                      // a gated card keeps its place and says what opens it;
                      // with no onClick it is a plain tile, not a button
                      return <ItemCard key={id} item={item} selected={picks.includes(id)} label={kindLabel(item)} gate={shut} onClick={shut ? undefined : (e) => clickCard(section, id, e.shiftKey)} />;
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
          </SkyPanel>

          <SkyPanel title="This lesson" aside={`${summary.pieces} of ${cap} Pieces`} className="shrink-0 !p-4">
            <PieceMeter className="mt-3" pieces={summary.pieces} cap={cap} />
            <p className={`mt-2 text-[12.5px] ${over ? "text-sky-coral" : "text-sky-muted"}`}>{meterNote}</p>
          </SkyPanel>

          <SkyPanel title="Tonight" aside={picks.length ? `${plural(picks.length, "Pick")} · ${plural(summary.pieces, "Piece")}` : "Nothing yet"} fit className="!p-4">
            {picks.length === 0 ? (
              <p className="mt-3 text-center text-[12.5px] text-sky-muted">Nothing picked. Choose something to learn and it lands here.</p>
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
            {undo && <UndoLine className="mt-2 shrink-0" what={`Removed ${nameOf(undo.removed)}`} onUndo={() => { setPicks(undo.before); setUndo(null); }} />}
            {picks.length > 0 && (
              <SkyButton
                variant="outline"
                block
                disabled={claiming}
                onClick={() => startClaim(async () => { if (onClaim) await onClaim(picks); setClaimed((c) => [...c, ...picks]); setPicks([]); setUndo(null); })}
                className="mt-3 shrink-0 py-2.5"
              >
                {claiming ? "Claiming…" : "I already know these"}
              </SkyButton>
            )}
            {picks.length > 0 && lessonHref ? (
              <SkyButton variant={over ? "coral" : "solid"} block href={lessonHref(picks)} className="mt-2 shrink-0 py-2.5">{startLabel}</SkyButton>
            ) : (
              <SkyButton block disabled href="#" className="mt-3 shrink-0 py-2.5">Start lesson</SkyButton>
            )}
          </SkyPanel>
        </aside>
      </div>
    </SkyPageShell>
  );
}
