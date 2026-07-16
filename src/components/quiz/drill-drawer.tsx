"use client";

// Mid-drill settings drawer — every control writes straight to useQuizConfig,
// the same live settings the Settings page edits, so changes apply instantly
// (the drill screen reads cfg on every render / submit / timer restart).
// Ported from the legacy renderDrawer/bindDrill drawer rows; the legacy
// random-font row is dropped (fonts are a Settings-page multi-select now).
//
// The four HUD rows at the bottom are what make the drill screen one view
// instead of three: all off is zen, all on is instrumented, and because they
// are live like everything else here you can feel the difference mid-card
// rather than having to end the session to try it.

import { useState } from "react";

import { Btn, Row, SmallBtn } from "@/components/ui";
import { useQuizConfig } from "@/lib/quiz-config";

function OnOff({ on, toggle }: { on: boolean; toggle: () => void }) {
  return (
    <Btn sel={on} onClick={toggle}>
      {on ? "On" : "Off"}
    </Btn>
  );
}

export function DrillDrawer() {
  const { cfg, update } = useQuizConfig();
  // Draft of the timer number input while focused, so cfg echoes don't
  // overwrite what the user is mid-typing (legacy renderDrawer behavior).
  const [numDraft, setNumDraft] = useState<string | null>(null);

  return (
    <div className="mt-4 rounded-[10px] bg-panel px-3.5 py-2.5 text-[13px]">
      <p className="mb-0.5 text-[13px] font-semibold uppercase tracking-[0.04em] text-text-muted">
        Drill view{" "}
        <span className="font-normal normal-case tracking-normal">
          — applies instantly
        </span>
      </p>
      <Row label="Timer">
        <OnOff on={cfg.timer} toggle={() => update({ timer: !cfg.timer })} />
        {cfg.timer ? (
          <>
            <input
              type="range"
              min={3}
              max={30}
              step={1}
              className="w-[90px] accent-accent"
              value={Math.min(30, cfg.timerSec)}
              onChange={(e) =>
                update({ timerSec: parseInt(e.target.value, 10) })
              }
            />
            <input
              type="number"
              min={1}
              max={600}
              className="w-[60px] rounded-md border border-border bg-card px-1.5 py-0.5 text-[13px] text-text"
              value={numDraft ?? String(cfg.timerSec)}
              onFocus={() => setNumDraft(String(cfg.timerSec))}
              onChange={(e) => {
                setNumDraft(e.target.value);
                const v = parseInt(e.target.value, 10);
                if (v >= 1) update({ timerSec: v });
              }}
              onBlur={() => setNumDraft(null)}
            />
            <span>s</span>
          </>
        ) : null}
      </Row>
      <Row label="Retries">
        <SmallBtn
          onClick={() => {
            if (cfg.retries === "lim" && cfg.retryN > 1)
              update({ retryN: cfg.retryN - 1 });
          }}
        >
          −
        </SmallBtn>
        <span>
          {cfg.retries === "unl" ? "∞" : cfg.retries === "none" ? "0" : cfg.retryN}
        </span>
        <SmallBtn
          onClick={() => {
            if (cfg.retries === "lim" && cfg.retryN < 9)
              update({ retryN: cfg.retryN + 1 });
          }}
        >
          +
        </SmallBtn>
      </Row>
      <Row label="Show correct answer">
        <OnOff
          on={cfg.showAnswer}
          toggle={() => update({ showAnswer: !cfg.showAnswer })}
        />
      </Row>
      <Row label="Script label">
        <OnOff
          on={cfg.scriptLabel}
          toggle={() => update({ scriptLabel: !cfg.scriptLabel })}
        />
      </Row>
      <Row label="Streak" hint="first-try correct in a row">
        <OnOff
          on={cfg.showStreak}
          toggle={() => update({ showStreak: !cfg.showStreak })}
        />
      </Row>
      <Row label="Live accuracy" hint="follows your accuracy setting">
        <OnOff
          on={cfg.showAccuracy}
          toggle={() => update({ showAccuracy: !cfg.showAccuracy })}
        />
      </Row>
      <Row label="Retry pips">
        <OnOff
          on={cfg.showRetryPips}
          toggle={() => update({ showRetryPips: !cfg.showRetryPips })}
        />
      </Row>
      <Row label="Fade controls" hint="they wake on mouse move">
        <OnOff
          on={cfg.fadeControls}
          toggle={() => update({ fadeControls: !cfg.fadeControls })}
        />
      </Row>
    </div>
  );
}
