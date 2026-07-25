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

import {
  askIsEmpty,
  englishAsks,
  enabledDirs,
  japaneseAsks,
  sentenceAsksRomaji,
  sentenceAsksSelection,
} from "@/lib/ask-config";
import { startIsDisabled } from "@/lib/practice-start";
import type { AskConfig, QuizConfig } from "@/types";
import type { SettingsReachability } from "@/lib/ask-forms";

function cx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}

/** The answer-format phrase for the how-line: what the enabled sources ask for,
 * pooled and deduped. "Type romaji" keeps the old wording for a typed card. */
function stylePhrase(ask: AskConfig): string | null {
  const { jp2en, en2jp } = enabledDirs(ask);
  const styles = new Set<string>();
  const add = (formats: readonly ("typed" | "mc")[]) => {
    for (const f of formats) styles.add(f === "typed" ? "Type romaji" : "Multiple choice");
  };
  if (jp2en) add(ask.japanese.answers);
  if (sentenceAsksSelection(ask)) add(["mc"]);
  if (sentenceAsksRomaji(ask)) add(ask.sentence.answers);
  if (en2jp) add(ask.english.answers);
  return styles.size ? [...styles].join(" + ") : null;
}

function promptPhrase(ask: AskConfig): string | null {
  const prompts = new Set<string>();
  if (japaneseAsks(ask)) {
    for (const p of ask.japanese.prompts) prompts.add(p === "text" ? "Text" : "Audio");
  }
  if (sentenceAsksSelection(ask) || sentenceAsksRomaji(ask)) {
    for (const p of ask.sentence.prompts) prompts.add(p === "text" ? "Text" : "Audio");
  }
  return prompts.size ? [...prompts].join(" + ") : null;
}

function responsePhrase(ask: AskConfig): string | null {
  const responses = new Set<string>();
  if (japaneseAsks(ask)) {
    for (const r of ask.japanese.responses) {
      responses.add(r === "definition" ? "Definition" : "Romaji");
    }
  }
  if (sentenceAsksSelection(ask)) responses.add("Definition");
  if (sentenceAsksRomaji(ask)) responses.add("Romaji");
  if (englishAsks(ask)) responses.add("Japanese");
  return responses.size ? [...responses].join(" + ") : null;
}

/** "Drill · Endless · Type romaji" — the HOW half, read off the live setup. */
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
              : "Drill",
  ];
  // Grid deals every card once, and the sentence corpus modes run their own
  // corpus-driven queue: none of them has a length or direction to state.
  if (
    cfg.mode === "grid" ||
    cfg.mode === "assembly" ||
    cfg.mode === "substitution" ||
    cfg.mode === "listen-sentence"
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

  // Match pairs shows both sides at once — no answer style either. Audio, when
  // on, is called out before the answer format.
  if (cfg.mode !== "pairs") {
    const prompts = promptPhrase(cfg.ask);
    if (prompts) parts.push(prompts);
    const responses = responsePhrase(cfg.ask);
    if (responses) parts.push(responses);
    const style = stylePhrase(cfg.ask);
    if (style) parts.push(style);
  }
  return parts.join(" · ");
}

/**
 * Pure function to determine the reason message for a disabled Start button.
 * Exported for testing.
 */
export function getStartButtonReason(
  cfg: QuizConfig,
  count: number,
  plannedCount: number,
  reachability?: SettingsReachability,
): string | null {
  // Grid ignores Drill's source matrix, but it still needs one response type.
  const howBroken =
    (cfg.mode === "drill" && askIsEmpty(cfg.ask)) ||
    (cfg.mode === "pairs" && cfg.pairResponses.length === 0) ||
    (cfg.mode === "grid" && cfg.gridResponses.length === 0);
  // Nothing to ask is a real, reachable state — everything selected is `quiet`
  // — and it used to leave Start looking live and doing nothing: you clicked,
  // the page didn't move, and the app never said why. A button that is enabled
  // and inert is worse than one that is disabled and explains itself.
  const nothingToAsk = count > 0 && !howBroken && plannedCount === 0;
  // Check if settings are unreachable (will produce no forms for these facts)
  const settingsUnreachable =
    count > 0 && !howBroken && nothingToAsk && reachability && !reachability.isReachable;

  if (!count) {
    return "Nothing is selected. Widen the filters above to start.";
  }
  if (howBroken) {
    if (cfg.mode === "pairs") {
      return "Choose at least one pair type in the setup above.";
    }
    if (cfg.mode === "grid") {
      return "Choose at least one Grid response type in the setup above.";
    }
    return "Choose at least one complete way to ask in the setup above.";
  }
  if (settingsUnreachable) {
    // Settings are unreachable — show specific reason from configIsReachable
    return (
      reachability?.reason ||
      "These settings can't be used with the selected material. Check the 'How to ask' settings above."
    );
  }
  if (nothingToAsk) {
    // Deliberately not "nothing to do" and not a congratulation. It is a
    // statement about right now, with the way out in the same sentence:
    // the app has nothing to learn by asking these today, and the fix is
    // to select more — which is the screen you are already on.
    if (cfg.mode === "grid") {
      return "None of the selected material has those Grid response types.";
    }
    if (cfg.mode === "pairs") {
      // Not "nothing to ask" but "nothing to MATCH": every type here
      // makes at most a lone pair, and one pair is not a board. The way
      // out is the same screen — widen until a type has two or more.
      return "These don't make a matching board. Pick more so at least one type has two or more pairs.";
    }
    return "You're solid on all of these for now. Pick another deck to drill something else.";
  }
  return null;
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
