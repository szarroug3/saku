"use client";

// The home: your sky. Tracked as SAK-329 to SAK-336.
//
// One call from the route, given the learner's data: the sky with every
// constellation they have learned, pannable and zoomable, hover to name a
// star; the legend; then, folded away under one line so the sky has the
// page, "How much you've discovered" and "Mix-ups" side by side. No lesson
// panel and no explainer of the review model: tonight's picks are reached
// from the Planetarium and the Lesson. A brand-new learner sees an empty sky
// that says where to start.

import { useMemo, useState } from "react";

import { DiscoveryPanel, discoveryTotals, type DiscoveryRow } from "@/sky/components/discovery-panel";
import { MixUpsPanel, type MixUp } from "@/sky/components/mix-ups-panel";
import { SkyField } from "@/sky/components/sky-field";
import { SkyPageShell } from "@/sky/components/sky-page-shell";
import { StandingLegend } from "@/sky/components/standing-legend";
import { useStandingFilter } from "@/sky/components/use-standing-filter";
import type { CoverageCounts } from "@/sky/lib/coverage";
import { buildGraph } from "@/sky/lib/graph";
import { skyStars, tallyStandings } from "@/sky/lib/sky-scene";
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
  /** Every single star the sky holds before anything is discovered (kana,
   * pieces, kanji), when the sky shows everything. Empty for discovered-only. */
  firmament?: readonly string[];
  /** Everything the app counts, by standing: the legend's numbers, adding up
   * to the discovery total. Without it the legend tallies the sky's stars. */
  standingCounts?: CoverageCounts;
}

export interface SkyHomeProps {
  data: SkyHomeData;
  /** Where the Planetarium lives, for the empty sky's way in. */
  planetariumHref?: string;
  /** How tall the home is: one page, never scrolling. The sky fills what
   * the heading and the details leave, and shrinks when the details open.
   * A CSS length; the route knows its own chrome. */
  height?: string;
}

export function SkyHome({ data, planetariumHref = "/planetarium", height = "calc(100vh - 8rem)" }: SkyHomeProps) {
  const graph = useMemo(() => buildGraph(data.items), [data.items]);
  const stars = useMemo(() => [...new Set([...skyStars(graph, data.roots), ...(data.firmament ?? [])])], [graph, data.roots, data.firmament]);
  const counts = useMemo(() => data.standingCounts ?? tallyStandings(stars, (id) => graph.itemOf(id)?.standing), [data.standingCounts, stars, graph]);
  const totals = discoveryTotals(data.discovery);
  const empty = data.roots.length === 0 && !(data.firmament?.length);
  // the panels fold away, so the sky is most of the page
  const [details, setDetails] = useState(false);
  // the legend is the filter: everything but "undiscovered" to start
  const { selected, toggle, singled, setSingled, lookOf } = useStandingFilter();

  return (
    <SkyPageShell title="Your sky" lede="This is your sky. It will evolve as you explore and discover more of the Japanese language." height={height}>
      <div className="relative flex min-h-[160px] flex-1 overflow-hidden rounded-2xl border border-sky-line">
        {empty ? (
          <div className="flex w-full flex-col items-center justify-center gap-3 p-8 text-center">
            <p className="font-sky-display text-2xl">Your sky is empty tonight.</p>
            <p className="max-w-[44ch] text-[14px] text-sky-muted">Pick something to learn and it appears here as its own constellation. The first kana are a good place to start.</p>
            <a href={planetariumHref} className="mt-1 rounded-[10px] bg-sky-gold px-3.5 py-2 text-sm font-semibold text-sky-gold-ink">Open the Planetarium</a>
          </div>
        ) : (
          <SkyField items={data.items} roots={data.roots} firmament={data.firmament} focus={1120} graph={graph} interactive fill lookOf={lookOf} label="Every constellation you have learned, scattered across the sky" />
        )}
      </div>
      {!empty && <StandingLegend className="mt-3" counts={counts} onHover={setSingled} hovered={singled} onToggle={toggle} selected={selected} info />}

      <div className="mt-4 flex max-h-[60%] shrink-0 flex-col">
        <button
          type="button"
          onClick={() => setDetails((d) => !d)}
          aria-expanded={details}
          aria-controls="sky-home-details"
          className="flex w-full shrink-0 items-center justify-between gap-4 rounded-2xl border border-sky-line bg-sky-panel px-5 py-3 text-left hover:bg-sky-card"
        >
          <span className="text-[12px] font-semibold uppercase tracking-[0.14em] text-sky-muted">Details</span>
          <span className="flex items-center gap-3 text-[13px] tabular-nums text-sky-muted">
            {totals.total > 0 && <span>{totals.discovered.toLocaleString()} of {totals.total.toLocaleString()} Discovered</span>}
            <span aria-hidden className="text-sky-ink">{details ? "Hide" : "Show"}</span>
          </span>
        </button>
        {details && (
          <div id="sky-home-details" className="mt-4 grid min-h-0 gap-4 md:grid-cols-2 md:grid-rows-[minmax(0,1fr)]">
            <DiscoveryPanel className="min-h-0 overflow-y-auto" rows={data.discovery} />
            <MixUpsPanel className="min-h-0 overflow-y-auto" pairs={data.mixUps} itemOf={graph.itemOf} />
          </div>
        )}
      </div>
    </SkyPageShell>
  );
}
