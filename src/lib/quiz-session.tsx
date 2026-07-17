"use client";

// Active-quiz + results state shared across routes. A quiz flows
// setup (/) → startQuiz → /quiz (mode screen) → finishQuiz → /results.
// Stored sessions reopen through viewStoredSession → /results.
//
// Tab-switching is allowed while a quiz runs: navigating away unmounts the
// mode screen but does NOT discard the quiz. Screens keep everything they
// need to continue (deck, position, per-card states, remaining timer) in
// `active.runtime`, a plain mutable object that lives here across mounts.
// The timer contract is pause-while-away: screens stop their countdown (and
// the slow-answer stopwatch) on unmount and resume from the stored remainder.
//
// Config snapshot rule: the Home-builder settings (mode, directions, answer
// styles, length) are FROZEN into the quiz at startQuiz — editing them
// mid-quiz only affects the next quiz. Settings-page settings (retries,
// timer, show-answer, script label, fonts, blur-submit, voice) are read
// live from useQuizConfig and apply instantly, drawer-style.

import { useRouter } from "next/navigation";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

import { computeResults } from "@/lib/engine";
import { factKeys } from "@/lib/facts";
import { useQuizConfig } from "@/lib/quiz-config";
import type {
  FactId,
  QuizConfig,
  QuizMode,
  QuizSessionRecord,
  SessionStats,
} from "@/types";

/** The Home-builder settings frozen at Start Quiz. */
export type QuizSnapshot = Pick<
  QuizConfig,
  "mode" | "dirs" | "styleJp2en" | "styleEn2jp" | "length" | "limType" | "limCount"
>;

export interface ActiveQuiz {
  /**
   * The FACTS this run draws from — the selection resolved at Start, or the
   * misses on a redrill. Endless mode replenishes from THIS list, never from
   * the live query.
   *
   * Resolved at Start and frozen, which matters more now than it did: the
   * selection is a query over history, and history moves the moment you answer
   * anything. A quiz that re-ran its own query mid-flight would rewrite its own
   * deck out from under you — you would answer 生, 生 would stop being shaky,
   * and 生 would vanish from the run that was drilling it.
   *
   * Facts, not characters, and that is what makes kanji drillable at all. The
   * screens used to put a CHARACTER on screen and look it up in CHAR_INDEX,
   * which has no kanji in it and never will. They now render whatever the
   * fact's subject says to render (see engine/question.ts) and know nothing
   * about what kind of thing they are asking.
   */
  facts: FactId[];
  /**
   * What this run is, in words — FROZEN at Start, like the snapshot and for the
   * same reason.
   *
   * The name cannot be re-derived later, and that is not a limitation, it is
   * the requirement. The selection is a query over history, and history moves
   * the moment you answer anything. A quiz started from "Kanji · Shaky" would,
   * halfway through, re-resolve to a different set and rename itself — the
   * resume card's predecessor documented exactly this hazard ("the card would
   * rename the quiz under you while it ran") and dodged it by naming only the
   * static decks, which no longer exist. Storing the sentence settles it: the
   * quiz is called what it was called when you started it.
   */
  what: string;
  redrill: boolean;
  /** Forces limited/full-coverage regardless of the snapshot (redrill). */
  forceCoverage: boolean;
  /** Builder settings frozen at start — render the quiz from these. */
  snapshot: QuizSnapshot;
  /** When Start was pressed, so Home's resume card can say "started 4 minutes
   * ago". Optional because a quiz snapshotted to localStorage before this
   * field existed restores without it — readers omit the clause rather than
   * invent a time. */
  startedAt?: number;
  /** Mode-screen scratch space that survives unmount/remount (deck, pos,
   * stats, grid card states, pairs board, remaining timer…). Owned by the
   * mode screens; opaque to this provider. */
  runtime: Record<string, unknown>;
}

/** Sidebar progress chip: e.g. done=12 total=50 → "12/50"; total=null while
 * endless → shows just the count. */
export interface QuizProgress {
  done: number;
  total: number | null;
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
  /** False until the sessionStorage snapshot has been restored — screens
   * must not redirect away from /quiz or /results before this is true. */
  restored: boolean;
  /** Non-null while a quiz is in progress (even when on another tab). */
  active: ActiveQuiz | null;
  /** Non-null when /results has something to show. */
  results: ResultsPayload | null;
  /** Live progress for the sidebar chip; screens keep it updated. */
  progress: QuizProgress | null;
  setProgress(p: QuizProgress | null): void;
  /** Begin a quiz over `facts` with the current cfg; navigates to /quiz.
   * `what` names the run for the resume card — see ActiveQuiz.what. */
  startQuiz(
    facts: FactId[],
    opts?: { redrill?: boolean; what?: string },
  ): void;
  /** End the active quiz: compute results, POST /api/session, go to /results. */
  finishQuiz(stats: SessionStats): void;
  /** Drop the active quiz without scoring (explicit "← Setup" / new start). */
  abandonQuiz(): void;
  /** Reopen a stored session's results (detail or summary-only fallback). */
  viewStoredSession(record: QuizSessionRecord): void;
}

const QuizSessionContext = createContext<QuizSessionContextValue | null>(null);

/** A quiz outlives the tab it started in. The whole session state (runtime
 * scratch included) is JSON-serializable and snapshotted to localStorage —
 * restored on mount, saved on every state change and again at beforeunload,
 * which is what catches in-place runtime mutations (deck position, per-card
 * states, remaining timer) since those never go through setState.
 *
 * localStorage rather than sessionStorage so closing the browser and coming
 * back tomorrow still offers Resume. The cost is that localStorage is shared
 * across tabs, so two open tabs would otherwise write over each other; the
 * `owner` stamp below settles that. There is no expiry: a quiz ends when you
 * finish it or discard it, not when it gets old. */
const STORAGE_KEY = "kanaquiz-session";

/** Identifies the tab that currently owns the quiz. Regenerated per mount, so
 * every tab gets its own. */
const TAB_ID = Math.random().toString(36).slice(2);

interface StoredSession {
  active: ActiveQuiz | null;
  results: ResultsPayload | null;
  progress: QuizProgress | null;
  /** Last tab to write. A tab that no longer owns the quiz stops saving, so
   * a stale background tab can't resurrect a quiz you finished elsewhere. */
  owner?: string;
}

export function QuizSessionProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const { cfg } = useQuizConfig();
  const [active, setActive] = useState<ActiveQuiz | null>(null);
  const [results, setResults] = useState<ResultsPayload | null>(null);
  const [progress, setProgress] = useState<QuizProgress | null>(null);
  const [restored, setRestored] = useState(false);
  /** True for exactly one state update: the one applying another tab's write. */
  const adoptedRef = useRef(false);

  useEffect(() => {
    try {
      const saved: StoredSession | null = JSON.parse(
        localStorage.getItem(STORAGE_KEY) ?? "null",
      );
      if (saved) {
        // Post-mount hydration, same pattern as quiz-config.
        // eslint-disable-next-line react-hooks/set-state-in-effect
        if (saved.active) setActive(saved.active);
        if (saved.results) setResults(saved.results);
        if (saved.progress) setProgress(saved.progress);
      }
    } catch {
      // corrupt snapshot — start clean
    }
    setRestored(true);
  }, []);

  useEffect(() => {
    if (!restored) return;
    const save = () => {
      try {
        localStorage.setItem(
          STORAGE_KEY,
          JSON.stringify({
            active,
            results,
            progress,
            owner: TAB_ID,
          } satisfies StoredSession),
        );
      } catch {
        // storage full/unavailable — resume degrades gracefully to not-offered
      }
    };
    // Saving state we just ADOPTED from another tab is what turns two tabs
    // into a write storm: adopting sets state → this effect fires → we write
    // → the other tab adopts OUR write → it writes → we adopt… Measured at
    // ~87k writes in 15s before this guard existed. Adopting is not news, so
    // it isn't published; only a change that started HERE is.
    if (adoptedRef.current) {
      adoptedRef.current = false;
    } else {
      save();
    }
    // beforeunload catches runtime mutations made since the last state change.
    window.addEventListener("beforeunload", save);
    return () => window.removeEventListener("beforeunload", save);
  }, [active, results, progress, restored]);

  // Newest tab wins. Opening the app in a second tab takes the quiz over, and
  // this tab steps back rather than fighting it — otherwise both would keep
  // writing their own runtime to the same key and each would see the other's
  // deck position stutter. `storage` only fires in OTHER tabs, so this is the
  // loser's side of the handshake.
  useEffect(() => {
    if (!restored) return;
    const onStorage = (e: StorageEvent) => {
      if (e.key !== STORAGE_KEY || !e.newValue) return;
      try {
        const next: StoredSession = JSON.parse(e.newValue);
        if (!next.owner || next.owner === TAB_ID) return;
        // Tell the save effect this state is theirs, not ours — see the guard.
        adoptedRef.current = true;
        setActive(next.active);
        setResults(next.results);
        setProgress(next.progress);
      } catch {
        // another tab wrote something unreadable — ignore it
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [restored]);

  const startQuiz = useCallback(
    (facts: FactId[], opts?: { redrill?: boolean; what?: string }) => {
      if (!facts.length) return;
      setActive({
        facts,
        // The count is the fallback rather than a guess at a name: it is always
        // true, and it is the one number that never blurs.
        what:
          opts?.what ??
          `${facts.length.toLocaleString()} thing${facts.length === 1 ? "" : "s"}`,
        redrill: !!opts?.redrill,
        forceCoverage: !!opts?.redrill,
        startedAt: Date.now(),
        snapshot: {
          mode: cfg.mode,
          dirs: { ...cfg.dirs },
          styleJp2en: cfg.styleJp2en,
          styleEn2jp: cfg.styleEn2jp,
          length: cfg.length,
          limType: cfg.limType,
          limCount: cfg.limCount,
        },
        runtime: {},
      });
      setProgress(null);
      router.push("/quiz");
    },
    [cfg, router],
  );

  const finishQuiz = useCallback(
    (stats: SessionStats) => {
      const quiz = active;
      setActive(null);
      setProgress(null);
      const s = computeResults(stats);
      if (!quiz || !s.total) {
        router.push("/");
        return;
      }
      const ts = Date.now();
      setResults({
        mode: quiz.snapshot.mode,
        redrill: quiz.redrill,
        ts,
        stats,
      });
      // Per-fact aggregates for history.json; fire-and-forget.
      const facts: QuizSessionRecord["facts"] = {};
      for (const c of s.facts) {
        facts[c] = {
          seen: stats[c].seen,
          missed: stats[c].misses,
          slow: stats[c].slow,
          // Folded into the aggregate so strict accuracy survives without
          // having to re-read every session's detail.
          firstTry: stats[c].firstTryCorrect === true ? 1 : 0,
          // Showings that ended right — the forgiving numerator. A showing
          // nobody answered contributes 0, which is the point: it is not a pass.
          //
          // TEMPORARY BRIDGE: grid and pairs don't increment detail.correct
          // yet, so a landed fact arrives here as correct: 0. Fall back to
          // everCorrect, which collapses a session to at most one correct
          // showing — coarse, but it never calls an unanswered fact right.
          //
          // `||`, NOT `??`: newFactStat initialises correct to 0, so the
          // nullish operator would never fire and every grid/pairs fact
          // would score 0% forgiving. The only case `||` gets wrong is a real
          // 0 with everCorrect true, which can't happen — landing a card
          // increments both. Delete this once both screens keep the counter.
          correct: stats[c].correct || (stats[c].everCorrect ? 1 : 0),
        };
      }
      const record: QuizSessionRecord = {
        ts,
        mode: quiz.snapshot.mode,
        redrill: quiz.redrill,
        total: s.total,
        forgivingPct: s.total ? Math.round((100 * s.forg) / s.total) : 0,
        strictPct: s.total ? Math.round((100 * s.strict) / s.total) : 0,
        facts,
        detail: stats,
      };
      fetch("/api/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(record),
      }).catch(() => {});
      router.push("/results");
    },
    [active, router],
  );

  const abandonQuiz = useCallback(() => {
    setActive(null);
    setProgress(null);
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
          correct: 0,
          slow: 0,
          confused: {},
        };
        for (const f of factKeys(record.detail)) {
          stats[f] = { ...empty, ...record.detail[f] };
        }
      } else {
        // Summary-only sessions stored aggregates and no detail — approximate a
        // view. The aggregate DOES know how many showings were landed, so
        // `correct` is real here rather than synthesized like everCorrect below.
        for (const [key, a] of Object.entries(record.facts ?? {})) {
          const c = key as FactId;
          stats[c] = {
            seen: a.seen,
            misses: a.missed,
            everCorrect: a.missed === 0 && record.forgivingPct === 100,
            firstTryCorrect: null,
            correct: a.correct ?? 0,
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
      restored,
      active,
      results,
      progress,
      setProgress,
      startQuiz,
      finishQuiz,
      abandonQuiz,
      viewStoredSession,
    }),
    [restored, active, results, progress, startQuiz, finishQuiz, abandonQuiz, viewStoredSession],
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
