"use client";

// Progress — where you are, not how you're doing.
//
// WHAT LEFT, AND WHY IT ISN'T COMING BACK
// =======================================
// This page used to open with an accuracy trend, three stat tiles, a per-deck
// accuracy grid and a sortable table of every character, all governed by a
// first-try / eventually-right toggle. It is four cards lighter now. The cuts
// are not tidying; each one was a number that could not be read:
//
//   ACCURACY OVER TIME. It always climbs, because the material gets familiar —
//   it measures how long you have been here, not how good you are. It cannot go
//   down, so it cannot tell you anything. Its absence is the feature.
//
//   OVERALL ACCURACY, and the deck rings. A rate pooled over every showing you
//   have ever answered, most of them from material you have since forgotten and
//   material you learned last week, in one figure. It moves about a point a
//   month and nothing you could do would move it faster.
//
//   THE CHARACTERS TABLE. Its own header called it the record — "every
//   character you have ever practised, and the one place they are never
//   forgotten". It was neither. Its rows resolve through CHAR_INDEX, which
//   src/data/characters.ts builds from SETS, which is kana; every kanji and
//   every word you have ever drilled hit `if (!info) return []` and vanished.
//   The table has been silently 214 rows of a 10,476-entry app since the day
//   kanji landed, under a heading promising the opposite. See the REPORT — the
//   brief expected a virtualisation problem at 21,449 rows and there was never
//   going to be one.
//
//   THE METRIC TOGGLE. It existed to govern those four cards. Nothing it
//   governed is left. The one place the distinction still bites — is a probed
//   fact "getting there" or "shaky" — reads cfg.accuracyMetric, i.e. the
//   setting, from Settings, where a setting lives.
//
// WHAT IS LEFT IS THREE CARDS AND EVERY NUMBER ON THEM IS A COUNT OF THINGS.
// There is no decimal on this page, and there is no arithmetic that could
// produce one.

import { useState } from "react";

import { BySubject } from "@/components/stats/by-subject";
import { KnowledgeBase } from "@/components/stats/knowledge-base";
import { MixUps } from "@/components/stats/mix-ups";
import { tallyFacts } from "@/components/stats/tally";
import { PageTitle } from "@/components/ui";
import { factKeys } from "@/lib/facts";
import { useQuizConfig } from "@/lib/quiz-config";
import { useHistory } from "@/lib/use-history";

export default function StatsPage() {
  const { cfg } = useQuizConfig();
  const { history } = useHistory();

  // ONE `now` per mount, the way the Library does it. Two reads a millisecond
  // apart cannot disagree about whether a fact is solid — but the knowledge base
  // and the By subject bar are the SAME facts counted twice, and two clocks is
  // how they would come to disagree about their totals for no reason a person
  // could see.
  const [now] = useState(() => Date.now());
  const claims = history.claims ?? {};

  // The population is what the app has a record of: every fact with an
  // aggregate, plus every fact you have claimed and never been asked. Not
  // ALL_FACTS — 21,753 facts, 21,000 of them never met, would bury the card in
  // a bucket that is about the dictionary rather than about you.
  const recorded = [
    ...new Set([...factKeys(history.facts), ...factKeys(claims)]),
  ];
  const tally = tallyFacts(recorded, history.facts, claims, cfg.accuracyMetric, now);

  return (
    <>
      <PageTitle title="Progress" sub="Where you are. Not how you're doing." />

      <KnowledgeBase tally={tally} />

      {/* Two columns on a wide screen, stacked on a narrow one. The mix-ups
       * board is the taller of the two and the one you came for; it goes second
       * so that a stacked phone reads By subject → mix-ups, which is the same
       * order as the wide screen's left → right. */}
      <div className="grid gap-3 md:grid-cols-2">
        <BySubject
          facts={history.facts}
          claims={claims}
          metric={cfg.accuracyMetric}
          now={now}
        />
        <MixUps history={history} graduateRuns={cfg.graduateRuns} />
      </div>
    </>
  );
}
