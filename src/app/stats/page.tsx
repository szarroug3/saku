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
//   governed is left. The app grades on one rule now, everywhere: right is
//   right, first try or after a retry — including the "getting there" vs
//   "shaky" split below.
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
import { ALL_FACTS, factKeys } from "@/lib/facts";
import { isSentenceTierMarkerFact } from "@/lib/sentence-ordering-progress";
import { useQuizConfig } from "@/lib/quiz-config";
import { useHistory } from "@/lib/use-history";

/** The population behind What-you-know's bar: every registered fact. Module
 * scope, so the 21,753-entry walk runs once per page load rather than once per
 * render — the same reason by-subject.tsx hoists its own SUBJECTS index.
 * Sentence-tier marker facts are never in ALL_FACTS (they're synthetic history
 * keys, not registry entries — see sentence-ordering-progress.ts), so no
 * filtering is needed to keep them out of this count, unlike `recorded` below
 * which has to filter them defensively out of what history might contain. */
const TOTAL_FACTS = ALL_FACTS.length;

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
  ].filter((fact) => !isSentenceTierMarkerFact(fact));
  const tally = tallyFacts(recorded, history.facts, claims, now);

  return (
    // A contained column, not full bleed. The three groups are counts and narrow
    // tables, not a dashboard that wants 1400px; capping keeps each bar next to
    // the number it belongs to, the same rule Settings and the Learn feed follow.
    <div className="max-w-4xl">
      <PageTitle title="Progress" sub="How much you have covered so far." />

      <KnowledgeBase tally={tally} total={TOTAL_FACTS} />

      {/* The one hairline on the page: What-you-know is the whole knowledge base
       * summed; below it the same facts are broken out by subject, then the
       * mix-ups board. That is the one major seam, so it gets the rule — the
       * groups within it separate by their heading and their whitespace, not by
       * more lines (the boxless language's rule; see the Row primitive).
       *
       * By subject stays a half-width column — it is five short rows and never
       * grows. Mix-ups (SAK-77) used to share that same half on a wide screen,
       * which squeezed the one card on this page with genuinely unbounded
       * content — a board of pairs that can run past its scroll cap — into the
       * same width as a fixed five-row table, while the page had visible room
       * beside it. It now spans the full row instead, stacked below By subject
       * on every width, which also means the wide screen reads top-to-bottom in
       * the same order the narrow screen always did. */}
      <div className="mt-6 grid gap-x-10 gap-y-8 border-t border-white/[0.08] pt-6 md:grid-cols-2">
        <BySubject
          facts={history.facts}
          claims={claims}
                    now={now}
          history={history}
        />
        <div className="md:col-span-2">
          <MixUps history={history} graduateRuns={cfg.graduateRuns} />
        </div>
      </div>
    </div>
  );
}
