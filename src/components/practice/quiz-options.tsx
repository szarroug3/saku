"use client";

// HOW a practice run asks. Collapsed to four knobs: Mode, Prompt Format (drill
// only), Length, and Requeue. Everything else about how to ask — responses,
// answer format, direction, and every pair/grid relationship — is automatic and
// always-on (see askFromInput and the forced-full pair/grid sets in
// normalizeConfig), so nothing here can be toggled into a state that breaks a
// lesson.

import { Card, Chip, Row, SmallBtn } from "@/components/ui";
import { useQuizConfig } from "@/lib/quiz-config";
import type { InputFormat } from "@/types";

const INPUT_LABEL: Record<InputFormat, string> = {
  text: "Text",
  audio: "Audio",
  both: "Both",
};

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
      </Row>

      {cfg.mode === "drill" ? (
        <Row label="Prompt Format">
          {(["text", "audio", "both"] as const).map((v) => (
            <Chip
              key={v}
              on={cfg.input === v}
              onClick={() => update({ input: v })}
            >
              {INPUT_LABEL[v]}
            </Chip>
          ))}
        </Row>
      ) : null}

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
          <Row label="Requeue when wrong">
            <Chip on={cfg.requeue} onClick={() => update({ requeue: true })}>
              On
            </Chip>
            <Chip on={!cfg.requeue} onClick={() => update({ requeue: false })}>
              Off
            </Chip>
          </Row>
        </>
      ) : null}
    </Card>
  );
}
