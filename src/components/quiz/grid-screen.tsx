"use client";

// Grid quiz screen (Tofugu-style sheet). Every selected character is a
// card with its own input; Enter / form submit (or blur, when the
// blur-submit setting is on) checks it. Correct → green + locked, focus
// jumps to the next open card; wrong → red shake settling to a red still-open
// tint; out of retries → locked (answer revealed if show-answer).
// Auto-finishes 500ms after every card is resolved.
//
// All resumable state lives in active.runtime.grid (a plain mutable,
// JSON-serializable object) — card order, input text, per-card {value, state,
// tries}, the streak — so tab-switch and refresh resume exactly. The shake is
// transient component state; the pending finish timeout is re-armed on remount
// when all cards are resolved.
// Retries, show-answer, fonts, and blur-submit read live from config.
//
// The runtime is mutated IN PLACE, so nothing about it reaches disk on its
// own: `active` never changes identity and React never hears about it. Every
// resolved answer therefore calls `saveNow()` explicitly — see `check()`, and
// the long note on saveNow in quiz-session.tsx for the miss-losing bug that
// closes.
//
// The view (see grid-hud.tsx): the drill's language on a sheet. Quiet pills
// that only speak when they have something true to say, a 2px hairline, and
// Finish quiet at 22% until you reach for it. There is no prose: a card is
// green or it shook, which is the whole message, and the retry counter that
// couldn't fit per-card is already spoken by the colour a card settles into.
//
// The sheet's rule, in one line, because it explains every class below: a
// RESOLVED card recedes and an OPEN card is the work. Attention follows what's
// left, and progress reads as the sheet going quiet.
//
// A card is a surface in the theme's own material, tinted by state, the same
// way every other small tile in this app is (ui.tsx's Chip, pairs' cells,
// deck-card's `smart`). The colours are all in globals.css under GRID QUIZ
// SHEET — that section is where the design lives; this file just names states.

import { useEffect, useRef, useState } from "react";

import { pickFont } from "@/lib/config";
import {
  checkTyped,
  confusedWith,
  newFactStat,
  questionsFor,
  retriesAllowed,
  shuffle,
} from "@/lib/engine";
import { entryOf, factInfo } from "@/lib/facts";
import { useQuizConfig } from "@/lib/quiz-config";
import { useQuizSession, type ActiveQuiz } from "@/lib/quiz-session";
import type { FactId, QuizConfig, SessionStats } from "@/types";

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
  /** Card order — shuffled ONCE at init. FACTS: one cell per askable thing, so
   * a kanji with three selected readings is three cells and each is graded on
   * its own. Keying the board by character would put 生 on the board once and
   * ask which of its nine readings you meant. */
  order: FactId[];
  cards: Record<FactId, GridCard>;
  /** Cards answered right on the FIRST try, in a row; any miss puts it back
   * to 0, exactly as the drill's does. In the runtime rather than React
   * state, so it survives a tab switch and a refresh like everything else. */
  streak: number;
  stats: SessionStats;
}

function initGrid(facts: FactId[], fonts: string[]): GridRuntime {
  const order = shuffle(facts.slice());
  const cards: Record<FactId, GridCard> = {};
  const stats: SessionStats = {};
  for (const f of order) {
    stats[f] = newFactStat();
    stats[f].seen++;
    cards[f] = { value: "", state: "open", tries: 0, font: pickFont(fonts) };
  }
  return { order, cards, streak: 0, stats };
}

/** Get (or lazily create) the grid runtime inside active.runtime. */
function ensureRuntime(active: ActiveQuiz, fonts: string[]): GridRuntime {
  const rt = active.runtime as { grid?: GridRuntime };
  const g = (rt.grid ??= initGrid(active.facts, fonts));
  // Resuming a runtime written before the streak existed.
  if (typeof g.streak !== "number") g.streak = 0;
  return g;
}

function setCardValue(g: GridRuntime, f: FactId, value: string): void {
  g.cards[f].value = value;
}

type CheckOutcome =
  | "noop" // empty input or already locked
  | "right" // correct — locked green
  | "locked" // wrong and out of retries — locked, shake
  | "retry"; // wrong but retryable — shake, stays open

/** Legacy grid check(): score the card's current input against LIVE cfg. */
function checkCard(g: GridRuntime, f: FactId, cfg: QuizConfig): CheckOutcome {
  const card = g.cards[f];
  const v = card.value.trim().toLowerCase();
  if (!v || card.state !== "open") return "noop";
  const st = g.stats[f];
  // A grid cell shows the thing and asks for its answer, which is jp2en by
  // construction — there is no direction control on this screen.
  const ok = checkTyped(f, card.value, "jp2en");
  // As in pairs: a grid cell is dealt once (`seen++` once, at init), so the
  // count can only ever reach 1 here. Kept so `firstTryCount` carries the same
  // meaning on every screen that writes stats.
  if (st.firstTryCorrect === null) {
    st.firstTryCorrect = ok;
    if (ok) st.firstTryCount = (st.firstTryCount ?? 0) + 1;
  }
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
  // `confused` is keyed by ENTRY — the thing you said instead, not one of its
  // facts. See FactSessionDetail.
  const said = confusedWith(f, v, g.order);
  if (said && said !== entryOf(f)) {
    st.confused[said] = (st.confused[said] ?? 0) + 1;
  }
  if (card.tries > retriesAllowed(cfg)) {
    if (cfg.showAnswer) card.value = factInfo(f)?.answers[0] ?? "";
    card.state = "wrong";
    return "locked";
  }
  return "retry";
}

// ---------- screen ----------

export function GridScreen() {
  const { cfg } = useQuizConfig();
  const { active, finishQuiz, setProgress, saveNow } = useQuizSession();
  const [, bump] = useState(0);
  const rerender = () => bump((n) => n + 1);

  // Cast once; lazily create the runtime on the first render of a fresh
  // quiz (guarded, so StrictMode re-renders and remounts reuse it).
  const g = active ? ensureRuntime(active, cfg.fonts) : null;

  // Transient shake state: cards mid-shake right now, keyed like the board.
  const [shaking, setShaking] = useState<Record<string, boolean>>({});
  const shakeTimers = useRef<Record<string, number>>({});
  const rafId = useRef<number | undefined>(undefined);
  const finishTimer = useRef<number | undefined>(undefined);
  const inputRefs = useRef(new Map<FactId, HTMLInputElement>());

  const shake = (f: FactId) => {
    window.clearTimeout(shakeTimers.current[f]);
    const arm = () => {
      setShaking((s) => ({ ...s, [f]: true }));
      shakeTimers.current[f] = window.setTimeout(() => {
        setShaking((s) => ({ ...s, [f]: false }));
      }, 460);
    };
    if (shaking[f]) {
      // Restart the animation: drop the class for a frame, then re-add
      // (the React equivalent of the legacy `void offsetWidth` reflow).
      setShaking((s) => ({ ...s, [f]: false }));
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

  const check = (f: FactId, fromBlur: boolean) => {
    if (!g) return;
    // Retries and show-answer are read live from cfg at check time.
    const out = checkCard(g, f, cfg);
    if (out === "noop") return;
    // Every outcome that changed the runtime hits the disk before the next
    // question is drawn — INCLUDING "retry", which is the one that used to be
    // lost. A miss moves nothing React can see (the stats are mutated in place
    // and `progress` only counts cards that went RIGHT), so a miss used to
    // reach localStorage only if beforeunload happened to fire. Crash,
    // force-quit or a tab eviction and every miss since your last correct
    // answer was gone.
    saveNow();
    if (out === "retry") {
      shake(f);
      rerender();
      return;
    }
    if (out === "locked") shake(f);
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
    const open = g.order.filter((f) => g.cards[f].state === "open");
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
  const done = g ? g.order.filter((f) => g.stats[f].everCorrect).length : 0;
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
        {g.order.map((f) => {
          const card = g.cards[f];
          const prompt = questionsFor(f).prompt(f, "jp2en");
          // Presentation only — this reads the state machine, it doesn't touch
          // it.
          //
          // RED MEANS FINISHED, NOT FAILED.
          // A card with goes left is NOT red — it looks exactly like a card
          // you haven't tried, and the spent dot below is the only thing that
          // says otherwise. Red is reserved for out-of-retries: done with,
          // here's the answer.
          //
          // This is the user's rule, and it also kills a real problem rather
          // than just obeying one. The sheet used to paint three states in
          // three reds — `missed` at 60% danger, `wrong` at 52%, and the shake
          // at 100%. Two of those are eight points apart, which is to say they
          // were the same colour, and the only thing telling `missed` from
          // `shake` was motion that had already finished. Now the shake is the
          // only thing ever briefly red-and-still-open, and the two states that
          // were indistinguishable are maximally different.
          //
          // The cost, stated: you can no longer see at a glance which cards
          // you've already missed. You read the dots. `kq-gcard-missed` is
          // consequently unused by this screen — it stays in globals.css
          // because the stylesheet is not mine to prune.
          const state = shaking[f]
            ? "animate-gshake kq-gcard-shake"
            : card.state === "right"
              ? "kq-gcard-right"
              : card.state === "wrong"
                ? "kq-gcard-wrong"
                : "";
          // Pips: one per allowed retry, spent left to right. A card that is
          // out of goes shows them all as gone, which is the same information
          // the red is already giving — deliberately, because that state is
          // the one worth saying twice.
          const allowed = retriesAllowed(cfg);
          const showPips =
            cfg.showRetryPips && Number.isFinite(allowed) && allowed > 0;
          return (
            <div
              key={f}
              className={`kq-gcard px-2 pb-2.5 pt-3 text-center ${state}`}
            >
              {/* No colour class: the glyph inherits the card's state ink, so
                  the surface and the thing written on it can never disagree. */}
              <span
                className="block text-[30px] leading-[1.2]"
                style={{ fontFamily: card.font }}
              >
                {prompt.glyph}
              </span>
              {/* Part of the question, not a caption: a cell showing 生 with no
                  "in 人生" under it is asking for one of nine answers. Kana
                  supplies none and the cell keeps its original spacing. */}
              <span className="mb-2 block min-h-3 text-[10px] leading-3 text-text-muted">
                {prompt.context ?? ""}
              </span>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  check(f, false);
                }}
              >
                <input
                  ref={(el) => {
                    if (el) inputRefs.current.set(f, el);
                    else inputRefs.current.delete(f);
                  }}
                  type="text"
                  autoComplete="off"
                  spellCheck={false}
                  disabled={card.state !== "open"}
                  value={card.value}
                  onChange={(e) => {
                    // Written into the runtime on every keystroke so a
                    // refresh mid-typing keeps the text.
                    setCardValue(g, f, e.target.value);
                    rerender();
                  }}
                  onBlur={() => {
                    // blurSubmit is read at blur time, live from config.
                    if (cfg.blurSubmit) check(f, true);
                  }}
                  className="kq-gcard-well w-full px-1 py-1.5 text-center text-sm"
                />
              </form>
              {/* The dots are the whole retry counter now that colour isn't
                  carrying it. Reserved height whether or not they're on, so
                  toggling the setting mid-quiz doesn't reflow 214 cards. */}
              <span className="mt-1.5 flex min-h-[5px] items-center justify-center gap-[3px]">
                {showPips
                  ? Array.from({ length: allowed }, (_, i) => {
                      const spent = i < card.tries;
                      return (
                        <span
                          key={i}
                          className={`block size-[5px] rounded-full ${
                            card.state === "wrong"
                              ? "bg-danger opacity-90"
                              : spent
                                ? "bg-text-muted opacity-[0.16]"
                                : "bg-text-muted opacity-[0.55]"
                          }`}
                        />
                      );
                    })
                  : null}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
