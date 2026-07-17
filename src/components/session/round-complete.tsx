"use client";

// The end of a round: the fork.
//
// Three ways on — retry the misses, pick your own, or complete the round and
// take the break. Retries come back HERE; only Complete round leaves.
//
// This screen is allowed to show content, and that is not an inconsistency
// with the rest screen being empty. You are still in the round here: you have
// just answered these, the answers are still in your head, and showing you
// what you missed is the whole point of a fork that offers to re-ask them. The
// emptiness rule starts at Complete round, because that is where the rest
// starts and the rest is the only thing the rest is for.

import { useState } from "react";

import { Btn, Card, Hint, SmallBtn } from "@/components/ui";
import { factInfo } from "@/lib/facts";
import { roundCompleteView, type StudySession } from "@/lib/session";
import type { FactId } from "@/types";

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

  // Which of the full selection you actually got to this round — used only to
  // dim the ones you skipped, never to change what's pickable. Glyph only,
  // still: no glyph here is paired with its answer.
  const wasAnswered = new Set(answered);

  const [picking, setPicking] = useState(false);
  const [picked, setPicked] = useState<Record<string, boolean>>({});

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

        {missed.length ? (
          <div className="flex flex-wrap gap-1.5">
            {missed.map((f) => (
              <span
                key={f}
                className="kq-material rounded-full border border-danger/40 bg-danger-bg px-2.5 py-0.5 text-[11px] text-danger"
              >
                {factGlyph(f)}
              </span>
            ))}
          </div>
        ) : (
          <Hint>Nothing missed this round.</Hint>
        )}

        {picking ? (
          <div className="mt-4 border-t border-border pt-3">
            <p className="mb-2 text-[9.5px] uppercase tracking-[0.13em] text-text-muted">
              Pick what to retry
            </p>
            <div className="flex flex-wrap gap-1.5">
              {selection.map((f) => (
                <SmallBtn
                  key={f}
                  sel={!!picked[f]}
                  className={!picked[f] && !wasAnswered.has(f) ? "opacity-55" : ""}
                  onClick={() => setPicked((p) => ({ ...p, [f]: !p[f] }))}
                >
                  {factGlyph(f)}
                </SmallBtn>
              ))}
            </div>
          </div>
        ) : null}

        <div className="mt-4 flex flex-wrap items-center gap-2">
          {missed.length ? (
            <Btn sel onClick={() => onRetry(missed)}>
              Retry the {missed.length} miss{missed.length === 1 ? "" : "es"}
            </Btn>
          ) : null}
          {picking ? (
            <Btn
              disabled={!pickedList.length}
              className="disabled:cursor-default disabled:opacity-45"
              onClick={() => onRetry(pickedList)}
            >
              Retry {pickedList.length || "…"}
            </Btn>
          ) : (
            <Btn onClick={() => setPicking(true)}>Pick what to retry…</Btn>
          )}
          <Btn go className="ml-auto" onClick={onComplete}>
            Complete round
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
