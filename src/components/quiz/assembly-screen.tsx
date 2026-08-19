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

import { Btn, SmallBtn } from "@/components/ui";
import { newFactStat, retriesAllowed, shuffle } from "@/lib/engine";
import {
  assemblyFacts,
  ASSEMBLY_QUIZ_TARGET,
  canonicalOrder,
  pickAssemblyForTiers,
  SENTENCE_ORDERING_TIERS,
  sentenceOrderingTierForItem,
  type AssemblyItem,
} from "@/data/assembly";
import {
  SENTENCE_ORDERING_GUIDES,
  type SentenceOrderingTierId,
} from "@/data/sentence-ordering-guides";
import {
  TIER_EXAMPLES,
  type TierExample,
} from "@/components/session/sentence-ordering-teach-walk";
import { useHistory } from "@/lib/use-history";
import { useQuizConfig } from "@/lib/quiz-config";
import { useQuizSession, type ActiveQuiz } from "@/lib/quiz-session";
import {
  sentenceTierMarkerFact,
} from "@/lib/sentence-ordering-progress";
import { learnedSentenceTierIds } from "@/lib/sentence-ordering-learned";
import type { HistoryFile, SessionStats } from "@/types";
import { DrillHalo, type HaloState } from "@/components/quiz/drill-halo";
import { sentenceOrderingLessonTier } from "@/components/quiz/sentence-ordering-lesson-source";
import {
  checkCard,
  type AsmCard,
  type AsmRuntime,
} from "@/components/quiz/assembly-check";

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

function quizTierIds(active: ActiveQuiz, history: HistoryFile): string[] {
  const explicit = SENTENCE_ORDERING_TIERS.filter((tier) =>
    active.facts.includes(sentenceTierMarkerFact(tier.id)),
  ).map((tier) => tier.id);
  if (explicit.length > 0) return explicit;

  return learnedSentenceTierIds(history);
}

const LESSON_PARTS: Readonly<
  Record<SentenceOrderingTierId, readonly (keyof TierExample)[]>
> = {
  request: ["context", "target", "action", "ending"],
  conditional: ["condition", "resultTopic", "core", "ending"],
  simple: ["topic", "core", "ending"],
  causal: ["core", "topic", "ending"],
  obligation: ["topic", "core", "ending"],
  sequential: ["core", "topic", "ending"],
  desire: ["topic", "core", "ending"],
  giving: ["topic", "core", "ending"],
  reported: ["topic", "core", "ending"],
  contrast: ["core", "topic", "ending"],
};

function lessonPattern(tierId: SentenceOrderingTierId, jp: string): string {
  const tier = SENTENCE_ORDERING_TIERS.find((candidate) => candidate.id === tierId)!;
  const visible = tier.patterns.find((pattern) => {
    const surface: Readonly<Record<string, string>> = {
      "te-request": "ください",
      "nai-request": "ないで",
      mashou: "ましょう",
      tara: "たら",
      ba: "れば",
      nara: "なら",
      "kara-reason": "から",
      node: "ので",
      "te-iru": "ている",
      "te-shimau": "てしま",
      "te-miru": "てみ",
      tai: "たい",
      yasui: "やすい",
      nikui: "にくい",
      "te-ageru": "あげ",
      "te-kureru": "くれ",
      "te-morau": "もら",
      "to-omou": "と思う",
      rashii: "らしい",
      kamoshirenai: "かもしれない",
      noni: "のに",
      "nai-de": "ないで",
      "nakereba-naranai": "なければならない",
      "nakereba-ikenai": "なければいけない",
    };
    return surface[pattern] ? jp.includes(surface[pattern]) : false;
  });
  return visible ?? tier.patterns[0];
}

function lessonPieces(
  tierId: SentenceOrderingTierId,
  example: TierExample,
): AssemblyItem["pieces"] {
  const starts = LESSON_PARTS[tierId]
    .map((key) => {
      const text = example[key];
      if (!text || typeof text === "string" || !("jp" in text) || !text.jp) return null;
      const start = example.jp.indexOf(text.jp);
      return start < 0 ? null : { start, text: text.jp };
    })
    .filter((part): part is { start: number; text: string } => part !== null)
    .sort((a, b) => a.start - b.start);
  return starts.map((part, index) => ({
    t: example.jp.slice(
      part.start,
      starts[index + 1]?.start ?? example.jp.length,
    ),
    h: null,
  }));
}

function lessonItems(tierId: SentenceOrderingTierId): AssemblyItem[] {
  const tierIndex = SENTENCE_ORDERING_TIERS.findIndex(
    (tier) => tier.id === tierId,
  );
  return TIER_EXAMPLES[tierId].map((example, index) => ({
    id: -10_000 - tierIndex * 10 - index,
    en: example.en,
    jp: example.jp,
    pieces: lessonPieces(tierId, example),
    v: [],
    p: [lessonPattern(tierId, example.jp)],
  }));
}

function buildRuntime(
  active: ActiveQuiz,
  history: HistoryFile,
  sessionWhat: string | undefined,
): AsmRuntime {
  const cards: AsmCard[] = [];
  const stats: SessionStats = {};
  const seenIds = new Set<number>();
  const lessonTier = sentenceOrderingLessonTier(sessionWhat);
  const exactLessonCards = lessonTier ? lessonItems(lessonTier) : null;
  if (exactLessonCards) {
    for (const item of exactLessonCards) {
      cards.push({
        item,
        pool: shuffle(item.pieces.map((piece) => piece.t)),
        tray: [],
        state: "open",
        tries: 0,
      });
      for (const fact of assemblyFacts(item)) {
        if (!stats[fact]) stats[fact] = newFactStat();
        stats[fact].seen++;
      }
    }
    return {
      cards,
      pos: 0,
      streak: 0,
      stats,
      source: "lesson-examples",
    };
  }
  const tierIds = quizTierIds(active, history);
  for (
    let i = 0;
    i < ASSEMBLY_QUIZ_TARGET * 4 && cards.length < ASSEMBLY_QUIZ_TARGET;
    i++
  ) {
    const item = pickAssemblyForTiers(history, tierIds);
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
  return {
    cards,
    pos: 0,
    streak: 0,
    stats,
    source: "practice-corpus",
  };
}

function ensureRuntime(
  active: ActiveQuiz,
  history: HistoryFile,
  sessionWhat: string | undefined,
): AsmRuntime {
  const rt = active.runtime as { assembly?: AsmRuntime };
  const expectedSource = sentenceOrderingLessonTier(sessionWhat)
    ? "lesson-examples"
    : "practice-corpus";
  // Replace queues saved by the older corpus-backed lesson implementation.
  // Without this, an already-open lesson can keep showing seven unrelated
  // generated cards even after lesson launches have been corrected. Also
  // covers SAK-75: a retry leg reuses this same runtime slot, so a stale
  // practice-corpus queue from before the source rule was fixed gets rebuilt
  // too, rather than sticking around empty.
  if (rt.assembly?.source !== expectedSource) {
    rt.assembly = buildRuntime(active, history, sessionWhat);
  }
  return (rt.assembly ??= buildRuntime(active, history, sessionWhat));
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

function advance(rt: AsmRuntime): void {
  rt.pos++;
}

function skipCard(rt: AsmRuntime, card: AsmCard): void {
  const index = rt.cards.indexOf(card);
  if (index < 0) return;
  const [skipped] = rt.cards.splice(index, 1);
  skipped.pool = shuffle(skipped.item.pieces.map((piece) => piece.t));
  skipped.tray = [];
  skipped.state = "open";
  skipped.tries = 0;
  rt.cards.push(skipped);
}

export function AssemblyScreen() {
  const { cfg } = useQuizConfig();
  const { history, loaded } = useHistory();
  const {
    active,
    session,
    finishQuiz,
    setProgress,
    saveNow,
    reviewLesson,
  } = useQuizSession();
  const [, bump] = useState(0);
  const rerender = () => bump((n) => n + 1);
  const [hintOpen, setHintOpen] = useState(false);
  const [shake, setShake] = useState(false);
  const dragging = useRef<{ from: "pool" | "tray"; surface: string } | null>(null);

  const rt =
    active && loaded ? ensureRuntime(active, history, session?.what) : null;

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
        Learn a sentence type and enough of its words first. Practice only uses
        sentence types you have learned.
      </div>
    );
  }

  const card = rt.cards[rt.pos];
  const item = card.item;
  const resolved = card.state !== "open";
  const canon = canonicalOrder(item);
  const coach = coachHints(item, canon, card.tries);
  const tierId = sentenceOrderingTierForItem(
    item,
  ) as SentenceOrderingTierId | null;
  const thinkHint =
    (tierId ? SENTENCE_ORDERING_GUIDES[tierId]?.hook : undefined) ??
    "Think about what each chunk does, then place the final predicate.";
  const haloState: HaloState =
    card.state === "right"
      ? "right"
      : card.state === "wrong"
        ? "wrong"
        : shake
          ? "wrong-flash"
          : "resting";

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
  const allowed = retriesAllowed(cfg);
  const retriesLeft = Math.max(0, allowed - card.tries);
  const unlimited = cfg.retries === "unl";
  const showPips = cfg.showRetryPips && (unlimited || allowed > 0);

  const skip = () => {
    if (resolved) return;
    skipCard(rt, card);
    setHintOpen(false);
    saveNow();
    rerender();
  };
  const endQuiz = () => finishQuiz(rt.stats);
  const hasLesson = !!session && session.teach.length > 0;
  const pct = total > 0 ? Math.round((100 * done) / total) : 0;

  return (
    <div>
      <div className="kq-band sticky top-0 z-10 border-b border-border px-3 py-1.5">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <span className="flex flex-wrap items-center gap-1.5">
            <span className="kq-material rounded-full border border-accent/40 bg-accent-bg px-3 py-1 text-[13px] font-semibold tabular-nums text-accent">
              {done} / {total}
            </span>
            {rt.streak >= 2 ? (
              <span className="kq-material rounded-full border border-border px-2.5 py-0.5 text-[11px] tabular-nums text-text-muted">
                🔥 {rt.streak}
              </span>
            ) : null}
          </span>
          <span className="flex items-center gap-1.5">
            {hasLesson ? (
              <SmallBtn onClick={reviewLesson}>Look again</SmallBtn>
            ) : null}
            <SmallBtn onClick={endQuiz}>End quiz</SmallBtn>
          </span>
        </div>
        <div className="h-(--bar-h) overflow-hidden rounded-full bg-panel">
          <div
            className="h-full rounded-full bg-accent transition-[width] duration-200"
            style={{
              width: `${pct}%`,
              boxShadow:
                "0 0 8px color-mix(in srgb, var(--accent) 55%, transparent)",
            }}
          />
        </div>
      </div>

      <div className="mx-auto mt-6 flex max-w-xl flex-col items-center">
        <DrillHalo
          key={`${item.id}-${card.tries}`}
          cardKey={`${item.id}-${card.tries}`}
          state={haloState}
          timerLeft={0}
          drainWindow={0}
          glyph=""
          font="inherit"
          fontSize={30}
          crossFade={card.tries === 0}
          sentenceFrame={item.en}
          sentenceFrameLang="en"
          compactSentenceFrame
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
              <li key={surface} className="group relative">
                <button
                  type="button"
                  lang="ja"
                  draggable={!resolved}
                  disabled={resolved}
                  aria-label={`Piece ${surface}, position ${idx + 1} of ${card.tray.length}. Arrow keys to move, Backspace to remove.`}
                  className={`kq-material rounded-xl border px-4 py-3 pr-8 text-lg ${
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
                {!resolved ? (
                  <button
                    type="button"
                    aria-label={`Return ${surface} to the available pieces`}
                    title="Return to available pieces"
                    className="absolute right-1.5 top-1.5 flex size-5 cursor-pointer items-center justify-center rounded-full text-[13px] leading-none text-text-muted hover:bg-panel hover:text-text"
                    onClick={(event) => {
                      event.stopPropagation();
                      unplace(surface);
                    }}
                  >
                    ×
                  </button>
                ) : null}
              </li>
            ))
          )}
        </ul>

        {/* Keep the pool's row reserved after its final piece is placed. Without
            this minimum height, the controls jump upward at the exact moment
            the learner finishes assembling the sentence. */}
        <ul
          className="mt-5 flex min-h-[62px] flex-wrap items-center justify-center gap-2"
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

        {resolved ? (
          <div lang="ja" className="mt-4 text-center text-base">
            {item.jp}
          </div>
        ) : null}

        <div className="mt-6 flex w-full flex-col items-center gap-4">
          {resolved ? (
            <Btn go onClick={next}>
              Next
            </Btn>
          ) : (
            <div className="flex items-center justify-center gap-3">
              <Btn
                go
                className="w-20"
                disabled={!trayFilled}
                onClick={check}
              >
                Check
              </Btn>
              <Btn
                className="w-20"
                onClick={skip}
                title="Skip — ask this again later"
              >
                Skip
              </Btn>
              <Btn
                className="w-20"
                onClick={() => setHintOpen((open) => !open)}
                title="Hint (?)"
              >
                {hintOpen ? "Hide" : "Hint"}
              </Btn>
            </div>
          )}
          <span className="flex min-h-2 items-center gap-1.5">
            {!resolved && showPips ? (
              <>
                {unlimited ? (
                  <span className="text-sm leading-none text-accent">∞</span>
                ) : (
                  Array.from({ length: allowed }, (_, index) => (
                    <span
                      key={index}
                      className={`block size-1.5 rounded-full ${
                        index < retriesLeft ? "bg-accent" : "bg-border"
                      }`}
                    />
                  ))
                )}
                <span className="ml-1 text-[9px] uppercase tracking-[0.08em] text-text-muted/70">
                  retries
                </span>
              </>
            ) : null}
          </span>

          {hintOpen && !resolved ? (
            <div className="w-full space-y-3">
              <div className="rounded-xl border border-border bg-panel p-3 text-sm">
                <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-accent">
                  {(tierId
                    ? SENTENCE_ORDERING_GUIDES[tierId]?.eyebrow
                    : undefined) ?? "Sentence ordering"}
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
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
