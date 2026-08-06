"use client";

// HOW a practice run asks. Collapsed to two knobs: Mode and Length. Everything
// else about how to ask — the prompt format (audio on/off), whether missed cards
// requeue, responses, answer format, direction, and every pair/grid
// relationship — is either a Settings-page preference or automatic and always-on
// (see askFromAudioPrompts and the forced-full pair/grid sets in
// normalizeConfig), so nothing here can be toggled into a state that breaks a
// lesson. The prompt-format and requeue toggles moved to Settings because they
// are environmental preferences, not per-run choices.

import { Card, Chip, Row, SmallBtn } from "@/components/ui";
import { useQuizConfig } from "@/lib/quiz-config";

export function QuizOptionsFields() {
  const { cfg, update } = useQuizConfig();

  return (
    <Card>
      <Row label="Mode">
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
        <Chip
          on={cfg.mode === "number-reading"}
          onClick={() => update({ mode: "number-reading" })}
        >
          Numbers
        </Chip>
      </Row>

      {cfg.mode === "drill" || cfg.mode === "pairs" ? (
        <>
          <Row label="Length">
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
              <>
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
              </>
            ) : null}
          </Row>
        </>
      ) : null}
    </Card>
  );
}
