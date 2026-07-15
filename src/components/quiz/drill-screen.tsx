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
// timer, showAnswer, scriptLabel, kanaPreview, fonts) are read live from
// useQuizConfig so mid-drill drawer / Settings-tab edits apply instantly.
//
// Timer pauses while away: the interval stops on unmount (remainder already
// in runtime) and resumes from the stored remainder on remount. Slow-answer
// measurement counts ACTIVE time only — elapsed accumulates on pause and the
// stopwatch restarts on resume.

import { useRouter } from "next/navigation";
import { useEffect, useReducer, useRef, useState } from "react";

import { Card, GhostBtn, ProgressBar, SmallBtn } from "@/components/ui";
import { CHAR_INDEX } from "@/data/characters";
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
  romajiToKana,
  shuffle,
} from "@/lib/engine";
import { useQuizConfig } from "@/lib/quiz-config";
import { useQuizSession } from "@/lib/quiz-session";
import type { Direction, SessionStats } from "@/types";

import { DrillDrawer } from "./drill-drawer";

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

interface DrillFeedback {
  kind: "good" | "bad";
  text: string;
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

function cx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}

export function DrillScreen() {
  const router = useRouter();
  const { cfg, ready } = useQuizConfig();
  const { active, finishQuiz, abandonQuiz, setProgress } = useQuizSession();

  // Runtime mutations don't go through setState — bump this to re-render.
  const [, force] = useReducer((x: number) => x + 1, 0);
  const [typed, setTyped] = useState("");
  const [drawerOpen, setDrawerOpen] = useState(false);

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

  /** Legacy submit, verbatim. `pickedChar` is set for MC clicks (both dirs). */
  function submit(given: string, pickedChar?: string) {
    if (!rt || !rt.q || rt.waiting || finishedRef.current) return;
    const q = rt.q;
    const info = CHAR_INDEX[q.c];
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
      st.everCorrect = true;
      if (ms > BEHAVIOR.slowAnswerMs) st.slow++;
      rt.feedback = { kind: "good", text: `Correct — ${q.c} is "${info.r[0]}"` };
      rt.waiting = true;
      stopCountdown();
      clearAdvance();
      advanceRef.current = setTimeout(
        () => handlersRef.current?.nextQuestion(),
        650,
      );
    } else {
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
        rt.feedback = {
          kind: "bad",
          text:
            given === "(time)" ? "Time's up — try again" : "Not quite — try again",
        };
        inputRef.current?.select();
        if (cfg.timer) startCountdown(cfg.timerSec);
      } else {
        const answer = cfg.showAnswer
          ? ` — the answer is "${info.r[0]}"${q.dir === "en2jp" ? "" : ` ${q.c}`}`
          : "";
        rt.feedback = {
          kind: "bad",
          text: `${given === "(time)" ? "Time's up" : "Not quite"}${answer} · re-queued`,
        };
        rt.deck.splice(Math.min(rt.deck.length, rt.pos + requeueGap()), 0, q.c);
        rt.requeued++;
        rt.waiting = true;
        stopCountdown();
        syncProgress(); // requeue grew the limited total
      }
    }
    force();
  }

  function onBack() {
    if (window.confirm("Back to setup? This quiz won't be scored or saved.")) {
      finishedRef.current = true;
      stopCountdown();
      clearAdvance();
      abandonQuiz();
      router.push("/");
    }
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
      rt.stats = {};
      rt.q = null;
      rt.waiting = false;
      rt.feedback = null;
      rt.timerLeft = null;
      rt.elapsedMs = 0;
      nextQuestion();
      return;
    }
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
      // Turning the timer off kills the running countdown and hides the chip.
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

  // ---------- render ----------

  if (!active || !rt || !rt.q) return null;

  const snap = active.snapshot;
  const q = rt.q;
  const info = CHAR_INDEX[q.c];
  const total = limited ? rt.deck.length : null;
  const pct = total ? Math.min(100, Math.round((100 * rt.asked) / total)) : null;
  const requeuedNote = rt.requeued ? ` · ${rt.requeued} re-queued` : "";
  const progText = total
    ? `${rt.asked} / ${total}${requeuedNote}`
    : `${rt.asked} answered · endless${requeuedNote}`;
  const typedMode =
    q.dir === "jp2en"
      ? snap.styleJp2en === "typed"
      : snap.styleEn2jp === "typed";
  const scriptTag = cfg.scriptLabel
    ? q.dir === "jp2en"
      ? info.setLabel.toLowerCase()
      : `give the ${info.setLabel.toLowerCase()}`
    : "";
  const preview =
    cfg.kanaPreview && q.dir === "jp2en" && typed.trim()
      ? romajiToKana(typed.trim())
      : "";
  const left = retriesAllowed(cfg) - q.tries;
  const retryLine = rt.waiting
    ? "press Enter for the next card"
    : cfg.retries === "unl"
      ? "unlimited retries"
      : left > 0
        ? `${left} ${left === 1 ? "retry" : "retries"} left`
        : "no retries left";

  return (
    <div>
      <div className="sticky top-0 z-10 bg-bg py-1.5">
        <div className="mb-2.5 flex flex-wrap items-center justify-between gap-2">
          <GhostBtn className="px-2 py-1" onClick={onBack}>
            ← Setup
          </GhostBtn>
          <span className="text-xs text-text-muted">{progText}</span>
          <span className="flex flex-wrap items-center gap-2">
            {cfg.timer && rt.timerLeft != null ? (
              <span className="text-[13px] text-text-muted">
                ⏱ {Math.max(0, rt.timerLeft)}s
              </span>
            ) : null}
            <SmallBtn onClick={endQuiz}>End quiz → results</SmallBtn>
            <SmallBtn
              aria-label="Mid-drill settings"
              onClick={() => setDrawerOpen((o) => !o)}
            >
              ⚙
            </SmallBtn>
          </span>
        </div>
        <ProgressBar pct={pct} />
      </div>

      <Card>
        <p
          className="mt-2 mb-0.5 text-center leading-[1.15]"
          style={{
            fontSize:
              q.dir === "jp2en"
                ? BEHAVIOR.cardSizePx
                : Math.round(BEHAVIOR.cardSizePx * 0.6),
            fontFamily: q.font,
          }}
        >
          {q.dir === "jp2en" ? q.c : info.r[0]}
        </p>
        <p className="mb-3.5 min-h-4 text-center text-xs text-text-muted">
          {scriptTag}
        </p>
        <div className="text-center">
          {typedMode ? (
            <>
              <input
                key={rt.asked}
                ref={inputRef}
                autoFocus
                autoComplete="off"
                spellCheck={false}
                placeholder="type answer, Enter to submit"
                value={typed}
                onChange={(e) => setTyped(e.target.value)}
                className="w-[230px] rounded-lg border border-border bg-card px-3 py-2 text-center text-lg text-text outline-none focus:border-accent"
              />
              <p className="mt-2 min-h-[30px] text-[22px]">{preview}</p>
            </>
          ) : (
            <div className="mt-1.5 flex flex-wrap justify-center gap-2">
              {q.mc?.map((opt, i) => (
                <button
                  key={opt}
                  onClick={() =>
                    submit(q.dir === "en2jp" ? opt : CHAR_INDEX[opt].r[0], opt)
                  }
                  className="min-w-[74px] cursor-pointer rounded-lg border border-border bg-card px-3.5 py-2.5 text-xl text-text hover:bg-panel"
                  style={
                    q.dir === "en2jp" && q.mcFonts
                      ? { fontFamily: q.mcFonts[i] }
                      : undefined
                  }
                >
                  {q.dir === "en2jp" ? opt : CHAR_INDEX[opt].r[0]}
                  <span className="block text-[10px] text-text-muted">
                    {i + 1}
                  </span>
                </button>
              ))}
            </div>
          )}
          <p
            className={cx(
              "mt-1.5 min-h-[22px] text-sm",
              rt.feedback?.kind === "good" ? "text-success" : "text-danger",
            )}
          >
            {rt.feedback?.text ?? ""}
          </p>
          <p className="mt-1.5 min-h-4 text-xs text-text-muted">{retryLine}</p>
        </div>
      </Card>

      {drawerOpen ? <DrillDrawer /> : null}
    </div>
  );
}
