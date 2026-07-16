"use client";

// Match-pairs quiz screen. Boards of BEHAVIOR.pairsPerBoard kana↔romaji
// pairs; mismatches flash red and record a miss + confusion pair; board
// completion advances; endless mode replenishes the deck.
//
// All resumable state lives in active.runtime.pairs (a plain mutable,
// JSON-serializable object) and is written AS IT CHANGES, so tab-switch
// unmount/remount and refresh both resume exactly. The 450ms mismatch
// flash is transient component state; the 500ms board-advance timeout is
// re-armed on remount when the all-matched condition still holds.
//
// The view (see pairs-hud.tsx): the drill's language on a board. Quiet pills
// that only speak when they have something true to say, a 2px hairline, and
// End quiz at 22% until you reach for it. There is no prose — the mismatch
// flash below is this screen's halo pulse, and it says the same thing the
// halo's red does, in the same 450ms, without a sentence.

import { useEffect, useRef, useState } from "react";

import { CHAR_INDEX } from "@/data/characters";
import { BEHAVIOR, pickFont } from "@/lib/config";
import { buildDeck, newCharStat, shuffle } from "@/lib/engine";
import { useQuizConfig } from "@/lib/quiz-config";
import { useQuizSession, type ActiveQuiz } from "@/lib/quiz-session";
import type { CharSessionDetail, QuizConfig, SessionStats } from "@/types";

import { PairsHud } from "./pairs-hud";

// ---------- the mismatch flash ----------

// Pairs' equivalent of the halo's wrong pulse: the two cells shake (the same
// `gshake` the halo and the grid cards use, from globals.css) while a danger
// ring blooms out of them and decays. Deliberate, one beat long, and gone —
// the board is never left wearing it.
//
// The mismatch flash (.kq-pairs-miss) is defined in globals.css beside gshake
// — every colour a token, dropped under reduced motion, the cells' danger
// border and fill carrying the 450ms on their own.

// ---------- runtime (lives in active.runtime.pairs) ----------

interface PairsCell {
  /** The character this cell belongs to — kana and romaji cells share it. */
  id: string;
  label: string;
  kind: "kana" | "romaji";
  /** Font family for kana cells, chosen at board build. */
  font?: string;
  /** Matched — faded out and unclickable. */
  gone: boolean;
}

interface PairsRuntime {
  deck: string[];
  pos: number;
  asked: number;
  endless: boolean;
  /** Deck size, or null when endless. */
  total: number | null;
  stats: SessionStats;
  board: PairsCell[];
  /** Index into board of the currently picked cell, if any. */
  pick: number | null;
  /** Pairs matched FIRST TRY, in a row; a mismatch puts it back to 0, exactly
   * as the drill's does. */
  streak: number;
  /** Kana ids that have been mismatched on THIS board — the pair can still be
   * matched, but not first try, so it no longer extends the streak. Cleared
   * with every new board (the chars get a clean run at it again in endless),
   * and it is the kana side because that is the side the miss lands on. */
  dirty: string[];
}

function statFor(stats: SessionStats, c: string): CharSessionDetail {
  return (stats[c] ??= newCharStat());
}

/**
 * Advance the runtime to the next board: replenish (endless) or signal
 * finished (returns false), take the next chars, mark them seen, and lay
 * out the shuffled kana+romaji cells.
 */
function fillBoard(p: PairsRuntime, chars: string[], fonts: string[]): boolean {
  p.pick = null;
  p.dirty = [];
  if (p.pos >= p.deck.length) {
    if (p.endless) p.deck = p.deck.concat(shuffle(chars.slice()));
    else return false;
  }
  const take = p.deck.slice(p.pos, p.pos + BEHAVIOR.pairsPerBoard);
  p.pos += take.length;
  p.asked += take.length;
  for (const c of take) statFor(p.stats, c).seen++;
  p.board = shuffle([
    ...take.map(
      (c): PairsCell => ({
        id: c,
        label: c,
        kind: "kana",
        font: pickFont(fonts),
        gone: false,
      }),
    ),
    ...take.map(
      (c): PairsCell => ({
        id: c,
        label: CHAR_INDEX[c].r[0],
        kind: "romaji",
        gone: false,
      }),
    ),
  ]);
  return true;
}

function initPairs(active: ActiveQuiz, cfg: QuizConfig): PairsRuntime {
  // Builder settings come from the frozen snapshot; redrills force a
  // limited full-coverage run regardless of it.
  const eff: QuizConfig = {
    ...cfg,
    ...active.snapshot,
    ...(active.forceCoverage
      ? { length: "limited" as const, limType: "cov" as const }
      : {}),
  };
  const deck = buildDeck(active.chars, eff);
  const endless = eff.length === "endless";
  const p: PairsRuntime = {
    deck,
    pos: 0,
    asked: 0,
    endless,
    total: endless ? null : deck.length,
    stats: {},
    board: [],
    pick: null,
    streak: 0,
    dirty: [],
  };
  fillBoard(p, active.chars, cfg.fonts); // deck is non-empty — always fills
  return p;
}

/** Get (or lazily create) the pairs runtime inside active.runtime. */
function ensureRuntime(active: ActiveQuiz, cfg: QuizConfig): PairsRuntime {
  const rt = active.runtime as { pairs?: PairsRuntime };
  const p = (rt.pairs ??= initPairs(active, cfg));
  // Resuming a runtime written before the streak existed.
  if (typeof p.streak !== "number") p.streak = 0;
  if (!Array.isArray(p.dirty)) p.dirty = [];
  return p;
}

type PickResult =
  | { kind: "noop" }
  | { kind: "picked" }
  | { kind: "matched"; boardDone: boolean }
  | { kind: "mismatch"; flash: [number, number] };

/** Legacy pickCell: pick / unpick / move pick / attempt a match. */
function pickCell(p: PairsRuntime, i: number): PickResult {
  const cell = p.board[i];
  if (cell.gone) return { kind: "noop" };
  if (p.pick === null) {
    p.pick = i;
    return { kind: "picked" };
  }
  if (p.pick === i) {
    // Same cell unpicks.
    p.pick = null;
    return { kind: "picked" };
  }
  const first = p.board[p.pick];
  if (first.kind === cell.kind) {
    // Same-kind cell moves the pick.
    p.pick = i;
    return { kind: "picked" };
  }
  // Opposite kind → match attempt.
  const firstIdx = p.pick;
  p.pick = null;
  if (first.id === cell.id) {
    const st = statFor(p.stats, cell.id);
    st.everCorrect = true;
    if (st.firstTryCorrect === null) st.firstTryCorrect = st.misses === 0;
    // Only a pair that was never mismatched on this board extends the streak
    // — a mismatch below has already zeroed it, so finding it afterwards
    // doesn't restore it.
    if (!p.dirty.includes(cell.id)) p.streak++;
    first.gone = true;
    cell.gone = true;
    return { kind: "matched", boardDone: p.board.every((x) => x.gone) };
  }
  // The KANA side's char takes the miss and the confusion entry.
  const kana = first.kind === "kana" ? first : cell;
  const other = first.kind === "kana" ? cell : first;
  const st = statFor(p.stats, kana.id);
  st.misses++;
  st.confused[other.id] = (st.confused[other.id] ?? 0) + 1;
  p.streak = 0;
  if (!p.dirty.includes(kana.id)) p.dirty.push(kana.id);
  return { kind: "mismatch", flash: [firstIdx, i] };
}

// ---------- screen ----------

export function PairsScreen() {
  const { cfg } = useQuizConfig();
  const { active, finishQuiz, setProgress } = useQuizSession();
  const [, bump] = useState(0);
  const rerender = () => bump((n) => n + 1);

  // Cast once; lazily create the runtime on the first render of a fresh
  // quiz (guarded, so StrictMode re-renders and remounts reuse it).
  const p = active ? ensureRuntime(active, cfg) : null;

  // Transient mismatch flash: board indices currently flashing danger.
  const [flash, setFlash] = useState<number[]>([]);
  const flashTimer = useRef<number | undefined>(undefined);
  const nextTimer = useRef<number | undefined>(undefined);

  const advanceBoard = () => {
    if (!active || !p) return;
    if (fillBoard(p, active.chars, cfg.fonts)) rerender();
    else finishQuiz(p.stats);
  };

  const pick = (i: number) => {
    if (!p) return;
    const res = pickCell(p, i);
    if (res.kind === "noop") return;
    if (res.kind === "matched" && res.boardDone) {
      window.clearTimeout(nextTimer.current);
      nextTimer.current = window.setTimeout(advanceBoard, 500);
    }
    if (res.kind === "mismatch") {
      window.clearTimeout(flashTimer.current);
      setFlash(res.flash);
      flashTimer.current = window.setTimeout(() => setFlash([]), 450);
    }
    rerender();
  };

  // Re-arm the board-advance timeout on remount if the previous mount's
  // timer was lost while the all-matched condition still holds (this also
  // finishes a non-endless quiz whose last board was completed pre-refresh).
  const armed = useRef(false);
  useEffect(() => {
    if (!p || armed.current) return;
    armed.current = true;
    if (p.board.length > 0 && p.board.every((x) => x.gone)) {
      nextTimer.current = window.setTimeout(advanceBoard, 500);
    }
    // advanceBoard is recreated per render; the armed guard makes this
    // effectively run-once per quiz.
  });

  useEffect(
    () => () => {
      window.clearTimeout(flashTimer.current);
      window.clearTimeout(nextTimer.current);
    },
    [],
  );

  const asked = p?.asked ?? 0;
  const total = p?.total ?? null;
  useEffect(() => {
    if (p) setProgress({ done: asked, total });
  }, [p, asked, total, setProgress]);

  if (!active || !p) return null;

  return (
    <div>
      <PairsHud
        asked={asked}
        total={total}
        stats={p.stats}
        streak={p.streak}
        onEnd={() => finishQuiz(p.stats)}
      />

      {/* The board is the stage, the way the halo is drill's: it stands on the
          page rather than inside a card. The cells keep `rounded-lg`+`bg-card`
          — the theme hook that earns them kiri's glass and momentum's shelf —
          and there are sixteen of them, not a hundred, so the blur is cheap. */}
      <div className="flex flex-col items-center pt-8 pb-4">
        <div className="grid w-full max-w-[430px] grid-cols-4 gap-2.5">
          {p.board.map((cell, i) => {
            const bad = flash.includes(i);
            const picked = p.pick === i;
            return (
              <button
                key={i}
                onClick={() => pick(i)}
                style={cell.kind === "kana" ? { fontFamily: cell.font } : undefined}
                className={[
                  "cursor-pointer rounded-lg px-1 py-4 text-xl",
                  "transition-[opacity,background-color,border-color] duration-300",
                  cell.gone
                    ? // Matched: it fades out rather than vanishing, and stops
                      // being a target the instant it's spent.
                      "pointer-events-none border border-border bg-card text-text opacity-[0.18]"
                    : bad
                      ? "kq-pairs-miss border border-danger bg-danger-bg text-danger"
                      : picked
                        ? "border-2 border-accent bg-accent-bg text-accent"
                        : "border border-border bg-card text-text hover:bg-panel",
                ].join(" ")}
              >
                {cell.label}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
