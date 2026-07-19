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
// THE PICKER IS GROUPED BY STANDING, LIKE THE RESULTS SCREEN
// ==========================================================
// The facts sit under the same adjective bands the Progress and Library
// screens use — shaky / slipping / getting there / solid — worst-first, so a
// miss you want another look at is where your eye already is. The band is a
// STATE, read from your history; it is never the answer. A retry chip is still
// the glyph and nothing else (see factGlyph): the band tells you how a
// character has been going, not what it says.

import { useState } from "react";

import { StandingChip } from "@/components/library/standing-chip";
import { Btn, Card, Hint, SmallBtn } from "@/components/ui";
import { factInfo } from "@/lib/facts";
import { standingFor } from "@/lib/library/standing";
import {
  roundCompleteView,
  SESSION_ROUND_TARGET,
  type StudySession,
} from "@/lib/session";
import { useQuizConfig } from "@/lib/quiz-config";
import { useHistory } from "@/lib/use-history";
import type { FactId } from "@/types";

import { groupByStanding, initialPicked } from "./retry-grouping";

/** A missed fact as a chip — the glyph, and nothing else. Not the answer:
 * you are about to be asked these again, and printing "し = shi" here would
 * hand you the answer key to the retry you are choosing. */
function factGlyph(f: FactId): string {
  return factInfo(f)?.glyph ?? (f as string);
}

export function RoundComplete({
  session,
  onRetry,
  onComplete,
}: {
  session: StudySession;
  onRetry: (facts: FactId[]) => void;
  onComplete: () => void;
}) {
  // TWO lists, and the difference is the bug this screen was fixed for. The
  // header counts describe the round you PLAYED (`answered` / `missed`); the
  // picker offers the WHOLE drill (`selection`), so ending a round early still
  // lets you retry anything that was in it, not just the ones you reached.
  const { selection, answered, missed, total, firstTry } =
    roundCompleteView(session);

  // Standing is a query over history, so it is read here — the same history,
  // claims and metric the Library and Progress screens paint from, so a
  // character reads "shaky" in exactly one voice across the app.
  const { history } = useHistory();
  const { cfg } = useQuizConfig();
  // ONE `now` per mount, not per render: two reads a millisecond apart must not
  // disagree about whether a fact is solid. Same rule as the Library page.
  const [now] = useState(() => Date.now());
  const claims = history.claims ?? {};
  const groups = groupByStanding(selection, (f) =>
    standingFor(history.facts, claims, f, cfg.accuracyMetric, now).standing,
  );

  // Which of the full selection you actually got to this round — used only to
  // dim the ones you skipped, never to change what's pickable. Glyph only,
  // still: no glyph here is paired with its answer.
  const wasAnswered = new Set(answered);

  // The misses open pre-ticked. So the default "Retry N" IS "retry the misses"
  // — the same one tap the old dedicated button gave, now folded into the
  // picker instead of sitting beside it as a second, redundant control.
  const [picked, setPicked] = useState<Record<string, boolean>>(() =>
    initialPicked(missed),
  );

  const pickedList = selection.filter((f) => picked[f]);

  return (
    <>
      <Card>
        <h1 className="text-[22px] font-light tracking-[-0.3px]">
          Round {session.round}
        </h1>
        <p className="mb-3 mt-0.5 text-[13px] text-text-muted">
          {total} question{total === 1 ? "" : "s"} · {firstTry} right first try ·{" "}
          {missed.length} missed
        </p>

        {/* One bar, two facts. No percentage: you can count the chips. */}
        <div className="mb-3.5 flex h-1.5 overflow-hidden rounded-full bg-panel">
          {firstTry > 0 ? (
            <span className="block h-full bg-success" style={{ flex: firstTry }} />
          ) : null}
          {total - firstTry > 0 ? (
            <span
              className="block h-full bg-danger"
              style={{ flex: total - firstTry }}
            />
          ) : null}
        </div>

        <div className="border-t border-border pt-3">
          <p className="text-[9.5px] uppercase tracking-[0.13em] text-text-muted">
            Pick what to retry
          </p>
          <p className="mb-3 mt-0.5">
            <Hint>
              {missed.length
                ? `Your ${missed.length} miss${missed.length === 1 ? "" : "es"} ${
                    missed.length === 1 ? "is" : "are"
                  } picked. Add or drop any character.`
                : "Nothing missed. Pick anything you want another look at."}
            </Hint>
          </p>

          <div className="flex flex-col gap-3">
            {groups.map(({ standing, facts }) => (
              <div
                key={standing}
                className="flex flex-wrap items-center gap-x-2.5 gap-y-1.5"
              >
                <StandingChip standing={standing} />
                {facts.map((f) => (
                  <SmallBtn
                    key={f}
                    sel={!!picked[f]}
                    className={
                      !picked[f] && !wasAnswered.has(f) ? "opacity-55" : ""
                    }
                    onClick={() => setPicked((p) => ({ ...p, [f]: !p[f] }))}
                  >
                    {factGlyph(f)}
                  </SmallBtn>
                ))}
              </div>
            ))}
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <Btn
            sel
            disabled={!pickedList.length}
            className="disabled:cursor-default disabled:opacity-45"
            onClick={() => onRetry(pickedList)}
          >
            Retry {pickedList.length || "…"}
          </Btn>
          <Btn go className="ml-auto" onClick={onComplete}>
            {session.round >= SESSION_ROUND_TARGET
              ? "Complete session"
              : "Complete round"}
          </Btn>
        </div>
      </Card>

      <Card className="px-[15px] py-[13px]">
        <Hint>
          Retries bring you back to this screen. <b>Complete round</b> starts the
          break.
        </Hint>
      </Card>
    </>
  );
}
