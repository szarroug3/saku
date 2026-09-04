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
  /** Called with the standing under the pointer, and null when it leaves,
   * so a sky beside the legend can single those stars out. */
  onHover?: (standing: Standing | null) => void;
  /** The standing currently singled out, shown as the active row. */
  hovered?: Standing | null;
  /** Click a word to show only that standing (several can be on); click
   * again to turn it off. With `onToggle` the rows are buttons. */
  onToggle?: (standing: Standing) => void;
  selected?: ReadonlySet<Standing>;
  className?: string;
}

/** Every dot with its word. Put one wherever standings are painted. */
export function StandingLegend({ standings = STANDING_ORDER, counts, extra = [], onHover, hovered = null, onToggle, selected, className = "" }: StandingLegendProps) {
  const live = Boolean(onHover);
  const clickable = Boolean(onToggle);
  return (
    <dl className={`flex flex-wrap gap-x-4 gap-y-1.5 font-sky-ui text-[12.5px] text-sky-muted ${className}`}>
      {standings.map((standing) => {
        const n = counts?.[standing];
        const on = hovered === standing;
        const picked = selected?.has(standing) ?? false;
        const Row = clickable ? "button" : "div";
        return (
          <Row
            key={standing}
            type={clickable ? "button" : undefined}
            aria-pressed={clickable ? picked : undefined}
            onClick={clickable ? () => onToggle?.(standing) : undefined}
            className={`relative inline-flex items-center gap-1.5 rounded-md border px-1.5 py-0.5 ${clickable ? "cursor-pointer" : live ? "cursor-default" : ""} ${picked ? "border-sky-line bg-sky-card-strong" : on ? "border-transparent bg-sky-card" : "border-transparent"} ${clickable && !picked ? "opacity-55" : ""}`}
            title={clickable ? (picked ? `Hide ${STANDING[standing].label}` : `Show ${STANDING[standing].label}`) : live ? undefined : STANDING[standing].meaning}
            onPointerEnter={live ? () => onHover?.(standing) : undefined}
            onPointerLeave={live ? () => onHover?.(null) : undefined}
            onFocus={live ? () => onHover?.(standing) : undefined}
            onBlur={live ? () => onHover?.(null) : undefined}
            tabIndex={live && !clickable ? 0 : undefined}
          >
            <Dot standing={standing} />
            <dt className="capitalize text-sky-ink">{STANDING[standing].label}</dt>
            {n !== undefined && <dd className="tabular-nums">{n}</dd>}
          </Row>
        );
      })}
      {extra.map((row) => (
        <div key={row.label} className="inline-flex items-center gap-1.5">
          <span aria-hidden className="inline-flex h-2.5 w-2.5 items-center justify-center">{row.swatch}</span>
          <dt className="capitalize text-sky-ink">{row.label}</dt>
        </div>
      ))}
    </dl>
  );
}
