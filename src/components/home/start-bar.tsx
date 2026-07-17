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
// the language the picker's own footer set.
//
// `kq-band` is what makes this bar OCCLUDE, and it replaces the `bg-bg` that
// used to be here. A sticky band has to hide what scrolls under it, and the
// honest answer to "with what?" is per-theme: the three opaque themes lay down
// the page's own ground, while kiri occludes with a blur instead, because a
// flat --bg there would punch an opaque rectangle through its mesh. That used
// to be spelled `[class~="sticky"][class~="bg-bg"]` in globals.css — an
// accidental class pair that armed by coincidence and disarmed by omission.
// The bar now says what it is; see CARD MATERIAL in globals.css.
//
// Still load-bearing and NOT taste: momentum shelves the primary button off
// `[class~="rounded-lg"][class~="bg-text"]`. Keep that one.

import type { QuizConfig } from "@/types";

function cx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}

/** "Drill · Endless · Type romaji" — the HOW half, read off the live setup. */
export function howSentence(cfg: QuizConfig): string {
  const parts: string[] = [
    cfg.mode === "pairs" ? "Match pairs" : cfg.mode === "grid" ? "Grid" : "Drill",
  ];
  // Grid deals every card once: it has no length and no direction to state.
  if (cfg.mode === "grid") return parts.join(" · ");

  parts.push(
    cfg.length === "endless"
      ? "Endless"
      : cfg.limType === "cov"
        ? "Full coverage"
        : `${cfg.limCount} questions`,
  );

  // Match pairs shows both sides at once — no answer style either.
  if (cfg.mode !== "pairs") {
    const styles: string[] = [];
    if (cfg.dirs.jp2en) {
      styles.push(cfg.styleJp2en === "typed" ? "Type romaji" : "Multiple choice");
    }
    if (cfg.dirs.en2jp) {
      styles.push(cfg.styleEn2jp === "typed" ? "Type kana" : "Multiple choice");
    }
    // Both directions answered the same way is one phrase, not two.
    const unique = [...new Set(styles)];
    if (unique.length) parts.push(unique.join(" + "));
  }
  return parts.join(" · ");
}

export function StartBar({
  cfg,
  what,
  count,
  active,
  confirmingReplace,
  onStart,
  onCancelReplace,
}: {
  cfg: QuizConfig;
  /** The WHAT half, already said — see selection.whatSentence. */
  what: string;
  /** Exact, deduped count of things selected. The one number that never
   * blurs, and the one thing that gates Start. */
  count: number;
  /** A quiz is in progress — starting this one replaces it. */
  active: boolean;
  /** Start was pressed with a quiz running: the button is now asking. */
  confirmingReplace: boolean;
  onStart: () => void;
  onCancelReplace: () => void;
}) {
  // Grid ignores directions, so only the count gates it there.
  const howBroken =
    cfg.mode !== "grid" && !cfg.dirs.jp2en && !cfg.dirs.en2jp;
  const disabled = !count || howBroken;

  // Never a bare greyed-out button. A disabled control that won't say why is
  // the reason people click a thing five times and then file a bug, and both
  // of these are one click from fixed — the fix is on this same screen.
  const reason = !count
    ? "Nothing is selected. Widen the filters above to start."
    : howBroken
      ? "Choose a direction in the setup above."
      : null;

  return (
    <div
      className={cx(
        "kq-band sticky bottom-0 -mx-3 mt-3.5 flex flex-wrap items-center gap-x-3 gap-y-2 px-3 py-2.5",
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
              {/* Said here, not only in the confirm dialog: a consequence you
                  only learn about after clicking is an ambush, and the confirm
                  is a backstop, not the notice. */}
              {active ? " · replaces the running quiz" : null}
            </span>
          </>
        )}
      </span>
      {/* Replacing a running quiz asks, and asks HERE — no window.confirm.
          A native dialog cannot be styled, cannot be read by anything driving
          the app, and stops the whole page to deliver one sentence that the bar
          above has already said ("· replaces the running quiz"). The button
          just becomes the question, and Cancel appears next to it. */}
      {confirmingReplace ? (
        <span className="ml-auto flex flex-none items-center gap-2">
          <span className="text-[13px] text-text-muted">Discard the one running?</span>
          <button
            type="button"
            onClick={onCancelReplace}
            className="kq-material cursor-pointer rounded-lg border border-border bg-card px-3.5 py-[7px] text-sm text-text hover:bg-panel"
          >
            Keep it
          </button>
          <button
            type="button"
            onClick={onStart}
            className="cursor-pointer rounded-lg bg-text px-5 py-2 text-sm font-semibold text-bg"
          >
            Replace
          </button>
        </span>
      ) : (
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
      )}
    </div>
  );
}
