"use client";

// HOW a practice run asks. Collapsed to two knobs: Mode and Length. Everything
// else about how to ask — the prompt format (audio on/off), whether missed cards
// requeue, responses, answer format, direction, and every pair/grid
// relationship — is either a Settings-page preference or automatic and always-on
// (see askFromAudioPrompts and the forced-full pair/grid sets in
// normalizeConfig), so nothing here can be toggled into a state that breaks a
// lesson. The prompt-format and requeue toggles moved to Settings because they
// are environmental preferences, not per-run choices.

import { Chip, Row, SmallBtn } from "@/components/ui";
import { useQuizConfig } from "@/lib/quiz-config";

export function QuizOptionsFields() {
  const { cfg, update } = useQuizConfig();

  return (
    <div className="mb-6">
      <Row
        label="Mode"
        info={
          <>
            Drill: one question at a time — you&apos;re shown a prompt and
            type or pick the answer, with retries if you miss it. Match
            pairs: a board of tiles — tap two that match (like a kana and its
            reading) until every pair is found. Grid: every selected item at
            once, each with its own box — fill in as many as you can; each
            one checks as you answer it. Substitution: shown a sentence
            pattern built on a verb you already know, then asked to write the
            same pattern using a different verb you know.
          </>
        }
      >
        <Chip on={cfg.mode === "drill"} onClick={() => update({ mode: "drill" })}>
          Drill
        </Chip>
        <Chip on={cfg.mode === "pairs"} onClick={() => update({ mode: "pairs" })}>
          Match pairs
        </Chip>
        <Chip on={cfg.mode === "grid"} onClick={() => update({ mode: "grid" })}>
          Grid
        </Chip>
        <Chip
          on={cfg.mode === "substitution"}
          onClick={() => update({ mode: "substitution" })}
        >
          Substitution
        </Chip>
      </Row>

      {cfg.mode === "drill" || cfg.mode === "pairs" ? (
        <>
          <Row
            label="Length"
            info={
              <>
                Endless: keeps asking for as long as you keep playing —
                there&apos;s no set end. Limited: stops after a fixed amount
                instead of running forever — choose Full coverage to ask
                everything currently selected exactly once, or a Count to say
                how much.
              </>
            }
          >
            <Chip
              on={cfg.length === "endless"}
              onClick={() => update({ length: "endless" })}
            >
              Endless
            </Chip>
            <Chip
              on={cfg.length === "limited"}
              onClick={() => update({ length: "limited" })}
            >
              Limited
            </Chip>
            {cfg.length === "limited" ? (
              // Full coverage/Count are a MODE of Limited, not a third top-level
              // choice beside Endless/Limited — cfg.limType only exists once
              // length is "limited" (see QuizConfig, quiz-config.tsx's default,
              // and every downstream read of limType). Flat chips of the same
              // shape as Endless/Limited made this read as three siblings, so
              // "Limited" and "Full coverage" could both look selected at once
              // with nothing showing one contained the other. The left rule
              // is the app's existing "this is subordinate" cue (see the same
              // border-l-2 border-accent pl-3.5 recipe in callout.tsx and
              // kana-entry-view.tsx) — here it visually hangs this pair off the
              // Limited chip it belongs to instead of floating beside it.
              <span className="flex flex-wrap items-center gap-1.5 border-l-2 border-accent pl-2.5">
                <SmallBtn
                  sel={cfg.limType === "cov"}
                  onClick={() => update({ limType: "cov" })}
                >
                  Full coverage
                </SmallBtn>
                <SmallBtn
                  sel={cfg.limType === "count"}
                  onClick={() => update({ limType: "count" })}
                >
                  Count
                </SmallBtn>
                <input
                  type="number"
                  min={1}
                  max={999}
                  disabled={cfg.limType !== "count"}
                  value={cfg.limCount}
                  onChange={(e) =>
                    update({
                      limCount: Math.max(
                        1,
                        Math.min(999, Number(e.target.value) || 1),
                      ),
                    })
                  }
                  aria-label="Question count"
                  className="kq-num w-20 rounded-lg border border-border bg-bg px-2 py-1.5 text-right text-sm text-text disabled:opacity-40"
                />
              </span>
            ) : null}
          </Row>
        </>
      ) : null}
    </div>
  );
}
