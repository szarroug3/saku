"use client";

// The headline of Statistics: per-session accuracy across your last sessions.
//
// This is the one picture on the app that answers "am I getting better?" — the
// question the Home shelves deliberately don't try to answer, because Home's
// job is starting a quiz and this page's job is remembering.
//
// HOW IT'S DRAWN
// ==============
// Divs and CSS, no chart library. Each session is one column:
//
//   track  a full-height bg-panel column — the 100% reference, the same
//          track the deck rings and the volume bars already read as "the
//          rest of the way"
//   bar    an accent fill from the bottom, height = the percentage ITSELF
//
// No scaling to the data's max: a bar's height IS its number, so the picture
// and the tooltip can never disagree, and a bad run visibly dips instead of
// being renormalized back up to the top of the chart. The floor under the fill
// (max(3px, …)) keeps a 0% session a visible mark rather than a hole — the
// worst session is exactly the one you must not lose.
//
// Every colour is a token, so this survives all four themes; the bars carry
// their own opacity rather than a mixed-down colour for the same reason.

import { plural } from "@/components/home/deck-card";
import { Card, Lbl } from "@/components/ui";
import { accuracyFor, formatAccuracy } from "@/lib/accuracy";
import type { AccuracyMetric, HistoryFile, QuizSessionRecord } from "@/types";

/** How many sessions the chart shows — the recent past, not the archive. */
const MAX_BARS = 20;

interface Point {
  ts: number;
  /** Accuracy under the chosen metric, or null when the session scored nothing. */
  pct: number | null;
  /** Characters the session covered. */
  chars: number;
}

/**
 * One session's accuracy under `metric`.
 *
 * Reads through accuracy.ts rather than deriving a ratio here: the session's
 * own `chars` map is exactly a history's `chars` map for one run, so handing
 * accuracyFor a one-session history gets the ONE definition of accuracy —
 * including its `firstTry ?? 0` guard for sessions written before that field
 * existed. `forgivingPct`/`strictPct` on the record are a different number
 * (share of CHARACTERS passed, not of showings), which is why they stay on the
 * sessions list and don't feed this chart.
 */
function sessionAccuracy(
  s: QuizSessionRecord,
  metric: AccuracyMetric,
): number | null {
  const chars = s.chars ?? {};
  return accuracyFor({ sessions: [], chars }, Object.keys(chars), metric);
}

function shortDate(ts: number): string {
  return new Date(ts).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

function stamp(ts: number): string {
  const d = new Date(ts);
  return `${shortDate(ts)} ${d.toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  })}`;
}

/** Chart header: the label, and what the bars are measuring. Both children
 * carry Lbl's own mb-2, so the row keeps the kit's label spacing. */
function Head({ note }: { note: string }) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-2">
      <Lbl>Accuracy trend</Lbl>
      <span className="mb-2 text-[11px] tabular-nums text-text-muted">
        {note}
      </span>
    </div>
  );
}

/** Day one. A designed state: the chart's own frame, and what will fill it.
 * No metric argument any more — the frame reads the same under either. */
function EmptyTrend() {
  return (
    <Card>
      {/* No metric word here — the page toggle beside the title names the
       * metric once for the whole page now. */}
      <Head note={`Last ${MAX_BARS} sessions`} />
      <div className="flex h-[104px] items-center justify-center rounded-[10px] border border-dashed border-border">
        <p className="px-4 text-center text-xs text-text-muted">
          Nothing to chart yet. Accuracy appears here once you have finished a
          quiz.
        </p>
      </div>
      <p className="mt-2 text-xs text-text-muted">
        One bar per session, newest on the right. The full column is 100%.
      </p>
    </Card>
  );
}

export function AccuracyTrend({
  history,
  metric,
}: {
  history: HistoryFile;
  metric: AccuracyMetric;
}) {
  // Oldest → newest, left to right: the trend has to read the way time does.
  // `ts` rather than file order, so a hand-edited history still reads right.
  const recent = history.sessions
    .slice()
    .sort((a, b) => a.ts - b.ts)
    .slice(-MAX_BARS);

  const points: Point[] = recent.map((s) => ({
    ts: s.ts,
    pct: sessionAccuracy(s, metric),
    chars: s.total || Object.keys(s.chars ?? {}).length,
  }));

  if (!points.length) return <EmptyTrend />;

  const latest = points[points.length - 1];
  const alone = points.length === 1;

  return (
    <Card>
      <Head
        note={alone ? "1 session" : `Last ${plural(points.length, "session")}`}
      />

      {/* items-end + a bottom rule: the baseline is where 0% sits, drawn as a
       * hairline so it stays recessive next to the bars. */}
      <div className="flex h-[104px] items-end gap-1.5 border-b border-border">
        {points.map((p, i) => {
          const last = i === points.length - 1;
          return (
            <div
              key={p.ts}
              className="group relative flex h-full max-w-[42px] min-w-0 flex-1 items-end rounded-t-[3px] bg-panel"
            >
              {p.pct === null ? null : (
                <div
                  className={`w-full rounded-t-[3px] bg-accent ${
                    last ? "" : "opacity-45 group-hover:opacity-80"
                  }`}
                  // max(): a 0% session is still a mark on the baseline.
                  style={{ height: `max(3px, ${p.pct}%)` }}
                />
              )}
              {/* Tooltip. Pure hover — no state, so 20 bars cost 20 spans and
               * zero re-renders. The end columns anchor to their own edge
               * instead of centring, or they'd hang off the card.
               *
               * THE TOOLTIP IS A CARD — the same surface ui/tooltip.tsx wears:
               * the four tokens Card uses. --border, --radius and --shadow-card
               * are the classes below; --card arrives via kq-surface, which is
               * where this one has to differ from its portalled twin.
               *
               * WHY NOT `bg-card` + the kiri `backdrop-blur` this used to copy
               * off ui/tooltip.tsx: BECAUSE THAT BLUR DOES NOTHING HERE, and it
               * is worth knowing why before copying it back. This span is a
               * child of the trend Card, and in kiri that Card carries its own
               * backdrop-filter — which makes it a BACKDROP ROOT, and a nested
               * backdrop-filter inside one is a no-op in Chromium. So the frost
               * never fired, --card is 5.5% white in kiri dark, and the result
               * was a pane you could read "ACCURACY TREND" straight through.
               * ui/tooltip.tsx runs the identical declaration and works — but it
               * works because Radix PORTALS it to <body>, where its backdrop is
               * the page. The portal is the load-bearing part, not the class.
               *
               * kq-surface gets the same look without a portal (and so without
               * the state this chart deliberately doesn't keep): it rebuilds the
               * card's surface opaquely — --bg, kiri's mesh, then --card over
               * both — so it composites to exactly what the settings tooltip
               * composites to, while actually occluding the bars. See the
               * OPAQUE GLASS section in globals.css.
               *
               * rounded-(--radius), NOT rounded-lg/xl: those class PAIRS with
               * bg-card are globals.css's Btn and Card selectors and would swap
               * in --shadow-btn or dissolve the fill into aizome's hairlines.
               * No arrow, for the reason ui/tooltip.tsx spells out. */}
              <span
                className={`kq-surface shadow-card pointer-events-none absolute bottom-full z-10 mb-2 hidden whitespace-nowrap rounded-(--radius) border border-border px-2 py-1 text-[11px] tabular-nums text-text group-hover:block ${
                  i === 0
                    ? "left-0"
                    : last
                      ? "right-0"
                      : "left-1/2 -translate-x-1/2"
                }`}
              >
                {stamp(p.ts)} · {formatAccuracy(p.pct)} ·{" "}
                {plural(p.chars, "char")}
              </span>
            </div>
          );
        })}
      </div>

      <div className="mt-2 flex flex-wrap items-baseline justify-between gap-2 text-[11px] tabular-nums text-text-muted">
        <span>{shortDate(points[0].ts)}</span>
        {alone ? (
          <span>One session so far · the trend grows as you drill</span>
        ) : (
          <span>Full column = 100% · hover a bar for its session</span>
        )}
        <span>
          Latest · <span className="text-text">{formatAccuracy(latest.pct)}</span>
        </span>
      </div>
    </Card>
  );
}
