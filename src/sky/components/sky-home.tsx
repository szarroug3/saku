"use client";

// The home: your sky. Tracked as SAK-329 to SAK-336.
//
// One call from the route, given the learner's data: the sky with every
// constellation they have learned, pannable and zoomable, hover to name; the
// legend; then "How much you've covered" and "Mix-ups" side by side. No
// lesson panel and no explainer of the review model: tonight's picks are
// reached from the Planetarium and the Lesson. A brand-new learner sees an
// empty sky that says where to start.

import { useCallback, useMemo, useState } from "react";

import type { StarLook } from "@/sky/components/constellation";
import { DiscoveryPanel, discoveryTotals, type DiscoveryRow } from "@/sky/components/discovery-panel";
import { MixUpsPanel, type MixUp } from "@/sky/components/mix-ups-panel";
import { SkyField } from "@/sky/components/sky-field";
import { StandingLegend } from "@/sky/components/standing-legend";
import { buildGraph } from "@/sky/lib/graph";
import { skyStars, tallyStandings } from "@/sky/lib/sky-scene";
import type { Standing } from "@/sky/lib/standing";
import type { SkyItem } from "@/sky/lib/types";

/** Everything the home needs, plain data, from whatever adapter the route uses. */
export interface SkyHomeData {
  /** Every item that is a star or could be: the constellations and all their parts. */
  items: readonly SkyItem[];
  /** The constellations to draw: met items that are not part of another met item. */
  roots: readonly string[];
  mixUps: readonly MixUp[];
  /** How far the learner has got in each subject, grouped as the app groups them. */
  discovery: readonly DiscoveryRow[];
}

export interface SkyHomeProps {
  data: SkyHomeData;
  /** Where the Planetarium lives, for the empty sky's way in. */
  planetariumHref?: string;
}

export function SkyHome({ data, planetariumHref = "/planetarium" }: SkyHomeProps) {
  const graph = useMemo(() => buildGraph(data.items), [data.items]);
  const stars = useMemo(() => skyStars(graph, data.roots), [graph, data.roots]);
  const counts = useMemo(() => tallyStandings(stars, (id) => graph.itemOf(id)?.standing), [stars, graph]);
  const totals = discoveryTotals(data.discovery);
  const empty = data.roots.length === 0;
  // hover a standing in the legend and only its stars stay lit
  const [singled, setSingled] = useState<Standing | null>(null);
  const lookOf = useCallback((_id: string, base: StarLook): StarLook => (singled && base.standing !== singled ? { ...base, muted: true } : base), [singled]);

  return (
    <div className="font-sky-ui text-sky-ink">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-sky-display text-4xl leading-tight">Your sky</h1>
          <p className="mt-2 max-w-[62ch] text-[15px] leading-relaxed text-sky-muted">
            Every word you&apos;ve learned is a small constellation: the word at its centre, its characters around it, the pieces they&apos;re built from beyond. Each star is coloured by how well you know it. Hover a constellation to name it; drag to pan and scroll to zoom.
          </p>
        </div>
        {!empty && totals.total > 0 && (
          <div className="text-[13px] tabular-nums text-sky-muted">
            <b className="text-sky-ink">{totals.discovered.toLocaleString()}</b> of {totals.total.toLocaleString()} discovered
          </div>
        )}
      </header>

      <div className="mt-4 overflow-hidden rounded-2xl border border-sky-line">
        {empty ? (
          <div className="flex min-h-[320px] flex-col items-center justify-center gap-3 p-8 text-center">
            <p className="font-sky-display text-2xl">Your sky is empty tonight.</p>
            <p className="max-w-[44ch] text-[14px] text-sky-muted">Pick something to learn and it appears here as its own constellation. The first kana are a good place to start.</p>
            <a href={planetariumHref} className="mt-1 rounded-[10px] bg-sky-gold px-3.5 py-2 text-sm font-semibold text-sky-gold-ink">Open the Planetarium</a>
          </div>
        ) : (
          <SkyField items={data.items} roots={data.roots} graph={graph} interactive lookOf={lookOf} label="Every constellation you have learned, scattered across the sky" />
        )}
      </div>
      {!empty && <StandingLegend className="mt-3" counts={counts} onHover={setSingled} hovered={singled} />}

      <div className="mt-6 grid gap-4 md:grid-cols-2">
        <DiscoveryPanel rows={data.discovery} />
        <MixUpsPanel graph={graph} pairs={data.mixUps} />
      </div>
    </div>
  );
}
