"use client";

// The home, named the Planetarium: your sky. Tracked as SAK-329 to SAK-336.
//
// One call from the route, given the learner's data: the sky with every
// constellation they have learned, pannable and zoomable, hover to name a
// star; the legend; then, folded away under one line so the sky has the
// page, "How much you've discovered" and "Mix-ups" side by side. No lesson
// panel and no explainer of the review model: tonight's picks are reached
// from the Observatory and the Lesson. A brand-new learner sees the whole
// firmament, undiscovered, and a way to the Observatory.

import { useMemo, useState } from "react";

import { DiscoveryPanel, discoveryTotals, type DiscoveryRow } from "@/sky/components/discovery-panel";
import { MixUpsPanel, type MixUp } from "@/sky/components/mix-ups-panel";
import { SkyField } from "@/sky/components/sky-field";
import { bodyOf, type Body } from "@/sky/lib/constellation";
import { Eyebrow } from "@/sky/components/sky-card";
import { SURFACE } from "@/sky/components/sky-panel";
import { SkyButton } from "@/sky/components/sky-button";
import { SkyPageShell } from "@/sky/components/sky-page-shell";
import { StandingLegend } from "@/sky/components/standing-legend";
import { useStandingFilter } from "@/sky/components/use-standing-filter";
import type { CoverageCounts } from "@/sky/lib/coverage";
import { STANDING_ORDER } from "@/sky/lib/standing";
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
  /** Where the Observatory lives, for the empty sky's way in. */
  observatoryHref?: string;
  /** Clears a mix-up by hand. */
  onClearMixUp?: (key: string) => Promise<void> | void;
  /** How tall the home is: one page, never scrolling. The sky fills what
   * the heading and the details leave, and shrinks when the details open.
   * A CSS length; the route knows its own chrome. */
  height?: string;
}

export function SkyHome({ data, observatoryHref = "/observatory", onClearMixUp, height = "calc(100vh - 8rem)" }: SkyHomeProps) {
  const graph = useMemo(() => buildGraph(data.items), [data.items]);
  const stars = useMemo(() => [...new Set([...skyStars(graph, data.roots), ...(data.firmament ?? [])])], [graph, data.roots, data.firmament]);
  // the sky opens on a planet if there is one, else a binary, else an
  // asteroid: the learner's furthest reach, and the part of the sky worth
  // a look first. The bodies are scattered like everything else (Sam,
  // 2026-09-05: not grouped), so this is a place to start, not a tour.
  const openOn = useMemo(() => {
    const first = (body: Body) => data.roots.find((id) => bodyOf(graph.itemOf(id)?.kind ?? "word") === body);
    return first("planet") ?? first("binary") ?? first("asteroid");
  }, [graph, data.roots]);
  const counts = useMemo(() => data.standingCounts ?? tallyStandings(stars, (id) => graph.itemOf(id)?.standing), [data.standingCounts, stars, graph]);
  const totals = discoveryTotals(data.discovery);
  // nothing discovered: no entry in any standing but "undiscovered"
  const empty = STANDING_ORDER.filter((s) => s !== "not-seen").every((s) => !(counts[s] ?? 0));
  // the panels fold away, so the sky is most of the page
  const [details, setDetails] = useState(false);
  // the legend is the filter: everything but "undiscovered" to start
  const { selected, toggle, singled, setSingled, lookOf } = useStandingFilter();

  return (
    <SkyPageShell title="Planetarium" height={height}>
      <div className="relative flex min-h-[160px] flex-1 overflow-hidden rounded-2xl border border-sky-line">
        <SkyField items={data.items} roots={data.roots} firmament={data.firmament} focus={1120} openOn={openOn} graph={graph} interactive fill lookOf={lookOf} label="Every constellation you have learned, scattered across the sky" />
        {empty && (
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-3 p-8 text-center">
            <p className="font-sky-display text-2xl">You haven&apos;t discovered anything yet.</p>
            <p className="text-[14px] text-sky-muted">Go to the observatory to explore.</p>
            <SkyButton href={observatoryHref} className="pointer-events-auto mt-1">Explore</SkyButton>
          </div>
        )}
      </div>
      <StandingLegend className="mt-3" counts={counts} onHover={setSingled} hovered={singled} onToggle={toggle} selected={selected} info />

      <div className="mt-4 flex max-h-[60%] shrink-0 flex-col">
        <button
          type="button"
          onClick={() => setDetails((d) => !d)}
          aria-expanded={details}
          aria-controls="sky-home-details"
          className={`${SURFACE} flex w-full shrink-0 items-center justify-between gap-4 px-5 py-3 text-left hover:bg-sky-card`}
        >
          <Eyebrow size="md" className="mb-0">Details</Eyebrow>
          <span className="flex items-center gap-3 text-[13px] tabular-nums text-sky-muted">
            {totals.total > 0 && <span>{totals.discovered.toLocaleString()} of {totals.total.toLocaleString()} Discovered</span>}
            <span aria-hidden className="text-sky-ink">{details ? "Hide" : "Show"}</span>
          </span>
        </button>
        {details && (
          <div id="sky-home-details" className="mt-4 grid min-h-0 gap-4 md:grid-cols-2 md:grid-rows-[minmax(0,1fr)]">
            <DiscoveryPanel className="min-h-0 overflow-y-auto" rows={data.discovery} />
            <MixUpsPanel className="min-h-0 overflow-y-auto" pairs={data.mixUps} itemOf={graph.itemOf} onClear={onClearMixUp} />
          </div>
        )}
      </div>
    </SkyPageShell>
  );
}
