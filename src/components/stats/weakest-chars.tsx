"use client";

// The characters you are worst at, weakest first — and the one place they are
// never forgotten.
//
// Home's "Weakest 20" card and its Confusions card are SUGGESTIONS: they stop
// pointing at a confusion once it graduates, because their job is choosing what
// to drill next and a solved problem is the wrong answer to that question.
// Statistics has the opposite job. Everything you have ever practised stays
// listed here, graduated or not, because this is the record.
//
// Ordering is weakestChars() from src/lib/decks.ts — the same function that
// builds Home's card, so the two screens can never disagree about who's
// weakest. It ranks by ACCURACY under the chosen metric, not by raw misses:
// "missed 9 times" says nothing without knowing it was shown 200. Ties break by
// `seen` descending, so 0%-from-one-showing never outranks 0%-from-twenty.

import { metricWord } from "@/components/home/deck-card";
import { Card, Hint, Lbl } from "@/components/ui";
import { CHAR_INDEX } from "@/data/characters";
import { accuracyOf, formatAccuracy } from "@/lib/accuracy";
import { weakestChars } from "@/lib/decks";
import type { AccuracyMetric, HistoryFile } from "@/types";

/** Deeper than Home's 20: this is the record, and it can afford the scroll. */
const N = 30;

export function WeakestChars({
  history,
  metric,
}: {
  history: HistoryFile;
  metric: AccuracyMetric;
}) {
  const rows = weakestChars(history, metric, N).flatMap((c) => {
    // weakestChars already dropped unseen chars and chars the data no longer
    // has, so both lookups hold — but this list renders `info.r[0]`, and a
    // silent crash on a stale history is a worse outcome than a missing row.
    const agg = history.chars[c];
    const info = CHAR_INDEX[c];
    const pct = agg ? accuracyOf(agg, metric) : null;
    if (!agg || !info || pct === null) return [];
    return [{ c, info, seen: agg.seen, pct }];
  });

  return (
    <Card>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <Lbl>Weakest characters</Lbl>
        <span className="mb-2 text-[11px] text-text-muted">
          weakest first · {metricWord(metric)}
        </span>
      </div>

      {rows.length === 0 ? (
        <div className="flex min-h-[76px] items-center justify-center rounded-[10px] border border-dashed border-border">
          <p className="px-4 text-center text-xs text-text-muted">
            Nothing to rank yet — characters appear here once you have drilled
            them.
          </p>
        </div>
      ) : (
        <>
          {rows.map((r) => (
            <div
              key={r.c}
              className="flex items-center gap-3 border-b border-border py-2 last:border-b-0"
            >
              <span
                aria-hidden="true"
                className="w-8 flex-none text-center font-kana text-[20px] leading-none"
              >
                {r.c}
              </span>
              <span className="min-w-0 flex-1 truncate text-[13px]">
                {r.info.r[0]} <Hint>{r.info.setLabel.toLowerCase()}</Hint>
              </span>
              {/* The same panel-track/accent-fill read as the deck rings and
               * the volume bars — accuracy, drawn small. */}
              <span
                aria-hidden="true"
                className="hidden h-[3px] w-12 flex-none overflow-hidden rounded-full bg-panel sm:block"
              >
                <span
                  className="block h-full rounded-full bg-accent opacity-80"
                  style={{ width: `${r.pct}%` }}
                />
              </span>
              <span className="w-11 flex-none text-right text-[13px] tabular-nums">
                {formatAccuracy(r.pct)}
              </span>
              <span className="w-14 flex-none text-right text-xs tabular-nums text-text-muted">
                {r.seen} seen
              </span>
            </div>
          ))}
          <p className="mt-2.5">
            <Hint>
              Ranked by accuracy, not by misses, and ties break toward the
              character you have seen more — 0% from twenty showings is a
              better-evidenced weakness than 0% from one.
            </Hint>
          </p>
        </>
      )}
    </Card>
  );
}
