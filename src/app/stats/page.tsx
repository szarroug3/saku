"use client";

// Statistics — session count, characters practiced, overall accuracy, and
// the weakest characters (top 30 by miss rate) from the history aggregates.

import { Card, Hint, Lbl, Metric, MetricsGrid, PageTitle } from "@/components/ui";
import { CHAR_INDEX } from "@/data/characters";
import { useHistory } from "@/lib/use-history";

export default function StatsPage() {
  const { history } = useHistory();

  const entries = Object.entries(history.chars).map(([c, a]) => ({
    c,
    ...a,
  }));
  const seen = entries.reduce((n, e) => n + e.seen, 0);
  const missed = entries.reduce((n, e) => n + e.missed, 0);
  const accuracy = seen
    ? `${Math.max(0, Math.round((100 * (seen - missed)) / seen))}%`
    : "—";

  const worst = entries
    .filter((e) => e.missed > 0)
    .sort((a, b) => b.missed / b.seen - a.missed / a.seen)
    .slice(0, 30);

  return (
    <>
      <PageTitle title="Statistics" sub="Aggregated from every saved session" />
      <MetricsGrid>
        <Metric k="Sessions" v={history.sessions.length} />
        <Metric k="Characters practiced" v={entries.length} />
        <Metric k="Overall accuracy" v={accuracy} />
      </MetricsGrid>
      <Card>
        <Lbl>Weakest characters</Lbl>
        {worst.length === 0 ? (
          <p className="mt-0.5">
            <Hint>No misses recorded yet.</Hint>
          </p>
        ) : (
          worst.map((e) => {
            const info = CHAR_INDEX[e.c];
            const acc = Math.max(
              0,
              Math.round((100 * (e.seen - e.missed)) / e.seen),
            );
            return (
              <div
                key={e.c}
                className="flex flex-wrap items-baseline justify-between gap-2 border-b border-border px-1 py-2 text-sm last:border-b-0"
              >
                <span>
                  <span className="text-[20px]">{e.c}</span>{" "}
                  <Hint>
                    {info
                      ? `${info.r[0]} · ${info.setLabel.toLowerCase()}`
                      : ""}
                  </Hint>
                </span>
                <span className="text-right text-[13px] text-danger">
                  {e.missed} {e.missed === 1 ? "miss" : "misses"} in {e.seen}{" "}
                  seen{" "}
                  <span className="text-text-muted">
                    · {acc}% accuracy
                    {e.slow > 0 ? ` · slow ×${e.slow}` : ""}
                  </span>
                </span>
              </div>
            );
          })
        )}
      </Card>
    </>
  );
}
