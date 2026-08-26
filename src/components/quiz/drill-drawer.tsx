"use client";

import { useState } from "react";

import { PrimaryBtn, Btn, Chip, Row, SmallBtn } from "@/components/ui";
import { askFromAudioPrompts } from "@/lib/ask-config";
import { useQuizConfig } from "@/lib/quiz-config";

function OnOff({ on, toggle }: { on: boolean; toggle: () => void }) {
  return (
    <Btn sel={on} onClick={toggle}>
      {on ? "On" : "Off"}
    </Btn>
  );
}

export function DrillDrawer({ onClose }: { onClose: () => void }) {
  const { cfg, update } = useQuizConfig();
  const [draft, setDraft] = useState(() => ({ ...cfg }));
  const [numDraft, setNumDraft] = useState<string | null>(null);

  function patch(changes: Partial<typeof draft>) {
    setDraft((prev) => ({ ...prev, ...changes }));
  }

  function save() {
    update(draft);
    onClose();
  }

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative z-10 flex w-full max-w-sm flex-col rounded-xl border border-border bg-[var(--bg)] shadow-xl">
        <div className="overflow-y-auto px-4 pt-4 pb-2 text-[13px]">
          <p className="mb-2 text-[13px] font-semibold uppercase tracking-[0.04em] text-text-muted">
            Drill settings
          </p>
          <Row label="Audio prompts">
            <OnOff
              on={draft.audioPrompts}
              toggle={() =>
                patch({
                  audioPrompts: !draft.audioPrompts,
                  ask: askFromAudioPrompts(!draft.audioPrompts),
                })
              }
            />
          </Row>
          <Row label="Pitch questions" dim={!draft.audioPrompts}>
            <OnOff
              on={draft.pitchQuestions}
              toggle={() => patch({ pitchQuestions: !draft.pitchQuestions })}
            />
          </Row>
          <Row label="Timer">
            {draft.timer ? (
              <>
                <input
                  type="range"
                  min={3}
                  max={30}
                  step={1}
                  className="w-[90px] accent-accent"
                  value={Math.min(30, draft.timerSec)}
                  onChange={(e) => patch({ timerSec: parseInt(e.target.value, 10) })}
                />
                <input
                  type="number"
                  min={1}
                  max={600}
                  className="kq-num w-[60px] rounded-md border border-border bg-card px-1.5 py-0.5 text-[13px] text-text"
                  value={numDraft ?? String(draft.timerSec)}
                  onFocus={() => setNumDraft(String(draft.timerSec))}
                  onChange={(e) => {
                    setNumDraft(e.target.value);
                    const v = parseInt(e.target.value, 10);
                    if (v >= 1) patch({ timerSec: v });
                  }}
                  onBlur={() => setNumDraft(null)}
                />
                <span>s</span>
              </>
            ) : null}
            <OnOff on={draft.timer} toggle={() => patch({ timer: !draft.timer })} />
          </Row>
          <Row label="Retries">
            <Chip on={draft.retries === "none"} onClick={() => patch({ retries: "none" })}>
              None
            </Chip>
            <Chip on={draft.retries === "lim"} onClick={() => patch({ retries: "lim" })}>
              Limited
            </Chip>
            <Chip on={draft.retries === "unl"} onClick={() => patch({ retries: "unl" })}>
              Unlimited
            </Chip>
            {draft.retries === "lim" ? (
              <>
                <SmallBtn
                  disabled={draft.retryN <= 1}
                  onClick={() => patch({ retryN: draft.retryN - 1 })}
                >
                  −
                </SmallBtn>
                <span className="tabular-nums">{draft.retryN}</span>
                <SmallBtn
                  disabled={draft.retryN >= 9}
                  onClick={() => patch({ retryN: draft.retryN + 1 })}
                >
                  +
                </SmallBtn>
              </>
            ) : null}
          </Row>
          <Row label="Show correct answer">
            <OnOff on={draft.showAnswer} toggle={() => patch({ showAnswer: !draft.showAnswer })} />
          </Row>
          <Row label="Script label">
            <OnOff on={draft.scriptLabel} toggle={() => patch({ scriptLabel: !draft.scriptLabel })} />
          </Row>
          <Row label="Streak" hint="first-try correct in a row">
            <OnOff on={draft.showStreak} toggle={() => patch({ showStreak: !draft.showStreak })} />
          </Row>
          <Row label="Live accuracy">
            <OnOff on={draft.showAccuracy} toggle={() => patch({ showAccuracy: !draft.showAccuracy })} />
          </Row>
          <Row label="Retry pips">
            <OnOff on={draft.showRetryPips} toggle={() => patch({ showRetryPips: !draft.showRetryPips })} />
          </Row>
          <Row label="Fade controls" hint="they wake on mouse move">
            <OnOff on={draft.fadeControls} toggle={() => patch({ fadeControls: !draft.fadeControls })} />
          </Row>
        </div>
        <div className="flex gap-2 border-t border-border px-4 py-3">
          <PrimaryBtn className="flex-1" onClick={save}>Save</PrimaryBtn>
          <Btn className="flex-1" onClick={onClose}>Cancel</Btn>
        </div>
      </div>
    </div>
  );
}
