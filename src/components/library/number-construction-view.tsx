"use client";

// A NUMBER-CONSTRUCTION PAGE — how one category of number or count is BUILT.
//
// It is the term/concept page's cousin (see term-view.tsx, grammar-concept-
// view.tsx) and built from the same pieces: the lesson's own IntroBody for the
// prose and IntroExamples for the worked table, so a reference page reads exactly
// like the lesson rule card it mirrors. The prose sits in one Card; the example
// table sits UNDERNEATH it, in its own Card, the way the phase-intro walk shows a
// rule beside its evidence.
//
// THE ONE THING IT DOES THAT A CONCEPT PAGE DOES NOT is offer a "Quiz me" button.
// The category carries a NumberQuizConfig (the tens quiz numbers to 99, the 本
// quiz counts 本), and the button launches a one-off number-reading round scoped
// to it — the same generative carrier Practice uses, but with this page's config
// instead of the default. It is a Practice-style one-off (no session), so the
// round's "Done" returns to Home without writing any record; a construction page
// stays read-only reference everywhere except this button.

import {
  IntroBody,
  IntroExamples,
} from "@/components/lesson/phase-intro-view";
import { Btn, Card } from "@/components/ui";
import { useQuizSession } from "@/lib/quiz-session";
import type { NumberConstruction } from "@/data/number-construction";
import type { FactId } from "@/types";

// Number reading is PROCEDURAL: it generates its own round and ignores the
// launch pool entirely. It still needs a non-empty facts array to begin a leg,
// so it rides one synthetic id the screen never reads — the same rider Practice
// uses. The round's scope comes from the page's quizConfig, threaded onto the
// leg's numberQuiz.
const NUMBER_READING_FACTS: FactId[] = ["number-reading:round" as FactId];

export function NumberConstructionView({
  construction,
}: {
  construction: NumberConstruction;
}) {
  const { startQuizInMode } = useQuizSession();

  const quizMe = () =>
    startQuizInMode(NUMBER_READING_FACTS, "number-reading", {
      what: construction.name,
      numberQuiz: construction.quizConfig,
    });

  return (
    <>
      {/* The prose, one Card, off the lesson's own IntroBody so a construction
          page and the lesson rule card cannot drift. No `measure` cap: the Card
          is already a sized column. */}
      <Card className="mb-3.5">
        <IntroBody body={construction.body} measure="" />
      </Card>

      {/* The worked example table, UNDERNEATH the prose in its own Card — the
          evidence for the rule above it. `bare` drops IntroExamples' own frame so
          it is not a box in a box; the Card is the box. */}
      {construction.examples.length > 0 ? (
        <Card className="mb-3.5">
          <IntroExamples examples={construction.examples} bare />
        </Card>
      ) : null}

      {/* Quiz me — launches the generative number-reading round scoped to this
          category. The one action a read-only reference page offers. */}
      <div className="mb-3.5">
        <Btn go onClick={quizMe}>
          Quiz me
        </Btn>
      </div>
    </>
  );
}
