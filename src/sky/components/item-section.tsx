"use client";

// The titled group an ItemCard sits inside. Built once so a new section is data
// rather than markup. Tracked as SAK-293.
//
// This carries more than a heading, because three ItemCard decisions pushed work
// down into it:
//
//   - the card has NO type label, so this header is the only thing saying what
//     these are;
//   - the card has NO locked state, because the Planetarium lists only what you can
//     take, so "why is the G row not here yet" is a question the SECTION answers;
//   - the card has NO status, so in the Atlas that lives in the furniture
//     beside this component.
//
// Which means the honesty of the Planetarium mostly lives here now. A section that
// quietly shows six of two thousand words, or hides a gate without saying what
// it is waiting for, is the failure mode this component exists to prevent.

import type { ReactNode } from "react";

export interface ItemSectionProps {
  title: string;
  /** One line explaining the section's rule, when it has one worth stating. */
  hint?: string;
  /**
   * How many items this section is showing right now. Always derived by the
   * caller from the data, never written as a literal, so it stays true as the
   * cart changes.
   */
  shown?: number;
  /**
   * How many exist in total, when that is larger than `shown`.
   *
   * Without it, "6 words" reads as "6 words exist" rather than "6 of 12,500 you
   * can take next", which is the single most misleading thing this page could
   * say. Given it, the count says so.
   */
  total?: number;
  /**
   * Set when the whole section is locked. The requirement is worded, never
   * implied by absence, and `progress` draws how close you are.
   */
  gate?: {
    /** What is being waited on, in the learner's terms. */
    requirement: string;
    /** Optional progress toward it, e.g. 27 of 40 words learned. */
    progress?: { have: number; need: number; unit: string };
  };
  children?: ReactNode;
}

export function ItemSection({ title, hint, shown, total, gate, children }: ItemSectionProps) {
  const locked = Boolean(gate);
  const isCapped = total !== undefined && shown !== undefined && total > shown;

  return (
    <section className="mt-6 first:mt-0">
      <div className="flex items-baseline justify-between gap-4 border-b border-border/60 pb-1.5">
        <h3
          className={`text-[11px] font-semibold uppercase tracking-[0.1em] ${
            locked ? "text-text-muted/70" : "text-text-muted"
          }`}
        >
          {title}
        </h3>

        {/* The count. "next 6 of 12,500" rather than "6", because the second one
            is a claim about how much Japanese there is. */}
        {shown !== undefined && !locked ? (
          <span className="shrink-0 text-[10.5px] tabular-nums text-text-muted/70">
            {isCapped ? (
              <>
                next <span className="text-text-muted">{shown}</span> of{" "}
                {total!.toLocaleString()}
              </>
            ) : (
              <>
                <span className="text-text-muted">{shown}</span>{" "}
                {shown === 1 ? "to take" : "to take"}
              </>
            )}
          </span>
        ) : null}
      </div>

      {hint ? (
        <p className="mt-1.5 max-w-[76ch] text-[11.5px] leading-relaxed text-text-muted/80">
          {hint}
        </p>
      ) : null}

      {locked ? <Gate gate={gate!} /> : <div className="mt-2.5">{children}</div>}
    </section>
  );
}

/**
 * A locked section says what it is waiting for and how close you are.
 *
 * Dashed and unfilled, the same language a locked thing used on the card before
 * locking moved up here, so the two read as the same idea at different scales.
 */
function Gate({ gate }: { gate: NonNullable<ItemSectionProps["gate"]> }) {
  const p = gate.progress;
  const pct = p ? Math.max(0, Math.min(100, Math.round((p.have / p.need) * 100))) : null;

  return (
    <div className="mt-2.5 rounded-xl border border-dashed border-border px-4 py-3.5">
      <p className="text-[12.5px] leading-relaxed text-text-muted">{gate.requirement}</p>

      {p ? (
        <div className="mt-2.5 flex items-center gap-3">
          <div className="h-1 flex-1 overflow-hidden rounded-full bg-panel">
            <div className="h-full rounded-full bg-accent" style={{ width: `${pct}%` }} />
          </div>
          <span className="shrink-0 text-[10.5px] tabular-nums text-text-muted/80">
            {p.have} of {p.need} {p.unit}
          </span>
        </div>
      ) : null}
    </div>
  );
}
