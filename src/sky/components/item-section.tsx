"use client";

// The titled group an ItemCard sits inside: one per kind of thing. Built
// once so a new section is data rather than markup. Tracked as SAK-293 and
// SAK-301.
//
// A section says what this kind of thing IS, when to start it, and offers a
// way in (Sam's rule, 2026-09-04): "Kana are the sounds of Japanese... Learn
// them first" with a Start button, then the next few things to take. A
// section that has not opened yet says what it is waiting for and how close
// you are, and shows nothing to take: nothing locked is ever listed, and
// nothing hidden is ever unexplained.
//
// The card has no type label (the section is per type), no status (the Atlas
// carries that in its furniture) and no locked state on this page (what
// cannot be taken is not shown), so the honesty of the Planetarium lives here.

import type { ReactNode } from "react";

export interface ItemSectionProps {
  title: string;
  /** What this kind of thing is, in one or two sentences. */
  intro?: string;
  /** When to start it: "Learn these first. They are what lets you read." */
  when?: string;
  /** The way in: a button after the intro, "Start kana". */
  start?: { label: string; onClick: () => void; disabled?: boolean };
  /** A second, quieter button beside Start, when a page has one. */
  claim?: { label: string; onClick: () => void; disabled?: boolean };
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

export function ItemSection({ title, intro, when, start, claim, shown, total, gate, children }: ItemSectionProps) {
  const locked = Boolean(gate);
  const isCapped = total !== undefined && shown !== undefined && total > shown;

  return (
    <section className="mt-7 font-sky-ui first:mt-0">
      <div className="flex items-baseline justify-between gap-4 border-b border-sky-line pb-1.5">
        <h3 className={`text-[13px] font-semibold uppercase tracking-[0.12em] ${locked ? "text-sky-muted" : "text-sky-accent"}`}>{title}</h3>

        {/* The count. "next 6 of 12,500" rather than "6", because the second one
            is a claim about how much Japanese there is. */}
        {shown !== undefined && !locked ? (
          <span className="shrink-0 text-[10.5px] tabular-nums text-sky-muted/70">
            {isCapped ? (
              <>
                next <span className="text-sky-muted">{shown}</span> of {total!.toLocaleString()}
              </>
            ) : (
              <>
                <span className="text-sky-muted">{shown}</span> to take
              </>
            )}
          </span>
        ) : null}
      </div>

      {(intro || when || start || claim) && (
        <div className="mt-2.5 flex flex-wrap items-end justify-between gap-x-6 gap-y-2">
          <div className="max-w-[70ch]">
            {intro && <p className="text-[13.5px] leading-relaxed text-sky-ink">{intro}</p>}
            {when && <p className={`text-[12.5px] leading-relaxed text-sky-muted ${intro ? "mt-1" : ""}`}>{when}</p>}
          </div>
          {(start || claim) && !locked && (
            <div className="flex shrink-0 items-center gap-2">
              {claim && (
                <button
                  type="button"
                  onClick={claim.onClick}
                  disabled={claim.disabled}
                  className="rounded-[10px] border border-sky-line bg-sky-card px-3.5 py-2 text-[13px] font-semibold text-sky-ink hover:bg-sky-card-strong disabled:text-sky-faint"
                >
                  {claim.label}
                </button>
              )}
              {start && (
                <button
                  type="button"
                  onClick={start.onClick}
                  disabled={start.disabled}
                  className="rounded-[10px] bg-sky-accent px-3.5 py-2 text-[13px] font-semibold text-sky-accent-ink disabled:bg-sky-card-strong disabled:text-sky-faint"
                >
                  {start.label}
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {locked ? <Gate gate={gate!} /> : children ? <div className="mt-3">{children}</div> : null}
    </section>
  );
}

/**
 * A locked section says what it is waiting for and how close you are.
 * Dashed and unfilled: the same language a locked thing uses everywhere.
 */
function Gate({ gate }: { gate: NonNullable<ItemSectionProps["gate"]> }) {
  const p = gate.progress;
  const pct = p ? Math.max(0, Math.min(100, Math.round((p.have / p.need) * 100))) : null;

  return (
    <div className="mt-3 rounded-xl border border-dashed border-sky-line px-4 py-3.5">
      <p className="text-[12.5px] leading-relaxed text-sky-muted">{gate.requirement}</p>

      {p ? (
        <div className="mt-2.5 flex items-center gap-3">
          <div className="h-1 flex-1 overflow-hidden rounded-full bg-sky-card-strong">
            <div className="h-full rounded-full bg-sky-accent" style={{ width: `${pct}%` }} />
          </div>
          <span className="shrink-0 text-[10.5px] tabular-nums text-sky-muted/80">
            {p.have} of {p.need} {p.unit}
          </span>
        </div>
      ) : null}
    </div>
  );
}
