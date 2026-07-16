"use client";

// The whole quiz, in two lines, above the only button that runs it.
//
// THIS IS THE FIX. Home used to split HOW (a hero that owned mode/direction/
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
// `sticky bottom-0` rather than pinned to the page: the bar belongs to Home,
// rides its bottom edge, and follows you down the picker's 54 rows so that the
// selection you are fine-tuning is always one click from running. It matches
// the language the picker's own footer set — and the class tokens are
// load-bearing, not taste. kiri frosts `[class~="sticky"][class~="bg-bg"]`
// because a sticky opaque band would otherwise punch a rectangle through that
// theme's mesh, and momentum shelves `[class~="rounded-lg"][class~="bg-text"]`
// for the primary button. Keep both.

import type { QuizConfig } from "@/types";

import { whatSentence } from "./selection";

function cx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}

/** "Drill · endless · type romaji" — the HOW half, read off the live setup. */
export function howSentence(cfg: QuizConfig): string {
  const parts: string[] = [
    cfg.mode === "pairs" ? "Match pairs" : cfg.mode === "grid" ? "Grid" : "Drill",
  ];
  // Grid deals every card once: it has no length and no direction to state.
  if (cfg.mode === "grid") return parts.join(" · ");

  parts.push(
    cfg.length === "endless"
      ? "endless"
      : cfg.limType === "cov"
        ? "full coverage"
        : `${cfg.limCount} questions`,
  );

  // Match pairs shows both sides at once — no answer style either.
  if (cfg.mode !== "pairs") {
    const styles: string[] = [];
    if (cfg.dirs.jp2en) {
      styles.push(cfg.styleJp2en === "typed" ? "type romaji" : "multiple choice");
    }
    if (cfg.dirs.en2jp) {
      styles.push(cfg.styleEn2jp === "typed" ? "type kana" : "multiple choice");
    }
    // Both directions answered the same way is one phrase, not two.
    const unique = [...new Set(styles)];
    if (unique.length) parts.push(unique.join(" + "));
  }
  return parts.join(" · ");
}

export function StartBar({
  cfg,
  labels,
  count,
  active,
  onStart,
}: {
  cfg: QuizConfig;
  /** The cards the selection currently is — already degraded-ready. */
  labels: string[];
  /** Exact, deduped character count. The one number that never blurs. */
  count: number;
  /** A quiz is in progress — starting this one replaces it. */
  active: boolean;
  onStart: () => void;
}) {
  // Grid ignores directions, so only the char count gates it there.
  const howBroken =
    cfg.mode !== "grid" && !cfg.dirs.jp2en && !cfg.dirs.en2jp;
  const disabled = !count || howBroken;

  // Never a bare greyed-out button. A disabled control that won't say why is
  // the reason people click a thing five times and then file a bug, and both
  // of these are one click from fixed — the fix is on this same screen.
  const reason = !count
    ? "Pick at least one deck to start."
    : howBroken
      ? "Choose a direction in the setup above."
      : null;

  return (
    <div
      className={cx(
        "sticky bottom-0 -mx-3 mt-3.5 flex flex-wrap items-center gap-x-3 gap-y-2 px-3 py-2.5",
        "border-t bg-bg",
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
              {whatSentence(labels, count)}
              {/* Said here, not only in the confirm dialog: a consequence you
                  only learn about after clicking is an ambush, and the confirm
                  is a backstop, not the notice. */}
              {active ? " · replaces the running quiz" : null}
            </span>
          </>
        )}
      </span>
      <button
        type="button"
        disabled={disabled}
        onClick={onStart}
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
