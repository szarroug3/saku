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
import type { CoverageCounts } from "@/sky/lib/coverage";
import { japaneseFont } from "@/sky/lib/japanese";
import { STANDING, STANDING_ORDER } from "@/sky/lib/standing";

export interface DiscoveryRow {
  label: string;
  discovered: number;
  total: number;
  /** The subject's entries by standing, for the bar and its hover. */
  counts?: CoverageCounts;
  children?: readonly DiscoveryRow[];
}

export interface DiscoveryPanelProps {
  rows: readonly DiscoveryRow[];
  title?: string;
  className?: string;
}

/** The whole panel's "x of y", summed over the top-level rows. */
export function discoveryTotals(rows: readonly DiscoveryRow[]): { discovered: number; total: number } {
  return rows.reduce((sum, r) => ({ discovered: sum.discovered + r.discovered, total: sum.total + r.total }), { discovered: 0, total: 0 });
}

interface Hover { row: DiscoveryRow; x: number; y: number }

/** One row of the list's shared grid: the list is the grid, so every row's
 * bar and count line up in the same columns. */
function Row({ row, child = false, onHover }: { row: DiscoveryRow; child?: boolean; onHover: (h: Hover | null) => void }) {
  const move = (e: React.PointerEvent) => onHover({ row, x: e.clientX, y: e.clientY });
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

/** The numbers behind a bar: each standing that has any, in legend order,
 * undiscovered last. */
function Breakdown({ row }: { row: DiscoveryRow }) {
  const counts = row.counts ?? {};
  const lines = STANDING_ORDER.filter((s) => (counts[s] ?? 0) > 0);
  return (
    <div className="rounded-xl border border-sky-line bg-sky-ground-0 px-3 py-2 font-sky-ui text-[12.5px] text-sky-ink shadow-[0_8px_24px_rgba(0,0,0,0.4)]">
      <div className={`mb-1 text-[10.5px] font-semibold uppercase tracking-[0.12em] text-sky-muted ${japaneseFont(row.label)}`}>{row.label}</div>
      {lines.length === 0 ? (
        <div className="text-sky-muted">Nothing here yet</div>
      ) : (
        <ul className="flex flex-col gap-0.5">
          {lines.map((s) => (
            <li key={s} className="flex items-center gap-2">
              <span aria-hidden className={`inline-block h-2 w-2 rounded-full ${STANDING[s].dot}`} />
              <span className="min-w-[3ch] text-right tabular-nums">{(counts[s] ?? 0).toLocaleString()}</span>
              <span className={`capitalize ${STANDING[s].text}`}>{STANDING[s].label}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function DiscoveryPanel({ rows, title = "How much you've discovered", className = "" }: DiscoveryPanelProps) {
  const { discovered, total } = discoveryTotals(rows);
  const [hover, setHover] = useState<Hover | null>(null);
  return (
    <section className={`rounded-2xl border border-sky-line bg-sky-card p-5 font-sky-ui text-sky-ink ${className}`}>
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h2 className="text-[12px] font-semibold uppercase tracking-[0.14em] text-sky-muted">{title}</h2>
        <span className="text-[13px] tabular-nums text-sky-muted">{discovered.toLocaleString()} of {total.toLocaleString()} Discovered</span>
      </div>
      <ul className="mt-4 grid grid-cols-[minmax(0,1fr)_minmax(80px,160px)_max-content] items-center gap-x-4 gap-y-2.5 text-[14px]">
        {rows.flatMap((row) => [
          <Row key={row.label} row={row} onHover={setHover} />,
          ...(row.children ?? []).map((c) => <Row key={`${row.label}/${c.label}`} row={c} child onHover={setHover} />),
        ])}
      </ul>
      {/* fixed to the viewport, so the details region's own scrolling never clips it */}
      {hover && (
        <div role="tooltip" className="pointer-events-none fixed z-50" style={{ left: hover.x + 14, top: hover.y + 14 }}>
          <Breakdown row={hover.row} />
        </div>
      )}
    </section>
  );
}
