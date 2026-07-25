"use client";

// ASSEMBLY screen (task 11) — "Build the sentence". Shown an English sentence
// and its Japanese pieces scrambled, the learner orders the pieces. Graded on
// the ONE canonical order (src/data/assembly.ts). Particles ride inside each
// piece, so the question is word ORDER, never particle choice, and the grade is
// unambiguous — the property the ingest filter guarantees.
//
// DRAG, with a real KEYBOARD FALLBACK (Sam's ruling, and the accessibility bar):
//   - Pointer: HTML5 drag. Drag a pool piece into the tray to place it; drag a
//     placed piece onto another to reorder; drag a placed piece back to the pool
//     to remove it.
//   - Keyboard: every piece is a button. In the POOL, Enter/Space places it at
//     the end of the tray. In the TRAY, ArrowLeft/ArrowRight move it one step,
//     and Backspace/Delete returns it to the pool. So a keyboard-only learner can
//     build and reorder any sentence without a pointer.
//
// No drag library (the repo has none and CSP/bundle rules discourage one). No
// motion beyond the state tint, so prefers-reduced-motion has nothing to fight.
//
// State lives in active.runtime.assembly, mutated in place and flushed with
// saveNow() — the grid-screen discipline. Copy is the approved mockup's
// ("Build the sentence", "Drag the pieces in order", meanings behind Hint,
// green-only grading). New copy is DRAFT and flagged.

import { useEffect, useRef, useState } from "react";

import { Btn, GhostBtn } from "@/components/ui";
import { newFactStat, retriesAllowed, shuffle } from "@/lib/engine";
import {
  assemblyFacts,
  canonicalOrder,
  gradeAssembly,
  pickAssembly,
  pieceHint,
  sentenceOrderingTierForItem,
  type AssemblyItem,
} from "@/data/assembly";
import {
  SENTENCE_ORDERING_GUIDES,
  type SentenceOrderingTierId,
} from "@/data/sentence-ordering-guides";
import { useHistory } from "@/lib/use-history";
import { useQuizConfig } from "@/lib/quiz-config";
import { useQuizSession, type ActiveQuiz } from "@/lib/quiz-session";
import type { HistoryFile, SessionStats } from "@/types";
import { DrillHalo, type HaloState } from "@/components/quiz/drill-halo";

const TARGET = 12;

interface AsmCard {
  item: AssemblyItem;
  /** Surfaces still in the pool (unplaced). */
  pool: string[];
  /** Surfaces placed in the tray, in the learner's current order. */
  tray: string[];
  state: "open" | "right" | "wrong";
  tries: number;
}

interface AsmRuntime {
  cards: AsmCard[];
  pos: number;
  streak: number;
  stats: SessionStats;
}

interface CoachHint {
  id: string;
  text: string;
}

/**
 * A lightweight teaching layer for sentence ordering.
 *
 * It uses only existing assembly data plus attempt count. First pass teaches
 * strategy; later passes add stronger anchors when the learner is stuck.
 */
function coachHints(item: AssemblyItem, canon: readonly string[], tries: number): CoachHint[] {
  const out: CoachHint[] = [
    {
      id: "keep-chunks",
      text: "Think in chunks, not individual words; each chip already includes its particle.",
    },
    {
      id: "anchor-end",
      text: "A good first move is to lock in the ending chunk.",
    },
    {
      id: "before-end",
      text: "Then place topic/time/place chunks before it and adjust the middle.",
    },
  ];

  if (tries > 0) {
    out.push({
      id: "final-anchor",
      text: `Try this anchor first: \u300c${canon[canon.length - 1] ?? ""}\u300d.`,
    });
  }
  if (tries > 1 && canon.length > 2) {
    out.push({
      id: "start-anchor",
      text: `Still stuck? Start from: \u300c${canon[0] ?? ""}\u300d.`,
    });
  }
  if (item.p.length > 0) {
    out.push({
      id: "pattern-clue",
      text: "Pattern chunks and their host words usually stay tightly grouped in the frame.",
    });
  }
  return out;
}

function buildRuntime(history: HistoryFile): AsmRuntime {
  const cards: AsmCard[] = [];
  const stats: SessionStats = {};
  const seenIds = new Set<number>();
  for (let i = 0; i < TARGET * 4 && cards.length < TARGET; i++) {
    const item = pickAssembly(history);
    if (!item) break;
    if (seenIds.has(item.id)) continue; // no repeats within one run
    seenIds.add(item.id);
    cards.push({
      item,
      pool: shuffle(item.pieces.map((p) => p.t)),
      tray: [],
      state: "open",
      tries: 0,
    });
    for (const f of assemblyFacts(item)) {
      if (!stats[f]) stats[f] = newFactStat();
      stats[f].seen++;
    }
  }
  return { cards, pos: 0, streak: 0, stats };
}

function ensureRuntime(active: ActiveQuiz, history: HistoryFile): AsmRuntime {
  const rt = active.runtime as { assembly?: AsmRuntime };
  return (rt.assembly ??= buildRuntime(history));
}

// ---------- mutations (module-level, runtime passed in) ----------
//
// These take the runtime as a parameter rather than closing over it, the same
// shape grid-screen's checkCard uses. The screen's `rt` is an effect dependency,
// and the immutability lint refuses in-place mutation of a value captured that
// way in the component body — but not one handed across a call boundary.

function placePiece(card: AsmCard, surface: string): void {
  if (card.state !== "open" || !card.pool.includes(surface)) return;
  card.pool = card.pool.filter((s) => s !== surface);
  card.tray.push(surface);
}

function unplacePiece(card: AsmCard, surface: string): void {
  if (card.state !== "open" || !card.tray.includes(surface)) return;
  card.tray = card.tray.filter((s) => s !== surface);
  card.pool.push(surface);
}

function movePiece(card: AsmCard, surface: string, dir: -1 | 1): void {
  if (card.state !== "open") return;
  const i = card.tray.indexOf(surface);
  const j = i + dir;
  if (i < 0 || j < 0 || j >= card.tray.length) return;
  [card.tray[i], card.tray[j]] = [card.tray[j], card.tray[i]];
}

function dropPiece(card: AsmCard, surface: string, index: number | null): void {
  if (card.state !== "open") return;
  card.pool = card.pool.filter((s) => s !== surface);
  card.tray = card.tray.filter((s) => s !== surface);
  const at = index === null ? card.tray.length : index;
  card.tray.splice(at, 0, surface);
}

/** Grade the current tray. Returns "right", "retry" (wrong, still open), or
 * "locked" (wrong, out of retries — the canonical order is revealed). */
function checkCard(rt: AsmRuntime, card: AsmCard, retries: number): "right" | "retry" | "locked" {
  const canon = canonicalOrder(card.item);
  const ok = gradeAssembly(card.item, card.tray);
  const facts = assemblyFacts(card.item);
  for (const f of facts) {
    const st = rt.stats[f];
    if (st.firstTryCorrect === null) {
      st.firstTryCorrect = ok;
      if (ok) st.firstTryCount = (st.firstTryCount ?? 0) + 1;
    }
  }
  if (ok) {
    if (card.tries === 0) rt.streak++;
    for (const f of facts) {
      rt.stats[f].everCorrect = true;
      rt.stats[f].correct++;
    }
    card.state = "right";
    return "right";
  }
  rt.streak = 0;
  card.tries++;
  for (const f of facts) rt.stats[f].misses++;
  if (card.tries > retries) {
    card.tray = canon.slice();
    card.pool = [];
    card.state = "wrong";
    return "locked";
  }
  return "retry";
}

function advance(rt: AsmRuntime): void {
  rt.pos++;
}

export function AssemblyScreen() {
  const { cfg } = useQuizConfig();
  const { history, loaded } = useHistory();
  const { active, finishQuiz, setProgress, saveNow } = useQuizSession();
  const [, bump] = useState(0);
  const rerender = () => bump((n) => n + 1);
  const [hintOpen, setHintOpen] = useState(false);
  const [shake, setShake] = useState(false);
  const dragging = useRef<{ from: "pool" | "tray"; surface: string } | null>(null);

  const rt = active && loaded ? ensureRuntime(active, history) : null;

  const done = rt ? rt.cards.filter((c) => c.state !== "open").length : 0;
  const total = rt?.cards.length ?? 0;
  useEffect(() => {
    if (rt) setProgress({ done, total });
  }, [rt, done, total, setProgress]);

  if (!active) return null;
  if (!rt) return null;
  if (rt.cards.length === 0) {
    // DRAFT copy.
    return (
      <div className="mx-auto mt-16 max-w-md text-center text-text-muted">
        Learn a few more words first. Sentence building will unlock once you know
        every word in a sentence.
      </div>
    );
  }

  const card = rt.cards[rt.pos];
  const item = card.item;
  const resolved = card.state !== "open";
  const canon = canonicalOrder(item);
  const coach = coachHints(item, canon, card.tries);
  const tierId = sentenceOrderingTierForItem(item) as SentenceOrderingTierId;
  const thinkHint =
    SENTENCE_ORDERING_GUIDES[tierId]?.hook ??
    SENTENCE_ORDERING_GUIDES.simple.hook;
  const haloState: HaloState =
    card.state === "right"
      ? "right"
      : card.state === "wrong"
        ? "wrong"
        : shake
          ? "wrong-flash"
          : "resting";
  const hintBySurface = new Map(item.pieces.map((p) => [p.t, pieceHint(p)]));

  const place = (surface: string) => {
    if (resolved) return;
    placePiece(card, surface);
    saveNow();
    rerender();
  };

  const unplace = (surface: string) => {
    if (resolved) return;
    unplacePiece(card, surface);
    saveNow();
    rerender();
  };

  const moveInTray = (surface: string, dir: -1 | 1) => {
    if (resolved) return;
    movePiece(card, surface, dir);
    saveNow();
    rerender();
  };

  /** Drop `surface` into the tray at `index` (or end when index is null). */
  const dropInTray = (surface: string, index: number | null) => {
    if (resolved) return;
    dropPiece(card, surface, index);
    saveNow();
    rerender();
  };

  const check = () => {
    if (resolved || card.tray.length !== canon.length) return;
    const out = checkCard(rt, card, retriesAllowed(cfg));
    saveNow();
    if (out !== "right") {
      setShake(true);
      window.setTimeout(() => setShake(false), 460);
    }
    rerender();
  };

  const next = () => {
    setHintOpen(false);
    if (rt.pos + 1 >= rt.cards.length) {
      finishQuiz(rt.stats);
      return;
    }
    advance(rt);
    saveNow();
    rerender();
  };

  const trayFilled = card.tray.length === canon.length;

  return (
    <div className="mx-auto mt-6 max-w-xl">
      <div className="mb-6 flex items-center justify-between text-sm text-text-muted">
        <span className="rounded-full border border-border bg-accent-bg px-3 py-1 text-[13px] font-medium text-accent tabular-nums">
          {rt.pos + 1} / {rt.cards.length}
        </span>
        <span className="tabular-nums" aria-hidden>
          {rt.streak > 0 ? `\u{1F525} ${rt.streak}` : ""}
        </span>
      </div>

      <div className="flex flex-col items-center">
        <DrillHalo
          key={`${item.id}-${card.tries}`}
          state={haloState}
          cardKey={`${item.id}-${card.tries}`}
          timerLeft={0}
          drainWindow={0}
          glyph=""
          font="inherit"
          fontSize={30}
          crossFade={card.tries === 0}
          sentenceFrame={item.en}
          sentenceFrameLang="en"
        />
        <div className="mt-5 text-xs font-semibold uppercase tracking-wide text-text-muted">
          Build the sentence
        </div>

        {/* The tray: the answer, in order. A drop target. */}
        <ul
          className={`mt-4 flex min-h-17 w-full flex-wrap items-center justify-center gap-2 rounded-xl border p-3 ${
            card.state === "right"
              ? "border-success bg-success-bg"
              : trayFilled
                ? "border-accent bg-accent-bg"
                : "border-dashed border-border bg-panel"
          } ${shake ? "animate-gshake" : ""}`}
          aria-label="Sentence being built"
          onDragOver={(e) => {
            if (dragging.current) e.preventDefault();
          }}
          onDrop={(e) => {
            e.preventDefault();
            const d = dragging.current;
            if (d) dropInTray(d.surface, null);
            dragging.current = null;
          }}
        >
          {card.tray.length === 0 ? (
            <li className="text-sm text-text-muted">Drag the pieces in order</li>
          ) : (
            card.tray.map((surface, idx) => (
              <li key={surface}>
                <button
                  type="button"
                  lang="ja"
                  draggable={!resolved}
                  disabled={resolved}
                  aria-label={`Piece ${surface}, position ${idx + 1} of ${card.tray.length}. Arrow keys to move, Backspace to remove.`}
                  className={`kq-material rounded-xl border px-4 py-3 text-lg ${
                    card.state === "right"
                      ? "border-success bg-success-bg"
                      : "border-border bg-card"
                  } ${resolved ? "" : "cursor-grab"}`}
                  onDragStart={() => {
                    dragging.current = { from: "tray", surface };
                  }}
                  onDragOver={(e) => {
                    if (dragging.current) e.preventDefault();
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    const d = dragging.current;
                    if (d) dropInTray(d.surface, idx);
                    dragging.current = null;
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "ArrowLeft") {
                      e.preventDefault();
                      moveInTray(surface, -1);
                    } else if (e.key === "ArrowRight") {
                      e.preventDefault();
                      moveInTray(surface, 1);
                    } else if (e.key === "Backspace" || e.key === "Delete") {
                      e.preventDefault();
                      unplace(surface);
                    }
                  }}
                >
                  {surface}
                </button>
              </li>
            ))
          )}
        </ul>

        {/* The pool: pieces not yet placed. */}
        {card.pool.length > 0 ? (
          <ul
            className="mt-5 flex flex-wrap items-center justify-center gap-2"
            aria-label="Pieces to place"
            onDragOver={(e) => {
              if (dragging.current?.from === "tray") e.preventDefault();
            }}
            onDrop={(e) => {
              e.preventDefault();
              const d = dragging.current;
              if (d?.from === "tray") unplace(d.surface);
              dragging.current = null;
            }}
          >
            {card.pool.map((surface) => (
              <li key={surface}>
                <button
                  type="button"
                  lang="ja"
                  draggable={!resolved}
                  disabled={resolved}
                  aria-label={`Piece ${surface}. Press Enter to place it, or drag it into the sentence.`}
                  className="kq-material cursor-grab rounded-xl border border-border bg-card px-4 py-3 text-lg shadow-chip"
                  onClick={() => place(surface)}
                  onDragStart={() => {
                    dragging.current = { from: "pool", surface };
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      place(surface);
                    }
                  }}
                >
                  {surface}
                </button>
              </li>
            ))}
          </ul>
        ) : null}

        {resolved ? (
          <div lang="ja" className="mt-4 text-center text-base">
            {item.jp}
          </div>
        ) : null}

        {hintOpen ? (
          <div className="mt-4 w-full space-y-3">
            <div className="rounded-xl border border-border bg-panel p-3 text-sm">
              <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-accent">
                {SENTENCE_ORDERING_GUIDES[tierId]?.eyebrow ?? "Sentence ordering"}
              </div>
              <p className="text-text">{thinkHint}</p>
              {card.tries > 0 ? (
                <ul className="mt-2 space-y-1 text-[12px] text-text-muted">
                  {coach.slice(3).map((hint) => (
                    <li key={hint.id}>- {hint.text}</li>
                  ))}
                </ul>
              ) : null}
            </div>

            <div className="rounded-xl border border-border bg-accent-bg p-3 text-sm">
              <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-accent">
                Word meanings
              </div>
              <div className="flex flex-wrap gap-x-4 gap-y-1">
                {item.pieces
                  .filter((p) => hintBySurface.get(p.t))
                  .map((p) => (
                    <span key={p.t}>
                      <span lang="ja" className="font-medium">
                        {p.t}
                      </span>{" "}
                      <span className="text-text-muted">{hintBySurface.get(p.t)}</span>
                    </span>
                  ))}
              </div>
            </div>
          </div>
        ) : null}

        <div className="mt-6 flex items-center justify-end gap-3">
          {resolved ? (
            <Btn go onClick={next}>
              Next
            </Btn>
          ) : (
            <>
              <GhostBtn onClick={() => setHintOpen((h) => !h)}>
                {hintOpen ? "Hide hint" : "Hint"}
              </GhostBtn>
              <Btn go disabled={!trayFilled} onClick={check}>
                Check
              </Btn>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
