"use client";

// Practice — where you set up and start a drill.
//
// This is HOW and WHAT, moved off Home. Home is the curriculum ("what should I
// learn next?"); Practice is the open builder ("what do I want to drill, and how
// should it ask?"). The split is option A from the plates: Practice owns the
// session settings and offers a few ready pools, and the Library is the door for
// picking exact items by hand.
//
// The rule the old Home start bar kept still holds here: whatever you are about
// to run is fully on screen before you run it, and only the Start button starts
// it. So the page reads top to bottom as the sentence Start acts on — the pool,
// then how it asks, then Start.

import { useMemo, useState } from "react";

import { QuizOptionsFields } from "@/components/practice/quiz-options";
import { StartBar } from "@/components/practice/start-bar";
import { PracticeSelector } from "@/components/practice/practice-selector";
import { Card, Lbl, PageTitle } from "@/components/ui";
import { planFacts, planSession } from "@/lib/budget";
import { KANA_GROUP_FACTS } from "@/lib/lesson";
import { useQuizConfig } from "@/lib/quiz-config";
import { useQuizSession } from "@/lib/quiz-session";
import { resolve, whatSentence } from "@/lib/selection";
import { useHistory } from "@/lib/use-history";
import { useLists } from "@/lib/use-lists";
import type { Selection } from "@/types";

export default function PracticePage() {
  const { cfg, set } = useQuizConfig();
  const { session, startSession } = useQuizSession();
  const { history } = useHistory();
  const { lists } = useLists();

  // The clock the BUDGET is computed against, read ONCE per visit. planSession
  // is pure, so it takes a fixed `now` rather than reading a clock mid-render;
  // held as state so it is stable for the life of the page. It goes stale only
  // if you leave the page open for days, and starting a session remounts it.
  const [now] = useState(() => Date.now());

  // The facts the query names, right now — what Start hands the quiz and what
  // the bar counts, computed once so the sentence and the session can never
  // disagree about what you pressed Start on.
  const facts = useMemo(
    () => resolve(cfg.selection, history, lists, cfg.accuracyMetric),
    [cfg.selection, cfg.accuracyMetric, history, lists],
  );

  const what = useMemo(
    () => whatSentence(cfg.selection, facts.length, lists),
    [cfg.selection, facts.length, lists],
  );

  // What actually runs: rank the pool, then top up new material one group at a
  // time so the drill never goes dark. Computed here (not inside start) so the
  // bar can say what Start will do — including "nothing, you're solid on all of
  // these" — before you press it.
  const planned = useMemo(() => {
    const plan = planSession({
      candidates: facts,
      history,
      groups: KANA_GROUP_FACTS,
      length:
        cfg.length === "limited" && cfg.limType === "count" ? cfg.limCount : null,
      // A user-built selection: a Count of N takes a uniform random N, not the
      // weakest N. The suggested/study loop weakness-ranks instead and is not
      // this page.
      random: true,
      now,
    });
    return { facts: planFacts(plan), teach: plan.teach };
  }, [facts, history, cfg.length, cfg.limType, cfg.limCount, now]);

  const start = () => {
    if (!planned.facts.length) return;
    startSession(planned.facts, planned.teach, what);
  };

  const setSelection = (selection: Selection) =>
    set((prev) => ({ ...prev, selection }));

  return (
    <>
      <PageTitle
        title="Practice"
        sub="Pick a pool and how it should ask, then drill."
      />

      <Lbl>What to practise</Lbl>
      <PracticeSelector
        sel={cfg.selection}
        lists={lists}
        history={history}
        metric={cfg.accuracyMetric}
        onChange={setSelection}
      />

      <Lbl>How to ask</Lbl>
      <Card>
        <QuizOptionsFields />
      </Card>

      <StartBar
        cfg={cfg}
        what={what}
        count={facts.length}
        plannedCount={planned.facts.length}
        active={!!session}
        onStart={start}
      />
    </>
  );
}
