// The standing legend and chip: the only two places a standing's colour is
// painted as a dot. Tracked as SAK-294.
//
// THE RULE: a bare coloured dot never appears without its word. That is why
// the dot itself is not exported. A chip is a dot with its label, a legend is
// every dot with its label, and anything else that wants to colour by standing
// (a star fill, a coverage bar segment) sits next to one of these.

import type { ReactNode } from "react";

import { STANDING, STANDING_ORDER, type Standing } from "@/sky/lib/standing";

function Dot({ standing, className = "" }: { standing: Standing; className?: string }) {
  return <span aria-hidden className={`inline-block h-2.5 w-2.5 shrink-0 rounded-full ${STANDING[standing].dot} ${className}`} />;
}

/** A standing as a worded chip: dot, word, and optionally a count. */
export function StandingChip({ standing, count, title }: { standing: Standing; count?: number; title?: string }) {
  const s = STANDING[standing];
  return (
    <span
      title={title ?? s.meaning}
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 font-sky-ui text-[12.5px] font-semibold ${s.border} ${s.text}`}
    >
      <Dot standing={standing} />
      {s.label}
      {count !== undefined && <span className="font-normal tabular-nums text-sky-muted">{count}</span>}
    </span>
  );
}

/** An extra row a legend can carry beside the standings: the lesson's
 * "tonight" and "lit", which are visual states, not standings, and so bring
 * their own swatch. */
export interface LegendExtra {
  label: string;
  swatch: ReactNode;
}

export interface StandingLegendProps {
  /** Which standings to list, in this order. Default: all six, best first. */
  standings?: readonly Standing[];
  /** Counts to show beside each word, when the legend doubles as a tally. */
  counts?: Partial<Record<Standing, number>>;
  /** Rows after the standings, for the lesson's own states. */
  extra?: LegendExtra[];
  className?: string;
}

/** Every dot with its word. Put one wherever standings are painted. */
export function StandingLegend({ standings = STANDING_ORDER, counts, extra = [], className = "" }: StandingLegendProps) {
  return (
    <dl className={`flex flex-wrap gap-x-4 gap-y-1.5 font-sky-ui text-[12.5px] text-sky-muted ${className}`}>
      {standings.map((standing) => (
        <div key={standing} className="inline-flex items-center gap-1.5" title={STANDING[standing].meaning}>
          <Dot standing={standing} />
          <dt className="text-sky-ink">{STANDING[standing].label}</dt>
          {counts?.[standing] !== undefined && <dd className="tabular-nums">{counts[standing]}</dd>}
        </div>
      ))}
      {extra.map((row) => (
        <div key={row.label} className="inline-flex items-center gap-1.5">
          <span aria-hidden className="inline-flex h-2.5 w-2.5 items-center justify-center">{row.swatch}</span>
          <dt className="text-sky-ink">{row.label}</dt>
        </div>
      ))}
    </dl>
  );
}
