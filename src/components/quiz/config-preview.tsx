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
    // Container-NEUTRAL: this draws no border or fill of its own. It used to
    // wrap itself in a recessed bg-panel box, which read as one quiet unit on
    // its own but stacked into a box-inside-a-box the moment a call site put it
    // inside a Card — the rest screen's `<Card><ConfigPreview/></Card>` drew two
    // near-concentric borders. So the surrounding container is now each call
    // site's job (the rest screen's Card is the box; the Library dialog and the
    // teach walk wrap it in their own recessed row), and this renders only the
    // summary line plus the editor it expands. A bare Fragment, so whatever
    // padding and material the call site chose is the only one in play.
    <>
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
        // QuizOptionsFields' own Rows separate from each other. It spans the
        // width the call site's container gives us, so the rule lines up with
        // that container's padding rather than owning padding of its own.
        <div className="mt-2 border-t border-border pt-1">
          <QuizOptionsFields />
        </div>
      ) : null}
    </>
  );
}
