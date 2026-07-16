"use client";

// Drill screen — port of the legacy quiz engine (startQuiz/nextQuestion/
// buildMC/submit/timer/bindDrill) from legacy/app.html.
//
// State contract (see src/lib/quiz-session.tsx): ALL mutable quiz state lives
// in `active.runtime` (a stable, JSON-serializable object) so tab switches
// (unmount/remount) resume mid-question and a page refresh survives via the
// provider's sessionStorage snapshot. The countdown syncs its remaining
// seconds and the active-elapsed ms into the runtime on every tick, because
// effect cleanups don't reliably run on page unload.
//
// Config split: builder settings (mode, dirs, styles, length) come from
// active.snapshot, frozen at Start Quiz. Settings-page values (retries,
// timer, showAnswer, scriptLabel, fonts, and the four HUD toggles) are read
// live from useQuizConfig so mid-drill drawer / Settings-tab edits apply
// instantly.
//
// Timer pauses while away: the interval stops on unmount (remainder already
// in runtime) and resumes from the stored remainder on remount. Slow-answer
// measurement counts ACTIVE time only — elapsed accumulates on pause and the
// stopwatch restarts on resume.
//
// The view: information stays, interaction fades. The HUD is small, quiet
// pills that are always readable; End quiz and the gear drop to 22% and wake
// on mouse move. Progress, the halo and the glyph are always there; streak,
// live accuracy and retry pips are the user's call — all four toggles are in
// the drawer, so the screen dials from zen (all off) to instrumented (all on)
// without ending the session.

import {
  useEffect,
  useReducer,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";

import { SmallBtn } from "@/components/ui";
import { CHAR_INDEX } from "@/data/characters";
import { EMPTY_AGGREGATE, accuracyOf, formatAccuracy } from "@/lib/accuracy";
import { BEHAVIOR, pickFont } from "@/lib/config";
import {
  buildDeck,
  buildMcOptions,
  checkTyped,
  confusedWith,
  newCharStat,
  pickDir,
  requeueGap,
  retriesAllowed,
  shuffle,
} from "@/lib/engine";
import { useQuizConfig } from "@/lib/quiz-config";
import { useQuizSession } from "@/lib/quiz-session";
import type { AccuracyMetric, Direction, SessionStats } from "@/types";

import { DrillDrawer } from "./drill-drawer";
import { DrillHalo, GLYPH_PX, type HaloState } from "./drill-halo";

// ---------- runtime shape (lives in active.runtime) ----------

interface DrillQuestion {
  /** The character being asked. */
  c: string;
  dir: Direction;
  /** Wrong attempts so far on this card. */
  tries: number;
  /** JP font picked when the question was asked — stable across remounts. */
  font: string;
  /** Multiple-choice option chars, frozen at ask time; null in typed mode. */
  mc: string[] | null;
  /** Per-option fonts for en2jp MC kana labels. */
  mcFonts: string[] | null;
}

/** How the last answer landed. There is no `text`: the halo IS the feedback —
 * green sweep for right, red pulse for wrong — so a sentence would only repeat
 * in prose what the colour already said. The one thing colour can't say is
 * WHICH answer was right, and that surfaces in the answer slot instead (the
 * input, or the correct MC option), the same way grid mode already reveals. */
interface DrillFeedback {
  kind: "good" | "bad";
}

/** Everything here must stay JSON-serializable (numbers/strings/plain
 * objects — no functions, no Infinity) for the sessionStorage snapshot. */
interface DrillRuntime {
  deck: string[];
  /** Next deck index to draw from. */
  pos: number;
  /** Questions asked so far (progress numerator). */
  asked: number;
  /** Cards spliced back into the deck after exhausting retries. */
  requeued: number;
  /** Consecutive cards answered right on the FIRST try; any miss (or a
   * timeout) puts it back to 0. In the runtime, not React state, so it
   * survives a tab switch and a refresh like everything else here. */
  streak: number;
  stats: SessionStats;
  q: DrillQuestion | null;
  /** True between an answer resolving and the next card. */
  waiting: boolean;
  feedback: DrillFeedback | null;
  /** Remaining countdown seconds; null when the timer is off. */
  timerLeft: number | null;
  /** Active (on-screen) ms spent on the current question so far. */
  elapsedMs: number;
}

interface DrillHandlers {
  tick(): void;
  nextQuestion(): void;
  onKeyDown(e: KeyboardEvent): void;
  onMount(): void;
  onUnmount(): void;
  onTimerCfgChange(): void;
}

/** The ring only wakes for the last few seconds — and if the whole timer is
 * shorter than that, the whole card is the last few seconds. */
const DRAIN_WINDOW_S = 5;
/** How long the controls stay lit after the mouse stops. */
const CONTROLS_IDLE_MS = 2000;

function cx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}

// ---------- reduced motion ----------

const REDUCED_MOTION = "(prefers-reduced-motion: reduce)";

function subscribeReducedMotion(onChange: () => void): () => void {
  const mq = window.matchMedia(REDUCED_MOTION);
  mq.addEventListener("change", onChange);
  return () => mq.removeEventListener("change", onChange);
}

/** useSyncExternalStore rather than an effect: no post-mount setState, and
 * the SSR snapshot is simply "no". */
function usePrefersReducedMotion(): boolean {
  return useSyncExternalStore(
    subscribeReducedMotion,
    () => window.matchMedia(REDUCED_MOTION).matches,
    () => false,
  );
}

// ---------- HUD pieces ----------

/** Small, quiet HUD chip. `tone` is the only colour the HUD ever uses. */
function Pill({
  tone = "quiet",
  children,
}: {
  tone?: "quiet" | "accent" | "warm";
  children: React.ReactNode;
}) {
  return (
    <span
      className={cx(
        "rounded-full border px-2.5 py-0.5 text-[11px] tabular-nums",
        tone === "accent"
          ? "border-accent/40 bg-accent-bg text-accent"
          : tone === "warm"
            ? "border-warning/40 bg-warning-bg text-warning"
            : "border-border text-text-muted",
      )}
    >
      {children}
    </span>
  );
}

/** Live session accuracy, on exactly the terms src/lib/accuracy.ts defines:
 * strict = first-try-correct showings / showings, forgiving = showings /
 * (showings + wrong attempts). Characters that have never been answered are
 * left out, so the card currently on screen can't drag the number down
 * before it's been attempted. */
function liveAccuracy(stats: SessionStats, metric: AccuracyMetric): number | null {
  const agg = { ...EMPTY_AGGREGATE };
  for (const st of Object.values(stats)) {
    if (st.firstTryCorrect === null) continue; // still in flight
    agg.seen += st.seen;
    agg.missed += st.misses;
    agg.firstTry += st.firstTryCorrect === true ? 1 : 0;
  }
  return accuracyOf(agg, metric);
}

export function DrillScreen() {
  const { cfg, ready } = useQuizConfig();
  const { active, finishQuiz, setProgress } = useQuizSession();

  // Runtime mutations don't go through setState — bump this to re-render.
  const [, force] = useReducer((x: number) => x + 1, 0);
  const [typed, setTyped] = useState("");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [controlsAwake, setControlsAwake] = useState(false);

  const inputRef = useRef<HTMLInputElement | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const advanceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** Timestamp when the active stopwatch for this question (re)started. */
  const qStartRef = useRef(0);
  /** Active ms accumulated before the current stopwatch span. */
  const elapsedBaseRef = useRef(0);
  const startedRef = useRef(false);
  const finishedRef = useRef(false);
  /** Async entry points (interval, timeout, document keydown) call through
   * here so they always see the closures from the latest render. */
  const handlersRef = useRef<DrillHandlers | null>(null);

  const reducedMotion = usePrefersReducedMotion();
  const rt = active ? (active.runtime as unknown as DrillRuntime) : null;
  const limited =
    !!active && (active.forceCoverage || active.snapshot.length === "limited");

  // ---------- engine (fresh closures each render; legacy port) ----------

  function stopCountdown() {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }

  function clearAdvance() {
    if (advanceRef.current) {
      clearTimeout(advanceRef.current);
      advanceRef.current = null;
    }
  }

  function syncProgress() {
    if (!rt) return;
    setProgress({ done: rt.asked, total: limited ? rt.deck.length : null });
  }

  /** Legacy startTimer: countdown from `from`, ticking once a second. Each
   * tick writes the remainder + elapsed into the runtime (refresh survival). */
  function startCountdown(from: number) {
    if (!rt) return;
    stopCountdown();
    rt.timerLeft = from;
    intervalRef.current = setInterval(() => handlersRef.current?.tick(), 1000);
  }

  function tick() {
    if (!rt || !rt.q || rt.waiting) return;
    rt.timerLeft = Math.max(0, (rt.timerLeft ?? 0) - 1);
    rt.elapsedMs = elapsedBaseRef.current + (Date.now() - qStartRef.current);
    if (rt.timerLeft <= 0) {
      submit("(time)");
      return;
    }
    force();
  }

  function endQuiz() {
    if (!rt || finishedRef.current) return;
    finishedRef.current = true;
    stopCountdown();
    clearAdvance();
    finishQuiz(rt.stats);
  }

  /** Legacy nextQuestion: advance the deck (replenishing from the SNAPSHOT
   * chars when endless, finishing when limited runs out) and ask a card. */
  function nextQuestion() {
    if (!active || !rt || finishedRef.current) return;
    clearAdvance();
    stopCountdown();
    rt.waiting = false;
    rt.feedback = null;
    if (rt.pos >= rt.deck.length) {
      if (limited) {
        endQuiz();
        return;
      }
      rt.deck = rt.deck.concat(shuffle(active.chars.slice()));
    }
    const c = rt.deck[rt.pos];
    rt.pos++;
    rt.asked++;
    const dir = pickDir({ ...cfg, dirs: active.snapshot.dirs });
    const typedMode =
      dir === "jp2en"
        ? active.snapshot.styleJp2en === "typed"
        : active.snapshot.styleEn2jp === "typed";
    // Font and MC options are rolled when the question is asked and stored in
    // the runtime so a remount doesn't reroll them.
    const mc = typedMode ? null : buildMcOptions(c);
    rt.q = {
      c,
      dir,
      tries: 0,
      font: pickFont(cfg.fonts),
      mc,
      mcFonts: mc && dir === "en2jp" ? mc.map(() => pickFont(cfg.fonts)) : null,
    };
    const st = rt.stats[c] ?? (rt.stats[c] = newCharStat());
    st.seen++;
    rt.elapsedMs = 0;
    elapsedBaseRef.current = 0;
    qStartRef.current = Date.now();
    if (cfg.timer) startCountdown(cfg.timerSec);
    else rt.timerLeft = null;
    setTyped("");
    syncProgress();
    force();
  }

  /** Legacy submit, verbatim (plus the streak, which is the same first-try
   * question `firstTryCorrect` already answers). `pickedChar` is set for MC
   * clicks (both dirs). */
  function submit(given: string, pickedChar?: string) {
    if (!rt || !rt.q || rt.waiting || finishedRef.current) return;
    const q = rt.q;
    const ms = elapsedBaseRef.current + (Date.now() - qStartRef.current);
    rt.elapsedMs = ms;
    const ok =
      q.dir === "en2jp" && pickedChar !== undefined
        ? pickedChar === q.c
        : q.dir === "en2jp"
          ? given.trim() === q.c
          : checkTyped(q.c, given);
    const st = rt.stats[q.c] ?? (rt.stats[q.c] = newCharStat());
    if (st.firstTryCorrect === null) st.firstTryCorrect = ok && q.tries === 0;
    if (ok) {
      // Only a clean first try extends the streak — a miss below has already
      // zeroed it, so getting there on the retry doesn't restore it.
      if (q.tries === 0) rt.streak = (rt.streak ?? 0) + 1;
      st.everCorrect = true;
      if (ms > BEHAVIOR.slowAnswerMs) st.slow++;
      rt.feedback = { kind: "good" };
      rt.waiting = true;
      stopCountdown();
      clearAdvance();
      advanceRef.current = setTimeout(
        () => handlersRef.current?.nextQuestion(),
        650,
      );
    } else {
      rt.streak = 0; // any miss, including a timeout
      st.misses++;
      if (pickedChar && pickedChar !== q.c) {
        st.confused[pickedChar] = (st.confused[pickedChar] ?? 0) + 1;
      } else if (given && given !== "(time)") {
        const match = confusedWith(q.c, given);
        if (match) st.confused[match] = (st.confused[match] ?? 0) + 1;
      }
      q.tries++;
      const left = retriesAllowed(cfg) - q.tries;
      if (left > 0) {
        // Red pulse + one fewer pip says "wrong, go again" without a sentence.
        // A timeout needs no words either: the ring visibly ran out.
        rt.feedback = { kind: "bad" };
        inputRef.current?.select();
        if (cfg.timer) startCountdown(cfg.timerSec);
      } else {
        rt.feedback = { kind: "bad" };
        rt.deck.splice(Math.min(rt.deck.length, rt.pos + requeueGap()), 0, q.c);
        rt.requeued++;
        rt.waiting = true;
        stopCountdown();
        syncProgress(); // requeue grew the limited total
      }
    }
    force();
  }

  /** Legacy bindDrill document keydown: Enter advances while waiting, Enter
   * in the answer box submits, digits 1–9 click MC options. */
  function onKeyDown(e: KeyboardEvent) {
    if (!rt || !rt.q || finishedRef.current) return;
    if (rt.waiting) {
      if (e.key === "Enter") nextQuestion();
      return;
    }
    if (e.key === "Enter" && document.activeElement === inputRef.current) {
      const v = inputRef.current?.value ?? "";
      if (v.trim()) submit(v);
      return;
    }
    if (rt.q.mc && /^[1-9]$/.test(e.key)) {
      // Don't hijack digits typed into a field (e.g. the drawer's timer box).
      const t = e.target;
      if (
        t instanceof HTMLElement &&
        (t.tagName === "INPUT" || t.tagName === "TEXTAREA")
      )
        return;
      const opt = rt.q.mc[parseInt(e.key, 10) - 1];
      if (opt) submit(rt.q.dir === "en2jp" ? opt : CHAR_INDEX[opt].r[0], opt);
    }
  }

  function onMount() {
    if (!active || !rt) return;
    startedRef.current = true;
    finishedRef.current = false;
    if (!Array.isArray(rt.deck)) {
      // Fresh quiz — build the deck. Redrill forces one full-coverage pass
      // over exactly the given chars; otherwise honor the builder snapshot.
      rt.deck = active.forceCoverage
        ? shuffle(active.chars.slice())
        : buildDeck(active.chars, { ...cfg, ...active.snapshot });
      rt.pos = 0;
      rt.asked = 0;
      rt.requeued = 0;
      rt.streak = 0;
      rt.stats = {};
      rt.q = null;
      rt.waiting = false;
      rt.feedback = null;
      rt.timerLeft = null;
      rt.elapsedMs = 0;
      nextQuestion();
      return;
    }
    // Resuming a runtime written before the streak existed.
    if (typeof rt.streak !== "number") rt.streak = 0;
    if (!rt.q) {
      nextQuestion();
      return;
    }
    // Resume mid-question after a tab switch / remount / refresh: restart the
    // active stopwatch from the accumulated elapsed, and the countdown from
    // the stored remainder.
    elapsedBaseRef.current = rt.elapsedMs ?? 0;
    qStartRef.current = Date.now();
    if (rt.waiting) {
      // A correct answer was mid auto-advance when we unmounted — re-arm it.
      if (rt.feedback?.kind === "good") {
        advanceRef.current = setTimeout(
          () => handlersRef.current?.nextQuestion(),
          650,
        );
      }
    } else if (cfg.timer) {
      startCountdown(
        rt.timerLeft != null && rt.timerLeft > 0 ? rt.timerLeft : cfg.timerSec,
      );
    } else {
      rt.timerLeft = null;
    }
    syncProgress();
    force();
  }

  function onUnmount() {
    if (!startedRef.current) return;
    startedRef.current = false;
    stopCountdown();
    clearAdvance();
    // Pause the active stopwatch: bank the elapsed into the runtime so the
    // slow-answer clock doesn't run while we're away. (timerLeft is already
    // there from the last tick.)
    if (rt && rt.q && !rt.waiting) {
      rt.elapsedMs = elapsedBaseRef.current + (Date.now() - qStartRef.current);
    }
  }

  function onTimerCfgChange() {
    if (!rt) return;
    if (!cfg.timer) {
      // Turning the timer off kills the running countdown and stills the ring.
      stopCountdown();
      rt.timerLeft = null;
      force();
      return;
    }
    // Turned on / timerSec changed: restart the countdown on the live card.
    if (rt.q && !rt.waiting) {
      startCountdown(cfg.timerSec);
      force();
    }
  }

  // ---------- effects ----------

  // Keep the async entry points pointed at this render's closures. Declared
  // first so it runs before the mount effect below.
  useEffect(() => {
    handlersRef.current = {
      tick,
      nextQuestion,
      onKeyDown,
      onMount,
      onUnmount,
      onTimerCfgChange,
    };
  });

  // Mount / unmount lifecycle. Waits for cfg hydration (`ready`) so a fresh
  // deck and a resumed countdown see the real settings, not the defaults.
  useEffect(() => {
    if (!active || !ready) return;
    handlersRef.current?.onMount();
    return () => handlersRef.current?.onUnmount();
  }, [active, ready]);

  // React live to timer settings edits (drawer or Settings tab). Value-diffed
  // so mount/hydration echoes don't clobber a resumed remainder.
  const prevTimerCfg = useRef<{ timer: boolean; sec: number } | null>(null);
  useEffect(() => {
    if (!ready) return;
    const prev = prevTimerCfg.current;
    prevTimerCfg.current = { timer: cfg.timer, sec: cfg.timerSec };
    if (!prev || (prev.timer === cfg.timer && prev.sec === cfg.timerSec)) return;
    handlersRef.current?.onTimerCfgChange();
  }, [ready, cfg.timer, cfg.timerSec]);

  // Document-level keys (Enter to advance/submit, 1–9 for MC), legacy style.
  useEffect(() => {
    const h = (e: KeyboardEvent) => handlersRef.current?.onKeyDown(e);
    document.addEventListener("keydown", h);
    return () => document.removeEventListener("keydown", h);
  }, []);

  // Interaction fades: End quiz and the gear sit at 22% and wake on any mouse
  // movement, then go back to sleep once the mouse settles. `awake` is
  // mirrored in a local so a moving mouse doesn't re-render 60 times a second.
  const fadeControls = cfg.fadeControls && !reducedMotion;
  useEffect(() => {
    if (!fadeControls) return;
    let awake = false;
    let idle: ReturnType<typeof setTimeout> | undefined;
    const sleep = () => {
      awake = false;
      setControlsAwake(false);
    };
    const wake = () => {
      if (!awake) {
        awake = true;
        setControlsAwake(true);
      }
      clearTimeout(idle);
      idle = setTimeout(sleep, CONTROLS_IDLE_MS);
    };
    // Arm the idle timer up front so turning the toggle on fades them out
    // even if the mouse never moves again.
    idle = setTimeout(sleep, CONTROLS_IDLE_MS);
    window.addEventListener("mousemove", wake);
    return () => {
      window.removeEventListener("mousemove", wake);
      clearTimeout(idle);
    };
  }, [fadeControls]);

  // ---------- render ----------

  if (!active || !rt || !rt.q) return null;

  const snap = active.snapshot;
  const q = rt.q;
  const info = CHAR_INDEX[q.c];
  const total = limited ? rt.deck.length : null;
  const pct = total ? Math.min(100, Math.round((100 * rt.asked) / total)) : null;
  const typedMode =
    q.dir === "jp2en"
      ? snap.styleJp2en === "typed"
      : snap.styleEn2jp === "typed";
  const scriptTag = cfg.scriptLabel
    ? q.dir === "jp2en"
      ? info.setLabel.toLowerCase()
      : `give the ${info.setLabel.toLowerCase()}`
    : "";

  // Retries: pips are the only representation. Unlimited shows an ∞ instead,
  // and "none" has nothing to say, so it says nothing.
  const allowed = retriesAllowed(cfg);
  const retriesLeft = Math.max(0, allowed - q.tries);
  const unlimited = cfg.retries === "unl";
  const showPips = cfg.showRetryPips && (unlimited || allowed > 0);

  // The ring: still, unless it has something to say. Draining only in the
  // final seconds; a wrong answer with retries left pulses out and hands the
  // ring back, where a re-queue holds it until the next card.
  const drainWindow = Math.min(DRAIN_WINDOW_S, Math.max(1, cfg.timerSec));
  const draining =
    cfg.timer && !rt.waiting && rt.timerLeft != null && rt.timerLeft <= drainWindow;
  const haloState: HaloState =
    rt.feedback?.kind === "good"
      ? "right"
      : rt.feedback?.kind === "bad" && rt.waiting
        ? "wrong"
        : draining
          ? "draining"
          : rt.feedback?.kind === "bad"
            ? "wrong-flash"
            : "resting";
  // Out of retries and waiting for the next card, with the setting on: show the
  // answer in the answer slot (the reveal that used to be a sentence).
  const revealing = cfg.showAnswer && rt.waiting && rt.feedback?.kind === "bad";

  const accuracy = cfg.showAccuracy
    ? liveAccuracy(rt.stats, cfg.accuracyMetric)
    : null;
  const controlsLit = !fadeControls || controlsAwake || drawerOpen;

  return (
    <div>
      <div className="sticky top-0 z-10 py-1.5">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          {/* Information — always quiet, and only ever present when it has
              something true to say. An empty pill is worse than no pill: "—
              first try" and "🔥 0" both report an absence as if it were data. */}
          <span className="flex flex-wrap items-center gap-1.5">
            <Pill>{total ? `${rt.asked} / ${total}` : `${rt.asked} answered`}</Pill>
            {rt.requeued ? <Pill>{rt.requeued} re-queued</Pill> : null}
            {cfg.showAccuracy && accuracy !== null ? (
              <Pill tone="accent">
                {formatAccuracy(accuracy)}{" "}
                {cfg.accuracyMetric === "firstTry" ? "first try" : "eventually right"}
              </Pill>
            ) : null}
            {/* A streak isn't a streak until it's a streak. */}
            {cfg.showStreak && (rt.streak ?? 0) >= BEHAVIOR.streakMin ? (
              <Pill tone="warm">🔥 {rt.streak}</Pill>
            ) : null}
          </span>
          {/* Interaction — you never click while drilling, so it gets out of
              the way until you reach for it. */}
          <span
            className="flex items-center gap-1.5"
            style={{
              opacity: controlsLit ? 1 : 0.22,
              transition: fadeControls ? "opacity 250ms ease" : undefined,
            }}
          >
            <SmallBtn onClick={endQuiz}>End quiz</SmallBtn>
            <SmallBtn
              aria-label="Mid-drill settings"
              onClick={() => setDrawerOpen((o) => !o)}
            >
              ⚙
            </SmallBtn>
          </span>
        </div>
        {/* 2px hairline: the progress bar reduced to the one thing it says. */}
        <div className="h-0.5 overflow-hidden rounded-full bg-panel">
          <div
            className="h-full rounded-full bg-accent transition-[width] duration-200"
            style={{
              width: `${pct === null ? 100 : Math.min(100, pct)}%`,
              boxShadow: "0 0 8px color-mix(in srgb, var(--accent) 55%, transparent)",
            }}
          />
        </div>
      </div>

      <div className="flex flex-col items-center gap-4 pt-10 pb-4">
        <DrillHalo
          // Re-mounts on every new card and every attempt, which is what
          // replays the entry sweep, the shake and the glyph cross-fade.
          key={`${rt.asked}-${q.tries}`}
          cardKey={`${rt.asked}-${q.tries}`}
          state={haloState}
          timerLeft={rt.timerLeft ?? 0}
          drainWindow={drainWindow}
          glyph={q.dir === "jp2en" ? q.c : info.r[0]}
          font={q.font}
          fontSize={q.dir === "jp2en" ? GLYPH_PX : Math.round(GLYPH_PX * 0.6)}
          crossFade={q.tries === 0}
        />
        {/* min-h-4 + text-center is the script label's theme hook. */}
        <p className="min-h-4 text-center text-[10px] uppercase tracking-[0.18em] text-text-muted">
          {scriptTag}
        </p>

        {typedMode ? (
          <input
            key={rt.asked}
            ref={inputRef}
            autoFocus
            autoComplete="off"
            spellCheck={false}
            placeholder="type answer, Enter to submit"
            value={typed}
            readOnly={revealing}
            onChange={(e) => setTyped(e.target.value)}
            // Wide enough for the placeholder to read in full — the old card
            // clipped it at 230px.
            className="w-[270px] rounded-lg border border-border bg-card px-3 py-2 text-center text-lg text-text outline-none focus:border-accent"
          />
        ) : (
          // Capped so the six options sit as two rows of three under the
          // halo, rather than a five-plus-one straggle as wide as the stage.
          <div className="flex max-w-[250px] flex-wrap justify-center gap-2">
            {q.mc?.map((opt, i) => (
              <button
                key={opt}
                onClick={() =>
                  submit(q.dir === "en2jp" ? opt : CHAR_INDEX[opt].r[0], opt)
                }
                className={cx(
                  "min-w-[74px] cursor-pointer rounded-lg border px-3.5 py-2.5 text-xl",
                  // The option you should have picked, lit alongside the reveal.
                  revealing && opt === q.c
                    ? "border-success bg-success-bg text-success"
                    : "border-border bg-card text-text hover:bg-panel",
                )}
                style={
                  q.dir === "en2jp" && q.mcFonts
                    ? { fontFamily: q.mcFonts[i] }
                    : undefined
                }
              >
                {q.dir === "en2jp" ? opt : CHAR_INDEX[opt].r[0]}
                <span className="block text-[10px] text-text-muted">{i + 1}</span>
              </button>
            ))}
          </div>
        )}

        {/* The reveal: the one thing colour can't say is WHICH answer was
            right. Held until you press Enter, so it's read rather than
            glimpsed. Fixed height whether or not it's showing — otherwise the
            stage jumps every time a card resolves. */}
        <p className="flex min-h-[38px] flex-col items-center justify-center gap-0.5">
          {revealing ? (
            <>
              <span className="text-sm">
                <span className="text-lg text-text">{q.c}</span>{" "}
                <span className="text-text-muted">=</span>{" "}
                <span className="font-semibold text-danger">{info.r[0]}</span>
              </span>
              <span className="text-[10px] text-text-muted">
                press Enter to continue
              </span>
            </>
          ) : null}
        </p>

        {/* Reserved whether or not pips are on, so toggling them mid-drill
            doesn't shove the drawer up and down. */}
        <span className="flex min-h-2 items-center gap-1.5">
          {showPips ? (
            <>
              {unlimited ? (
                <span className="text-sm leading-none text-accent">∞</span>
              ) : (
                Array.from({ length: allowed }, (_, i) => (
                  <span
                    key={i}
                    className={cx(
                      "block size-1.5 rounded-full",
                      i < retriesLeft ? "bg-accent" : "bg-border",
                    )}
                  />
                ))
              )}
              <span className="ml-1 text-[9px] uppercase tracking-[0.08em] text-text-muted/70">
                retries
              </span>
            </>
          ) : null}
        </span>
      </div>

      {drawerOpen ? <DrillDrawer /> : null}
    </div>
  );
}
