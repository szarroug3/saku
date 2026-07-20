"use client";

// Practice — where you set up and start a drill.
//
// This is HOW and WHAT, moved off Home. Home is the curriculum ("what should I
// learn next?"); Practice is the open builder ("what do I want to drill, and how
// should it ask?"). The split is option A from the plates: Practice owns the
// drill settings and offers a few ready pools, and the Library is the door for
// picking exact items by hand.
//
// PRACTICE IS A ONE-OFF QUIZ, NOT A SESSION. Start runs the selected pool as a
// single quiz — straight to the drill, no lesson/teach screen first, and no rest
// timer or fork loop after. When the quiz ends it goes to the results page. That
// is why this page calls startQuiz (the one-off) and not startSession (the
// teach → drill → rest → repeat loop the lesson cards and the Library Drill use).
//
// The rule the old Home start bar kept still holds here: whatever you are about
// to run is fully on screen before you run it, and only the Start button starts
// it. So the page reads top to bottom as the sentence Start acts on — the pool,
// then how it asks, then Start.

import { useMemo } from "react";

import { QuizOptionsFields } from "@/components/practice/quiz-options";
import { StartBar } from "@/components/practice/start-bar";
import { PracticeSelector } from "@/components/practice/practice-selector";
import { Card, Lbl, PageTitle } from "@/components/ui";
import { useQuizConfig } from "@/lib/quiz-config";
import { useQuizSession } from "@/lib/quiz-session";
import { resolve, whatSentence } from "@/lib/selection";
import { useHistory } from "@/lib/use-history";
import { useLists } from "@/lib/use-lists";
import type { Selection } from "@/types";

export default function PracticePage() {
  const { cfg, set } = useQuizConfig();
  const { session, startQuiz } = useQuizSession();
  const { history } = useHistory();
  const { lists } = useLists();

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

  // What actually runs: exactly the pool you picked, capped to the requested
  // length. This is an EXPLICIT selection — you chose "Everything I have seen"
  // or "Just the shaky ones" or a saved list — so Practice drills all of it,
  // solid facts included. It deliberately does NOT run the curriculum budget
  // (planSession), which drops what you're solid on: that budget is for the
  // app choosing material FOR you, and applying it here would refuse the thing
  // you literally pointed at (the same seam the Library opens with includeSolid).
  // resolve() already returns the pool in random order, so a Count of N is a
  // uniform random N: take the first N. This keeps the selector's promise that
  // the number on the tile is the number you get.
  const planned = useMemo(() => {
    const cap =
      cfg.length === "limited" && cfg.limType === "count" ? cfg.limCount : null;
    return { facts: cap === null ? facts : facts.slice(0, cap) };
  }, [facts, cfg.length, cfg.limType, cfg.limCount]);

  // A one-off quiz, not a session: straight to /quiz, then /results when it ends.
  // No teach screen, no rest timer, no fork loop. startQuiz clears any session in
  // progress (the bar warns when there is one).
  const start = () => {
    if (!planned.facts.length) return;
    startQuiz(planned.facts, { what });
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
