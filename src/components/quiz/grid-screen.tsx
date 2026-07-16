"use client";

// Grid quiz screen (Tofugu-style sheet). Every selected character is a
// card with its own input; Enter / form submit (or blur, when the
// blur-submit setting is on) checks it. Correct → green + locked, focus
// jumps to the next open card; wrong → red shake settling to the warning
// tint; out of retries → locked (answer revealed if show-answer).
// Auto-finishes 500ms after every card is resolved.
//
// All resumable state lives in active.runtime.grid (a plain mutable,
// JSON-serializable object) and is written AS IT CHANGES — card order,
// input text, per-card {value, state, tries}, the streak — so tab-switch and
// refresh resume exactly. The shake is transient component state; the pending
// finish timeout is re-armed on remount when all cards are resolved.
// Retries, show-answer, fonts, and blur-submit read live from config.
//
// The view (see grid-hud.tsx): the drill's language on a sheet. Quiet pills
// that only speak when they have something true to say, a 2px hairline, and
// Finish quiet at 22% until you reach for it. There is no prose: a card is
// green or it shook, which is the whole message, and the retry counter that
// couldn't fit per-card is already spoken by the colour a card settles into.
//
// A card is a surface in the theme's own material, tinted by state, the same
// way every other small tile in this app is (ui.tsx's Chip, pairs' cells,
// deck-card's `smart`). The colours are all in globals.css under GRID QUIZ
// SHEET — that section is where the design lives; this file just names states.

import { useEffect, useRef, useState } from "react";

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

import { GridHud } from "./grid-hud";

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
  /** Cards answered right on the FIRST try, in a row; any miss puts it back
   * to 0, exactly as the drill's does. In the runtime rather than React
   * state, so it survives a tab switch and a refresh like everything else. */
  streak: number;
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
  return { order, cards, streak: 0, stats };
}

/** Get (or lazily create) the grid runtime inside active.runtime. */
function ensureRuntime(active: ActiveQuiz, fonts: string[]): GridRuntime {
  const rt = active.runtime as { grid?: GridRuntime };
  const g = (rt.grid ??= initGrid(active.chars, fonts));
  // Resuming a runtime written before the streak existed.
  if (typeof g.streak !== "number") g.streak = 0;
  return g;
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
    // Only a clean first try extends the streak — a miss below has already
    // zeroed it, so getting there on the retry doesn't restore it.
    if (card.tries === 0) g.streak++;
    st.everCorrect = true;
    card.state = "right";
    return "right";
  }
  g.streak = 0;
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
      <GridHud
        done={done}
        total={total}
        stats={g.stats}
        streak={g.streak}
        onFinish={() => finishQuiz(g.stats)}
      />
      {/* The sheet and its cards are `kq-grid*` hook classes rather than
          Tailwind colour utilities — see the GRID QUIZ SHEET section in
          globals.css. Two things need naming here that a utility can't say:
          these 214 cards must stay OUT of kiri's per-element frosting (the
          sheet carries one blur for all of them instead), and each state is a
          surface + edge + ink together, which is one class, not three. */}
      <div className="kq-grid-sheet mt-4">
        {g.order.map((c) => {
          const card = g.cards[c];
          const state = shaking[c]
            ? "animate-gshake kq-gcard-shake"
            : card.state === "right"
              ? "kq-gcard-right"
              : card.state === "wrong" || card.tries > 0
                ? "kq-gcard-wrong"
                : "";
          return (
            <div
              key={c}
              className={`kq-gcard px-2 pb-2.5 pt-3 text-center ${state}`}
            >
              {/* No colour class: the glyph inherits the card's state ink, so
                  the surface and the thing written on it can never disagree. */}
              <span
                className="mb-2 block text-[30px] leading-[1.2]"
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
                  className="kq-gcard-well w-full px-1 py-1.5 text-center text-sm"
                />
              </form>
            </div>
          );
        })}
      </div>
    </div>
  );
}
