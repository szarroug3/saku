"use client";

// Active-quiz + results state shared across routes. A quiz flows
// setup (/) → startQuiz → /quiz (mode screen) → finishQuiz → /results.
// Stored sessions reopen through viewStoredSession → /results.

import { useRouter } from "next/navigation";
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

import { computeResults } from "@/lib/engine";
import { useQuizConfig } from "@/lib/quiz-config";
import type { QuizMode, QuizSessionRecord, SessionStats } from "@/types";

export interface ActiveQuiz {
  /** The chars this run draws from (selection, or the misses on a redrill). */
  chars: string[];
  redrill: boolean;
  /** Forces limited/full-coverage regardless of cfg (used by redrill). */
  forceCoverage: boolean;
}

export interface ResultsPayload {
  mode: QuizMode;
  redrill: boolean;
  ts: number;
  stats: SessionStats;
  /** Set when reopening an old stored session that has no detail. */
  summaryOnly?: { forgivingPct: number; strictPct: number };
}

interface QuizSessionContextValue {
  /** Non-null while a quiz screen should be live. */
  active: ActiveQuiz | null;
  /** Non-null when /results has something to show. */
  results: ResultsPayload | null;
  /** Begin a quiz over `chars` with the current cfg; navigates to /quiz. */
  startQuiz(chars: string[], opts?: { redrill?: boolean }): void;
  /** End the active quiz: compute results, POST /api/session, go to /results. */
  finishQuiz(stats: SessionStats): void;
  /** Drop the active quiz without scoring (back-to-setup / nav away). */
  abandonQuiz(): void;
  /** Reopen a stored session's results (detail or summary-only fallback). */
  viewStoredSession(record: QuizSessionRecord): void;
}

const QuizSessionContext = createContext<QuizSessionContextValue | null>(null);

export function QuizSessionProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const { cfg } = useQuizConfig();
  const [active, setActive] = useState<ActiveQuiz | null>(null);
  const [results, setResults] = useState<ResultsPayload | null>(null);
  // cfg at the moment the quiz started (mode may change on the setup screen
  // while a finished quiz's results are still around).
  const modeRef = useRef<QuizMode>(cfg.mode);
  const redrillRef = useRef(false);

  const startQuiz = useCallback(
    (chars: string[], opts?: { redrill?: boolean }) => {
      if (!chars.length) return;
      modeRef.current = cfg.mode;
      redrillRef.current = !!opts?.redrill;
      setActive({
        chars,
        redrill: !!opts?.redrill,
        forceCoverage: !!opts?.redrill,
      });
      router.push("/quiz");
    },
    [cfg.mode, router],
  );

  const finishQuiz = useCallback(
    (stats: SessionStats) => {
      const s = computeResults(stats);
      setActive(null);
      if (!s.total) {
        router.push("/");
        return;
      }
      const ts = Date.now();
      setResults({
        mode: modeRef.current,
        redrill: redrillRef.current,
        ts,
        stats,
      });
      // Same payload the legacy app posted; fire-and-forget.
      const chars: QuizSessionRecord["chars"] = {};
      for (const c of s.chars) {
        chars[c] = {
          seen: stats[c].seen,
          missed: stats[c].misses,
          slow: stats[c].slow,
        };
      }
      const record: QuizSessionRecord = {
        ts,
        mode: modeRef.current,
        redrill: redrillRef.current,
        total: s.total,
        forgivingPct: s.total ? Math.round((100 * s.forg) / s.total) : 0,
        strictPct: s.total ? Math.round((100 * s.strict) / s.total) : 0,
        chars,
        detail: stats,
      };
      fetch("/api/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(record),
      }).catch(() => {});
      router.push("/results");
    },
    [router],
  );

  const abandonQuiz = useCallback(() => {
    setActive(null);
  }, []);

  const viewStoredSession = useCallback(
    (record: QuizSessionRecord) => {
      const stats: SessionStats = {};
      let summaryOnly: ResultsPayload["summaryOnly"];
      if (record.detail) {
        // Defaults guard against partial detail objects in older files.
        const empty = {
          seen: 0,
          misses: 0,
          everCorrect: false,
          firstTryCorrect: null,
          slow: 0,
          confused: {},
        };
        for (const [c, d] of Object.entries(record.detail)) {
          stats[c] = { ...empty, ...d };
        }
      } else {
        // Older sessions only stored aggregates — approximate a view.
        for (const [c, a] of Object.entries(record.chars ?? {})) {
          stats[c] = {
            seen: a.seen,
            misses: a.missed,
            everCorrect: a.missed === 0 && record.forgivingPct === 100,
            firstTryCorrect: null,
            slow: a.slow,
            confused: {},
          };
        }
        summaryOnly = {
          forgivingPct: record.forgivingPct,
          strictPct: record.strictPct,
        };
      }
      setResults({
        mode: record.mode,
        redrill: record.redrill,
        ts: record.ts,
        stats,
        summaryOnly,
      });
      router.push("/results");
    },
    [router],
  );

  const value = useMemo(
    () => ({
      active,
      results,
      startQuiz,
      finishQuiz,
      abandonQuiz,
      viewStoredSession,
    }),
    [active, results, startQuiz, finishQuiz, abandonQuiz, viewStoredSession],
  );
  return (
    <QuizSessionContext.Provider value={value}>
      {children}
    </QuizSessionContext.Provider>
  );
}

export function useQuizSession(): QuizSessionContextValue {
  const ctx = useContext(QuizSessionContext);
  if (!ctx) throw new Error("useQuizSession outside QuizSessionProvider");
  return ctx;
}
