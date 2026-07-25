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
  type AssemblyItem,
} from "@/data/assembly";
import { useHistory } from "@/lib/use-history";
import { useQuizConfig } from "@/lib/quiz-config";
import { useQuizSession, type ActiveQuiz } from "@/lib/quiz-session";
import type { HistoryFile, SessionStats } from "@/types";

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

interface OrderGuideStep {
  id: string;
  text: string;
}

function roleOfChunk(surface: string): "topic" | "subject" | "object" | "setting" | "ending" | "other" {
  if (/(は)$/.test(surface)) return "topic";
  if (/(が)$/.test(surface)) return "subject";
  if (/(を)$/.test(surface)) return "object";
  if (/(に|で|へ|から|まで|より)$/.test(surface)) return "setting";
  if (/(です|だ|だった|ます|ました|ません|たい|ない|なかった|んだ|んです|そうだ|そうだった|か)$/.test(surface)) {
    return "ending";
  }
  return "other";
}

function orderingGuide(canon: readonly string[]): OrderGuideStep[] {
  if (canon.length === 0) return [];
  const out: OrderGuideStep[] = [];
  const end = canon[canon.length - 1] ?? "";
  out.push({
    id: "anchor-end",
    text: `Anchor the ending first: Japanese main action/statement usually closes the sentence, so start with 「${end}」 as your right edge.`,
  });

  const topic = canon.find((c) => roleOfChunk(c) === "topic");
  if (topic) {
    out.push({
      id: "topic-early",
      text: `Topic chunks often come early. Here, 「${topic}」 is a strong early candidate.`,
    });
  }

  const mids = canon.filter((c) => {
    const role = roleOfChunk(c);
    return role === "subject" || role === "object" || role === "setting";
  });
  if (mids.length) {
    out.push({
      id: "middle-band",
      text: `Then place role chunks in the middle (${mids.join(" / ")}) before the ending chunk.`,
    });
  }

  out.push({
    id: "not-english",
    text: "Japanese is usually Subject-Object-Verb (or Topic-...-Verb), so do not force English word order.",
  });
  return out;
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
  const [teachOpen, setTeachOpen] = useState(true);
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
  const guide = orderingGuide(canon);
  const nextTarget = canon[card.tray.length] ?? null;
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

      <div
        className={`kq-material rounded-2xl border bg-card p-8 shadow-card ${
          card.state === "right" ? "border-success" : "border-border"
        }`}
      >
        <div className="text-center">
          <div className="text-xs font-semibold uppercase tracking-wide text-text-muted">
            Build the sentence
          </div>
          <div className="mt-2 text-xl">{item.en}</div>
        </div>

        <div className="mt-4 rounded-xl border border-border bg-panel p-3 text-sm">
          <div className="flex items-center justify-between gap-2">
            <div className="text-[11px] font-semibold uppercase tracking-wide text-accent">
              How Japanese order works
            </div>
            <GhostBtn onClick={() => setTeachOpen((v) => !v)}>
              {teachOpen ? "Hide" : "Show"}
            </GhostBtn>
          </div>
          {teachOpen ? (
            <div className="mt-2 space-y-2 text-text-muted">
              <p>
                Not always nouns first. Japanese usually puts the action/statement near the end,
                and particles on chunks show each chunk&apos;s job.
              </p>
              <p>
                English: &quot;Sam goes&quot;. Japanese often feels like &quot;Sam ... goes&quot; with role chunks
                before the ending chunk.
              </p>
              <ul className="space-y-1">
                {guide.map((step) => (
                  <li key={step.id}>- {step.text}</li>
                ))}
              </ul>
              {!resolved && nextTarget ? (
                <p className="text-[12px]">
                  Next coaching move: place <span lang="ja" className="font-medium">{nextTarget}</span>.
                </p>
              ) : null}
            </div>
          ) : null}
        </div>

        {/* The tray: the answer, in order. A drop target. */}
        <ul
          className={`mt-6 flex min-h-17 flex-wrap items-center justify-center gap-2 rounded-xl border p-3 ${
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
          <div className="mt-4 space-y-3">
            <div className="rounded-xl border border-border bg-panel p-3 text-sm">
              <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-text-muted">
                Sentence ordering
              </div>
              <ul className="space-y-1 text-text-muted">
                {coach.map((h) => (
                  <li key={h.id}>- {h.text}</li>
                ))}
              </ul>
              {card.tries > 0 ? (
                <p className="mt-2 text-[12px] text-text-muted">
                  You have {card.tries} miss{card.tries === 1 ? "" : "es"} on this card,
                  so stronger anchors are now shown.
                </p>
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
