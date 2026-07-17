"use client";

// The quiz you left running — and NOTHING when there isn't one.
//
// Its predecessor was a permanent hero at the top of Home that offered
// "Resume" whether or not anything was running; with nothing running it built
// a fresh quiz from the saved setup, which resumes nothing, so the button was
// a lie exactly when it was most prominent. The fix is to make the card's
// presence the message: this component renders only when active is non-null,
// so seeing it IS the news, and every word on it can be about the real quiz.
//
// It states the quiz, not the setup. The panel and the shelves below are
// building your NEXT quiz and the snapshot rule means edits there cannot reach
// this one (quiz-session freezes the builder settings at startQuiz) — so this
// card reads from active.snapshot and active.chars, never from the live cfg.
// Two cards on one screen showing different modes is correct and is the whole
// point of the snapshot.

import { Btn, SmallBtn } from "@/components/ui";
import {
  type ConfirmOptions,
  useConfirm,
} from "@/components/ui/confirm-dialog";
import { DECKS, deckSelectable } from "@/lib/decks";
import type { ActiveQuiz, QuizProgress } from "@/lib/quiz-session";

import { namedSelection } from "./selection";

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

const MODE_WORD = { drill: "Drill", pairs: "Match pairs", grid: "Grid" };

/**
 * What the running quiz is drilling, named off the STATIC decks only.
 *
 * Not the weakness decks, deliberately: those are computed from history, and
 * history moves. A quiz started from "Last Misses" would be named by whatever
 * the last misses are NOW, which after the previous session is a different set
 * — the card would rename the quiz under you while it ran. The static decks
 * are the same set today as they were when you pressed Start.
 */
function deckName(chars: string[]): string {
  const enabled: Record<string, boolean> = {};
  for (const c of chars) enabled[c] = true;
  const labels = namedSelection(DECKS.map(deckSelectable), enabled);
  if (!labels.length) {
    return `${chars.length} character${chars.length === 1 ? "" : "s"}`;
  }
  return labels.length <= 2
    ? labels.join(" + ")
    : `${labels[0]} + ${labels.length - 1} more`;
}

const DISCARD_PROMPT: ConfirmOptions = {
  title: "Discard the quiz in progress?",
  body: "Your answers so far will not be scored.",
  confirmLabel: "Discard quiz",
};

export function ResumeCard({
  active,
  progress,
  onResume,
  onDiscard,
}: {
  active: ActiveQuiz;
  /** Live position; null before the mode screen has reported one. */
  progress: QuizProgress | null;
  onResume: () => void;
  onDiscard: () => void;
}) {
  const confirm = useConfirm();
  const where =
    progress === null
      ? null
      : progress.total === null
        ? // Endless has no total, so "12 of ∞" is not available and "12 of 12"
          // would be a finish line that doesn't exist.
          `${progress.done} answered`
        : `${progress.done} of ${progress.total}`;

  const sub = [
    where,
    // Absent on a session restored from a snapshot written before startedAt
    // existed — the same rule as everywhere else here: omit, never invent.
    active.startedAt ? `started ${ago(active.startedAt)}` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className="mb-3.5 flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl border border-accent bg-accent-bg p-[18px]">
      <span aria-hidden="true" className="text-lg leading-none text-accent">
        ↩
      </span>
      <span className="min-w-0">
        <span className="block text-[15px] font-semibold">
          {MODE_WORD[active.snapshot.mode]} in progress ·{" "}
          {deckName(active.chars)}
        </span>
        {sub ? (
          <span className="mt-0.5 block text-xs tabular-nums text-text-muted">
            {sub}
          </span>
        ) : null}
      </span>
      <span className="ml-auto flex flex-none items-center gap-2">
        <SmallBtn
          onClick={() => {
            void (async () => {
              if (await confirm(DISCARD_PROMPT)) onDiscard();
            })();
          }}
        >
          Discard
        </SmallBtn>
        {/* The one button on Home that goes to a quiz without starting one. */}
        <Btn sel onClick={onResume}>
          Resume
        </Btn>
      </span>
    </div>
  );
}
