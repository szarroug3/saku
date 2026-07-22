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

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

import { PracticeResume } from "@/components/practice/practice-resume";
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
  const { runs, startQuiz, continueRun, discardRun } = useQuizSession();
  const { history } = useHistory();
  const { lists } = useLists();

  // The clock the resume card is read against. Set strictly after mount, not in
  // a useState initialiser, so a server-seeded "started 4 minutes ago" can't
  // disagree with the client on hydration. The card itself is client-only
  // anyway (runs is empty until localStorage is restored), so this is belt and
  // braces — but it keeps the time text honest the moment the card appears.
  const [mountedNow, setMountedNow] = useState<number | null>(null);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMountedNow(Date.now());
  }, []);

  // The single most-recently-touched run, whatever it is — a one-off quiz, a
  // Library "Teach me", or a curriculum lesson. `runs` is ordered focused-first
  // then newest-parked, so runs[0] is always "where you were last". Continuing
  // it routes to wherever it left off; to pick a DIFFERENT run you go to the
  // Current sessions page (linked below). This is the one place that no longer
  // filters by origin: with many runs live at once the honest thing is to offer
  // the latest and point at the full list for the rest.
  const recent = runs[0] ?? null;

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
  // No teach screen, no rest timer, no fork loop. startQuiz parks any run in
  // progress rather than overwriting it, so Start never destroys anything.
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

      {/* The most recent run, whatever kind — a one-off quiz, a Library "Teach
          me", or a curriculum lesson. Continue lands where it left off; Discard
          drops just this one. Every other run in progress lives on the Current
          sessions page, linked when there is more than one. */}
      {recent ? (
        <>
          <PracticeResume
            kind={recent.kind}
            what={recent.what}
            progress={recent.progress}
            startedAt={recent.startedAt}
            now={mountedNow}
            onContinue={() => continueRun(recent.id)}
            onDiscard={() => discardRun(recent.id)}
          />
          {runs.length > 1 ? (
            <p className="mb-3 text-[13px] text-text-muted">
              To continue a different session,{" "}
              <Link href="/current" className="underline hover:text-text">
                go to Current sessions
              </Link>
              .
            </p>
          ) : null}
        </>
      ) : null}

      <Lbl>What to practice</Lbl>
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
        onStart={start}
      />
    </>
  );
}
