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

import { useMemo, useState } from "react";

import {
  boxKeysForFacts,
  factOfBoxKey,
  missedBoxKeysForFacts,
  type BoxKey,
} from "@/components/results/word-table";
import { Board } from "@/components/results/triage-board";
import { ResultsCard } from "@/components/results/results-card";
import {
  historyBefore,
  runFactsFromSession,
  summarize,
} from "@/components/results/summary";
import { Btn, Card, FlatSurfaceProvider, Hint, SmallBtn } from "@/components/ui";
import { entryDisplayLabel } from "@/components/results/entry-display-label";
import { factInfo } from "@/lib/facts";
import {
  roundCompleteView,
  roundTargetOf,
  type StudySession,
} from "@/lib/session";
import { useHistory } from "@/lib/use-history";
import type { EntryId, FactId } from "@/types";

import { retryButtonLabel, retryHint } from "./retry-grouping";

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

  // Row headings, one look per fact — never one look per entry. A transitivity
  // pair (出る／出す) mints both sides onto the SAME entry (see
  // src/data/transitivity-facts.ts), so grouping the table's rows off the
  // entry's own glyph (WordTable's default when no `displayEntry` is passed)
  // silently named every row after whichever side was minted first, however
  // few of that side's questions this round actually asked. See SAK-20 and
  // entry-display-label.ts's header for the general rule this closes.
  const { history } = useHistory();
  const displayEntry = (entry: EntryId, fact: FactId): string =>
    entryDisplayLabel(entry, fact, history);

  // The SAME ring/headline/counts sentence and the SAME needs-work/solid board
  // the practice Results page renders (see results-card.tsx, triage-board.tsx,
  // summary.ts) — round-complete used to reimplement both, in a different unit
  // (forms, not facts) and without the ring or All/None selection. "Prior" is
  // cut at the SESSION's start, not "now": every earlier round of THIS session
  // is already committed to `history` by the time a later round's fork renders
  // (closeRound commits as each round closes), and prior/needsWork's own
  // "first clean pass" read must not count this session's own rounds as
  // evidence of themselves.
  const prior = useMemo(
    () => historyBefore(history, session.startedAt),
    [history, session.startedAt],
  );
  const run = useMemo(
    () => runFactsFromSession(session.roundStats),
    [session.roundStats],
  );
  const summary = useMemo(
    () => summarize(run, session.roundStats, prior, []),
    [run, session.roundStats, prior],
  );

  const allBoxes = new Set(boxKeysForFacts(run.facts, session.roundStats));
  const needsWorkBoxes = new Set(
    missedBoxKeysForFacts(run.facts, session.roundStats),
  );
  const notAnsweredBoxes = new Set(
    boxKeysForFacts(run.notAnswered, session.roundStats),
  );
  const solidBoxes = new Set(
    [...allBoxes].filter(
      (b) => !needsWorkBoxes.has(b) && !notAnsweredBoxes.has(b),
    ),
  );

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
  const setVisible = (boxes: Set<BoxKey>, on: boolean) =>
    setPicked((prev) => {
      const next = new Set(prev);
      for (const b of boxes) if (on) next.add(b);
        else next.delete(b);
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
    // Both Cards below de-box via context rather than each hand-stripping
    // its own chrome — the same pattern EntrySurface uses for the redesigned
    // Library entry pages. See useBorderlessSurface in ui.tsx. SAK-21.
    <FlatSurfaceProvider borderless>
      <Card>
        <h1 className="mb-3 text-[22px] font-light tracking-[-0.3px]">
          Round {session.round}
        </h1>

        {/* The same ring/headline/counts card every results screen shows —
            see results-card.tsx. Replaces the old form-counted text line and
            solid/danger bar: the ring carries that signal now. */}
        <div className="mb-3.5">
          <ResultsCard
            pct={run.pct}
            headline={summary.headline}
            detail={summary.detail}
            counts={summary.counts}
          />
        </div>

        {/* What the retry earned, named. Glyphs only, same rule as the chips:
            you may be about to be asked these again. */}
        {recovered.length ? (
          <p className="mb-3.5 text-[13px] text-success">
            Back on the retry: {recovered.map(factGlyph).join(" ")}
          </p>
        ) : null}

        {/* NEEDS WORK first — the actionable pile, in the SAME board the
            practice Results page uses (label, count, All/None, WordTable —
            see triage-board.tsx's Board). Outstanding misses open pre-ticked;
            recovered forms show here too but open un-ticked, since the "Back
            on the retry" line already accounts for them. */}
        {needsWorkBoxes.size ? (
          <div className="border-t border-border pt-3">
            <p className="mb-3 text-[13px] text-text-muted">
              <Hint>{retryHint(outstanding.length, recovered.length)}</Hint>
            </p>
            <Board
              label="Needs work"
              facts={run.facts}
              stats={session.roundStats}
              visibleBoxes={needsWorkBoxes}
              selected={picked}
              onToggle={toggle}
              onSetVisible={setVisible}
              displayEntry={displayEntry}
            />
          </div>
        ) : null}

        {/* SOLID — the quiet "you nailed these" list. Tappable through the
            same picker so you can fold one back into a retry if you want, but
            it opens un-ticked and adds nothing to Retry by default. */}
        {solidBoxes.size ? (
          <div className="mt-3.5 border-t border-border pt-3">
            <Board
              label="Solid"
              facts={run.facts}
              stats={session.roundStats}
              visibleBoxes={solidBoxes}
              solidTone
              selected={picked}
              onToggle={toggle}
              onSetVisible={setVisible}
              displayEntry={displayEntry}
            />
          </div>
        ) : null}

        <div className="mt-4 flex flex-wrap items-start justify-between gap-2">
          <div className="flex flex-col items-start gap-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <SmallBtn
                sel
                disabled={!pickedBoxes.length}
                onClick={() => onRetry(pickedList, pickedBoxes)}
              >
                {retryButtonLabel(pickedBoxes.length)}
              </SmallBtn>
              {/* Nothing needs work — "Retry 0 selected" would sit there
                  disabled and meaningless (same reasoning as the practice
                  Results page's own nothingToFix branch — see triage-board.tsx).
                  Retry the WHOLE round instead, same mechanism, full selection. */}
              {!needsWorkBoxes.size && answered.length ? (
                <SmallBtn onClick={() => onRetry(answered, [...allBoxes])}>
                  Retry all
                </SmallBtn>
              ) : null}
            </div>
            <Hint>Retries bring you back to this screen.</Hint>
          </div>

          <div className="flex flex-col items-end gap-1.5">
            <Btn go onClick={onComplete}>
              {session.round >= roundTargetOf(session)
                ? "Complete session"
                : "Complete round"}
            </Btn>
            {/* This sentence has to name the button directly above it, and say
                what that button actually does. On the last round it reads
                "Complete session", and there is no break after it — the
                session ends. The old line said "Complete round starts the
                break" unconditionally, which on the final round named a
                button that wasn't there and promised a rest that wasn't
                coming. See SAK-21 (Changes Requested). */}
            <Hint>
              {session.round >= roundTargetOf(session) ? (
                <>
                  <b>Complete session</b> finishes for good.
                </>
              ) : (
                <>
                  <b>Complete round</b> starts the break.
                </>
              )}
            </Hint>
          </div>
        </div>
      </Card>
    </FlatSurfaceProvider>
  );
}
