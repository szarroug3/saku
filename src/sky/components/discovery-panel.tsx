"use client";

// "How much you've discovered": how far the learner has got in each subject,
// as "x of y" rows with a bar, grouped the way the app already groups them
// (Kana with Hiragana and Katakana under it, and so on). Sam's call
// (2026-09-04): the breakdown by subject over the breakdown by standing,
// because it says how much of the language the learner has really reached.
// The bar itself is the standing breakdown, in the sky's colours against the
// subject's total, and hovering it gives the numbers: "9 solid, 3 shaky".

import { useState } from "react";

import { CoverageBar } from "@/sky/components/coverage-bar";
import { Eyebrow, Floating, pointerAnchor, SkyCard, type Anchor } from "@/sky/components/sky-card";
import { SkyPanel } from "@/sky/components/sky-panel";
import { StandingTally } from "@/sky/components/standing-legend";
import type { CoverageCounts } from "@/sky/lib/coverage";
import { japaneseFont } from "@/sky/lib/japanese";

export interface DiscoveryRow {
  label: string;
  discovered: number;
  total: number;
  /** The subject's entries by standing, for the bar and its hover. */
  counts?: CoverageCounts;
  children?: readonly DiscoveryRow[];
}

interface DiscoveryPanelProps {
  rows: readonly DiscoveryRow[];
  title?: string;
  className?: string;
}

/** The whole panel's "x of y", summed over the top-level rows. */
export function discoveryTotals(rows: readonly DiscoveryRow[]): { discovered: number; total: number } {
  return rows.reduce((sum, r) => ({ discovered: sum.discovered + r.discovered, total: sum.total + r.total }), { discovered: 0, total: 0 });
}

interface Hover { row: DiscoveryRow; at: Anchor }

/** One row of the list's shared grid: the list is the grid, so every row's
 * bar and count line up in the same columns. */
function Row({ row, child = false, onHover }: { row: DiscoveryRow; child?: boolean; onHover: (h: Hover | null) => void }) {
  const move = (e: React.PointerEvent) => onHover({ row, at: pointerAnchor(e.clientX, e.clientY) });
  return (
    <li className="contents">
      <span className={`truncate ${child ? "pl-6 text-sky-muted" : "text-sky-ink"} ${japaneseFont(row.label)}`}>{row.label}</span>
      <div className="cursor-default py-1" onPointerEnter={move} onPointerMove={move} onPointerLeave={() => onHover(null)}>
        <CoverageBar className="h-2" counts={row.counts ?? {}} total={row.total} label={row.label} />
      </div>
      <span className="text-right tabular-nums text-sky-muted">{row.discovered.toLocaleString()} of {row.total.toLocaleString()}</span>
    </li>
  );
}

export function DiscoveryPanel({ rows, title = "How much you've discovered", className = "" }: DiscoveryPanelProps) {
  const { discovered, total } = discoveryTotals(rows);
  const [hover, setHover] = useState<Hover | null>(null);
  return (
    <SkyPanel title={title} aside={`${discovered.toLocaleString()} of ${total.toLocaleString()} Discovered`} className={className}>
      <ul className="mt-4 grid grid-cols-[minmax(0,1fr)_minmax(80px,160px)_max-content] items-center gap-x-4 gap-y-2.5 text-[14px]">
        {rows.flatMap((row) => [
          <Row key={row.label} row={row} onHover={setHover} />,
          ...(row.children ?? []).map((c) => <Row key={`${row.label}/${c.label}`} row={c} child onHover={setHover} />),
        ])}
      </ul>
      {hover && (
        <Floating at={hover.at}>
          <SkyCard className="px-3 py-2 text-[12.5px]">
            <Eyebrow className={japaneseFont(hover.row.label)}>{hover.row.label}</Eyebrow>
            <StandingTally counts={hover.row.counts ?? {}} empty="Nothing here yet" />
          </SkyCard>
        </Floating>
      )}
    </SkyPanel>
  );
}
