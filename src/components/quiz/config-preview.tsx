"use client";

// The config summary line, plus a "Change" toggle that expands the real editor
// inline. It exists for the launch points that drop STRAIGHT into a drill — the
// Library's "Quiz me" pre-start modal, the rest screen between rounds — where
// the "How to ask" settings are otherwise invisible: the quiz just starts and
// the learner has no way to see, let alone change, the direction / style /
// length it will run with. Practice already shows QuizOptionsFields inline and
// needs none of this.
//
// IT DOES NOT OWN OR MOVE THE CONFIG. Expanding renders the SAME
// QuizOptionsFields Practice uses, which reads and writes the one global config
// through useQuizConfig. So the summary here, the editor here, and the Practice
// page all edit the same settings — change something in the expanded panel and
// the summary above it updates live, because both read the same live cfg. It is
// an accordion, deliberately NOT a nested modal: at the Library launch point
// this already sits inside a dialog, and a dialog opening a second dialog to
// edit a line it is showing is the kind of stack this app keeps flat.

import { useState } from "react";

import { QuizOptionsFields } from "@/components/practice/quiz-options";
import { SmallBtn } from "@/components/ui";
import { configSummary } from "@/lib/config-summary";
import { useQuizConfig } from "@/lib/quiz-config";

export function ConfigPreview() {
  const { cfg } = useQuizConfig();
  const [open, setOpen] = useState(false);

  return (
    // Its own recessed panel so the summary and the editor it expands read as
    // one quiet unit distinct from the buttons around them, in both the modal
    // and on the rest screen. bg-panel is the RECESSED tone (see Metric's note
    // in ui.tsx) — right for a thing nested inside a card, which is where both
    // call sites put it.
    <div className="rounded-lg border border-border bg-panel px-3 py-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        {/* The line the drill will actually run with. Muted, because it is a
            read-out and not a control — the one control here is "Change". */}
        <span className="min-w-0 text-[13px] text-text-muted">
          {configSummary(cfg)}
        </span>
        {/* `sel` while open so the toggle wears the accent state that says
            "this is the thing currently expanded", matching every other toggle
            in the app. */}
        <SmallBtn
          sel={open}
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
        >
          {open ? "Done" : "Change"}
        </SmallBtn>
      </div>
      {open ? (
        // A hairline rule sets the editor off from the summary, the same way
        // QuizOptionsFields' own Rows separate from each other. The negative
        // margin lets the rule run the full width of the panel while the fields
        // keep the panel's horizontal padding.
        <div className="mt-2 border-t border-border pt-1">
          <QuizOptionsFields />
        </div>
      ) : null}
    </div>
  );
}
