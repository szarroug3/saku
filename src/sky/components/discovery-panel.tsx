// "How much you've discovered": how far the learner has got in each subject,
// as "x of y" rows with a thin bar, grouped the way the app already groups
// them (Kana with Hiragana and Katakana under it, and so on). Sam's call
// (2026-09-04): the breakdown by subject over the breakdown by standing,
// because it says how much of the language the learner has really reached.
// Standings live on the sky itself: hover a word in the legend and the
// stars of that standing are the only ones left lit.

import { japaneseFont } from "@/sky/lib/japanese";

export interface DiscoveryRow {
  label: string;
  discovered: number;
  total: number;
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

function Bar({ discovered, total }: { discovered: number; total: number }) {
  const share = total > 0 ? Math.min(1, discovered / total) : 0;
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-sky-card-strong" aria-hidden>
      <div className={`h-full rounded-full bg-sky-star-mid ${discovered > 0 ? "min-w-[2px]" : ""}`} style={{ width: `${share * 100}%` }} />
    </div>
  );
}

/** One row of the list's shared grid: the list is the grid, so every row's
 * bar and count line up in the same columns. */
function Row({ row, child = false }: { row: DiscoveryRow; child?: boolean }) {
  return (
    <li className="contents">
      <span className={`truncate ${child ? "pl-6 text-sky-muted" : "text-sky-ink"} ${japaneseFont(row.label)}`}>{row.label}</span>
      <Bar discovered={row.discovered} total={row.total} />
      <span className="text-right tabular-nums text-sky-muted">{row.discovered.toLocaleString()} of {row.total.toLocaleString()}</span>
    </li>
  );
}

export function DiscoveryPanel({ rows, title = "How much you've discovered", className = "" }: DiscoveryPanelProps) {
  const { discovered, total } = discoveryTotals(rows);
  return (
    <section className={`rounded-2xl border border-sky-line bg-sky-card p-5 font-sky-ui text-sky-ink ${className}`}>
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h2 className="text-[12px] font-semibold uppercase tracking-[0.14em] text-sky-muted">{title}</h2>
        <span className="text-[13px] tabular-nums text-sky-muted">{discovered.toLocaleString()} of {total.toLocaleString()} Discovered</span>
      </div>
      <ul className="mt-4 grid grid-cols-[minmax(0,1fr)_minmax(80px,160px)_max-content] items-center gap-x-4 gap-y-2.5 text-[14px]">
        {rows.flatMap((row) => [
          <Row key={row.label} row={row} />,
          ...(row.children ?? []).map((c) => <Row key={`${row.label}/${c.label}`} row={c} child />),
        ])}
      </ul>
    </section>
  );
}
