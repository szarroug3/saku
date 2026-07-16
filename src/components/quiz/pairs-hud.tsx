"use client";

// The pairs screen's HUD — the drill's HUD, on a board instead of a card.
//
// The rules are drill-screen.tsx's, verbatim: information stays, interaction
// fades. Quiet pills that only render when they have something true to say, a
// 2px hairline for progress, and End quiz sitting at 22% until the mouse
// moves. Every colour comes from a theme token.
//
// No background band: like drill (and unlike the grid, which scrolls) the
// board fits the stage, so nothing ever passes under the pills and the sticky
// wrapper needs no `bg-bg` — which would punch an opaque rectangle straight
// through kiri's mesh.
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
 * Characters still sitting unmatched on the board are already counted as seen,
 * so they're excluded until they resolve — otherwise a fresh board would open
 * at 0% and climb, reporting "not attempted yet" as "wrong". */
function liveAccuracy(stats: SessionStats, metric: AccuracyMetric): number | null {
  const agg = { ...EMPTY_AGGREGATE };
  for (const st of Object.values(stats)) {
    if (st.firstTryCorrect === null) continue; // not matched yet
    agg.seen += st.seen;
    agg.missed += st.misses;
    agg.firstTry += st.firstTryCorrect === true ? 1 : 0;
  }
  return accuracyOf(agg, metric);
}

export interface PairsHudProps {
  /** Characters dealt onto boards so far. */
  asked: number;
  /** Deck size, or null when endless. */
  total: number | null;
  /** Live per-character stats — the accuracy pill reads through them. */
  stats: SessionStats;
  /** Pairs matched first try, in a row. */
  streak: number;
  onEnd(): void;
}

export function PairsHud({ asked, total, stats, streak, onEnd }: PairsHudProps) {
  const { cfg } = useQuizConfig();
  const reducedMotion = usePrefersReducedMotion();
  const [controlsAwake, setControlsAwake] = useState(false);

  // Interaction fades: End quiz sits at 22% and wakes on any mouse movement,
  // then goes back to sleep once the mouse settles. `awake` is mirrored in a
  // local so a moving mouse doesn't re-render 60 times a second.
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
  // Endless has no total to be a fraction of, so the bar reads full — the
  // same thing drill's does.
  const pct =
    total === null ? 100 : Math.min(100, Math.round((100 * asked) / total));

  return (
    <div className="sticky top-0 z-10 py-1.5">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        {/* Information — always quiet, and only ever present when it has
            something true to say. An empty pill is worse than no pill: "—
            first try" and "🔥 0" both report an absence as if it were data. */}
        <span className="flex flex-wrap items-center gap-1.5">
          <Pill>
            {total !== null ? `${asked} / ${total}` : `${asked} characters`}
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
        {/* Interaction — the board is what you click; this isn't, until the
            moment you want it. */}
        <span
          className="flex items-center gap-1.5"
          style={{
            opacity: controlsLit ? 1 : 0.22,
            transition: fadeControls ? "opacity 250ms ease" : undefined,
          }}
        >
          <SmallBtn onClick={onEnd}>End quiz</SmallBtn>
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
