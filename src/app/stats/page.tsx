"use client";

// Statistics — the page whose job is REMEMBERING.
//
// Home answers "what do I drill now?" and deliberately keeps no history on
// screen; the trend, the record, and the per-deck picture all live here, in
// priority order:
//
//   1. the trend        am I getting better?          — the headline
//   2. the totals       how much have I done?
//   3. by deck          where am I strong / weak?
//   4. the weakest      what exactly is costing me?
//
// Every number on this page reads through src/lib/accuracy.ts under
// cfg.accuracyMetric, so "88%" means the same thing here, on the drill HUD,
// and on Home's rings. This page used to hand-roll (seen - missed) / seen,
// which mixes showings with attempts and could go negative — the exact bug
// accuracy.ts exists to prevent.

import { AccuracyTrend } from "@/components/stats/accuracy-trend";
import { DeckAccuracy } from "@/components/stats/deck-accuracy";
import { WeakestChars } from "@/components/stats/weakest-chars";
import { Metric, MetricsGrid, PageTitle } from "@/components/ui";
import { accuracyFor, formatAccuracy } from "@/lib/accuracy";
import { useQuizConfig } from "@/lib/quiz-config";
import { useHistory } from "@/lib/use-history";

export default function StatsPage() {
  const { cfg } = useQuizConfig();
  const { history } = useHistory();

  const practised = Object.keys(history.chars);
  const overall = accuracyFor(history, practised, cfg.accuracyMetric);

  return (
    <>
      <PageTitle
        title="Statistics"
        sub="Everything you have practised, remembered — across every saved session"
      />

      <AccuracyTrend history={history} metric={cfg.accuracyMetric} />

      <MetricsGrid>
        <Metric k="Sessions" v={history.sessions.length} />
        <Metric k="Characters practised" v={practised.length} />
        <Metric k="Overall accuracy" v={formatAccuracy(overall)} />
      </MetricsGrid>

      <DeckAccuracy history={history} cfg={cfg} />

      <WeakestChars history={history} metric={cfg.accuracyMetric} />
    </>
  );
}
