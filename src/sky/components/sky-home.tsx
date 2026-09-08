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

import { useCallback, useMemo, useState } from "react";

import type { StarLook } from "@/sky/components/constellation";
import { DiscoveryPanel, discoveryTotals, type DiscoveryRow } from "@/sky/components/discovery-panel";
import { MixUpsPanel, type MixUp } from "@/sky/components/mix-ups-panel";
import { ResumeLine } from "@/sky/components/quiz-resume";
import { SkyField } from "@/sky/components/sky-field";
import { bodyOf, type Body } from "@/sky/lib/constellation";
import { Eyebrow } from "@/sky/components/sky-card";
import { SURFACE } from "@/sky/components/sky-panel";
import { RoundButton, SkyButton } from "@/sky/components/sky-button";
import { SkyPageShell } from "@/sky/components/sky-page-shell";
import { SkyWarning, StandingLegend } from "@/sky/components/standing-legend";
import { useSkyFilter } from "@/sky/components/use-sky-filter";
import { groupOf, SKY_GROUPS, type SkyGroup } from "@/sky/lib/groups";
import type { CoverageCounts } from "@/sky/lib/coverage";
import { STANDING_ORDER } from "@/sky/lib/standing";
import { buildGraph } from "@/sky/lib/graph";
import { skyStars, tallyStandings } from "@/sky/lib/sky-scene";
import type { SavedRun } from "@/sky/lib/quiz-run";
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
  /** A quiz left part way through, offered back beside the heading (SAK-404).
   * The href is the route's, since only it knows what a Sky URL looks like
   * (SAK-367). Absent when there is nothing to come back to, which is the
   * usual case, and then the heading is the heading. */
  resume?: { run: SavedRun; href: string };
  /** How tall the home is: one page, never scrolling. The sky fills what
   * the heading and the details leave, and shrinks when the details open.
   * A CSS length, passed on to the page frame, which has the default. */
  height?: string;
}

export function SkyHome({ data, observatoryHref = "/observatory", onClearMixUp, resume, height }: SkyHomeProps) {
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
  // the legend is the filter: every collection, and every standing but
  // "undiscovered", to start
  const { selected, toggle, singled, setSingled, groups, toggleGroup, lookOf: byStanding } = useSkyFilter();
  // A collection turned off is out of the sky WHEREVER it appears: not as a
  // constellation of its own, and not as a piece of another one either
  // (Sam, 2026-09-06: with Kanji off, a word's kanji should not be up
  // there, part of its constellation or not). A word with its kanji hidden
  // is then the one star it is, which is what "only words" asks for.
  const lookOf = useCallback((id: string, base: StarLook): StarLook => {
    const kind = graph.itemOf(id)?.kind;
    const group = kind ? groupOf(kind) : null;
    if (group !== null && !groups.has(group)) return { ...base, hidden: true };
    return byStanding(id, base);
  }, [graph, groups, byStanding]);
  // how much each collection holds, so the cost of showing it is on its own
  // chip. Counted over the items rather than the constellations: a piece is
  // never a constellation of its own and still lights up inside every kanji
  // and word built from it, so counting constellations would call it empty.
  const groupRows = useMemo(() => {
    const n = new Map<SkyGroup, number>();
    for (const item of data.items) {
      const group = groupOf(item.kind);
      if (group) n.set(group, (n.get(group) ?? 0) + 1);
    }
    return SKY_GROUPS.filter((g) => (n.get(g.id) ?? 0) > 0).map((g) => ({ id: g.id, label: g.label, count: n.get(g.id) ?? 0, on: groups.has(g.id) }));
  }, [data.items, groups]);

  return (
    <SkyPageShell eyebrow="Planetarium" title="What have you discovered?" aside={resume && <ResumeLine run={resume.run} href={resume.href} />} height={height}>
      {/* the box is the wash's colour with none of its stars (.sky-wash-clear),
          so the learner's own stars are the only stars in it: with one or two
          discovered they were lost among the background's (Sam, 2026-09-06) */}
      <div className="sky-wash-clear relative flex min-h-[160px] flex-1 overflow-hidden rounded-2xl border border-sky-line">
        <SkyField items={data.items} roots={data.roots} firmament={data.firmament} focus={1120} openOn={openOn} graph={graph} interactive fill lookOf={lookOf} label="Every constellation the sky holds, scattered across it, lit as you learn them" />
        {empty && (
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-3 p-8 text-center">
            <p className="font-sky-display text-2xl">You haven&apos;t discovered anything yet.</p>
            <p className="text-[14px] text-sky-muted">Go to the observatory to explore.</p>
            <SkyButton href={observatoryHref} className="pointer-events-auto mt-1">Explore</SkyButton>
          </div>
        )}
      </div>
      <StandingLegend
        className="mt-3"
        counts={counts}
        onHover={setSingled}
        hovered={singled}
        onToggle={toggle}
        selected={selected}
        info
        groups={groupRows}
        onGroup={(id) => toggleGroup(id as SkyGroup)}
        note={<SkyWarning>Showing more at once makes the sky slower to draw.</SkyWarning>}
      />

      <div className="mt-4 flex max-h-[60%] shrink-0 flex-col">
        {/* the round button is the only way to open this, as it is for every
            fold in the Sky (SAK-412); the words beside it are the section's
            name and its count, which no glyph can say */}
        <div className={`${SURFACE} flex w-full shrink-0 items-center justify-between gap-4 px-5 py-3 text-left`}>
          <Eyebrow size="md" className="mb-0">Details</Eyebrow>
          <span className="flex items-center gap-3 text-[13px] tabular-nums text-sky-muted">
            {totals.total > 0 && <span>{totals.discovered.toLocaleString()} of {totals.total.toLocaleString()} Discovered</span>}
            <RoundButton
              label={details ? "Hide the details" : "Show the details"}
              expanded={details}
              controls="sky-home-details"
              onClick={() => setDetails((d) => !d)}
            >
              ⌃
            </RoundButton>
          </span>
        </div>
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
