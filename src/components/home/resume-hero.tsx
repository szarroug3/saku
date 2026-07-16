"use client";

// The hero: your current setup as a SENTENCE, and one button to act on it.
//
// It owns HOW you drill — mode, direction, answer style, length — and nothing
// about WHICH characters; the shelves below own that. Reading the setup back as
// prose is the point: a form makes you audit five rows before starting, a
// sentence you can check at a glance. The rows are still there, one click away
// behind "Edit setup", unchanged.

import { useState } from "react";

import { QuizOptionsFields } from "@/components/home/quiz-options";
import { Btn, Card, PrimaryBtn } from "@/components/ui";
import { SETS } from "@/data/characters";
import type { QuizConfig } from "@/types";

/** "Drill · endless · type romaji" — the HOW half. */
function howSentence(cfg: QuizConfig): string {
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

/** "2 hours ago". Coarse on purpose — this is a nudge, not a stopwatch. */
function ago(ts: number): string {
  const mins = Math.round((Date.now() - ts) / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} minute${mins === 1 ? "" : "s"} ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  const days = Math.round(hours / 24);
  return `${days} day${days === 1 ? "" : "s"} ago`;
}

export function ResumeHero({
  cfg,
  chars,
  lastTs,
  active,
  disabled,
  onStart,
  onResume,
  onDiscardAndStart,
}: {
  cfg: QuizConfig;
  /** The currently-selected characters — the WHAT half of the sentence. */
  chars: string[];
  /** Most recent session's ts; null when there is no history to speak of. */
  lastTs: number | null;
  /** A quiz is in progress, so the primary action is to go back to it. */
  active: boolean;
  disabled?: boolean;
  onStart: () => void;
  onResume: () => void;
  onDiscardAndStart: () => void;
}) {
  const [open, setOpen] = useState(false);

  const scripts = SETS.filter((set) =>
    set.sections.some((sec) => sec.chars.some((c) => cfg.enabled[c.c])),
  ).map((s) => s.label.toLowerCase());

  const what = [
    scripts.length ? scripts.join(" + ") : "no characters",
    `${chars.length} character${chars.length === 1 ? "" : "s"}`,
    // Omitted entirely on day one rather than claiming a never.
    ...(lastTs === null ? [] : [`last drilled ${ago(lastTs)}`]),
  ].join(" · ");

  return (
    <Card>
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <p className="text-[15px] font-semibold">{howSentence(cfg)}</p>
        <button
          type="button"
          aria-expanded={open}
          className="cursor-pointer text-xs text-accent"
          onClick={() => setOpen((v) => !v)}
        >
          {open ? "Done" : "Edit setup"}
        </button>
      </div>
      <p className="mt-1 text-xs tabular-nums text-text-muted">{what}</p>

      {open ? (
        <div className="mt-3 border-t border-border pt-1">
          <QuizOptionsFields />
        </div>
      ) : null}

      {active ? (
        <>
          <PrimaryBtn className="mt-3.5" onClick={onResume}>
            Resume quiz
          </PrimaryBtn>
          <Btn
            className="mt-2.5 w-full disabled:cursor-default disabled:opacity-45"
            disabled={disabled}
            onClick={onDiscardAndStart}
          >
            Discard &amp; start new quiz
          </Btn>
        </>
      ) : (
        <PrimaryBtn className="mt-3.5" disabled={disabled} onClick={onStart}>
          {/* NOT "pick up where you left off": this builds a fresh deck from
              the saved setup — it resumes nothing. Only "Resume quiz" above
              returns to a quiz in progress. The "last drilled …" clause
              carries the continuity without the button having to lie. */}
          Start drilling
        </PrimaryBtn>
      )}
    </Card>
  );
}
