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
//     to remove it. The dragged piece gets a custom, app-styled drag image (via
//     setDragImage) instead of the browser's default translucent snapshot, and
//     the tray reflows live under the pointer to preview where the piece would
//     land, both committed only on drop (SAK-90).
//   - Keyboard: every piece is a button. In the POOL, Enter/Space places it at
//     the end of the tray. In the TRAY, ArrowLeft/ArrowRight move it one step,
//     and Backspace/Delete returns it to the pool. So a keyboard-only learner can
//     build and reorder any sentence without a pointer. Unaffected by the drag
//     changes above; this path never touches dragOverIndex or setDragImage.
//
// No drag library (the repo has none and CSP/bundle rules discourage one). The
// drag image is native (OS-rendered, so it can't fight prefers-reduced-motion),
// and the live tray reflow is a CSS transform transition gated behind
// motion-safe: so it collapses to an instant snap when reduced motion is on.
//
// State lives in active.runtime.assembly, mutated in place and flushed with
// saveNow() — the grid-screen discipline. Copy is the approved mockup's
// ("Build the sentence", "Drag the pieces in order", meanings behind Hint,
// green-only grading). New copy is DRAFT and flagged.

import {
  useEffect,
  useRef,
  useState,
  type DragEvent,
  type MutableRefObject,
} from "react";

import { Btn, Info, SmallBtn } from "@/components/ui";
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
  SENTENCE_ORDERING_CHUNK_ROLES,
  SENTENCE_ORDERING_GUIDES,
  type SentenceOrderingTierId,
} from "@/data/sentence-ordering-guides";
import {
  TIER_EXAMPLES,
  type TierExample,
} from "@/components/session/sentence-ordering-teach-walk";
import {
  assemblyMismatchMessage,
  findAssemblyMismatch,
  pieceGloss,
  pieceLabel,
  type AssemblyMismatch,
} from "@/lib/assembly-check";
import { assemblyRoleSpans } from "@/lib/sentence-part-spans";
import {
  colorizeSentence,
  SentencePartBoxes,
} from "@/components/quiz/sentence-part-breakdown";
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
import {
  computeDragOverIndex,
  DRAG_OVER_UNCHANGED,
  previewTrayOrder,
} from "@/components/quiz/assembly-drag";
import { DrillDrawer } from "./drill-drawer";

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

// The ordered chunk roles per tier — shared with the teach walkthrough and
// with the wrong-check mismatch labeling (src/lib/assembly-check.ts), so a
// lesson card's pieces and its "which chunk is misplaced" feedback name
// chunks the same way. `keyof TierExample` is a superset of ChunkRoleKey
// (TierExample also carries en/enOrdered/jp), so the cast is safe here.
const LESSON_PARTS = SENTENCE_ORDERING_CHUNK_ROLES as Readonly<
  Record<SentenceOrderingTierId, readonly (keyof TierExample)[]>
>;

function lessonPattern(tierId: SentenceOrderingTierId, jp: string): string {
  const tier = SENTENCE_ORDERING_TIERS.find((candidate) => candidate.id === tierId)!;
  const visible = tier.patterns.find((pattern) => {
    const surface: Readonly<Record<string, string>> = {
      wo: "を",
      ni: "に",
      de: "で",
      e: "へ",
      made: "まで",
      "made-ni": "までに",
      dake: "だけ",
      "kara-source": "から",
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

// ---------- pointer-drag preview (SAK-90) ----------
//
// The pure drop-target math (previewTrayOrder, computeDragOverIndex, and the
// trayWithoutDragged helper they share) lives in assembly-drag.ts, imported
// above -- pulled
// out so it can be unit-tested with plain node:test (this file's JSX can't
// be parsed by the test runner's loader) and so the tray <ul>'s and each
// piece <button>'s onDragOver can't disagree about what "empty space" versus
// "over a piece" means (see assembly-drag.ts's computeDragOverIndex doc
// comment for the SAK-90 round-2 bug that shared logic fixes). Everything
// below is display-only: it never touches card.tray, only what's rendered
// while a drag is in flight. The actual reorder still lands through
// dropInTray -> dropPiece above, same as before this ticket.

/** A custom, app-styled drag image (SAK-90 ask #1) so the piece dragging
 * around under the pointer looks like the app, not the browser's default
 * translucent element snapshot. The clone is parked off-screen just long
 * enough for setDragImage to snapshot it, then discarded; it never actually
 * appears in the document's visible flow. */
function makeDragImage(source: HTMLElement): HTMLElement {
  const clone = source.cloneNode(true) as HTMLElement;
  clone.style.position = "fixed";
  clone.style.top = "-1000px";
  clone.style.left = "-1000px";
  clone.style.margin = "0";
  clone.style.width = `${source.offsetWidth}px`;
  clone.style.pointerEvents = "none";
  document.body.appendChild(clone);
  return clone;
}

function startDrag(
  e: DragEvent<HTMLButtonElement>,
  dragging: MutableRefObject<{ from: "pool" | "tray"; surface: string } | null>,
  from: "pool" | "tray",
  surface: string,
): void {
  dragging.current = { from, surface };
  const image = makeDragImage(e.currentTarget);
  e.dataTransfer.setDragImage(image, image.offsetWidth / 2, image.offsetHeight / 2);
  e.dataTransfer.effectAllowed = "move";
  // The clone only needs to survive long enough for the browser to grab its
  // snapshot for the drag image; remove it right after this tick.
  window.setTimeout(() => image.remove(), 0);
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
  const [mismatch, setMismatch] = useState<AssemblyMismatch | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const dragging = useRef<{ from: "pool" | "tray"; surface: string } | null>(null);
  // Mirrors `dragging.current`, updated at every site that writes the ref
  // (see below). The ref alone is enough for the event-handler reads
  // (onDragOver/onDrop fire rapidly and must not trigger a re-render per
  // event — that's the whole reason this is a ref, not state), but a few
  // spots below need the CURRENT dragged piece to affect what gets
  // rendered (the preview tray order, the dimmed/preview styling on a
  // piece) — React refs are not allowed to be read during render (they can
  // go stale under the compiler/concurrent rendering), so those specific
  // reads use this state twin instead.
  const [draggingSurface, setDraggingSurface] = useState<
    { from: "pool" | "tray"; surface: string } | null
  >(null);
  // Where the dragged piece would land in the tray if dropped right now,
  // or null when nothing's being dragged over the tray. Display-only; drop
  // still commits through dropInTray. Cleared on drop, drag-end, and
  // whenever the pointer leaves the tray for the pool (SAK-90).
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

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
  // Surface → its piece, so pool/tray rendering (which only carries surface
  // strings, the shape grading needs) can still reach each piece's headword
  // for the unknown-word definition badge (SAK-87).
  const pieceBySurface = new Map(item.pieces.map((p) => [p.t, p]));
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
  // A wrong check (still-open retry, or the final out-of-retries reveal)
  // reddens the tray and names the specific chunk that's out of place —
  // not just "the whole order is wrong" (SAK-47).
  const wrongTray = mismatch !== null || card.state === "wrong";
  // The resolved reveal's colored-words-plus-labeled-boxes breakdown (SAK-50
  // changes-requested: "the same style as the sentence lesson where it shows
  // the words in color and has their definition") — null when the tier is
  // unknown or its role count doesn't match this item's piece count, in
  // which case the fixed bar below falls back to the plain sentence.
  const roleSpans = resolved ? assemblyRoleSpans(item.pieces, tierId) : null;

  const place = (surface: string) => {
    if (resolved) return;
    placePiece(card, surface);
    setMismatch(null);
    saveNow();
    rerender();
  };

  const unplace = (surface: string) => {
    if (resolved) return;
    unplacePiece(card, surface);
    setMismatch(null);
    saveNow();
    rerender();
  };

  const moveInTray = (surface: string, dir: -1 | 1) => {
    if (resolved) return;
    movePiece(card, surface, dir);
    setMismatch(null);
    saveNow();
    rerender();
  };

  /** Drop `surface` into the tray at `index` (or end when index is null). */
  const dropInTray = (surface: string, index: number | null) => {
    if (resolved) return;
    dropPiece(card, surface, index);
    setMismatch(null);
    saveNow();
    rerender();
  };

  const check = () => {
    if (resolved || card.tray.length !== canon.length) return;
    // card.tray is never touched by checkCard, wrong or right (Sam, changes
    // requested: the learner's own order must stay on screen exactly as they
    // left it) — this mismatch stays valid against the tray shown after
    // locking too, not just at the moment it's computed here.
    // findAssemblyMismatch itself returns null on a full match, so no
    // separate gradeAssembly pre-check is needed here.
    const wrongMismatch = findAssemblyMismatch(item, card.tray, tierId);
    const out = checkCard(rt, card, retriesAllowed(cfg));
    saveNow();
    setMismatch(out === "right" ? null : wrongMismatch);
    if (out !== "right") {
      setShake(true);
      window.setTimeout(() => setShake(false), 460);
    }
    rerender();
  };

  const next = () => {
    setHintOpen(false);
    setMismatch(null);
    dragging.current = null;
    setDraggingSurface(null);
    setDragOverIndex(null);
    if (rt.pos + 1 >= rt.cards.length) {
      finishQuiz(rt.stats);
      return;
    }
    advance(rt);
    saveNow();
    rerender();
  };

  // The tray as it would look if the in-flight drag dropped right now.
  // Equal to card.tray when nothing's being dragged over the tray.
  const previewTray = previewTrayOrder(
    card.tray,
    draggingSurface?.surface ?? null,
    dragOverIndex,
  );

  const trayFilled = card.tray.length === canon.length;
  const allowed = retriesAllowed(cfg);
  const retriesLeft = Math.max(0, allowed - card.tries);
  const unlimited = cfg.retries === "unl";
  const showPips = cfg.showRetryPips && (unlimited || allowed > 0);

  const skip = () => {
    if (resolved) return;
    skipCard(rt, card);
    setHintOpen(false);
    setMismatch(null);
    dragging.current = null;
    setDraggingSurface(null);
    setDragOverIndex(null);
    saveNow();
    rerender();
  };
  const endQuiz = () => finishQuiz(rt.stats);
  const hasLesson = !!session && session.teach.length > 0;
  const pct = total > 0 ? Math.round((100 * done) / total) : 0;

  return (
    // .kq-center-frame (globals.css, SAK-10): floor-height wrapper so a
    // short assembly card reads as vertically centered instead of pinned to
    // the top with a dead gap under it; still grows and scrolls normally
    // once the hint panel or a long piece pool needs more room.
    <div className="kq-center-frame">
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
            <SmallBtn
              aria-label="Mid-drill settings"
              onClick={() => setDrawerOpen((o) => !o)}
            >
              ⚙
            </SmallBtn>
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

      {/* flex-1 + justify-center centers the card in whatever room the
          frame leaves below the HUD. pb-28 is a constant reservation for the
          fixed reveal bar (see the end of this component) — constant, so it
          cannot be the thing that shifts this stage when a card resolves. */}
      <div className="mx-auto flex w-full max-w-xl flex-1 flex-col items-center justify-center py-4 pb-28">
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

        {/* The tray: the answer, in order. A drop target. previewTray is the
            tray reordered as if the current drag dropped right now, equal
            to card.tray whenever nothing's being dragged over it, so this
            adds nothing to the non-dragging render path. */}
        <ul
          className={`mt-4 flex min-h-17 w-full flex-wrap items-center justify-center gap-2 rounded-xl border p-3 ${
            card.state === "right"
              ? "border-success bg-success-bg"
              : wrongTray
                ? "border-danger bg-danger-bg"
                : trayFilled
                  ? "border-accent bg-accent-bg"
                  : "border-dashed border-border bg-panel"
          } ${shake ? "animate-gshake" : ""}`}
          aria-label="Sentence being built"
          onDragOver={(e) => {
            if (!dragging.current) return;
            e.preventDefault();
            // Reached only when the pointer is over empty tray space, not
            // over a specific piece (each piece's own onDragOver below
            // always stops propagation while dragging, self-hover included):
            // land at the end.
            setDragOverIndex(
              computeDragOverIndex(card.tray, dragging.current.surface, {
                kind: "tray-empty",
              }),
            );
          }}
          onDrop={(e) => {
            e.preventDefault();
            const d = dragging.current;
            if (d) dropInTray(d.surface, dragOverIndex);
            dragging.current = null;
            setDraggingSurface(null);
            setDragOverIndex(null);
          }}
          onDragLeave={(e) => {
            // dragleave fires constantly moving between child pieces; only
            // clear the preview once the pointer actually leaves the tray.
            if (e.currentTarget.contains(e.relatedTarget as Node | null)) return;
            setDragOverIndex(null);
          }}
        >
          {previewTray.length === 0 ? (
            <li className="text-sm text-text-muted">Tap or drag the pieces into order</li>
          ) : (
            previewTray.map((surface) => {
              const gloss = pieceGloss(pieceBySurface.get(surface)?.h ?? null, history);
              const committedIdx = card.tray.indexOf(surface);
              const isPreviewSlot =
                dragOverIndex !== null && draggingSurface?.surface === surface;
              return (
              <li key={surface} className="group relative">
                <button
                  type="button"
                  lang="ja"
                  draggable={!resolved}
                  disabled={resolved}
                  aria-label={`Piece ${surface}, position ${committedIdx + 1} of ${card.tray.length}. Arrow keys to move, Backspace to remove.`}
                  className={`kq-material rounded-xl border py-3 pr-8 text-center text-lg motion-safe:transition-[opacity,transform] motion-safe:duration-150 ${
                    gloss ? "pl-8" : "pl-4"
                  } ${
                    card.state === "right"
                      ? "border-success bg-success-bg"
                      : mismatch?.trayIndex === committedIdx
                        ? "border-danger bg-danger-bg"
                        : isPreviewSlot
                          ? "border-dashed border-accent bg-accent-bg opacity-70"
                          : "border-border bg-card"
                  } ${resolved ? "" : "cursor-grab"}`}
                  onDragStart={(e) => {
                    startDrag(e, dragging, "tray", surface);
                    setDraggingSurface({ from: "tray", surface });
                  }}
                  onDragOver={(e) => {
                    if (!dragging.current) return;
                    e.preventDefault();
                    // Always stop propagation while dragging, including when
                    // hovering the dragged piece's own ghost slot. Without
                    // this, the parent tray <ul>'s onDragOver treats the
                    // bubbled event as "empty tray space" and forces
                    // dragOverIndex to the end (SAK-90 round 2 bug: see
                    // computeDragOverIndex's doc comment in assembly-drag.ts
                    // for the full mechanics of why the drop always landed
                    // at the end regardless of where the pointer hovered).
                    e.stopPropagation();
                    const rect = e.currentTarget.getBoundingClientRect();
                    const before = e.clientX < rect.left + rect.width / 2;
                    const target = computeDragOverIndex(
                      card.tray,
                      dragging.current.surface,
                      {
                        kind: "piece",
                        hoveredSurface: surface,
                        pointerBeforeMidpoint: before,
                      },
                    );
                    // Self-hover (dragging the piece's own rendered ghost
                    // slot) is a decided "no change" case, not the
                    // end-of-tray fallback -- see assembly-drag.ts.
                    if (target !== DRAG_OVER_UNCHANGED) setDragOverIndex(target);
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    const d = dragging.current;
                    if (d) dropInTray(d.surface, dragOverIndex);
                    dragging.current = null;
                    setDraggingSurface(null);
                    setDragOverIndex(null);
                  }}
                  onDragEnd={() => {
                    dragging.current = null;
                    setDraggingSurface(null);
                    setDragOverIndex(null);
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
                  {/* Trailing sentence punctuation (。！？) is stripped for
                      DISPLAY only — see pieceLabel. Showing it was a tell for
                      which piece goes last, since only the final piece ever
                      carries it (SAK-50 changes-requested). `surface` itself,
                      punctuation and all, is still what's placed/graded. */}
                  {pieceLabel(surface)}
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
                {/* The unknown-word definition badge (SAK-87): only when this
                    piece's headword is a real content word (h non-null) the
                    learner hasn't met yet. pieceGloss already returns null
                    for a bare particle or an already-known word, so a card
                    built entirely from known material shows no badges at
                    all. Opposite corner from the remove "×" above so the two
                    never overlap. */}
                {gloss ? (
                  <span
                    className="absolute left-1.5 top-1.5"
                    onClick={(event) => event.stopPropagation()}
                  >
                    <Info label={`Meaning of ${pieceLabel(surface)}`}>
                      {gloss}
                    </Info>
                  </span>
                ) : null}
              </li>
              );
            })
          )}
        </ul>

        {/* Names the specific chunk a wrong check found out of place, using
            the tier's own chunk-role labels — not just a red tray with no
            explanation (SAK-47). */}
        {wrongTray && mismatch ? (
          <p role="alert" className="mt-2 text-sm text-danger">
            {assemblyMismatchMessage(mismatch)}
          </p>
        ) : null}

        {/* Keep the pool's row reserved after its final piece is placed. Without
            this minimum height, the controls jump upward at the exact moment
            the learner finishes assembling the sentence. */}
        <ul
          className="mt-5 flex min-h-[62px] flex-wrap items-center justify-center gap-2"
          aria-label="Pieces to place"
          onDragOver={(e) => {
            if (dragging.current?.from === "tray") e.preventDefault();
            // A tray piece dragged back out is no longer a tray-insertion
            // preview, so drop the live reflow: the tray should show its
            // committed order while the pointer is over the pool.
            if (dragOverIndex !== null) setDragOverIndex(null);
          }}
          onDrop={(e) => {
            e.preventDefault();
            const d = dragging.current;
            if (d?.from === "tray") unplace(d.surface);
            dragging.current = null;
            setDraggingSurface(null);
            setDragOverIndex(null);
          }}
        >
          {card.pool.map((surface) => {
            const gloss = pieceGloss(pieceBySurface.get(surface)?.h ?? null, history);
            // Dimmed while this piece is the one being dragged into the
            // tray, so it doesn't read as a second copy alongside its
            // dashed preview slot over there.
            const isBeingDragged =
              dragOverIndex !== null &&
              draggingSurface?.from === "pool" &&
              draggingSurface.surface === surface;
            return (
            <li key={surface} className="relative">
              <button
                type="button"
                lang="ja"
                draggable={!resolved}
                disabled={resolved}
                aria-label={`Piece ${surface}. Press Enter to place it, or drag it into the sentence.`}
                className={`kq-material cursor-grab rounded-xl border border-border bg-card py-3 pr-4 text-center text-lg motion-safe:transition-opacity motion-safe:duration-150 ${
                  isBeingDragged ? "opacity-40" : ""
                } ${gloss ? "pl-8" : "pl-4"}`}
                onClick={() => place(surface)}
                onDragStart={(e) => {
                  startDrag(e, dragging, "pool", surface);
                  setDraggingSurface({ from: "pool", surface });
                }}
                onDragEnd={() => {
                  dragging.current = null;
                  setDraggingSurface(null);
                  setDragOverIndex(null);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    place(surface);
                  }
                }}
              >
                {/* See the tray button above: display-only, punctuation
                    stripped so it's not a tell for the final piece. */}
                {pieceLabel(surface)}
              </button>
              {/* The unknown-word definition badge (SAK-87), see the tray's
                  matching comment above. Left corner in both states (Sam,
                  changes requested): a pool piece has no remove button to
                  avoid, but the badge stays on the same side either way
                  rather than flipping between tray and pool. Buttons reserve
                  room for it (see the conditional pl-8 above) so it never
                  sits on top of the piece's own text. */}
              {gloss ? (
                <span
                  className="absolute left-1.5 top-1.5"
                  onClick={(event) => event.stopPropagation()}
                >
                  <Info label={`Meaning of ${pieceLabel(surface)}`}>
                    {gloss}
                  </Info>
                </span>
              ) : null}
            </li>
            );
          })}
        </ul>

        {/* The resolved reveal used to render here, in-flow (the plain
            item.jp line, then a Next button swapped in for Check/Skip/Hint) —
            both moved out to the fixed bottom bar below (see the end of this
            component) so resolving a card doesn't reflow the tray/pool above
            it, the same fix SAK-50's changes-requested pass made on the drill
            screen. */}
        <div className="mt-6 flex w-full flex-col items-center gap-4">
          {resolved ? null : (
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
                title="Skip, ask this again later"
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

      {/* THE REVEAL, fixed to the bottom of the viewport instead of in-flow
          (SAK-50 changes-requested pass — same fix as the drill screen: see
          its matching comment for why `position: fixed` rather than a
          reserved-height in-flow element). `pb-28` above is the constant
          clearance that keeps this from covering the tray/pool while it's up.

          Styled like the sentence LESSON's own word-by-word breakdown
          (colored words, a labeled box per chunk underneath) — reused from
          mark-view.tsx via components/quiz/sentence-part-breakdown.tsx and
          lib/sentence-part-spans.ts, not reinvented, per Sam's explicit ask.
          Falls back to the plain sentence when the item's tier/piece count
          doesn't line up with known chunk roles (roleSpans null) — the same
          case chunkRoleLabels already declines to guess a label for. */}
      {resolved ? (
        <div className="kq-band fixed inset-x-0 bottom-0 z-20 border-t border-border px-4 py-3">
          <div className="mx-auto flex max-h-[45vh] max-w-xl flex-col items-center gap-1 overflow-y-auto text-center">
            {roleSpans ? (
              <>
                <p lang="ja" className="text-lg">
                  {colorizeSentence(item.jp, roleSpans.spans)}
                </p>
                <SentencePartBoxes
                  sentence={item.jp}
                  spans={roleSpans.spans}
                  labels={roleSpans.labels}
                  lang="ja"
                />
              </>
            ) : (
              <p lang="ja" className="text-lg">
                {item.jp}
              </p>
            )}
            <Btn go onClick={next} className="mt-2">
              Next
            </Btn>
          </div>
        </div>
      ) : null}
      {drawerOpen ? <DrillDrawer onClose={() => setDrawerOpen(false)} /> : null}
    </div>
  );
}
