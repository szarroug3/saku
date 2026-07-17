"use client";

// Home — top to bottom, the order you build a quiz in.
//
//   0. resume        the quiz you left running, and ONLY if there is one
//   1. setup         HOW you drill, always visible, never behind a disclosure
//   2. selection     WHAT you drill, as a query
//   3. start bar     the whole quiz as a sentence, and the only Start
//
// THE RULE, and every line below serves it: whatever you are about to run is
// fully on screen before you run it, and only a button starts a quiz.
//
// WHAT CHANGED, and why the shelves are gone
// ==========================================
// This screen used to be two shelves of cards over a flat char→bool map
// (cfg.enabled), plus a 214-cell picker to fine-tune it. That was a good design
// for 214 things and it does not survive 21,449: there is no shelf of cards for
// "the useful subsets of a dictionary", and nobody fine-tunes 21,449
// checkboxes. The cards' cleverest property — that two overlapping ones
// deduped for free, because a map cannot hold a key twice — was real, and it
// was a property of the storage, not of the idea.
//
// So selection is a QUERY (see src/types/index.ts and src/lib/selection.ts).
// The dedup is still free, for a different reason: resolve() ends in a Set.
// What is new is that the selection now costs six fields instead of one key per
// thing in the app, and that "drill the kanji I'm shaky on" is a gesture you
// can actually make.
//
// The query lives in cfg.selection, and resolve() is the only thing that turns
// it into facts. Home does not know what a fact is, what a kanji is, or how
// many of either there are.

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import { QuizOptionsFields } from "@/components/home/quiz-options";
import { ResumeCard } from "@/components/home/resume-card";
import { SelectionCard } from "@/components/home/selection-card";
import { StartBar } from "@/components/home/start-bar";
import { Card, Lbl, PageTitle } from "@/components/ui";
import { useQuizConfig } from "@/lib/quiz-config";
import { useQuizSession } from "@/lib/quiz-session";
import { resolve, whatSentence } from "@/lib/selection";
import { useHistory } from "@/lib/use-history";
import { useLists } from "@/lib/use-lists";

export default function HomePage() {
  const router = useRouter();
  const { cfg, set } = useQuizConfig();
  const { active, progress, startQuiz, abandonQuiz } = useQuizSession();
  const { history } = useHistory();
  const { lists } = useLists();
  const [replacing, setReplacing] = useState(false);

  // The facts the query names, right now. This IS what Start hands to the quiz
  // and what the bar counts — one computation, so the sentence and the session
  // can never disagree about what you pressed Start on.
  //
  // Memoised on the query, the history and the lists for its IDENTITY as much
  // as its cost: resolve() walks every fact in the app, and it returns a fresh
  // array every call.
  const facts = useMemo(
    () => resolve(cfg.selection, history, lists, cfg.accuracyMetric),
    [cfg.selection, cfg.accuracyMetric, history, lists],
  );

  const what = useMemo(
    () => whatSentence(cfg.selection, facts.length, lists),
    [cfg.selection, facts.length, lists],
  );

  const start = () => {
    if (!facts.length) return;
    // Starting over a running quiz asks first — but on the page, not through
    // window.confirm. A native dialog is unstyleable, unreadable to anything
    // driving the app, and this is a two-state button, not an interruption.
    if (active && !replacing) {
      setReplacing(true);
      return;
    }
    // Replacing rather than abandoning-then-starting: startQuiz overwrites the
    // active quiz outright, and abandonQuiz first would only add a render with
    // no quiz in it.
    startQuiz(facts, { what });
  };

  return (
    <>
      <PageTitle title="Kana quiz" />

      {/* Not rendered at all with no quiz — see resume-card.tsx. A card that
          offers to resume nothing is the lie this replaced. */}
      {active ? (
        <ResumeCard
          active={active}
          progress={progress}
          onResume={() => router.push("/quiz")}
          onDiscard={abandonQuiz}
        />
      ) : null}

      <Lbl>Setup</Lbl>
      <Card>
        {/* Always open. This used to be a disclosure ("Edit setup") on the
            hero, which is how you got to press Start without being able to see
            the settings it would run with. Four rows is not a wall. */}
        <QuizOptionsFields />
      </Card>

      <SelectionCard
        sel={cfg.selection}
        lists={lists}
        onChange={(selection) => set((prev) => ({ ...prev, selection }))}
      />

      <StartBar
        cfg={cfg}
        what={what}
        count={facts.length}
        active={!!active}
        confirmingReplace={replacing}
        onStart={start}
        onCancelReplace={() => setReplacing(false)}
      />
    </>
  );
}
