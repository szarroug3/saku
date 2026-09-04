"use client";

// The Planetarium: pick what to learn next. Tracked as SAK-300 to SAK-304.
//
// One call from the route, given the learner's items, what they have
// learned, and the sections on offer. A shop, not a feed (Sam's rule): the
// picker is sections of ItemCards in English only, each priced in the real
// pieces it brings, locked ones shown with their reason; the rail is the
// preview sky of tonight's picks, the piece meter against a comfortable
// lesson, and the picks themselves with what each brings and a way to take
// one out. Every number comes from src/sky/lib/cart.ts over the graph, so
// the cart's total is what the lesson will teach.

import { useMemo, useState } from "react";

import { ItemCard } from "@/sky/components/item-card";
import { ItemSection, type ItemSectionProps } from "@/sky/components/item-section";
import { PieceMeter } from "@/sky/components/piece-meter";
import { SkyField } from "@/sky/components/sky-field";
import { SkyPanel } from "@/sky/components/sky-panel";
import { cartSummary, COMFORTABLE_PIECES, pickBreakdown, pickState, withoutPick, type PickLine } from "@/sky/lib/cart";
import { buildGraph, type PrerequisiteGraph } from "@/sky/lib/graph";
import { japaneseFont } from "@/sky/lib/japanese";
import type { SkyItem } from "@/sky/lib/types";

export interface PlanetariumSection {
  id: string;
  title: string;
  /** One line on the section's rule, when it has one worth stating. */
  hint?: string;
  /** What is on offer, in order, by id. */
  items: readonly string[];
  /** How many exist beyond what is shown, when more do. */
  total?: number;
  /** Set when the whole section is waiting on something. */
  gate?: ItemSectionProps["gate"];
}

export interface SkyPlanetariumData {
  /** Everything on offer and everything under it, plus what the learner has. */
  items: readonly SkyItem[];
  /** What is already in the sky: free, and never charged. */
  learned: readonly string[];
  sections: readonly PlanetariumSection[];
}

export interface SkyPlanetariumProps {
  data: SkyPlanetariumData;
  /** A comfortable lesson, in pieces. */
  cap?: number;
  /** Where "Start tonight's lesson" goes; the picks are appended as
   * `?picks=a,b,c`. A path, not a function: the route is a server component. */
  lessonPath?: string;
  initialPicks?: readonly string[];
}

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/** What a pick brings, worded: "1 kanji, 2 pieces under it · already in your sky: 雨 田". */
function describe(graph: PrerequisiteGraph, line: PickLine, openedBy: readonly string[]): { text: string; free: SkyItem[] } {
  const b = pickBreakdown(graph, line);
  const bits: string[] = [];
  if (b.brings.kana) bits.push(plural(b.brings.kana, "sound"));
  if (b.brings.word) bits.push(plural(b.brings.word, "word"));
  if (b.brings.kanji) {
    const under = b.brings.radical ? `, ${plural(b.brings.radical, "piece")} under ${b.brings.kanji === 1 ? "it" : "them"}` : "";
    bits.push(`${b.brings.kanji} kanji${under}`);
  } else if (b.brings.radical) bits.push(plural(b.brings.radical, "piece"));
  if (b.shared.length) bits.push(`${b.shared.length} already in tonight's picks`);
  if (openedBy.length) bits.push(`with ${openedBy.map((id) => graph.itemOf(id)?.english ?? id).join(" and ")}`);
  return { text: bits.join(" · "), free: b.shared.length ? [] : b.free };
}

export function SkyPlanetarium({ data, cap = COMFORTABLE_PIECES, lessonPath, initialPicks = [] }: SkyPlanetariumProps) {
  const graph = useMemo(() => buildGraph(data.items), [data.items]);
  const learned = useMemo(() => new Set(data.learned), [data.learned]);
  const [picks, setPicks] = useState<readonly string[]>(initialPicks);
  const [undo, setUndo] = useState<{ removed: string; before: readonly string[] } | null>(null);

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

  const nameOf = (id: string) => graph.itemOf(id)?.english ?? id;
  const meterNote = summary.pieces === 0
    ? "Pick anything to start."
    : over
      ? `That's ${summary.over} past a comfortable lesson. You can still start it, but expect a backlog of unopened lessons.`
      : summary.pieces === cap
        ? "A full lesson, right at the line."
        : `${cap - summary.pieces} more ${cap - summary.pieces === 1 ? "piece" : "pieces"} before this lesson gets uncomfortably large.`;
  const startLabel = over ? `Start with ${summary.pieces} pieces anyway` : `Start tonight's lesson · ${plural(summary.pieces, "piece")}`;

  return (
    <div className="font-sky-ui text-sky-ink">
      <header>
        <div className="text-[11.5px] font-semibold uppercase tracking-[0.12em] text-sky-muted">Planetarium</div>
        <h1 className="mt-1 font-sky-display text-4xl leading-tight">What would you like to learn next?</h1>
        <p className="mt-2 text-[15px] leading-relaxed text-sky-muted">Pick freely. Nothing here is a fixed order, and anything already in your sky is free.</p>
      </header>

      <div className="mt-6 grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="min-w-0">
          {data.sections.map((section) => (
            <ItemSection key={section.id} title={section.title} hint={section.hint} shown={section.items.length} total={section.total} gate={section.gate}>
              <div className="grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-2">
                {section.items.map((id) => {
                  const item = graph.itemOf(id);
                  if (!item) return null;
                  const state = pickState(graph, id, learned, picks);
                  // a picked card shows its line in the cart (priced after the picks
                  // before it); an unpicked one, what it would add to the whole cart
                  const cost = summary.lines.find((l) => l.id === id)?.cost ?? graph.costOf(id, learned, picks);
                  const note = cost.shared.length
                    ? `${cost.shared.length} shared`
                    : state.openedByCart.length
                      ? `comes with ${state.openedByCart.map(nameOf).join(" and ")}`
                      : cost.free.length && cost.pieces.length === 1 && item.kind === "word"
                        ? "kanji already in your sky"
                        : undefined;
                  return (
                    <ItemCard
                      key={id}
                      item={item}
                      selected={picks.includes(id)}
                      pieces={cost.pieces.length}
                      note={note}
                      locked={state.available ? undefined : `needs ${state.needs.map(nameOf).join(" and ")} first`}
                      onClick={() => toggle(id)}
                    />
                  );
                })}
              </div>
            </ItemSection>
          ))}
        </div>

        <aside className="flex flex-col gap-4 lg:sticky lg:top-6">
          <SkyPanel title="Your sky tonight" className="!p-4">
            <div className="mt-3 overflow-hidden rounded-xl border border-sky-line">
              <SkyField items={data.items} roots={picks} tonight={new Set(picks)} graph={graph} width={340} height={230} pad={16} baseSize={40} seed="planetarium" label="Tonight's picks, as the constellations they will be" />
            </div>
            <p className="mt-2 text-[12.5px] text-sky-muted">
              {picks.length === 0
                ? "Nothing picked yet. Pick something and it appears here."
                : `${plural(picks.length, "new constellation")} for tonight. Stars you already know are lit; the rest wait for the lesson.`}
            </p>
          </SkyPanel>

          <SkyPanel title="This lesson" aside={`${summary.pieces} of ${cap} pieces`} className="!p-4">
            <PieceMeter className="mt-3" pieces={summary.pieces} cap={cap} />
            <p className={`mt-2 text-[12.5px] ${over ? "text-sky-coral" : "text-sky-muted"}`}>{meterNote}</p>
          </SkyPanel>

          <SkyPanel title="Tonight" aside={picks.length ? `${plural(picks.length, "pick")} · ${plural(summary.pieces, "piece")}` : "nothing yet"} className="!p-4">
            {picks.length === 0 ? (
              <p className="mt-3 text-center text-[12.5px] text-sky-muted">Nothing picked. Your sky stays as it is.</p>
            ) : (
              <ul className="mt-3 flex max-h-[240px] flex-col gap-1.5 overflow-y-auto">
                {summary.lines.map((line) => {
                  const { text, free } = describe(graph, line, pickState(graph, line.id, learned, picks).openedByCart);
                  return (
                    <li key={line.id} className="rounded-lg bg-sky-card px-2.5 py-2">
                      <div className="flex items-baseline gap-2">
                        <span className="flex-1 text-[13px] font-semibold">{nameOf(line.id)}</span>
                        <span className="text-[11px] tabular-nums text-sky-muted">{line.cost.pieces.length}</span>
                        <button type="button" aria-label={`Remove ${nameOf(line.id)}`} onClick={() => toggle(line.id)} className="pl-1.5 text-[14px] leading-none text-sky-muted hover:text-sky-coral">×</button>
                      </div>
                      {(text || free.length > 0) && (
                        <div className="mt-0.5 text-[11px] text-sky-muted">
                          {text}
                          {free.length > 0 && (
                            <>
                              {text ? " · " : ""}already in your sky:{" "}
                              {free.map((f) => <span key={f.id} className={`font-sky-display text-sky-ink ${japaneseFont(f.glyph)}`}>{f.glyph} </span>)}
                            </>
                          )}
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
            {undo && (
              <p className="mt-2 text-[12px] text-sky-muted">
                Removed {nameOf(undo.removed)}.{" "}
                <button type="button" className="underline hover:text-sky-ink" onClick={() => { setPicks(undo.before); setUndo(null); }}>Undo</button>
              </p>
            )}
            {picks.length > 0 && lessonPath ? (
              <a href={`${lessonPath}?picks=${encodeURIComponent(picks.join(","))}`} className={`mt-3 block rounded-[10px] px-3.5 py-2.5 text-center text-sm font-semibold ${over ? "bg-sky-coral text-sky-gold-ink" : "bg-sky-gold text-sky-gold-ink"}`}>{startLabel}</a>
            ) : (
              <span aria-disabled className="mt-3 block rounded-[10px] bg-sky-card-strong px-3.5 py-2.5 text-center text-sm font-semibold text-sky-faint">{"Start tonight's lesson"}</span>
            )}
          </SkyPanel>
        </aside>
      </div>
    </div>
  );
}
