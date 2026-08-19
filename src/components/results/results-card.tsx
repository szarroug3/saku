"use client";

// The one "how did it go" card, shared by every results screen: the practice
// Results page, a round's fork, and the end of a taught or Quiz-me session.
// Same ring, same headline/detail/counts sentence (see summary.ts's
// summarize), same shape — only what sits in the trailing slot (a "Save as a
// list" button, or nothing) differs per screen.

import { AccuracyRing } from "@/components/home/accuracy-ring";
import { Card } from "@/components/ui";
import type { Bit } from "@/components/results/summary";
import type { ReactNode } from "react";

/**
 * Accuracy as a filled arc — the same read as Home's deck rings, at hero size.
 *
 * Green at 100%: the one moment the ring is reporting an achievement rather
 * than a measurement.
 */
export function BigRing({ pct }: { pct: number | null }) {
  return (
    <AccuracyRing
      pct={pct}
      unpractised="hidden"
      size={78}
      stroke={7.5}
      arc={pct === 100 ? "var(--success)" : "var(--arc)"}
      labelClassName="text-[17px] font-semibold tabular-nums"
    />
  );
}

/** A generated sentence, with the characters your eye should land on. */
export function Line({ bits, className }: { bits: Bit[]; className?: string }) {
  return (
    <span className={className}>
      {bits.map((b, i) =>
        b.em ? (
          <b key={i} className="font-kana font-medium text-text">
            {b.t}
          </b>
        ) : (
          <span key={i}>{b.t}</span>
        ),
      )}
    </span>
  );
}

export function ResultsCard({
  pct,
  headline,
  detail,
  counts,
  trailing,
}: {
  pct: number | null;
  headline: string;
  detail?: Bit[] | null;
  counts: Bit[];
  /** e.g. "Save as a list" — omitted where a screen has nothing to put here. */
  trailing?: ReactNode;
}) {
  return (
    <Card className="flex items-center gap-3.5">
      <BigRing pct={pct} />
      <span className="flex min-w-0 flex-col gap-0.5">
        <span className="text-[15px] font-semibold">{headline}</span>
        {detail ? <Line bits={detail} className="text-[13px] text-text-muted" /> : null}
        <Line bits={counts} className="text-[13px] text-text-muted" />
      </span>
      {trailing ? (
        <span className="ml-auto shrink-0 self-start">{trailing}</span>
      ) : null}
    </Card>
  );
}
