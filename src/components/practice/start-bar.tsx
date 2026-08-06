"use client";

// The whole quiz, in two lines, above the only button that runs it.
//
// THIS IS THE FIX. Setup used to split HOW (a hero that owned mode/direction/
// length) from WHAT (cards that owned the characters), and each one started
// quizzes on its own — so at the moment you acted you could only ever see half
// of what you were about to run. Press Start and you saw the how, not the what
// ("what deck is this even using?"). Click a deck and it ran instantly with the
// settings folded away behind a disclosure ("what settings am I getting?").
// Both halves are on this bar, and the rule the whole screen now keeps is:
// whatever you are about to run is fully on screen before you run it.
//
// So it says the how, then the what, then Start — in that order, because that
// is the order of the sentence, and Start acts on exactly what it sits under.
//
// It sits at the BOTTOM OF THE PAGE — the last thing in the flow, after the
// "How to ask" card — not `sticky bottom-0`. Sticky rode the viewport edge and
// let the setup scroll UNDER it, so the bar hung over the Length row instead of
// following the end of the content; Sam asked for it at the bottom of the page,
// so it just ends the page. Start still sits directly under everything it acts
// on, because that setup is the last thing above it.
//
// `kq-band` gives the bar its own material (a per-theme ground: the opaque
// themes lay down the page's ground, kiri a blur, because a flat --bg would
// punch an opaque rectangle through its mesh). It no longer needs to OCCLUDE a
// scroll — nothing passes under a static footer — but the band still reads as a
// distinct footer, which is what we want. See CARD MATERIAL in globals.css.
//
// Still load-bearing and NOT taste: momentum shelves the primary button off
// `[class~="rounded-lg"][class~="bg-text"]`. Keep that one.

import { startIsDisabled, getStartButtonReason } from "@/lib/practice-start";
import type { QuizConfig } from "@/types";
import type { SettingsReachability } from "@/lib/ask-forms";

function cx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}

/** "Drill · Full coverage · Both" — the HOW half, read off the live setup. */
export function howSentence(cfg: QuizConfig): string {
  const parts: string[] = [
    cfg.mode === "pairs"
      ? "Match pairs"
      : cfg.mode === "grid"
        ? "Grid"
        : cfg.mode === "assembly"
          ? "Build sentences"
          : cfg.mode === "substitution"
            ? "Substitution"
            : cfg.mode === "listen-sentence"
              ? "Listen to sentences"
              : cfg.mode === "number-reading"
                ? "Numbers"
                : "Drill",
  ];
  // Grid deals every card once, and the sentence corpus modes run their own
  // corpus-driven queue: none of them has a length or direction to state.
  if (
    cfg.mode === "grid" ||
    cfg.mode === "assembly" ||
    cfg.mode === "substitution" ||
    cfg.mode === "listen-sentence" ||
    cfg.mode === "number-reading"
  )
    return parts.join(" · ");

  parts.push(
    cfg.length === "endless"
      ? "Endless"
      : cfg.limType === "cov"
        ? "Full coverage"
        : // A pairs run of N is N pairs, not N "questions" — it has no questions.
          `${cfg.limCount} ${cfg.mode === "pairs" ? "pairs" : "questions"}`,
  );

  // Match pairs shows both sides at once and has no prompt format. A drill names
  // how it is prompted — the only remaining ask knob. Text is always on, so this
  // just says whether audio is added too.
  if (cfg.mode === "drill") parts.push(cfg.audioPrompts ? "Text & audio" : "Text");
  return parts.join(" · ");
}

export function StartBar({
  cfg,
  what,
  count,
  plannedCount,
  reachability,
  onStart,
}: {
  cfg: QuizConfig;
  /** The WHAT half, already said — see selection.whatSentence. */
  what: string;
  /** Exact, deduped count of things selected. The one number that never
   * blurs, and the one thing that gates Start. */
  count: number;
  /**
   * How many of `count` the BUDGET would actually put in the session — the
   * ranked material plus the teach top-up. Can be 0 while `count` is 5: that
   * means the app is confident about every one of them right now, which is not
   * an error and not an empty selection.
   */
  plannedCount: number;
  /** Whether the current settings are reachable (will produce forms). */
  reachability?: SettingsReachability;
  onStart: () => void;
}) {
  const disabled = startIsDisabled(cfg, count, plannedCount);
  const reason = getStartButtonReason(cfg, count, plannedCount, reachability);

  return (
    <div
      className={cx(
        "kq-band -mx-3 mt-3.5 flex flex-wrap items-center gap-x-3 gap-y-2 px-3 py-2.5",
        "border-t",
        disabled ? "border-border" : "border-accent",
      )}
    >
      <span className="min-w-0">
        {disabled ? (
          <span className="block text-[13px] text-text-muted">{reason}</span>
        ) : (
          <>
            <span className="block text-[15px] font-semibold">
              {howSentence(cfg)}
            </span>
            <span className="mt-0.5 block text-xs tabular-nums text-text-muted">
              {what}
            </span>
          </>
        )}
      </span>
      <button
        type="button"
        disabled={disabled}
        onClick={onStart}
        suppressHydrationWarning
        className={cx(
          "ml-auto flex-none cursor-pointer rounded-lg bg-text px-5 py-2",
          "text-sm font-semibold text-bg",
          "disabled:cursor-default disabled:opacity-40",
        )}
      >
        Start
      </button>
    </div>
  );
}
