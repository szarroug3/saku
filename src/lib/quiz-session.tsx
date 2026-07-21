"use client";

// Active-quiz + session + results state shared across routes.
//
// A one-off quiz flows setup (/) → startQuiz → /quiz → finishQuiz → /results.
// A SESSION flows setup (/) → startSession → /quiz → finishQuiz → /session
// (the fork) → retry legs back to /quiz, or Complete round → the rest → the
// next round over the SAME whole set. See src/lib/session.ts for the loop
// itself; this file only owns the state and the navigation.
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
// mid-quiz only affects the next quiz. A session freezes them ONCE, at
// startSession, and every round of it re-runs that same snapshot: "rerunning a
// previous session reruns the session as it was". Settings-page settings
// (retries, timer, show-answer, script label, fonts, blur-submit, voice) are
// read live from useQuizConfig and apply instantly, drawer-style.
//
// SAVE AS YOU ANSWER
// ==================
// There is no "are you sure?" on leaving, anywhere, ever. That is affordable
// because every answer is already on disk before you could leave: the mode
// screens call `saveNow()` the moment they mutate the runtime. See the note on
// `saveNow` for the bug this closed.

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

// Both from the DATA-FREE engine/fact modules, not the barrels: this provider
// is mounted in the root layout on every route, so a static edge from here to
// facts.ts would pull the whole vocab+kanji payload into the eager client
// bundle everywhere. computeResults + factKeys need no registry.
import { computeResults } from "@/lib/engine/results";
import { factKeys } from "@/lib/fact-keys";
import { useQuizConfig } from "@/lib/quiz-config";
import type { QuizSnapshot } from "@/lib/quiz-session-types";
import {
  mergeStats,
  restMinutes,
  SESSION_ROUND_TARGET,
  summariseRound,
  type SessionOrigin,
  type StudySession,
} from "@/lib/session";
import type {
  FactId,
  QuizConfig,
  QuizMode,
  QuizSessionRecord,
  SessionStats,
} from "@/types";

export type { QuizSnapshot };

export interface ActiveQuiz {
  /**
   * The FACTS this LEG draws from — a session round's whole set, the misses on
   * a redrill, or a one-off's resolved selection. Endless mode replenishes
   * from THIS list, never from the live query.
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
  /**
   * This LEG's identity, minted once in beginLeg.
   *
   * Screens use it to answer "am I looking at the same leg I was looking at a
   * moment ago". They cannot use the object identity of `active` for that: the
   * snapshot round-trips through JSON every time another tab writes it, so an
   * adopted leg is a brand-new object describing the very same quiz. A screen
   * that re-initialises on object identity therefore tears itself down and
   * rebuilds on every adoption — which is exactly the loop that bricked the
   * session (see the storm note on saveNow).
   *
   * Optional because a leg snapshotted before this field existed restores
   * without one; readers fall back to `startedAt`.
   */
  legId?: string;
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
  /** False until the localStorage snapshot has been restored — screens
   * must not redirect away from /quiz, /session or /results before this is
   * true. */
  restored: boolean;
  /** Non-null while a quiz leg is in progress (even when on another tab). */
  active: ActiveQuiz | null;
  /** Non-null while a session loop is running — including during a rest, when
   * `active` is null because nothing is being drilled. */
  session: StudySession | null;
  /** Non-null when /results has something to show. */
  results: ResultsPayload | null;
  /** Live progress for the sidebar chip; screens keep it updated. */
  progress: QuizProgress | null;
  setProgress(p: QuizProgress | null): void;
  /**
   * Write the snapshot to disk NOW, without waiting for a state change.
   *
   * Mode screens call this after every answer. See the comment on the save
   * effect for why a state-change-driven save is not enough.
   */
  saveNow(): void;
  /** Begin a one-off quiz over `facts` with the current cfg; navigates to
   * /quiz. `what` names the run — see ActiveQuiz.what. */
  startQuiz(facts: FactId[], opts?: { redrill?: boolean; what?: string }): void;
  /**
   * The rest is over (or you skipped the lesson): begin round 1.
   *
   * `scope` WIDENS the session before the first card is drawn — the kana
   * lessons' "quiz me on all hiragana so far" fork. It rewrites `facts`, not
   * just the leg, because a session that drilled thirty facts and then reported
   * five would be lying about what you did; every later round, the results and
   * the record all read the widened set. Only legal before round 1, which is
   * the only moment nothing has been answered yet and so nothing is lost.
   */
  startFirstRound(scope?: FactId[]): void;
  /** End the active leg. In a session this opens the fork; otherwise it
   * computes results, POSTs /api/session and goes to /results. */
  finishQuiz(stats: SessionStats): void;
  /** Drop the active quiz without scoring (explicit "← Setup" / new start). */
  abandonQuiz(): void;
  /** Reopen a stored session's results (detail or summary-only fallback). */
  viewStoredSession(record: QuizSessionRecord): void;

  // ---------- the session loop ----------
  /**
   * Start a session over the PLANNED set.
   *
   * `facts` is what src/lib/budget.ts decided the session is — ranked material
   * topped up from `teach` — not the raw selection. `teach` is the subset that
   * gets shown before it gets asked. `what` names it, frozen like the snapshot.
   */
  startSession(
    facts: FactId[],
    teach?: FactId[],
    what?: string,
    origin?: SessionOrigin,
  ): void;
  /** Re-ask a subset from the fork. Comes back to the same fork. */
  retryLeg(facts: FactId[]): void;
  /**
   * Mid-round "Look again": go back to the lesson without discarding the leg.
   *
   * Unlike the fork, this keeps `active` and its runtime intact, so resumeRound
   * drops you back into the exact card you left. Only for a session that has a
   * teach phase — the drill screen gates the control on that.
   */
  reviewLesson(): void;
  /** Resume the round after a "Look again": back to /quiz with the leg
   * untouched (NOT a fresh beginLeg, so nothing is re-asked). */
  resumeRound(): void;
  /** Complete the round: bank it, write the floor, start the rest. */
  completeRound(): void;
  /** The rest is over (or you skipped it): run the SAME whole set again. */
  startNextRound(): void;
  /** Leave to home without changing session state. */
  pauseSession(): void;
  /** Stop for good — banks the current round and shows Session complete. */
  endSession(): void;
  /** Session complete → Done: write history and clear. */
  finishSession(): void;
  /** Throw the session away unscored. */
  discardSession(): void;
  /** Drop EVERY run, focused and parked, and remove the snapshot outright.
   * The reset behind "Clear knowledge base", and the way out of a session that
   * will not let you out. See the implementation for why it writes rather than
   * waiting for the save effect. */
  clearAllRuns(): void;
  /** Continue a session you left: back to whatever it was doing. */
  continueSession(): void;
  /** Repair a session whose phase says "drilling" but which has no leg. See
   * the implementation: that state deadlocks /quiz and /session against each
   * other and freezes the whole app, escape hatches included. */
  recoverLostLeg(): void;

  // ---------- many runs at once (see PARKING) ----------
  /** Every run in progress right now — the focused one plus every parked one.
   * The Current sessions page, Home's lesson cards and Practice's resume card
   * all read this. Ordered focused-first, then most-recently-parked. */
  runs: RunInfo[];
  /** Continue a run by id (FOCUSED_RUN for the focused one). A parked run is
   * swapped in — whatever is focused now is parked first, so nothing is lost —
   * and routed to wherever it left off. */
  continueRun(id: string): void;
  /** Discard a run by id without scoring it. */
  discardRun(id: string): void;
}

const QuizSessionContext = createContext<QuizSessionContextValue | null>(null);

/** A quiz outlives the tab it started in. The whole session state (runtime
 * scratch included) is JSON-serializable and snapshotted to localStorage —
 * restored on mount, saved on every state change, again on every answer via
 * saveNow(), and once more at beforeunload.
 *
 * localStorage rather than sessionStorage so closing the browser and coming
 * back tomorrow still offers Continue. The cost is that localStorage is shared
 * across tabs, so two open tabs would otherwise write over each other; the
 * `owner` stamp below settles that. There is no expiry: a session ends when
 * you finish it or discard it, not when it gets old. */
const STORAGE_KEY = "kanaquiz-session";

/** Identifies the tab that currently owns the quiz. Regenerated per mount, so
 * every tab gets its own. */
const TAB_ID = Math.random().toString(36).slice(2);

/** A short unique id for a parked run. Time-prefixed only for legibility in
 * dev; uniqueness comes from the random tail. */
function genRunId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

/** Where a run should resume: a session mid-drill goes to /quiz, any other
 * session to /session, a one-off quiz to /quiz. */
function routeForRun(active: ActiveQuiz | null, session: StudySession | null): string {
  if (session) return session.phase === "drilling" && active ? "/quiz" : "/session";
  return "/quiz";
}

/** A run you left to start another. See PARKING below.
 *
 * It is the whole focused triple frozen: the leg (with its runtime), the
 * session loop it belongs to (null for a one-off quiz), and its progress. Put
 * back verbatim when you continue it, so it resumes exactly where you left. */
interface ParkedRun {
  id: string;
  active: ActiveQuiz | null;
  session: StudySession | null;
  progress: QuizProgress | null;
  /** When it was set aside — orders the Current sessions list under the one
   * you're doing now. */
  parkedAt: number;
}

interface StoredSession {
  active: ActiveQuiz | null;
  session: StudySession | null;
  results: ResultsPayload | null;
  progress: QuizProgress | null;
  /** Runs set aside to start others — see PARKING. */
  parked?: ParkedRun[];
  /** Last tab to write. A tab that no longer owns the quiz stops saving, so
   * a stale background tab can't resurrect a quiz you finished elsewhere. */
  owner?: string;
}

/** The stable id for the FOCUSED run — the one /quiz or /session is rendering
 * right now. Parked runs carry their own generated ids; the focused run is
 * "whatever is focused", so it needs no persistent id, and callers refer to it
 * by this sentinel. */
export const FOCUSED_RUN = "focused";

/** What a screen needs to LIST a run without knowing the leg/session split:
 * the Current sessions page, Home's lesson cards and Practice's resume card all
 * read this shape and never touch ActiveQuiz/StudySession directly. */
export interface RunInfo {
  /** FOCUSED_RUN for the focused run, else the parked run's id. */
  id: string;
  /** A one-off quiz (ends at results) vs a session (teach → drill → rest). */
  kind: "quiz" | "session";
  /** Where a session came from — a curriculum lesson or the Library. Undefined
   * for one-off quizzes. */
  origin?: SessionOrigin;
  /** Its name, frozen at start. */
  what: string;
  /** The facts it drills — Home matches its lesson against this. */
  facts: FactId[];
  /** A session's phase; undefined for a quiz. */
  phase?: StudySession["phase"];
  progress: QuizProgress | null;
  startedAt?: number;
  /** For ordering: a session's last-answer time, else when it was parked (or
   * now, for the focused run). */
  lastActiveAt: number;
  /** True for the one /quiz or /session is currently rendering. */
  focused: boolean;
}

function quizRunInfo(
  id: string,
  quiz: ActiveQuiz,
  progress: QuizProgress | null,
  lastActiveAt: number,
  focused: boolean,
): RunInfo {
  return {
    id,
    kind: "quiz",
    what: quiz.what,
    facts: quiz.facts,
    progress,
    startedAt: quiz.startedAt,
    lastActiveAt,
    focused,
  };
}

function sessionRunInfo(
  id: string,
  s: StudySession,
  progress: QuizProgress | null,
  focused: boolean,
): RunInfo {
  return {
    id,
    kind: "session",
    origin: s.origin ?? "lesson",
    what: s.what,
    facts: s.facts,
    phase: s.phase,
    progress,
    startedAt: s.startedAt,
    lastActiveAt: s.lastActiveAt,
    focused,
  };
}

/** The fallback name for a run nobody named. The count rather than a guess at
 * a name: it is always true, and it is the one number that never blurs. */
function countWhat(facts: FactId[]): string {
  return `${facts.length.toLocaleString()} thing${facts.length === 1 ? "" : "s"}`;
}

/**
 * The comparable form of a snapshot: every persisted field, in a fixed order,
 * and WITHOUT `owner`.
 *
 * Order is stated explicitly rather than relying on JSON.stringify's key order,
 * because one side of the comparison is an object we built and the other came
 * back through JSON.parse — and this is the value a skipped write is decided
 * on, so "usually the same order" is not good enough. `owner` is excluded on
 * purpose: it is who wrote, not what was written, and including it would make
 * every save differ from every other and defeat the whole guard.
 */
function canonical(s: StoredSession): string {
  return JSON.stringify({
    active: s.active ?? null,
    session: s.session ?? null,
    results: s.results ?? null,
    progress: s.progress ?? null,
    parked: s.parked ?? [],
  });
}

function snapshotOf(cfg: QuizConfig): QuizSnapshot {
  return {
    mode: cfg.mode,
    dirs: { ...cfg.dirs },
    styleJp2en: cfg.styleJp2en,
    styleEn2jp: cfg.styleEn2jp,
    length: cfg.length,
    limType: cfg.limType,
    limCount: cfg.limCount,
  };
}

export function QuizSessionProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const { cfg } = useQuizConfig();
  const [active, setActive] = useState<ActiveQuiz | null>(null);
  const [session, setSession] = useState<StudySession | null>(null);
  const [results, setResults] = useState<ResultsPayload | null>(null);
  const [progress, setProgress] = useState<QuizProgress | null>(null);
  const [restored, setRestored] = useState(false);
  // Runs set aside to start another. See PARKING: startQuiz/startSession no
  // longer clear what's running — they park it here and open the new one, so
  // several runs can be in progress at once and the Current sessions page lists
  // them all. Newest-first.
  const [parked, setParked] = useState<ParkedRun[]>([]);
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
        if (saved.session) setSession(saved.session);
        if (saved.results) setResults(saved.results);
        if (saved.progress) setProgress(saved.progress);
        if (saved.parked) setParked(saved.parked);
      }
    } catch {
      // corrupt snapshot — start clean
    }
    setRestored(true);
  }, []);

  // The latest values, readable from a stable callback. saveNow() must not
  // change identity every render: the mode screens call it from inside their
  // own effects and handlers, and a fresh function each render would make it a
  // dep that re-fires all of them.
  //
  // Mirrored in an effect rather than assigned during render — a ref write in
  // the render body is a real hazard (it can be torn by a re-render React
  // discards), and this one has no need to be early. It is declared FIRST so
  // it runs before the save effect below, which means every save reads values
  // from the render that triggered it.
  const latest = useRef<StoredSession>({
    active: null,
    session: null,
    results: null,
    progress: null,
    parked: [],
  });
  const restoredRef = useRef(false);
  /** What we believe storage currently holds: the canonical body, and the exact
   * raw string. Two refs rather than one because they answer different
   * questions — the body says "our state matches storage", the raw string
   * catches storage having moved under us since we last looked, so a skipped
   * write can never lose an answer. Updated on every write we make and on every
   * adoption we apply. */
  const lastBodyRef = useRef<string | null>(null);
  const lastRawRef = useRef<string | null>(null);
  useEffect(() => {
    latest.current = { active, session, results, progress, parked };
    restoredRef.current = restored;
  });

  /**
   * Write the snapshot. Stable identity — see `latest` above.
   *
   * THE BUG THIS CLOSES
   * ===================
   * Saving used to happen only when provider STATE changed. But a quiz's real
   * state lives in `active.runtime`, which the mode screens mutate IN PLACE —
   * so `active` never changes identity, and the only save dep that moved
   * during a quiz was `progress`. In grid mode `progress.done` counts cards
   * with `everCorrect`, and `everCorrect` is only ever set in the correct
   * branch. So: a right answer saved the session, and a WRONG one saved
   * nothing at all.
   *
   * `beforeunload` hid this for the common case — a normal reload or tab close
   * fires it and the misses get flushed. What it does not cover is a crash, a
   * force-quit, or the browser evicting the tab under memory pressure, and in
   * any of those you lost every miss since your last correct answer. The file
   * used to claim in its own header that the runtime was "written AS IT
   * CHANGES" while the line above the listener admitted beforeunload was
   * catching what state-change saves miss. Both cannot be true.
   *
   * Now the screens call this on every resolved answer, right or wrong, so the
   * disk is current before the next question is drawn. beforeunload stays as a
   * belt-and-braces for in-flight edits (half-typed text), not as the
   * mechanism.
   */
  const saveNow = useCallback(() => {
    if (!restoredRef.current) return;
    try {
      const body = canonical(latest.current);
      // NOTHING CHANGED, SO NOTHING IS PUBLISHED — and this is the guard that
      // keeps two open tabs from destroying each other.
      //
      // THE STORM, AND WHY THE OLD GUARD DID NOT STOP IT
      // ================================================
      // `adoptedRef` below suppresses exactly one save: the state update that
      // applies another tab's write. That is not enough, because adopting has
      // CONSEQUENCES that land afterwards. Adopting replaces `active` with a
      // fresh object parsed out of JSON, which used to remount the drill
      // screen, whose onMount calls syncProgress() → setProgress({…}). That is
      // a brand-new state update arriving a tick later, by which time
      // `adoptedRef` has already been consumed — so it published, the other tab
      // adopted OURS, its drill remounted, it published back, and so on.
      // Measured here at ~14,000 writes in 3 seconds with two idle tabs open,
      // both pinned at 100% of the main thread and neither able to finish a
      // click. That is the session brick: it survives a reload and a server
      // restart because the other tab is still writing, and it survives
      // clearing localStorage by hand for the same reason — the other tab puts
      // it straight back.
      //
      // Suppressing "the update that adopted" was the wrong shape of guard,
      // because it has to know which later updates were CAUSED by adopting.
      // Comparing the payload needs to know nothing: a tab that would write
      // what is already there simply does not write, so the cycle cannot start
      // however many effects fire downstream of an adoption. The drill also no
      // longer remounts on adoption (see ActiveQuiz.legId), which removes the
      // pump; this removes the loop, and the two are deliberately independent.
      if (
        body === lastBodyRef.current &&
        localStorage.getItem(STORAGE_KEY) === lastRawRef.current
      ) {
        return;
      }
      const raw = JSON.stringify({
        ...latest.current,
        owner: TAB_ID,
      } satisfies StoredSession);
      localStorage.setItem(STORAGE_KEY, raw);
      lastBodyRef.current = body;
      lastRawRef.current = raw;
    } catch {
      // storage full/unavailable — resume degrades gracefully to not-offered
    }
  }, []);

  useEffect(() => {
    if (!restored) return;
    // Saving state we just ADOPTED from another tab is what turns two tabs
    // into a write storm: adopting sets state → this effect fires → we write
    // → the other tab adopts OUR write → it writes → we adopt… Measured at
    // ~87k writes in 15s before this guard existed. Adopting is not news, so
    // it isn't published; only a change that started HERE is.
    if (adoptedRef.current) {
      adoptedRef.current = false;
    } else {
      saveNow();
    }
    // Belt-and-braces for state that hasn't resolved into an answer yet — the
    // half-typed contents of a grid well, say. Everything that has been
    // ANSWERED is already on disk by the time this could fire.
    window.addEventListener("beforeunload", saveNow);
    return () => window.removeEventListener("beforeunload", saveNow);
  }, [active, session, results, progress, parked, restored, saveNow]);

  // Newest tab wins. Opening the app in a second tab takes the quiz over, and
  // this tab steps back rather than fighting it — otherwise both would keep
  // writing their own runtime to the same key and each would see the other's
  // deck position stutter. `storage` only fires in OTHER tabs, so this is the
  // loser's side of the handshake.
  useEffect(() => {
    if (!restored) return;
    const onStorage = (e: StorageEvent) => {
      if (e.key !== STORAGE_KEY) return;
      // SOMEONE CLEARED IT. A removed key is a decision, not an absence, and
      // ignoring it was how "Clear knowledge base" and Discard appeared to do
      // nothing: the tab that cleared dropped its session, the other tab still
      // held one, and the next thing that tab wrote put the session straight
      // back. An escape hatch that one surviving tab can undo is not an escape
      // hatch, so a clear is adopted exactly like any other write.
      if (!e.newValue) {
        adoptedRef.current = true;
        lastBodyRef.current = null;
        lastRawRef.current = null;
        setActive(null);
        setSession(null);
        setResults(null);
        setProgress(null);
        setParked([]);
        return;
      }
      try {
        const next: StoredSession = JSON.parse(e.newValue);
        if (!next.owner || next.owner === TAB_ID) return;
        // Tell the save effect this state is theirs, not ours — see the guard.
        adoptedRef.current = true;
        // Storage now holds exactly this, and our state is about to. Recording
        // both is what lets saveNow recognise the echo of an adoption and stay
        // quiet instead of publishing it back — see the storm note there.
        lastBodyRef.current = canonical(next);
        lastRawRef.current = e.newValue;
        setActive(next.active);
        setSession(next.session);
        setResults(next.results);
        setProgress(next.progress);
        setParked(next.parked ?? []);
      } catch {
        // another tab wrote something unreadable — ignore it
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [restored]);

  // ---------- PARKING: many runs at once ----------
  //
  // The app used to hold ONE run. Starting anything threw away whatever you
  // were doing. Now starting parks the focused run instead: it's pushed onto
  // `parked` and the new run takes focus. Continuing a parked run swaps it back
  // (parking whatever was focused), so you can bounce between several lessons
  // and quizzes and lose none of them. Terminal actions (finish/discard) only
  // ever clear the FOCUSED run — parked runs live until you finish or discard
  // them from the Current sessions page.

  /** Set the focused run aside if there is one, so a new run can take focus
   * without overwriting it. Reads the live state from `latest` so it's correct
   * inside a click handler, and clears the focused slots. No-op when nothing is
   * focused. */
  const parkIfActive = useCallback(() => {
    const cur = latest.current;
    if (!cur.active && !cur.session) return;
    setParked((prev) => [
      {
        id: genRunId(),
        active: cur.active,
        session: cur.session,
        progress: cur.progress,
        parkedAt: Date.now(),
      },
      ...prev,
    ]);
    setActive(null);
    setSession(null);
    setProgress(null);
  }, []);

  /** Start one leg of drilling. A leg is a quiz; a session is many legs. */
  const beginLeg = useCallback(
    (
      facts: FactId[],
      what: string,
      snapshot: QuizSnapshot,
      redrill: boolean,
    ) => {
      if (!facts.length) return;
      setActive({
        facts,
        what,
        redrill,
        forceCoverage: redrill,
        legId: genRunId(),
        startedAt: Date.now(),
        snapshot,
        runtime: {},
      });
      setProgress(null);
      router.push("/quiz");
    },
    [router],
  );

  const startQuiz = useCallback(
    (facts: FactId[], opts?: { redrill?: boolean; what?: string }) => {
      if (!facts.length) return;
      // Don't overwrite what's running — set it aside, then open the new quiz.
      parkIfActive();
      beginLeg(facts, opts?.what ?? countWhat(facts), snapshotOf(cfg), !!opts?.redrill);
    },
    [cfg, beginLeg, parkIfActive],
  );

  // ---------- history ----------

  const writeRecord = useCallback(
    (stats: SessionStats, mode: QuizMode, redrill: boolean, extra: {
      planned?: FactId[];
      rounds?: number;
    }) => {
      const s = computeResults(stats);
      if (!s.total) return null;
      const ts = Date.now();
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
        mode,
        redrill,
        total: s.total,
        forgivingPct: s.total ? Math.round((100 * s.forg) / s.total) : 0,
        strictPct: s.total ? Math.round((100 * s.strict) / s.total) : 0,
        facts,
        detail: stats,
        ...extra,
      };
      fetch("/api/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(record),
      }).catch(() => {});
      return { ts, record };
    },
    [],
  );

  // ---------- the loop ----------

  const startSession = useCallback(
    (
      facts: FactId[],
      teach: FactId[] = [],
      what?: string,
      origin: SessionOrigin = "lesson",
    ) => {
      if (!facts.length) return;
      // Don't overwrite what's running — set it aside, then open the lesson.
      parkIfActive();
      const now = Date.now();
      const snapshot = snapshotOf(cfg);
      const teaching = teach.length > 0;
      const name = what ?? countWhat(facts);
      setSession({
        facts,
        teach,
        what: name,
        snapshot,
        startedAt: now,
        round: 1,
        // New material is read before it's asked. With nothing new in the
        // session there is nothing to read, so the lesson doesn't appear at
        // all rather than appearing empty.
        phase: teaching ? "teaching" : "drilling",
        restUntil: null,
        roundStats: {},
        rounds: [],
        totalStats: {},
        lastActiveAt: now,
        origin,
      });
      setResults(null);
      if (teaching) router.push("/session");
      else beginLeg(facts, name, snapshot, false);
    },
    [cfg, beginLeg, router, parkIfActive],
  );

  const startFirstRound = useCallback(
    (scope?: FactId[]) => {
      if (!session) return;
      // A widened scope replaces the session's set outright — see the interface
      // note. `what` is recounted with it so the HUD and the stored record name
      // the run the user actually chose rather than the lesson it started from.
      const widen = !!scope?.length;
      const facts = widen ? scope! : session.facts;
      const what = widen ? countWhat(facts) : session.what;
      setSession({
        ...session,
        facts,
        what,
        phase: "drilling",
        lastActiveAt: Date.now(),
      });
      beginLeg(facts, what, session.snapshot, false);
    },
    [session, beginLeg],
  );

  const retryLeg = useCallback(
    (facts: FactId[]) => {
      if (!session || !facts.length) return;
      setSession({ ...session, phase: "drilling", lastActiveAt: Date.now() });
      // forceCoverage: a retry is one full pass over exactly these, whatever
      // the session's length setting says. You asked for these; you get these.
      beginLeg(facts, "The misses", session.snapshot, true);
    },
    [session, beginLeg],
  );

  const reviewLesson = useCallback(() => {
    // Both must hold: a session (for the teach set) and a live leg to come back
    // to. Deliberately does NOT touch `active` — the runtime carries the deck,
    // position and per-card state, and resumeRound re-enters it untouched.
    if (!session || !active) return;
    setSession({ ...session, phase: "teaching", lastActiveAt: Date.now() });
    router.push("/session");
  }, [session, active, router]);

  const resumeRound = useCallback(() => {
    if (!session) return;
    // No beginLeg: a fresh leg would rebuild the deck and re-ask from the top.
    // The active leg is still here, so flipping the phase and routing back to
    // /quiz resumes the very card "Look again" was showing.
    setSession({ ...session, phase: "drilling", lastActiveAt: Date.now() });
    router.push("/quiz");
  }, [session, router]);

  /**
   * Bank the round that just ended: summarise it and fold it into the totals.
   *
   * Shared by "Complete round" (which then rests) and "Done for now" (which
   * then stops) — both of those finished the round, so both bank it. The only
   * difference is what happens next.
   *
   * THE ROUND-COMPLETE FLOOR IS NOT HERE, AND THAT IS THE FINDING.
   * =============================================================
   * The design called for completing a round to write `stability =
   * max(stability, floorDays)` for every fact you walked away holding — a
   * floor, never a multiplier, because cramming proves "I had it when I left"
   * and nothing about intervals. That reasoning is right and the model agrees
   * with it. The code is still not here, because against the model that landed
   * it is PROVABLY A NO-OP:
   *
   *   scoring.review() ends with
   *       stability: Math.max(SCORING.floorDays, state.stability * factor)
   *   — every review floors at floorDays, unconditionally, hit or miss.
   *
   *   aggregate.foldSession() runs exactly one review() per fact per session,
   *   at the session's own ts, for every fact with seen > 0.
   *
   * So by the time a session reaches history, every fact in it already has
   * stability >= floorDays and lastTested = the session ts — which is
   * precisely and entirely what the floor was specified to guarantee. Writing
   * it would add a second place that says `Math.max(x, 1)` about a number that
   * is already >= 1, and a reader would reasonably assume it did something.
   *
   * The floor was specified before the model landed. The model absorbed it:
   * `SCORING.floorDays` IS the floor, applied at the one write, which is a
   * better place for it than a session-loop callback — and it means the loop
   * needs no scoring privileges at all. The loop writes no scoring state, and
   * that is the honest end state rather than a gap.
   */
  const closeRound = useCallback((s: StudySession, now: number): StudySession => {
    return {
      ...s,
      rounds: [...s.rounds, summariseRound(s.round, s.roundStats)],
      totalStats: mergeStats(s.totalStats, s.roundStats),
      roundStats: {},
      lastActiveAt: now,
    };
  }, []);

  const completeRound = useCallback(() => {
    if (!session) return;
    const now = Date.now();
    if (session.round >= SESSION_ROUND_TARGET) {
      setSession({
        ...closeRound(session, now),
        phase: "complete",
        restUntil: null,
      });
      setActive(null);
      setProgress(null);
      router.push("/session");
      return;
    }
    const nextRound = session.round + 1;
    const mins = restMinutes(nextRound, cfg.restFirstMin, cfg.restThenMin);
    setSession({
      ...closeRound(session, now),
      phase: "resting",
      // A timestamp, not a process. Nothing runs; closing the tab costs
      // nothing, because there is nothing to close.
      restUntil: now + mins * 60_000,
    });
    setActive(null);
    setProgress(null);
    router.push("/session");
  }, [session, cfg.restFirstMin, cfg.restThenMin, closeRound, router]);

  const startNextRound = useCallback(() => {
    if (!session) return;
    if (session.round >= SESSION_ROUND_TARGET) return;
    setSession({
      ...session,
      round: session.round + 1,
      phase: "drilling",
      restUntil: null,
      roundStats: {},
      lastActiveAt: Date.now(),
    });
    // THE SAME WHOLE SESSION — not the retried bits. This is the line the
    // whole design turns on.
    beginLeg(session.facts, session.what, session.snapshot, false);
  }, [session, beginLeg]);

  const pauseSession = useCallback(() => {
    if (!session) return;
    router.push("/");
  }, [session, router]);

  const endSession = useCallback(() => {
    if (!session) return;
    const now = Date.now();
    // Stopping during a rest: the round was already banked when the rest
    // started, so there is nothing left to close and closing again would
    // record an empty round.
    const banked =
      session.phase === "resting" || session.phase === "complete"
        ? session
        : closeRound(session, now);
    setSession({ ...banked, phase: "complete", restUntil: null });
    setActive(null);
    setProgress(null);
    router.push("/session");
  }, [session, closeRound, router]);

  const finishSession = useCallback(async () => {
    if (!session) return;
    if (session.teach.length) {
      await fetch("/api/claim", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ facts: session.teach, known: true }),
      }).catch(() => {});
    }
    writeRecord(session.totalStats, session.snapshot.mode, false, {
      planned: session.facts,
      rounds: session.rounds.length,
    });
    setSession(null);
    setActive(null);
    setProgress(null);
    router.push("/");
  }, [session, writeRecord, router]);

  const discardSession = useCallback(() => {
    setSession(null);
    setActive(null);
    setProgress(null);
  }, []);

  /**
   * THE LAST LINE OF DEFENCE: drop every run there is, and make it stick.
   *
   * Everything else that ends a run ends ONE run and leaves the rest — which is
   * right for Discard on a single row, and wrong for the two callers here:
   * "Clear knowledge base", which promises the app "starts over from its first
   * lesson, as if you had just installed it", and any learner who has to get
   * out of a session that will not let them out.
   *
   * Three things, in this order, and all three are load-bearing:
   *
   *  1. Remove the key OUTRIGHT rather than waiting for the save effect. A
   *     learner reaching for this has an app that may not be re-rendering; a
   *     reset that only happens if React gets another turn is no reset at all.
   *     This is a plain synchronous write and it cannot be starved.
   *  2. Forget what we thought storage held, so the idempotence guard in
   *     saveNow cannot decide the clear was a no-op and skip re-publishing.
   *  3. Clear the React state too, so this tab's screens let go as well. Other
   *     tabs are told by the removal itself — `storage` fires in every other
   *     tab and the listener above treats a removed key as a clear, which is
   *     what stops a surviving tab from writing the session back.
   */
  const clearAllRuns = useCallback(() => {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // storage unavailable — the state reset below still frees this tab
    }
    lastBodyRef.current = null;
    lastRawRef.current = null;
    setActive(null);
    setSession(null);
    setResults(null);
    setProgress(null);
    setParked([]);
  }, []);

  /**
   * A session that says it is DRILLING but has no leg has lost its leg. Put it
   * back at its fork, which is the one place it can be steered from.
   *
   * THIS IS A DEADLOCK BREAKER, AND THE DEADLOCK IS TOTAL.
   * ======================================================
   * The two route guards are each individually right and mutually fatal in this
   * one state: /quiz sends you to /session when there is no leg to draw, and
   * /session sends you to /quiz when the phase says drilling. With both true
   * the app replaces between the two routes forever — measured at ~1,400
   * navigations in 4 seconds — and because the router never settles, nothing
   * renders and NO control can be clicked. Not End quiz, not Discard, not
   * Clear knowledge base. It is the one failure that takes the escape hatches
   * with it, which is exactly what made the session unrecoverable from inside
   * the app rather than merely broken.
   *
   * The cure has to be at the state, not at either guard: whichever guard you
   * relax, the state is still lying, and the next screen to trust it breaks in
   * its own way. So the lie is corrected. Nothing is invented in doing it — the
   * round's answers are already in `roundStats` and the fork reads them, so a
   * recovered round reports exactly what it banked, which may honestly be
   * nothing. What the learner gets back is a screen with buttons on it.
   */
  const recoverLostLeg = useCallback(() => {
    setSession((s) =>
      s && s.phase === "drilling"
        ? { ...s, phase: "round-complete", lastActiveAt: Date.now() }
        : s,
    );
  }, []);

  const continueSession = useCallback(() => {
    if (!session) return;
    router.push(session.phase === "drilling" && active ? "/quiz" : "/session");
  }, [session, active, router]);

  // ---------- PARKING: continue / discard / list ----------

  /** Continue any run by id. FOCUSED_RUN just routes the focused run. A parked
   * run is swapped into focus — whatever was focused is parked first (in the
   * same update, so nothing is lost) — then routed to where it left off. */
  const continueRun = useCallback(
    (id: string) => {
      if (id === FOCUSED_RUN) {
        const cur = latest.current;
        router.push(routeForRun(cur.active, cur.session));
        return;
      }
      const run = parked.find((r) => r.id === id);
      if (!run) return;
      const cur = latest.current;
      setParked((prev) => {
        const without = prev.filter((r) => r.id !== id);
        if (cur.active || cur.session) {
          return [
            {
              id: genRunId(),
              active: cur.active,
              session: cur.session,
              progress: cur.progress,
              parkedAt: Date.now(),
            },
            ...without,
          ];
        }
        return without;
      });
      setActive(run.active);
      setSession(run.session);
      setProgress(run.progress);
      router.push(routeForRun(run.active, run.session));
    },
    [parked, router],
  );

  /** Discard a run by id without scoring it. FOCUSED_RUN clears the focused
   * slots; a parked id is dropped from the list. */
  const discardRun = useCallback((id: string) => {
    if (id === FOCUSED_RUN) {
      setActive(null);
      setSession(null);
      setProgress(null);
      return;
    }
    setParked((prev) => prev.filter((r) => r.id !== id));
  }, []);

  /** Every run in progress, focused-first then most-recently-parked. Screens
   * read this instead of the leg/session split. */
  const runs = useMemo<RunInfo[]>(() => {
    const out: RunInfo[] = [];
    if (session) {
      out.push(sessionRunInfo(FOCUSED_RUN, session, progress, true));
    } else if (active) {
      out.push(quizRunInfo(FOCUSED_RUN, active, progress, active.startedAt ?? 0, true));
    }
    for (const r of parked) {
      if (r.session) {
        out.push(sessionRunInfo(r.id, r.session, r.progress, false));
      } else if (r.active) {
        out.push(quizRunInfo(r.id, r.active, r.progress, r.parkedAt, false));
      }
    }
    return out;
  }, [active, session, progress, parked]);

  // ---------- finishing a leg ----------

  const finishQuiz = useCallback(
    (stats: SessionStats) => {
      const quiz = active;
      // In a session, finishing a leg opens the fork — it does not score
      // anything and it does not leave the loop. Scoring happens once, when
      // the session ends.
      if (session && quiz) {
        setSession({
          ...session,
          roundStats: mergeStats(session.roundStats, stats),
          phase: "round-complete",
          lastActiveAt: Date.now(),
        });
        setActive(null);
        setProgress(null);
        router.push("/session");
        return;
      }
      setActive(null);
      setProgress(null);
      const s = computeResults(stats);
      if (!quiz || !s.total) {
        router.push("/");
        return;
      }
      const out = writeRecord(stats, quiz.snapshot.mode, quiz.redrill, {
        planned: quiz.facts,
      });
      setResults({
        mode: quiz.snapshot.mode,
        redrill: quiz.redrill,
        ts: out?.ts ?? Date.now(),
        stats,
      });
      router.push("/results");
    },
    [active, session, writeRecord, router],
  );

  const abandonQuiz = useCallback(() => {
    setActive(null);
    setSession(null);
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
      session,
      results,
      progress,
      setProgress,
      saveNow,
      startQuiz,
      startFirstRound,
      finishQuiz,
      abandonQuiz,
      viewStoredSession,
      startSession,
      retryLeg,
      reviewLesson,
      resumeRound,
      completeRound,
      startNextRound,
      pauseSession,
      endSession,
      finishSession,
      discardSession,
      clearAllRuns,
      recoverLostLeg,
      continueSession,
      runs,
      continueRun,
      discardRun,
    }),
    [
      restored,
      active,
      session,
      results,
      progress,
      saveNow,
      startQuiz,
      startFirstRound,
      finishQuiz,
      abandonQuiz,
      viewStoredSession,
      startSession,
      retryLeg,
      reviewLesson,
      resumeRound,
      completeRound,
      startNextRound,
      pauseSession,
      endSession,
      finishSession,
      discardSession,
      clearAllRuns,
      recoverLostLeg,
      continueSession,
      runs,
      continueRun,
      discardRun,
    ],
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
