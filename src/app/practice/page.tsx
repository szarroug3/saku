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
import { Lbl, PageTitle } from "@/components/ui";
import { useQuizConfig } from "@/lib/quiz-config";
import { useQuizSession } from "@/lib/quiz-session";
import { gridFacts } from "@/lib/grid-facts";
import { playablePairBoards } from "@/lib/pair-facts";
import { hasSubstitutionMaterial } from "@/lib/engine/substitution";
import {
  buildCoverageDeck,
  configIsReachable,
  enabledFormsFor,
} from "@/lib/ask-forms";
import {
  englishSentenceAsksOrdering,
} from "@/lib/ask-config";
import { resolve, whatSentence } from "@/lib/selection";
import {
  ASSEMBLY_QUIZ_TARGET,
  readableAssemblyForTiers,
} from "@/data/assembly";
import {
  learnedSentenceTierFacts,
  learnedSentenceTierIds,
} from "@/lib/sentence-ordering-learned";
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
  const sentenceSelected = cfg.selection.types.includes("sentence");
  const sentenceConfigured =
    cfg.mode === "drill" && englishSentenceAsksOrdering(cfg.ask);
  const includeSentences = sentenceSelected && sentenceConfigured;
  const learnedSentenceIds = useMemo(
    () => learnedSentenceTierIds(history),
    [history],
  );
  const sentenceQuestionCount = useMemo(
    () => readableAssemblyForTiers(learnedSentenceIds, history).length,
    [learnedSentenceIds, history],
  );
  const ordinaryTypes = cfg.selection.types.filter(
    (type) => type !== "sentence",
  );
  const ordinarySelected =
    !sentenceSelected || ordinaryTypes.length > 0;
  const ordinaryFacts = useMemo(
    () =>
      ordinarySelected
        ? resolve(
            { ...cfg.selection, types: ordinaryTypes },
            history,
            lists,
            cfg.accuracyMetric,
            0,
            {
            now: mountedNow ?? 0,
            graduateRuns: cfg.graduateRuns,
            },
          )
        : [],
    [
      ordinarySelected,
      ordinaryTypes,
      cfg.selection,
      cfg.accuracyMetric,
      cfg.graduateRuns,
      mountedNow,
      history,
      lists,
    ],
  );
  const sentenceFacts = useMemo(
    () => (includeSentences ? learnedSentenceTierFacts(history) : []),
    [includeSentences, history],
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
    if (includeSentences && !ordinarySelected) {
      return {
        facts: sentenceFacts,
        count: Math.min(ASSEMBLY_QUIZ_TARGET, sentenceQuestionCount),
      };
    }
    // Substitution rolls its cards from the learner's KNOWN verbs (history),
    // not from the selected pool — so its "is there material?" question is the
    // same history-wide predicate the screen rolls against, not the selection
    // count. Report 0 planned when no conjugable verbs are known so the Start
    // gate below catches the empty case BEFORE launch, matching the runtime's
    // own empty state instead of contradicting it. `facts` stays the selection
    // (the runtime ignores it) so start()'s non-empty guard behaves as before.
    if (cfg.mode === "substitution") {
      return {
        facts: ordinaryFacts,
        count: hasSubstitutionMaterial(history) ? ordinaryFacts.length || 1 : 0,
      };
    }
    const cap =
      cfg.length === "limited" && cfg.limType === "count" ? cfg.limCount : null;
    if (cfg.mode === "pairs") {
      // Length/Count still belong to the pairs screen (it expands the pool into
      // variants and caps afterward), so `facts` is handed over whole. But a
      // selection can expand into NO playable board — every type having only a
      // lone pair, which is not a matching game — and Start must not launch into
      // an empty run. So the gate counts the specs on PLAYABLE (≥2-pair) boards:
      // 0 here is the genuinely-unstartable case, and only that case, so it no
      // longer rejects an otherwise startable selection.
      const boards = playablePairBoards(ordinaryFacts, cfg.pairResponses, history);
      return {
        facts: ordinaryFacts,
        count: boards.reduce((n, b) => n + b.specs.length, 0),
      };
    }
    if (cfg.mode === "grid") {
      const selected = gridFacts(ordinaryFacts, cfg.gridResponses);
      return { facts: selected, count: selected.length };
    }
    const selected =
      cap === null ? ordinaryFacts : ordinaryFacts.slice(0, cap);
    const sentenceCount = includeSentences
      ? Math.min(ASSEMBLY_QUIZ_TARGET, sentenceQuestionCount)
      : 0;
    return {
      facts: includeSentences ? [...selected, ...sentenceFacts] : selected,
      count: selected.length + sentenceCount,
    };
  }, [
    ordinaryFacts,
    ordinarySelected,
    sentenceFacts,
    cfg.mode,
    cfg.gridResponses,
    cfg.pairResponses,
    cfg.length,
    cfg.limType,
    cfg.limCount,
    history,
    includeSentences,
    sentenceQuestionCount,
  ]);

  // Footer count should reflect askable QUESTIONS for this run, not raw facts.
  const questionCount = useMemo(() => {
    if (includeSentences) {
      const ordinary = planned.facts.filter(
        (fact) => !sentenceFacts.includes(fact),
      );
      const ordinaryCount = ordinary.reduce(
        (sum, fact) => sum + enabledFormsFor(fact, cfg.ask).length,
        0,
      );
      return (
        ordinaryCount +
        Math.min(ASSEMBLY_QUIZ_TARGET, sentenceQuestionCount)
      );
    }
    if (cfg.mode === "pairs") return planned.count;
    if (cfg.mode === "grid") return planned.facts.length;
    if (cfg.length === "limited" && cfg.limType === "cov") {
      return buildCoverageDeck(planned.facts, cfg.ask).deck.length;
    }

    if (cfg.length === "limited" && cfg.limType === "count") {
      return cfg.limCount;
    }

    return planned.facts.reduce(
      (sum, fact) => sum + enabledFormsFor(fact, cfg.ask).length,
      0,
    );
  }, [
    cfg.mode,
    cfg.length,
    cfg.limType,
    cfg.limCount,
    cfg.ask,
    includeSentences,
    sentenceFacts,
    sentenceQuestionCount,
    planned.count,
    planned.facts,
  ]);

  // Check if the current settings are reachable for drill mode with facts selected
  const reachability = useMemo(() => {
    if (cfg.mode !== "drill" || planned.facts.length === 0) {
      return { isReachable: true };
    }
    return configIsReachable(planned.facts, cfg.ask);
  }, [cfg.mode, cfg.ask, planned.facts]);

  const what = useMemo(
    () =>
      whatSentence(cfg.selection, questionCount, lists, {
        showCount: !(cfg.mode === "drill" && cfg.length === "endless"),
      }),
    [cfg.selection, questionCount, lists, cfg.mode, cfg.length],
  );

  // Grid narrows the selected pool by response type before dealing it, so its
  // visible count and frozen run name must describe that narrowed pool rather
  // than the broader filter result.
  const runWhat = useMemo(
    () =>
      cfg.mode === "grid"
        ? whatSentence(cfg.selection, questionCount, lists, {
            showCount: cfg.length !== "endless",
          })
        : what,
    [cfg.mode, cfg.length, cfg.selection, questionCount, lists, what],
  );

  // A one-off quiz, not a session: straight to /quiz, then /results when it ends.
  // No teach screen, no rest timer, no fork loop. startQuiz parks any run in
  // progress rather than overwriting it, so Start never destroys anything.
  const start = () => {
    if (!planned.facts.length) return;
    startQuiz(planned.facts, { what: runWhat });
  };

  const setSelection = (selection: Selection) =>
    set((prev) => ({ ...prev, selection }));

  return (
    // Reading-width column, like Settings and the Learn feed: the setup rows are
    // label-left / control-right, so on a wide monitor an uncapped column strands
    // each control a screen away from its label. Cap it so they stay together.
    <div className="max-w-3xl">
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

      <Lbl tone="accent">What to practice</Lbl>
      <PracticeSelector
        sel={cfg.selection}
        lists={lists}
        history={history}
        metric={cfg.accuracyMetric}
        now={mountedNow ?? 0}
        graduateRuns={cfg.graduateRuns}
        onChange={setSelection}
      />

      <Lbl tone="accent">How to ask</Lbl>
      <QuizOptionsFields />

      <StartBar
        cfg={cfg}
        what={runWhat}
        count={questionCount}
        plannedCount={planned.count}
        reachability={reachability}
        onStart={start}
      />
    </div>
  );
}
