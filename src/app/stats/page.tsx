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
//   4. the characters   what exactly is costing me?
//
// Every number on this page reads through src/lib/accuracy.ts. This page used
// to hand-roll (seen - missed) / seen, which mixes showings with attempts and
// could go negative — the exact bug accuracy.ts exists to prevent.
//
// THE METRIC IS THE PAGE'S, AND THE PAGE OWNS IT
// ==============================================
// "first try" used to be printed as static text in the corner of two separate
// cards — twice on one screen, and a label both times: it told you which of the
// two accuracy definitions you were reading and gave you no way to read the
// other one without going to Settings.
//
// It is one control now, at the top, and it governs EVERY statistic below it:
// the trend, the Overall accuracy tile, the deck rings and the characters
// table all take `metric` from here. That is the whole reason it sits beside
// the title rather than in the corner of the card that used to print it — a
// control tucked into one card claims to be that card's, and this one isn't.
//
// It is LOCAL STATE and writes nothing back to settings. Two reasons:
//
//   1. cfg.accuracyMetric also drives Home's rings and the drill HUD. Flipping
//      a view control on Statistics to see the other number is not the same act
//      as changing what accuracy MEANS everywhere in the app, and silently
//      doing the second when you asked for the first is how a settings screen
//      stops being the place your settings live. The results screen's chips
//      already make exactly this choice.
//   2. The alternative — per-card local state — was the other option on the
//      table, and it is worse: it lets the trend read "first try" while the
//      table beside it reads "eventually right", which is two different
//      definitions of accuracy on one screen with nothing saying so. One
//      control for the whole page keeps the screen internally consistent
//      without reaching into the user's settings.
//
// `override ?? cfg.accuracyMetric` rather than useState(cfg.accuracyMetric):
// QuizConfigProvider starts from defaults and hydrates from localStorage after
// mount, so seeding state from cfg on first render would capture the DEFAULT
// and never see the user's real setting — and the fix for that is a sync
// setState in an effect, which this codebase's lint rightly refuses. Holding
// "has the user overridden it here?" instead means the page tracks cfg for free
// until the moment they touch the chips, and pins to their choice after.

import { useState } from "react";

import { AccuracyTrend } from "@/components/stats/accuracy-trend";
import { CharactersTable } from "@/components/stats/characters-table";
import { DeckAccuracy } from "@/components/stats/deck-accuracy";
import { Chip, Metric, MetricsGrid, PageTitle } from "@/components/ui";
import { accuracyFor, formatAccuracy } from "@/lib/accuracy";
import { factKeys } from "@/lib/facts";
import { useQuizConfig } from "@/lib/quiz-config";
import { useHistory } from "@/lib/use-history";
import type { AccuracyMetric } from "@/types";

export default function StatsPage() {
  const { cfg } = useQuizConfig();
  const { history } = useHistory();

  const [override, setOverride] = useState<AccuracyMetric | null>(null);
  const metric = override ?? cfg.accuracyMetric;

  // Pooled over every fact with history — a real ratio over a real population
  // of showings, which is what "overall" should mean.
  const practised = factKeys(history.facts);
  const overall = accuracyFor(history, practised, metric);

  return (
    <>
      <PageTitle title="Statistics" />

      {/* Same two words, same order, same component as the results screen's
       * chips — it is the same choice, so it should not be a second dialect.
       * A radiogroup rather than two toggles: these are one value with two
       * settings, and "First try pressed, Eventually right unpressed" is a
       * clumsier way to say that to a screen reader than "First try, selected,
       * 1 of 2". */}
      <div
        role="radiogroup"
        aria-label="Accuracy metric"
        className="mb-3.5 flex flex-wrap items-center gap-1.5"
      >
        <Chip
          role="radio"
          aria-checked={metric === "firstTry"}
          on={metric === "firstTry"}
          onClick={() => setOverride("firstTry")}
        >
          First try
        </Chip>
        <Chip
          role="radio"
          aria-checked={metric === "attempt"}
          on={metric === "attempt"}
          onClick={() => setOverride("attempt")}
        >
          Eventually right
        </Chip>
        {/* No "every figure on this page" caption. The chips sit under this
         * page's title with the whole page beneath them and nothing else
         * competing for them — that IS the claim, made by position, and a
         * caption restating it was the control apologising for itself. The
         * scope is a fact about the code, so it lives in the header comment
         * above, where it stays true and stays out of the way. */}
      </div>

      <AccuracyTrend history={history} metric={metric} />

      <MetricsGrid>
        <Metric k="Sessions" v={history.sessions.length} />
        <Metric k="Characters practised" v={practised.length} />
        <Metric k="Overall accuracy" v={formatAccuracy(overall)} />
      </MetricsGrid>

      {/* cfg for showVolume, but the metric comes from the page — a spread
       * override rather than a second prop, so DeckAccuracy keeps taking the
       * one config object it already takes and nothing is written back. */}
      <DeckAccuracy
        history={history}
        cfg={{ ...cfg, accuracyMetric: metric }}
      />

      <CharactersTable history={history} metric={metric} />
    </>
  );
}
