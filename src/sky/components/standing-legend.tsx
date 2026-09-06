"use client";

// The standing legend and chip: the only two places a standing's colour is
// painted as a dot. Tracked as SAK-294.
//
// THE RULE: a bare coloured dot never appears without its word. That is why
// the dot itself is not exported. A chip is a dot with its label, a legend is
// every dot with its label, and anything else that wants to colour by standing
// (a star fill, a coverage bar segment) sits next to one of these.

import { useRef, useState, type ReactNode } from "react";

import { useEqualChips } from "@/sky/components/chip-row";
import { aboveAnchor, Floating, SkyCard, type Anchor } from "@/sky/components/sky-card";
import type { CoverageCounts } from "@/sky/lib/coverage";
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
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 font-sky-ui text-[12.5px] font-semibold capitalize ${s.border} ${s.text}`}
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
  /** An "i" after the words: hover or focus it for what each standing means. */
  info?: boolean;
  /** The collections, as a second row of the same chips: a standing hides a
   * star inside its constellation, a collection takes the whole
   * constellation out of the sky. */
  groups?: readonly LegendGroup[];
  onGroup?: (id: string) => void;
  /** A line under the rows: what showing more of the sky at once costs. */
  note?: ReactNode;
  className?: string;
}

/** One collection in the second row: its name, how many constellations it
 * puts in the sky, and whether it is shown. */
export interface LegendGroup {
  id: string;
  label: string;
  count: number;
  on: boolean;
}

/** The mark on a note that warns, drawn rather than typed so it sits with
 * the text whatever the font does (the app's own mark, like the legend's "i"). */
export function WarnMark({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 14 13" aria-hidden className={`size-3.5 shrink-0 ${className}`}>
      <path d="M7 1.2 13 12H1Z" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
      <rect x="6.35" y="5" width="1.3" height="3.7" rx="0.65" fill="currentColor" />
      <circle cx="7" cy="10.2" r="0.78" fill="currentColor" />
    </svg>
  );
}

/** A quiet warning line: the mark in the shaky amber, the words muted. */
export function SkyWarning({ children }: { children: ReactNode }) {
  return (
    <p className="inline-flex items-center gap-1.5 font-sky-ui text-[12px] text-sky-muted">
      <WarnMark className="text-sky-shaky" />
      {children}
    </p>
  );
}

/** What each standing means, one line per standing: the card behind the
 * legend's "i", and anywhere else the words need spelling out. */
export function StandingKey({ standings = STANDING_ORDER, className = "" }: { standings?: readonly Standing[]; className?: string }) {
  return (
    <dl className={`grid grid-cols-[max-content_1fr] gap-x-3 gap-y-1.5 font-sky-ui text-[12.5px] text-sky-ink ${className}`}>
      {standings.map((standing) => (
        <div key={standing} className="contents">
          <dt className="inline-flex items-center gap-1.5 capitalize">
            <Dot standing={standing} />
            <span className={STANDING[standing].text}>{STANDING[standing].label}</span>
          </dt>
          <dd className="text-sky-muted">{STANDING[standing].meaning}</dd>
        </div>
      ))}
    </dl>
  );
}

/** Counts by standing as words: "12 solid, 3 shaky", numbers lined up on
 * the right, each word in its colour and so no dot. Only the standings
 * that have any, in legend order. */
export function StandingTally({ counts, standings = STANDING_ORDER, empty = "Nothing yet", className = "" }: { counts: CoverageCounts; standings?: readonly Standing[]; empty?: string; className?: string }) {
  const lines = standings.filter((s) => (counts[s] ?? 0) > 0);
  if (lines.length === 0) return <div className={`text-sky-muted ${className}`}>{empty}</div>;
  return (
    <dl className={`grid grid-cols-[max-content_max-content] gap-x-2 gap-y-0.5 ${className}`}>
      {lines.map((s) => (
        <div key={s} className="contents">
          <dd className="text-right tabular-nums">{(counts[s] ?? 0).toLocaleString()}</dd>
          <dt className={`capitalize ${STANDING[s].text}`}>{STANDING[s].label}</dt>
        </div>
      ))}
    </dl>
  );
}

/** The legend's "i": the key opens above it on hover or focus, above
 * because the legend usually sits at the bottom of a sky with nothing below
 * to spill into. */
function InfoButton({ standings }: { standings: readonly Standing[] }) {
  const button = useRef<HTMLButtonElement>(null);
  const [at, setAt] = useState<Anchor | null>(null);
  const open = () => { const r = button.current?.getBoundingClientRect(); if (r) setAt(aboveAnchor(r)); };
  const close = () => setAt(null);
  return (
    <div className="inline-flex items-center" onPointerEnter={open} onPointerLeave={close}>
      <button
        ref={button}
        type="button"
        aria-expanded={at !== null}
        aria-controls="sky-standing-key"
        onFocus={open}
        onBlur={close}
        onClick={() => (at ? close() : open())}
        aria-label="What the standings mean"
        className={`inline-flex size-3.5 items-center justify-center rounded-full border border-sky-accent text-sky-accent hover:bg-sky-accent/15 ${at ? "bg-sky-accent/15" : ""}`}
      >
        {/* the i is drawn, not typed, so it sits dead centre whatever the font does (the app's own mark) */}
        <svg viewBox="0 0 10 10" aria-hidden className="size-[7px] fill-current">
          <circle cx="5" cy="1.6" r="1.15" />
          <rect x="4.05" y="3.7" width="1.9" height="5.2" rx="0.7" />
        </svg>
      </button>
      {at && (
        <Floating id="sky-standing-key" at={at} gap={8} className="w-max max-w-[min(420px,calc(100vw-16px))]">
          <SkyCard className="px-3 py-2.5"><StandingKey standings={standings} /></SkyCard>
        </Floating>
      )}
    </div>
  );
}

/** Every dot with its word. Put one wherever standings are painted. */
export function StandingLegend({ standings = STANDING_ORDER, counts, extra = [], onHover, hovered = null, onToggle, selected, info = false, groups, onGroup, note, className = "" }: StandingLegendProps) {
  const live = Boolean(onHover);
  const clickable = Boolean(onToggle);
  // every chip on both rows one width (Sam, 2026-09-06)
  const box = useEqualChips<HTMLDListElement>(true);
  return (
    <dl ref={box} className={`flex flex-wrap items-center gap-x-2 gap-y-1.5 font-sky-ui text-[12.5px] text-sky-muted ${className}`}>
      {standings.map((standing) => {
        const n = counts ? (counts[standing] ?? 0) : undefined;
        const on = hovered === standing;
        const picked = selected?.has(standing) ?? false;
        const Row = clickable ? "button" : "div";
        return (
          <Row
            key={standing}
            data-sky-chip=""
            type={clickable ? "button" : undefined}
            aria-pressed={clickable ? picked : undefined}
            onClick={clickable ? () => onToggle?.(standing) : undefined}
            className={`relative inline-flex items-center gap-1.5 rounded-md border px-1.5 py-0.5 ${clickable ? "cursor-pointer" : live ? "cursor-default" : ""} ${picked ? "border-sky-accent bg-sky-card-strong" : on ? "border-transparent bg-sky-card-strong" : clickable ? "border-transparent bg-sky-card" : "border-transparent"}`}
            title={clickable ? (picked ? `Hide ${STANDING[standing].label}` : `Show ${STANDING[standing].label}`) : live ? undefined : STANDING[standing].meaning}
            onPointerEnter={live ? () => onHover?.(standing) : undefined}
            onPointerLeave={live ? () => onHover?.(null) : undefined}
            onFocus={live ? () => onHover?.(standing) : undefined}
            onBlur={live ? () => onHover?.(null) : undefined}
            tabIndex={live && !clickable ? 0 : undefined}
          >
            <Dot standing={standing} />
            <dt className="capitalize text-sky-ink">{STANDING[standing].label}</dt>
            {n !== undefined && <dd className="ml-auto pl-2 tabular-nums">{n.toLocaleString()}</dd>}
          </Row>
        );
      })}
      {extra.map((row) => (
        <div key={row.label} className="inline-flex items-center gap-1.5">
          <span aria-hidden className="inline-flex h-2.5 w-2.5 items-center justify-center">{row.swatch}</span>
          <dt className="capitalize text-sky-ink">{row.label}</dt>
        </div>
      ))}
      {info && <InfoButton standings={standings} />}
      {groups && groups.length > 0 && (
        <>
          {/* a break, so the collections start their own row and are still
              measured with the standings above them */}
          <span aria-hidden className="basis-full" />
          {groups.map((g) => (
            <button
              key={g.id}
              data-sky-chip=""
              type="button"
              aria-pressed={g.on}
              onClick={() => onGroup?.(g.id)}
              title={g.on ? `Take ${g.label} out of the sky` : `Put ${g.label} back in the sky`}
              className={`relative inline-flex cursor-pointer items-center gap-1.5 rounded-md border px-1.5 py-0.5 ${g.on ? "border-sky-accent bg-sky-card-strong" : "border-transparent bg-sky-card"}`}
            >
              <dt className={g.on ? "text-sky-ink" : ""}>{g.label}</dt>
              <dd className="ml-auto pl-2 tabular-nums">{g.count.toLocaleString()}</dd>
            </button>
          ))}
        </>
      )}
      {note && <><span aria-hidden className="basis-full" />{note}</>}
    </dl>
  );
}
