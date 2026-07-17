"use client";

// What you are holding — and the one card on this page that moves while you are
// away.
//
// Nothing here is a rate. Four counts and a bar drawn from those same four
// counts, so the bar cannot say anything the numbers don't. That is the whole
// answer to "are these supposed to be percentages?": there is no number on this
// card that could be one.
//
// SOLID GOES DOWN, AND THAT IS THE FEATURE
// ========================================
// Every other progress metric this app has tried only climbed — accuracy over
// time rises because the material gets familiar, so it measures how long you
// have been here. This count falls when you stop. It is the only honest thing a
// study app can put on a page called Progress, and it needs no caption saying so:
// you will see it drop, once, and understand it forever.

import { Card, Lbl } from "@/components/ui";
import {
  BUCKETS,
  BUCKET_LABEL,
  fillFor,
  held,
  type Tally,
} from "@/components/stats/tally";

export function KnowledgeBase({ tally }: { tally: Tally }) {
  const shown = BUCKETS.filter((b) => tally[b] > 0);
  const total = held(tally);

  return (
    <Card>
      <Lbl>Your knowledge base</Lbl>

      {total === 0 ? (
        <p className="py-2 text-[13px] text-text-muted">
          Nothing yet. Drill something and it will show up here.
        </p>
      ) : (
        <>
          {/* Smaller digits on a phone. At 44px five counts stack four rows
           * deep and the card runs off the screen before the bar that sums
           * them, which is the one thing that has to be seen with them. */}
          <div className="flex flex-wrap items-end gap-x-[26px] gap-y-3">
            {shown.map((b) => (
              <div key={b}>
                <p className="text-[32px] font-extralight leading-none tabular-nums sm:text-[44px]">
                  {tally[b].toLocaleString()}
                </p>
                <p className="mt-1 text-xs text-text-muted">
                  {BUCKET_LABEL[b]}
                </p>
              </div>
            ))}
          </div>

          {/* The bar is the same four numbers, laid end to end. `flex` takes the
           * count itself, so the widths ARE the counts and no percentage is
           * computed anywhere — including behind the scenes, where one would be
           * just as much of a lie about what this card knows.
           *
           * aria-hidden with no label of its own: it restates the numbers
           * directly above it, and a screen reader that has just read them out
           * does not need them again as five nested percentages. */}
          <div
            aria-hidden="true"
            className="mt-4 flex h-2 overflow-hidden rounded-full bg-panel"
          >
            {shown.map((b) => (
              <span
                key={b}
                className={`block h-full ${fillFor(b)}`}
                style={{ flex: tally[b] }}
              />
            ))}
          </div>
        </>
      )}
    </Card>
  );
}
