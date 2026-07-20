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
// `sticky bottom-0` rather than pinned to the page: the bar belongs to the
// Practice page, rides its bottom edge, and follows you down the picker so that
// the selection you are fine-tuning is always one click from running. It matches
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
        : // A pairs run of N is N pairs, not N "questions" — it has no questions.
          `${cfg.limCount} ${cfg.mode === "pairs" ? "pairs" : "questions"}`,
  );

  // Match pairs shows both sides at once — no answer style either.
  if (cfg.mode !== "pairs") {
    const styles: string[] = [];
    if (cfg.dirs.jp2en) {
      styles.push(cfg.styleJp2en === "typed" ? "Type romaji" : "Multiple choice");
    }
    if (cfg.dirs.en2jp) {
      styles.push(cfg.styleEn2jp === "typed" ? "Type romaji" : "Multiple choice");
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
  plannedCount,
  active,
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
  /** A session is in progress — starting this one replaces it. */
  active: boolean;
  onStart: () => void;
}) {
  // Grid ignores directions, so only the count gates it there.
  const howBroken =
    cfg.mode !== "grid" && !cfg.dirs.jp2en && !cfg.dirs.en2jp;
  // Nothing to ask is a real, reachable state — everything selected is `quiet`
  // — and it used to leave Start looking live and doing nothing: you clicked,
  // the page didn't move, and the app never said why. A button that is enabled
  // and inert is worse than one that is disabled and explains itself.
  const nothingToAsk = count > 0 && !howBroken && plannedCount === 0;
  const disabled = !count || howBroken || nothingToAsk;

  // Never a bare greyed-out button. A disabled control that won't say why is
  // the reason people click a thing five times and then file a bug, and both
  // of these are one click from fixed — the fix is on this same screen.
  const reason = !count
    ? "Nothing is selected. Widen the filters above to start."
    : howBroken
      ? "Choose a direction in the setup above."
      : nothingToAsk
        ? // Deliberately not "nothing to do" and not a congratulation. It is a
          // statement about right now, with the way out in the same sentence:
          // the app has nothing to learn by asking these today, and the fix is
          // to select more — which is the screen you are already on.
          "You're solid on all of these for now. Pick another deck to drill something else."
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
              {/* The notice, and the ONLY notice: there is no confirm dialog
                  and no two-state button behind it. A consequence you only
                  learn about after clicking is an ambush, so it is written on
                  the button that causes it. Nothing more is owed here — the
                  session card is on screen above, saying there is a session and
                  offering Continue, and everything in it is already saved. */}
              {active ? " · replaces the session in progress" : null}
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
