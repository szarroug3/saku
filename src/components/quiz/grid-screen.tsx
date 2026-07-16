"use client";

// Grid quiz screen (Tofugu-style sheet). Every selected character is a
// card with its own input; Enter / form submit (or blur, when the
// blur-submit setting is on) checks it. Correct → green + locked, focus
// jumps to the next open card; wrong → red shake settling to the muted
// wrong color; out of retries → locked (answer revealed if show-answer).
// Auto-finishes 500ms after every card is resolved.
//
// All resumable state lives in active.runtime.grid (a plain mutable,
// JSON-serializable object) and is written AS IT CHANGES — card order,
// input text, per-card {value, state, tries} — so tab-switch and refresh
// resume exactly. The shake is transient component state; the pending
// finish timeout is re-armed on remount when all cards are resolved.
// Retries, show-answer, fonts, and blur-submit read live from config.

import { useEffect, useRef, useState } from "react";

import { Hint, ProgressBar, SmallBtn } from "@/components/ui";
import { CHAR_INDEX } from "@/data/characters";
import { pickFont } from "@/lib/config";
import {
  checkTyped,
  confusedWith,
  newCharStat,
  retriesAllowed,
  shuffle,
} from "@/lib/engine";
import { useQuizConfig } from "@/lib/quiz-config";
import { useQuizSession, type ActiveQuiz } from "@/lib/quiz-session";
import type { QuizConfig, SessionStats } from "@/types";

// ---------- runtime (lives in active.runtime.grid) ----------

interface GridCard {
  /** Current input text — written on every keystroke. */
  value: string;
  /** open = answerable · right = correct+locked · wrong = out of retries. */
  state: "open" | "right" | "wrong";
  /** Wrong submissions so far, compared against the LIVE retry setting. */
  tries: number;
  /** Font family chosen at init. */
  font: string;
}

interface GridRuntime {
  /** Card order — shuffled ONCE at init. */
  order: string[];
  cards: Record<string, GridCard>;
  stats: SessionStats;
}

function initGrid(chars: string[], fonts: string[]): GridRuntime {
  const order = shuffle(chars.slice());
  const cards: Record<string, GridCard> = {};
  const stats: SessionStats = {};
  for (const c of order) {
    stats[c] = newCharStat();
    stats[c].seen++;
    cards[c] = { value: "", state: "open", tries: 0, font: pickFont(fonts) };
  }
  return { order, cards, stats };
}

/** Get (or lazily create) the grid runtime inside active.runtime. */
function ensureRuntime(active: ActiveQuiz, fonts: string[]): GridRuntime {
  const rt = active.runtime as { grid?: GridRuntime };
  return (rt.grid ??= initGrid(active.chars, fonts));
}

function setCardValue(g: GridRuntime, c: string, value: string): void {
  g.cards[c].value = value;
}

type CheckOutcome =
  | "noop" // empty input or already locked
  | "right" // correct — locked green
  | "locked" // wrong and out of retries — locked, shake
  | "retry"; // wrong but retryable — shake, stays open

/** Legacy grid check(): score the card's current input against LIVE cfg. */
function checkCard(g: GridRuntime, c: string, cfg: QuizConfig): CheckOutcome {
  const card = g.cards[c];
  const v = card.value.trim().toLowerCase();
  if (!v || card.state !== "open") return "noop";
  const st = g.stats[c];
  const ok = checkTyped(c, card.value);
  if (st.firstTryCorrect === null) st.firstTryCorrect = ok;
  if (ok) {
    st.everCorrect = true;
    card.state = "right";
    return "right";
  }
  st.misses++;
  card.tries++;
  const match = confusedWith(c, v);
  if (match) st.confused[match] = (st.confused[match] ?? 0) + 1;
  if (card.tries > retriesAllowed(cfg)) {
    if (cfg.showAnswer) card.value = CHAR_INDEX[c].r[0];
    card.state = "wrong";
    return "locked";
  }
  return "retry";
}

// ---------- screen ----------

export function GridScreen() {
  const { cfg } = useQuizConfig();
  const { active, finishQuiz, setProgress } = useQuizSession();
  const [, bump] = useState(0);
  const rerender = () => bump((n) => n + 1);

  // Cast once; lazily create the runtime on the first render of a fresh
  // quiz (guarded, so StrictMode re-renders and remounts reuse it).
  const g = active ? ensureRuntime(active, cfg.fonts) : null;

  // Transient shake state: chars whose card is mid-shake right now.
  const [shaking, setShaking] = useState<Record<string, boolean>>({});
  const shakeTimers = useRef<Record<string, number>>({});
  const rafId = useRef<number | undefined>(undefined);
  const finishTimer = useRef<number | undefined>(undefined);
  const inputRefs = useRef(new Map<string, HTMLInputElement>());

  const shake = (c: string) => {
    window.clearTimeout(shakeTimers.current[c]);
    const arm = () => {
      setShaking((s) => ({ ...s, [c]: true }));
      shakeTimers.current[c] = window.setTimeout(() => {
        setShaking((s) => ({ ...s, [c]: false }));
      }, 460);
    };
    if (shaking[c]) {
      // Restart the animation: drop the class for a frame, then re-add
      // (the React equivalent of the legacy `void offsetWidth` reflow).
      setShaking((s) => ({ ...s, [c]: false }));
      cancelAnimationFrame(rafId.current ?? 0);
      rafId.current = requestAnimationFrame(arm);
    } else {
      arm();
    }
  };

  /** After a card locks: finish when none remain, else move focus on
   * (skipped for blur-submit checks so we don't steal focus). */
  const advance = (fromBlur: boolean) => {
    if (!g) return;
    const open = g.order.filter((x) => g.cards[x].state === "open");
    if (!open.length) {
      window.clearTimeout(finishTimer.current);
      finishTimer.current = window.setTimeout(() => finishQuiz(g.stats), 500);
    } else if (!fromBlur) {
      inputRefs.current.get(open[0])?.focus();
    }
  };

  const check = (c: string, fromBlur: boolean) => {
    if (!g) return;
    // Retries and show-answer are read live from cfg at check time.
    const out = checkCard(g, c, cfg);
    if (out === "noop") return;
    if (out === "retry") {
      shake(c);
      rerender();
      return;
    }
    if (out === "locked") shake(c);
    rerender();
    advance(fromBlur);
  };

  // On mount (once the quiz is available): focus the first open input, or —
  // if every card is already resolved — re-arm the auto-finish timeout that
  // a refresh may have lost.
  const armed = useRef(false);
  useEffect(() => {
    if (!g || armed.current) return;
    armed.current = true;
    const open = g.order.filter((c) => g.cards[c].state === "open");
    if (!open.length) {
      finishTimer.current = window.setTimeout(() => finishQuiz(g.stats), 500);
    } else {
      inputRefs.current.get(open[0])?.focus();
    }
    // No dep array: finishQuiz is recreated per render and the armed guard
    // makes this effectively run-once per quiz.
  });

  useEffect(
    () => () => {
      for (const id of Object.values(shakeTimers.current)) {
        window.clearTimeout(id);
      }
      cancelAnimationFrame(rafId.current ?? 0);
      window.clearTimeout(finishTimer.current);
    },
    [],
  );

  const total = g?.order.length ?? 0;
  const done = g ? g.order.filter((c) => g.stats[c].everCorrect).length : 0;
  useEffect(() => {
    if (g) setProgress({ done, total });
  }, [g, done, total, setProgress]);

  if (!active || !g) return null;


  return (
    <div>
      <div className="sticky top-0 z-10 mb-2.5 flex flex-wrap items-center justify-between gap-2 bg-bg py-2">
        <span className="text-xs text-text-muted">
          {done} / {total} correct
        </span>
        <SmallBtn onClick={() => finishQuiz(g.stats)}>Finish quiz</SmallBtn>
      </div>
      <ProgressBar pct={total ? Math.round((100 * done) / total) : 0} />
      <p className="mb-3 text-center">
        <Hint>
          Type the romaji in any card · Enter to check · retry wrong ones as
          many times as you like
        </Hint>
      </p>
      <div className="grid grid-cols-[repeat(auto-fill,minmax(96px,1fr))] gap-2.5">
        {g.order.map((c) => {
          const card = g.cards[c];
          const bg = shaking[c]
            ? "animate-gshake bg-gcard-shake"
            : card.state === "right"
              ? "bg-gcard-right"
              : card.state === "wrong" || card.tries > 0
                ? "bg-gcard-wrong"
                : "bg-gcard";
          return (
            <div
              key={c}
              className={`rounded-xl px-2 pb-2.5 pt-3 text-center transition-colors duration-[250ms] ${bg}`}
            >
              <span
                className="mb-2 block text-[30px] leading-[1.2] text-white"
                style={{ fontFamily: card.font }}
              >
                {c}
              </span>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  check(c, false);
                }}
              >
                <input
                  ref={(el) => {
                    if (el) inputRefs.current.set(c, el);
                    else inputRefs.current.delete(c);
                  }}
                  type="text"
                  autoComplete="off"
                  spellCheck={false}
                  disabled={card.state !== "open"}
                  value={card.value}
                  onChange={(e) => {
                    // Written into the runtime on every keystroke so a
                    // refresh mid-typing keeps the text.
                    setCardValue(g, c, e.target.value);
                    rerender();
                  }}
                  onBlur={() => {
                    // blurSubmit is read at blur time, live from config.
                    if (cfg.blurSubmit) check(c, true);
                  }}
                  className="w-full rounded-md border-none bg-black/50 px-1 py-1.5 text-center text-sm text-white disabled:opacity-90"
                />
              </form>
            </div>
          );
        })}
      </div>
    </div>
  );
}
