"use client";

// The grid screen's HUD — the drill's HUD, adapted to a sheet that scrolls.
//
// The rules are drill-screen.tsx's, verbatim: information stays, interaction
// fades. Quiet pills that only render when they have something true to say, a
// 2px hairline for progress, and Finish quiz sitting at 22% until the mouse
// moves. Every colour comes from a theme token.
//
// The one deliberate departure from drill: drill's stage doesn't scroll, so
// its sticky HUD carries no background at all (a `bg-bg` band punches an
// opaque rectangle straight through kiri's mesh). The grid is a hundred cards
// long and every one of them scrolls under these pills, so a soft
// var(--bg) → transparent scrim sits behind the HUD — enough that the pills
// stay readable over a passing card, short of the hard band drill dropped.
//
// Pill / the fade / liveAccuracy are deliberate copies of drill-screen's, one
// per screen, matching how drill keeps its own. ui.tsx is where they'd belong
// if the three screens ever consolidate.

import { useEffect, useState, useSyncExternalStore } from "react";

import { SmallBtn } from "@/components/ui";
import { EMPTY_AGGREGATE, accuracyOf, formatAccuracy } from "@/lib/accuracy";
import { BEHAVIOR } from "@/lib/config";
import { useQuizConfig } from "@/lib/quiz-config";
import type { AccuracyMetric, SessionStats } from "@/types";

/** How long the controls stay lit after the mouse stops. */
const CONTROLS_IDLE_MS = 2000;

const REDUCED_MOTION = "(prefers-reduced-motion: reduce)";

/** The scrim: opaque under the pills, gone by the time it clears the
 * hairline, so a card sliding under the HUD dissolves instead of colliding. */
const SCRIM =
  "linear-gradient(to bottom, var(--bg) 0%, var(--bg) 58%, transparent 100%)";

function cx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}

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

/** Live session accuracy, on exactly the terms src/lib/accuracy.ts defines.
 * Cards that haven't been answered yet are left out — on the grid EVERY card
 * is counted as seen from the first paint, so without this the sheet would
 * open at 0% and climb, reporting "unanswered" as "wrong". */
function liveAccuracy(stats: SessionStats, metric: AccuracyMetric): number | null {
  const agg = { ...EMPTY_AGGREGATE };
  for (const st of Object.values(stats)) {
    if (st.firstTryCorrect === null) continue; // not attempted yet
    agg.seen += st.seen;
    agg.missed += st.misses;
    agg.firstTry += st.firstTryCorrect === true ? 1 : 0;
  }
  return accuracyOf(agg, metric);
}

export interface GridHudProps {
  /** Cards answered right. */
  done: number;
  total: number;
  /** Live per-character stats — the accuracy pill reads through them. */
  stats: SessionStats;
  /** Cards answered right on the first try, in a row. */
  streak: number;
  onFinish(): void;
}

export function GridHud({ done, total, stats, streak, onFinish }: GridHudProps) {
  const { cfg } = useQuizConfig();
  const reducedMotion = usePrefersReducedMotion();
  const [controlsAwake, setControlsAwake] = useState(false);

  // Interaction fades: Finish quiz sits at 22% and wakes on any mouse
  // movement, then goes back to sleep once the mouse settles. `awake` is
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

  const accuracy = cfg.showAccuracy
    ? liveAccuracy(stats, cfg.accuracyMetric)
    : null;
  const controlsLit = !fadeControls || controlsAwake;
  const pct = total ? Math.min(100, Math.round((100 * done) / total)) : 0;

  return (
    <div className="sticky top-0 z-10 py-1.5">
      {/* Sits behind the pills (the sticky wrapper is the stacking context)
          and above the cards, which are outside it. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 -top-3 -bottom-6 -z-10"
        style={{ background: SCRIM }}
      />
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        {/* Information — always quiet, and only ever present when it has
            something true to say. An empty pill is worse than no pill: "—
            first try" and "🔥 0" both report an absence as if it were data. */}
        <span className="flex flex-wrap items-center gap-1.5">
          <Pill>
            {done} / {total}
          </Pill>
          {cfg.showAccuracy && accuracy !== null ? (
            <Pill tone="accent">
              {formatAccuracy(accuracy)}{" "}
              {cfg.accuracyMetric === "firstTry" ? "first try" : "eventually right"}
            </Pill>
          ) : null}
          {/* A streak isn't a streak until it's a streak. */}
          {cfg.showStreak && streak >= BEHAVIOR.streakMin ? (
            <Pill tone="warm">🔥 {streak}</Pill>
          ) : null}
        </span>
        {/* Interaction — you're typing, not clicking, so it gets out of the
            way until you reach for it. */}
        <span
          className="flex items-center gap-1.5"
          style={{
            opacity: controlsLit ? 1 : 0.22,
            transition: fadeControls ? "opacity 250ms ease" : undefined,
          }}
        >
          <SmallBtn onClick={onFinish}>Finish quiz</SmallBtn>
        </span>
      </div>
      {/* 2px hairline: the progress bar reduced to the one thing it says. */}
      <div className="h-0.5 overflow-hidden rounded-full bg-panel">
        <div
          className="h-full rounded-full bg-accent transition-[width] duration-200"
          style={{
            width: `${pct}%`,
            boxShadow: "0 0 8px color-mix(in srgb, var(--accent) 55%, transparent)",
          }}
        />
      </div>
    </div>
  );
}
