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
  englishSentenceAsksOrdering,
  englishSentenceAsksSelection,
  englishAsks,
  enabledDirs,
  japaneseAsks,
  sentenceAsksRomaji,
  sentenceAsksSelection,
} from "@/lib/ask-config";
import { startIsDisabled, getStartButtonReason } from "@/lib/practice-start";
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
  if (englishSentenceAsksOrdering(ask)) styles.add("Order chunks");
  if (englishSentenceAsksSelection(ask)) styles.add("Multiple choice");
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
  if (englishSentenceAsksOrdering(ask)) responses.add("Ordered Japanese");
  if (englishSentenceAsksSelection(ask)) responses.add("Japanese sentence");
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
