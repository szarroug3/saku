"use client";

// The end of a round: the fork.
//
// Two ways on — pick what to retry (your misses are already ticked, so the
// common path is one tap), or complete the round and take the break. Retries
// come back HERE; only Complete round leaves.
//
// This screen is allowed to show content, and that is not an inconsistency
// with the rest screen being empty. You are still in the round here: you have
// just answered these, the answers are still in your head, and showing you
// what you missed is the whole point of a fork that offers to re-ask them. The
// emptiness rule starts at Complete round, because that is where the rest
// starts and the rest is the only thing the rest is for.
//
// TWO SECTIONS, GROUPED BY OUTCOME
// ================================
// The body is split into NEEDS WORK and SOLID — the two piles the header counts.
// The unit is the FORM: one way a fact was asked ("hear it → pick the meaning"),
// not the SHOWING. A form missed and re-asked is one form, not two questions, so
// a keigo item asked three ways with one miss reads "3 forms · 2 solid · 1 needs
// work" — the double-count the old showing-based header carried is gone.
//
// Each section is the same WordTable the results board uses (a row per word, its
// forms as cells), filtered to one outcome. Needs work comes FIRST because it is
// the actionable half: those forms open pre-ticked and the Retry button re-asks
// them. Every cell still says how the card was asked, how it went, and — for a
// miss — what you answered instead, never the answer itself: you are about to be
// re-asked these.

import { useState } from "react";

import {
  factOfBoxKey,
  missedBoxKeysForFacts,
  roundFormCounts,
  roundFormsByOutcome,
  type BoxKey,
  WordTable,
} from "@/components/results/word-table";
import { Btn, Card, Hint } from "@/components/ui";
import { factInfo } from "@/lib/facts";
import {
  roundCompleteView,
  SESSION_ROUND_TARGET,
  type StudySession,
} from "@/lib/session";
import type { FactId } from "@/types";

import { retryHint } from "./retry-grouping";

/** The recovered line's glyph — what a retry earned back. Never paired with its
 * answer: you may be about to be asked these again. */
function factGlyph(f: FactId): string {
  return factInfo(f)?.glyph ?? (f as string);
}

export function RoundComplete({
  session,
  onRetry,
  onComplete,
}: {
  session: StudySession;
  onRetry: (facts: FactId[], boxes: BoxKey[]) => void;
  onComplete: () => void;
}) {
  // TWO lists, and the difference is the bug this screen was fixed for. The
  // header counts describe the round you PLAYED (`answered` / `missed`); the
  // picker offers the WHOLE drill (`selection`), so ending a round early still
  // lets you retry anything that was in it, not just the ones you reached.
  //
  // `missed` stays HISTORICAL — you did miss these, and no later leg gets to
  // edit that. `recovered` and `outstanding` split it by what is still true
  // now, and only `outstanding` reaches the picker. That split is the whole of
  // the "my perfect retry left no trace" fix: the round keeps its record, the
  // OFFER stops re-offering work you have already done.
  const { selection, answered, recovered, outstanding } =
    roundCompleteView(session);

  // The header, in FORMS: solid = landed first try, needsWork = missed or
  // recovered, totalForms = the two summed. Counted over the ANSWERED facts
  // (what the round played), never the full selection — an unreached form is not
  // a miss. See roundFormCounts / roundFormsByOutcome for the form-vs-showing
  // distinction this replaced.
  const { solid, needsWork, totalForms } = roundFormCounts(
    answered,
    session.roundStats,
  );

  // The same forms as BOXES, so each section renders only its own outcome. The
  // sets are derived from the identical classification the counts use, so the
  // header and the two lists can never disagree.
  const { solid: solidBoxList, needsWork: needsWorkBoxList } =
    roundFormsByOutcome(answered, session.roundStats);
  const solidBoxes = new Set(solidBoxList);
  const needsWorkBoxes = new Set(needsWorkBoxList);

  // The OUTSTANDING misses open pre-ticked. So the default "Retry N" IS "retry
  // what's still open" — the same one tap the old dedicated button gave, now
  // folded into the picker instead of sitting beside it as a second, redundant
  // control. Pre-ticking `missed` was the bug: clear both misses on a retry and
  // the screen came back offering to retry them again, which is why the tester
  // could not tell a perfect retry from no retry at all.
  const [picked, setPicked] = useState<Set<BoxKey>>(
    () => new Set(missedBoxKeysForFacts(outstanding, session.roundStats)),
  );

  // One toggle, shared by both sections — a tap lights or clears a form for the
  // retry, whichever pile it lives in.
  const toggle = (box: BoxKey) =>
    setPicked((prev) => {
      const next = new Set(prev);
      if (!next.delete(box)) next.add(box);
      return next;
    });

  const pickedFacts = [...picked]
    .map((box) => factOfBoxKey(box))
    .filter((f): f is FactId => !!f);
  const pickedList = [...new Set(pickedFacts)].filter((f) =>
    selection.includes(f),
  );
  const pickedBoxes = [...picked];

  return (
    <>
      <Card>
        <h1 className="text-[22px] font-light tracking-[-0.3px]">
          Round {session.round}
        </h1>
        {/* Three numbers in ONE unit (distinct FORMS), and the total is the
            other two summed, so the line adds up by construction. It used to
            count showings and read "5 questions · 4 right first try · 2 missed"
            for a round that only asked three distinct forms — the re-ask of a
            miss counted as its own question. See roundFormCounts. */}
        <p className="mb-3 mt-0.5 text-[13px] text-text-muted">
          {totalForms} form{totalForms === 1 ? "" : "s"} · {solid} solid ·{" "}
          {needsWork} needs work
        </p>

        {/* One bar, two piles. No percentage: you can count the cells. */}
        <div className="mb-3.5 flex h-1.5 overflow-hidden rounded-full bg-panel">
          {solid > 0 ? (
            <span className="block h-full bg-success" style={{ flex: solid }} />
          ) : null}
          {needsWork > 0 ? (
            <span
              className="block h-full bg-danger"
              style={{ flex: needsWork }}
            />
          ) : null}
        </div>

        {/* What the retry earned, named. Glyphs only, same rule as the chips:
            you may be about to be asked these again. */}
        {recovered.length ? (
          <p className="mb-3.5 text-[13px] text-success">
            Back on the retry: {recovered.map(factGlyph).join(" ")}
          </p>
        ) : null}

        {/* NEEDS WORK first — the actionable pile. Each cell is a form you
            missed or only got after another look: the phrase, how it went, and
            what you answered instead (never the answer — it may be re-asked).
            Outstanding misses open pre-ticked; recovered forms show here too but
            open un-ticked, since the "Back on the retry" line already accounts
            for them. Tapping a cell adds or drops it from the retry. */}
        {needsWorkBoxes.size ? (
          <div className="border-t border-border pt-3">
            <p className="text-[9.5px] uppercase tracking-[0.13em] text-text-muted">
              Needs work
            </p>
            <p className="mb-3 mt-0.5">
              <Hint>{retryHint(outstanding.length, recovered.length)}</Hint>
            </p>
            <WordTable
              facts={answered}
              stats={session.roundStats}
              showOnly={needsWorkBoxes}
              isSelected={(box) => picked.has(box)}
              onToggle={toggle}
            />
          </div>
        ) : null}

        {/* SOLID — the quiet "you nailed these" list. First-try forms only, no
            "said" and no status marker. Tappable through the same picker so you
            can fold one back into a retry if you want, but it opens un-ticked
            and adds nothing to Retry by default. */}
        {solidBoxes.size ? (
          <div className="mt-3.5 border-t border-border pt-3">
            <p className="mb-3 text-[9.5px] uppercase tracking-[0.13em] text-text-muted">
              Solid
            </p>
            <WordTable
              facts={answered}
              stats={session.roundStats}
              showOnly={solidBoxes}
              solidTone
              isSelected={(box) => picked.has(box)}
              onToggle={toggle}
            />
          </div>
        ) : null}

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <Btn
            sel
            disabled={!pickedBoxes.length}
            className="disabled:cursor-default disabled:opacity-45"
            onClick={() => onRetry(pickedList, pickedBoxes)}
          >
            Retry {pickedBoxes.length || "…"}
          </Btn>
          <Btn go className="ml-auto" onClick={onComplete}>
            {session.round >= SESSION_ROUND_TARGET
              ? "Complete session"
              : "Complete round"}
          </Btn>
        </div>
      </Card>

      <Card className="px-[15px] py-[13px]">
        {/* The second sentence has to name the button that is actually on
            screen, and say what that button actually does. On the last round it
            reads "Complete session", and there is no break after it — the
            session ends. The old line said "Complete round starts the break"
            unconditionally, which on the final round named a button that wasn't
            there and promised a rest that wasn't coming. */}
        <Hint>
          Retries bring you back to this screen.{" "}
          {session.round >= SESSION_ROUND_TARGET ? (
            <>
              <b>Complete session</b> finishes for good.
            </>
          ) : (
            <>
              <b>Complete round</b> starts the break.
            </>
          )}
        </Hint>
      </Card>
    </>
  );
}
