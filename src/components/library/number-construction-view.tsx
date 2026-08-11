"use client";

// A NUMBER-CONSTRUCTION PAGE — how one category of number or count is BUILT.
//
// It is the term/concept page's cousin (see term-view.tsx, grammar-concept-
// view.tsx) and built from the same pieces: the lesson's own IntroBody for the
// prose and the grammar-styled count tables (IntroCountTableGroup) for the worked
// examples, so a reference page reads exactly like the lesson rule card it
// mirrors. The prose sits in one Card; the example tables sit UNDERNEATH it, in
// their own Card, split into "Regular" and "Irregular" the way the grammar pages
// split regular conjugation from its exceptions.
//
// IT NO LONGER OWNS ITS OWN "Quiz me" BUTTON. The action lives in the shared page
// action bar (SliceBar) beside "Add to list", the same one-bar layout every other
// Library entry page uses; the entry page threads this page's quizConfig to it.

import {
  IntroBody,
  IntroCountTables,
} from "@/components/lesson/phase-intro-view";
import { Card } from "@/components/ui";
import type { NumberConstruction } from "@/data/number-construction";

export function NumberConstructionView({
  construction,
  hideExamples = false,
}: {
  construction: NumberConstruction;
  /** Drop the worked-example count tables. The redesigned counter page removes
   * them — each counter's exceptions are stated in its prose (一本 → いっぽん),
   * so the full 1–10 tables were more than the page needs. */
  hideExamples?: boolean;
}) {
  return (
    <>
      {/* The prose, one Card, off the lesson's own IntroBody so a construction
          page and the lesson rule card cannot drift. No `measure` cap: the Card
          is already a sized column. */}
      <Card className="mb-3.5">
        <IntroBody body={construction.body} measure="" />
      </Card>

      {!hideExamples && construction.exampleGroups.length > 0 ? (
        <Card className="mb-3.5">
          <IntroCountTables groups={construction.exampleGroups} />
        </Card>
      ) : null}
    </>
  );
}
