"use client";

// What you are holding — and the one card on this page that moves while you are
// away.
//
// The four counts above the bar are still exactly that: counts, not rates —
// "83 solid" is not a percentage of anything and never becomes one. The bar
// beneath them is different on purpose: it is scaled against `total`, the
// full population those counts are drawn from, with a trailing untouched
// segment for whatever of it you haven't met (see tally.ts's `barSegments`).
// That segment is transparent, not a status colour, so it reads as "not yet
// here" rather than as a fifth condition — the bar is not a rate either, it is
// a proportion, and the two counts above it plus the untouched remainder are
// still the only three things determining any pixel of it.
//
// At real corpus scale this bar is mostly empty for most learners, and that is
// the point rather than a defect to paper over: a five-pixel sliver of colour
// in a mostly-empty bar next to "5 of 2,136" IS what "you've barely started"
// looks like, and it is a more scannable answer to "what's left" than four
// numbers alone. Do not add a minimum segment width to make the sliver more
// visible — see by-subject.tsx, which draws the same bar for the same reason
// and carries the fuller account of why the smudge is accepted, not hidden.
//
// SOLID GOES DOWN, AND THAT IS THE FEATURE
// ========================================
// Every other progress metric this app has tried only climbed — accuracy over
// time rises because the material gets familiar, so it measures how long you
// have been here. This count falls when you stop. It is the only honest thing a
// study app can put on a page called Progress, and it needs no caption saying so:
// you will see it drop, once, and understand it forever.

import { useState } from "react";

import { Info, Lbl } from "@/components/ui";
import { BucketBreakdown } from "@/components/stats/bucket-breakdown";
import {
  barSegments,
  BUCKETS,
  BUCKET_LABEL,
  held,
  type Tally,
} from "@/components/stats/tally";
import type { Standing } from "@/lib/library/standing";
import type { FactId } from "@/types";

export function KnowledgeBase({
  tally,
  total,
  factsByBucket,
}: {
  tally: Tally;
  /** The full fact population `tally` is drawn from — e.g. `ALL_FACTS.length`
   * from src/lib/facts.ts — so the bar can show what's untouched, not just
   * what's held. The four numbers above the bar never use it; they stay
   * counts of `tally` alone. */
  total: number;
  /** SAK-78: the FACTS behind each bucket, in the exact shape `tally` was
   * summed from (tally.ts's `factsByStanding` — the same walk `tally` came
   * from, kept instead of counted). A count becomes clickable only once its
   * caller can hand back what it's a count OF; optional so a page that only
   * wants the totals (none exist yet, but nothing should require this) isn't
   * forced to build the list it will never show. */
  factsByBucket?: Partial<Record<Standing, readonly FactId[]>>;
}) {
  const shown = BUCKETS.filter((b) => tally[b] > 0);
  const heldCount = held(tally);
  const [open, setOpen] = useState<Standing | null>(null);

  return (
    <section>
      <Lbl>What you know</Lbl>

      {heldCount === 0 ? (
        <p className="py-2 text-[13px] text-text-muted">
          Nothing yet. Drill something and it will show up here.
        </p>
      ) : (
        <>
          {/* Smaller digits on a phone. At 44px five counts stack four rows
           * deep and the card runs off the screen before the bar that sums
           * them, which is the one thing that has to be seen with them. */}
          <div className="flex flex-wrap items-end gap-x-[26px] gap-y-3">
            {shown.map((b) => {
              const bucketFacts = factsByBucket?.[b];
              // "Claimed" is the one bucket nothing else on this page
              // explains: it is not earned by drilling, so it needs its
              // own word said out loud, right where the count is, not
              // only on a reference page a reader may never open.
              const claimedInfo =
                b === "claimed" ? (
                  <Info>
                    This shows things that were marked known via &ldquo;I
                    already know this&rdquo; but have not been quizzed yet.
                    It fades back into drilling on its own over time. You
                    can unclaim it from that item&rsquo;s Library page.
                  </Info>
                ) : null;
              // Clickable only when there's a list behind the number to open
              // — a plain <p>, same as before, whenever a caller hasn't wired
              // factsByBucket up (or the fact list came back empty for a
              // bucket the tally still says has something in it, which would
              // mean the two disagreed and a panel claiming "nothing here"
              // next to a nonzero count would be a worse answer than no
              // button at all).
              if (!bucketFacts?.length) {
                return (
                  <div key={b}>
                    <p className="text-[32px] font-extralight leading-none tabular-nums sm:text-[44px]">
                      {tally[b].toLocaleString()}
                    </p>
                    <p className="mt-1 text-xs text-text-muted">
                      {BUCKET_LABEL[b]}
                      {claimedInfo}
                    </p>
                  </div>
                );
              }
              return (
                <div key={b}>
                  <button
                    type="button"
                    data-testid={`knowledge-base-bucket-${b}`}
                    onClick={() => setOpen(b)}
                    className="cursor-pointer text-left"
                  >
                    <p className="text-[32px] font-extralight leading-none tabular-nums sm:text-[44px]">
                      {tally[b].toLocaleString()}
                    </p>
                    <p className="mt-1 text-xs text-text-muted underline decoration-dotted underline-offset-2">
                      {BUCKET_LABEL[b]}
                    </p>
                  </button>
                  {claimedInfo}
                </div>
              );
            })}
          </div>

          <BucketBreakdown
            standing={open}
            label={open ? `${tally[open].toLocaleString()} ${BUCKET_LABEL[open]}` : ""}
            facts={(open && factsByBucket?.[open]) || []}
            onClose={() => setOpen(null)}
          />

          {/* The bar is the four counts above it, laid end to end, plus a
           * trailing untouched segment sized against `total`. `flex` takes the
           * count itself, so the widths ARE the counts and no percentage is
           * computed anywhere — including behind the scenes, where one would be
           * just as much of a lie about what this card knows.
           *
           * aria-hidden with no label of its own: the four status segments
           * restate the numbers directly above them, and a screen reader that
           * has just read those out does not need them again as nested
           * percentages; the untouched segment has no number of its own to
           * restate. */}
          <div
            aria-hidden="true"
            className="mt-4 flex h-2 overflow-hidden rounded-full bg-panel"
          >
            {barSegments(tally, total).map((seg) => (
              <span
                key={seg.bucket}
                className={`block h-full ${seg.fill}`}
                style={{ flex: seg.flex }}
              />
            ))}
          </div>
        </>
      )}
    </section>
  );
}
