"use client";

// Results screen body: forgiving/strict toggle, metric cards, missed /
// slow / mix-up lists, and the redrill / again / back-to-setup actions.
// Renders a ResultsPayload from useQuizSession — either a live finish or a
// stored session reopened from Recent sessions (summary-only sessions show
// their stored percentages instead of recomputed ones).

import { useRouter } from "next/navigation";
import { useState } from "react";

import {
  Btn,
  Card,
  GhostBtn,
  Hint,
  Lbl,
  Metric,
  MetricsGrid,
  PageTitle,
} from "@/components/ui";
import { CHAR_INDEX } from "@/data/characters";
import { BEHAVIOR } from "@/lib/config";
import { computeResults, confusionPairs, missedChars } from "@/lib/engine";
import { selectedChars, useQuizConfig } from "@/lib/quiz-config";
import { useQuizSession, type ResultsPayload } from "@/lib/quiz-session";
import type { CharInfo, CharSessionDetail, QuizMode } from "@/types";

function modeName(m: QuizMode): string {
  return m === "pairs" ? "Match pairs" : m === "grid" ? "Grid" : "Drill";
}

/** One "missed characters" row: char + reading left, verdict right. */
function MissRow({
  char,
  stat,
  showAnswer,
}: {
  char: string;
  stat: CharSessionDetail;
  showAnswer: boolean;
}) {
  // Guard: a stored session may reference chars a future data change removed.
  const info = CHAR_INDEX[char] as CharInfo | undefined;
  const confused = Object.entries(stat.confused)
    .sort((a, b) => b[1] - a[1])
    .map(([x, n]) => `${x}${n > 1 ? ` ×${n}` : ""}`)
    .join(", ");
  const verdict = stat.everCorrect
    ? stat.misses
      ? `${stat.misses} ${stat.misses === 1 ? "miss" : "misses"} before correct`
      : "missed first try"
    : `never got it${showAnswer ? " · answer shown" : ""}`;
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-border px-1 py-2 text-sm last:border-b-0">
      <span>
        <span className="text-[20px]">{char}</span>{" "}
        {info ? (
          <Hint>
            {info.r[0]} · {info.setLabel.toLowerCase()}
          </Hint>
        ) : null}
      </span>
      <span className="text-right text-[13px] text-danger">
        {verdict}
        {confused ? (
          <span className="text-text-muted"> · confused with {confused}</span>
        ) : null}
      </span>
    </div>
  );
}

export function ResultsView({ results }: { results: ResultsPayload }) {
  const router = useRouter();
  const { cfg } = useQuizConfig();
  const { active, abandonQuiz, startQuiz } = useQuizSession();
  const [view, setView] = useState<"forg" | "strict">("forg");
  // Fixed at mount: a just-finished quiz shows time-of-day like the legacy
  // finish screen; anything older (reopened sessions) shows the full date.
  const [recent] = useState(() => Date.now() - results.ts < 60_000);

  const { stats, summaryOnly } = results;
  const s = computeResults(stats);
  const correct = view === "forg" ? s.forg : s.strict;
  // Summary-only sessions have no reliable per-char detail — show the
  // percentages the session stored instead of recomputing.
  const scorePct = summaryOnly
    ? view === "forg"
      ? summaryOnly.forgivingPct
      : summaryOnly.strictPct
    : s.total
      ? Math.round((100 * correct) / s.total)
      : null;

  const when = recent
    ? new Date(results.ts).toLocaleTimeString([], {
        hour: "numeric",
        minute: "2-digit",
      })
    : new Date(results.ts).toLocaleString();

  const missed = missedChars(stats, view);
  const slowChars = s.chars.filter((c) => stats[c].slow > 0);
  const pairs = confusionPairs(stats);

  /** Stored results can be viewed mid-quiz — starting a new run from here
   * must explicitly discard the one in progress. True = clear to start. */
  const discardActive = (): boolean => {
    if (!active) return true;
    if (!window.confirm("Discard the quiz in progress?")) return false;
    abandonQuiz();
    return true;
  };

  const redrill = () => {
    // Always redrill the forgiving misses regardless of the toggle.
    const chars = missedChars(stats, "forg");
    if (!chars.length) return;
    if (!discardActive()) return;
    startQuiz(chars, { redrill: true });
  };

  const again = () => {
    if (!discardActive()) return;
    startQuiz(selectedChars(cfg));
  };

  return (
    <>
      <PageTitle
        title="Results"
        sub={`${modeName(results.mode)}${results.redrill ? " (redrill)" : ""} · ${
          s.total
        } characters · ${when}${summaryOnly ? " · older session — summary only" : ""}`}
      />
      <div className="mb-3.5 flex flex-wrap gap-1.5">
        <Btn sel={view === "forg"} onClick={() => setView("forg")}>
          Forgiving <span className="text-[11px]">correct-after-retries counts</span>
        </Btn>
        <Btn sel={view === "strict"} onClick={() => setView("strict")}>
          Strict <span className="text-[11px]">first try only</span>
        </Btn>
      </div>
      <MetricsGrid>
        <Metric k="Score" v={scorePct === null ? "—" : `${scorePct}%`} />
        <Metric k="Correct" v={`${correct} / ${s.total}`} />
        <Metric k="Slow but right" v={s.slow} />
      </MetricsGrid>
      <Card>
        <Lbl>Missed characters</Lbl>
        {missed.length ? (
          missed.map((c) => (
            <MissRow key={c} char={c} stat={stats[c]} showAnswer={cfg.showAnswer} />
          ))
        ) : (
          <p>
            <Hint>Nothing missed. Clean run.</Hint>
          </p>
        )}
      </Card>
      {slowChars.length > 0 && (
        <Card>
          <Lbl>
            Slow but correct{" "}
            <span className="font-normal normal-case tracking-normal">
              — over {BEHAVIOR.slowAnswerMs / 1000}s
            </span>
          </Lbl>
          {slowChars.map((c) => (
            <div key={c} className="py-[3px] text-[13px] text-text-muted">
              <span className="text-[17px]">{c}</span>{" "}
              {(CHAR_INDEX[c] as CharInfo | undefined)?.r[0]} — right but slow
              {stats[c].slow > 1 ? ` ×${stats[c].slow}` : ""}
            </div>
          ))}
        </Card>
      )}
      {pairs.length > 0 && (
        <Card>
          <Lbl>Mix-up patterns</Lbl>
          {pairs.map(([key, n]) => {
            const [a, b] = key.split("·");
            return (
              <div key={key} className="py-[3px] text-[13px] text-text-muted">
                <span className="text-[17px]">
                  {a} ↔ {b}
                </span>{" "}
                mixed up {n}×
              </div>
            );
          })}
        </Card>
      )}
      <div className="flex flex-wrap gap-2">
        <Btn className="flex-1" onClick={redrill}>
          Redrill the misses
        </Btn>
        <Btn className="flex-1" onClick={again}>
          Same settings, go again
        </Btn>
        <GhostBtn
          className="flex-1 px-3.5 py-[7px]"
          onClick={() => router.push("/")}
        >
          Back to setup
        </GhostBtn>
      </div>
    </>
  );
}
