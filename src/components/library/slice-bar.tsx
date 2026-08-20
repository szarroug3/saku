"use client";

// THE BAR. Pinned to the bottom of anything you are looking at, offering the
// three things you can do with it: drill it, claim it, file it.
//
// It is one component because it is one bar. A shelf, a section, a search, a
// row and a single entry are all just a `Slice` — a name and some entries — and
// the alternative is three screens each deciding for themselves what "Drill"
// means here. The bar already knows what it is pointing at; the second and third
// verbs are nearly free, which is the whole argument for them existing.
//
// WHAT IT REFUSES TO DO
// =====================
// There are no per-row Drill buttons anywhere in the Library, and this bar is
// why there needn't be. The rule: IF A SCREEN SHOWS YOU THE ANSWER, IT DOESN'T
// GET TO ASK THE QUESTION. The entry page prints セイ two inches above the
// button; a drill of exactly that, right now, is the purest possible massed
// repetition, and the app's own arithmetic scores it at nothing (review() at
// p ≈ 1 multiplies stability by 1.0 — see scoring.ts). So the primary verb,
// "Teach me", builds a NORMAL session that these facts are part of, and they
// come up at a distance from your having read them. "Quiz" is the deliberate
// opt-out beside it: a one-off that asks exactly this set right now, for when
// you already know it and just want to be tested — the same run Practice starts.

import { useState } from "react";
import { AlertDialog as AlertDialogPrimitive } from "radix-ui";

import { AddToList } from "@/components/library/add-to-list";
import { ConfigPreview } from "@/components/quiz/config-preview";
import { Btn, Hint } from "@/components/ui";
import { constructionConfigForFact } from "@/data/counter-categories";
import {
  drillPlan,
  hasMultipleQuizForms,
  quizFormCount,
  sliceCount,
  sliceFacts,
  sliceIsDrillable,
  sliceSentence,
  type Slice,
} from "@/lib/library/slice";
import { claimableFacts, quizzableFacts } from "@/lib/library/library-index";
import { useQuizSession } from "@/lib/quiz-session";
import type { Claims } from "@/lib/claims";
import type { FactAggregate, FactId, HistoryFile, QuizMode } from "@/types";

interface SliceTeachPlan {
  facts: readonly FactId[];
  teach: readonly FactId[];
  what: string;
  mode?: QuizMode;
  /** What the button counts. Usually facts; sentence-rule shelves count the
   * coherent lessons the action begins working through. */
  displayCount?: number;
}

export function SliceBar({
  slice,
  facts,
  claims,
  history,
  now,
  onClaim,
  onUnclaim,
  showLabel = true,
  includeSolid = false,
  claimFacts,
  quizFacts,
  quizMode,
  teachPlan,
  progressReady = true,
  variant = "bar",
  hasSelection = false,
}: {
  slice: Slice;
  facts: Record<FactId, FactAggregate>;
  claims: Claims;
  /** The whole history, so the quiz guard can ask whether the WORD a kanji
   * reading is anchored in has been learned. A reading in an unlearned word is
   * never quizzed, even if it became "met" some other way. */
  history: HistoryFile;
  /** Passed in, never read from a clock here: every screen in this feature
   * renders against ONE `now`, or the bar and the table it summarises can
   * disagree about whether a fact is solid. */
  now: number;
  /** Marks the slice known. Owned by the page, because the page holds the
   * history this bar is rendered from — typically `useHistoryWrites().claim`,
   * which applies locally and posts in the background rather than blocking on
   * a round trip. */
  onClaim(facts: FactId[]): void;
  /** Reverses a claim — "actually, I don't [know this]". Offered on the entry
   * variant (see the SAK-61 note by claimedFacts below) and, since the owner's
   * follow-up request, on the "bar" variant too — but ONLY there while it is
   * showing an explicit selection (hasSelection): a search or browse slice
   * never gets an unclaim action, just the hand-picked set the reader built.
   * Optional because a whole-shelf/search "bar" render still has nothing to
   * reverse until the caller wires it up. */
  onUnclaim?(facts: FactId[]): void;
  /** Whether to print `slice.label` in bold ahead of the sentence. True on the
   * shelf, where the label is the current selection or search and nothing else
   * on screen names it. False on an entry page, where the label is the entry's
   * own name and the header and the breadcrumb have both already said it. The
   * label is still PASSED either way: it names the add-to-list panel and the
   * run the Teach me and Quiz buttons start. */
  showLabel?: boolean;
  /** True ONLY for an explicit selection — the user toggled these items by hand
   * and pressed Drill. It makes solid/quiet facts drillable (asked directly)
   * instead of dropped, so a selection of things you already know still drills.
   * The default "don't re-drill what you know" holds for whole-shelf and
   * whole-section slices, which never set it. */
  includeSolid?: boolean;
  /** Optional additional claim-only facts for reference entries whose completion is
   * tracked without a quiz fact. Sentence-rule pages use their tier marker so
   * “I know this” advances the same Learn track as its lesson card. */
  claimFacts?: readonly FactId[];
  /** A subject-specific quiz pool when entry facts are not the actual exercise.
   * Sentence rules quiz readable assembly facts in assembly mode. */
  quizFacts?: readonly FactId[];
  quizMode?: QuizMode;
  /** A subject-specific lesson launch. Sentence rules teach one coherent tier
   * at a time instead of merging ten lesson walks into one. */
  teachPlan?: SliceTeachPlan;
  /** False when this browser's signed-out history cannot be read until the
   * client starts. Never present actions calculated from a fake empty history. */
  progressReady?: boolean;
  /** "bar" (default) is the full action band — Add to list, I-know-this, Quiz,
   * Teach — shown on the main Library shelf. "entry" is the pared-down entry-page
   * treatment: NO band, NO Add to list (that verb belongs to the shelf), NO
   * claim/teach. It renders NOTHING unless the entry is quizzable on its own, and
   * when it is, only a lone "Quiz me" button — a reference page shows the answer,
   * so the one thing it may still offer is a deliberate self-test. */
  variant?: "bar" | "entry";
  /** The shelf bar only appears once the reader has SELECTED rows by hand — the
   * actions act on that selection, so with nothing picked there is nothing to
   * offer and the bar renders nothing. Ignored by the entry variant. */
  hasSelection?: boolean;
}) {
  const { startSession, startQuiz, startQuizInMode } = useQuizSession();
  const [adding, setAdding] = useState(false);
  // "Quiz me" no longer drops straight into the drill. It opens a pre-start step
  // so the config that WILL run is visible and changeable first — the same gap
  // Practice already closes by showing the editor inline, closed here for the
  // launch points that used to bypass it. See QuizPreStart below.
  const [quizzing, setQuizzing] = useState(false);

  // Signed-out history lives in localStorage, which the server cannot read.
  // Until the provider has restored it, every progress-derived sentence and
  // action would be calculated from a fake empty history (briefly offering
  // “Teach me” to someone who already knows the whole slice). Render the bar
  // once, from real data, instead of rendering and then correcting it.
  if (!progressReady) return null;
  // The shelf bar's actions all operate on a hand-picked selection; with nothing
  // selected there is nothing to add, claim, quiz or teach, so it shows nothing
  // at all rather than a whole-shelf "Everything" band. (The entry variant has
  // its own gate below and never sets hasSelection.)
  if (variant === "bar" && !hasSelection) return null;
  const plan = drillPlan(slice, facts, claims, now, includeSolid);
  // Teach first, then probe — the order the session should MEET them, which is
  // budget.planFacts's rule and not this bar's to invent. This is what "Teach me"
  // runs: the new material, taught, then the met material probed.
  const order = [...plan.teach, ...plan.probe];
  // WHAT "QUIZ ME" ASKS — every quizzable fact named by this Library slice.
  // A Library page has just shown the material, and an explicit Quiz action means
  // test this material now; prior exposure is not an additional eligibility gate.
  // GUARD (see quizzableFacts): a kanji reading
  // anchored in a word the learner has not learned is dropped. It never asks
  // "山 read as ざん in 登山" until 登山 itself has been learned, even if that
  // reading became "met" some other way (a stray claim, a re-cut). Non-reading
  // facts and readings whose word IS known are untouched, so kana, words and
  // meanings quiz exactly as before, and a hand-picked selection still asks
  // everything it picked except a reading in a word you never learned.
  const quizOrder = quizzableFacts(sliceFacts(slice), history);
  const effectiveQuizOrder = quizFacts ? [...new Set(quizFacts)] : quizOrder;
  const quizCount = quizFormCount(effectiveQuizOrder);
  const canQuiz = hasMultipleQuizForms(effectiveQuizOrder);
  const hasGenerator = effectiveQuizOrder.some(
    (fact) => constructionConfigForFact(fact) !== null,
  );
  // Claim only ever touches NOT-solid facts: claiming what the model already
  // calls solid is a documented no-op. So even when Drill is force-including
  // solid facts, claim runs off the default plan and is disabled once every
  // not-solid fact is claimed.
  // SOURCE (see claimableFacts): "I know this" claims a kanji's MEANING, never
  // its word-anchored readings. Knowing 山 does not mean knowing 登山, so
  // claiming 山 must not mark `kanji:山/reading@登山` known and slip it into the
  // quiz. Kana claim their one fact and words claim all of theirs, unchanged.
  const ordinaryClaimOrder = claimableFacts(
    includeSolid
      ? (() => {
          const base = drillPlan(slice, facts, claims, now);
          return [...base.teach, ...base.probe];
        })()
      : order,
  );
  const claimOrder = [
    ...new Set([
      ...ordinaryClaimOrder,
      ...(claimFacts ?? []).filter((id) => claims[id] === undefined),
    ]),
  ];
  const count = sliceCount(slice, facts, claims, now, includeSolid);
  const sentence = sliceSentence(count);
  // ONE thing to learn is not a drill. A single kana IS its one reading, and a
  // "drill" of it is a one-question session that teaches nothing the screen above
  // this bar hasn't already shown — so hide Drill (only Drill) on single-fact
  // slices. Add-to-list and I-know-this stay: you may still file か or claim it.
  const canDrill = sliceIsDrillable(slice);

  // SAK-61: what "unclaim" reverses, on an entry OR a selection. The mirror of
  // claimOrder above — the same claimable (non-reading) facts of this exact
  // slice, filtered down to the ones that ARE currently claimed, rather than
  // the ones that aren't. There is deliberately no separate "unclaim
  // mechanism": it is applyDropClaims (history-ops.ts) run on this set,
  // through the same onUnclaim the caller already wires onClaim through.
  // Together, claimOrder and claimedFacts are the whole "smart" bulk-action
  // rule the owner asked for: an all-unclaimed selection shows only "I know
  // these", an all-claimed one shows only "Mark as not known", and a mixed
  // selection shows both, each acting on its own subset.
  const claimedFacts = claimableFacts(sliceFacts(slice)).filter(
    (fact) => claims[fact] !== undefined,
  );

  // ENTRY-PAGE TREATMENT. A Library entry page is reference, not a shelf: no
  // filing (Add to list is the shelf's verb), no claim/teach. It may still
  // offer a deliberate self-test (canQuiz) and, since SAK-61, the one verb
  // that reverses a claim already made on THIS entry (canUnclaim) — both
  // narrow, deliberate exceptions to "reference doesn't act". Render nothing
  // unless one of them applies.
  if (variant === "entry") {
    // SAK-61: "unclaiming should be in the library" — this is the one entry
    // action besides Quiz me, and it only appears when there is something on
    // THIS entry to reverse. Everything else about the entry variant (no
    // band, no Add to list, no claim/teach) is unchanged.
    const canUnclaim = Boolean(onUnclaim) && claimedFacts.length > 0;
    if (!canQuiz && !canUnclaim) return null;
    return (
      <>
        {/* Pinned to the bottom of the entry COLUMN, not just the end of its
            content — page.tsx wraps the entry in a min-height flex column and
            gives this bar `mt-auto`, so a short entry (a two-line word)
            doesn't strand the button far above a dead gap. Deliberately NOT
            `fixed inset-x-0` like the quiz screens' reveal bar: that spans the
            full viewport and would sit on top of the sidebar's own bottom
            content (its sign-in notice), which has no reason to make room for
            a bar that belongs to the entry column beside it, not the sidebar. */}
        <div className="kq-band border-t border-border px-4 py-3">
          <div className="flex flex-wrap items-center justify-end gap-1.5">
            {canUnclaim ? (
              <Btn onClick={() => onUnclaim?.(claimedFacts)}>
                Mark as not known
              </Btn>
            ) : null}
            {canQuiz ? (
              <Btn sel onClick={() => setQuizzing(true)}>
                Quiz me {quizCount}
              </Btn>
            ) : null}
          </div>
        </div>
        <QuizPreStart
          open={quizzing}
          onOpenChange={setQuizzing}
          label={slice.label}
          count={quizCount}
          generator={hasGenerator}
          onStart={() => {
            if (hasGenerator) {
              startQuiz(effectiveQuizOrder, {
                what: slice.label,
                mode: "drill",
                coverage: true,
              });
            } else if (quizMode) {
              startQuizInMode(effectiveQuizOrder, quizMode, { what: slice.label });
            } else {
              startQuiz(effectiveQuizOrder, { what: slice.label });
            }
          }}
        />
      </>
    );
  }

  return (
    <>
      {adding ? (
        <AddToList
          entries={slice.entries}
          label={slice.label}
          onDone={() => setAdding(false)}
        />
      ) : null}
      {/* DE-BOXED: no band, border, fill or shadow. The bar is a layout sibling
          BELOW the scroll box (nothing scrolls behind it), so it needs no
          occluding material — it sits on the page mesh like every other de-boxed
          surface, set off from the shelf above by a single flat hairline. It is
          only mounted at all while rows are selected (see the hasSelection gate),
          so this row IS the "you have a selection, here's what you can do with
          it" state. */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-t border-white/[0.08] pt-3">
        <div className="min-w-0 flex-1 text-[13px] text-text-muted">
          {/* An empty slice has no sentence (see sliceSentence): show nothing
              here at all rather than a lone label with a trailing comma and no
              clause after it. */}
          {sentence ? (
            <>
              {showLabel ? (
                <>
                  <b className="font-medium text-text">{slice.label}</b>
                  {", "}
                </>
              ) : null}
              {sentence}
              {count.seen > 0 && count.seen < count.total ? (
                <span className="ml-1.5">
                  <Hint>
                    · {count.seen} seen, {count.total} in total
                  </Hint>
                </span>
              ) : null}
            </>
          ) : null}
        </div>
        <div className="flex min-w-0 flex-wrap items-center gap-1.5">
          <Btn
            sel={adding}
            onClick={() => setAdding((v) => !v)}
            disabled={slice.entries.length === 0}
          >
            ＋ Add to list
          </Btn>
          {/* HIDDEN, not disabled, once there is nothing left to claim.
              Claiming what the model already calls solid is a no-op, and
              `claimOrder` is exactly the not-solid facts, so an empty order
              means the slice is already known and the button is GONE — the
              same "don't ask what you've answered" rule the Quiz/Teach
              buttons follow below. */}
          {claimOrder.length > 0 ? (
            <Btn onClick={() => onClaim(claimOrder)}>
              ✓ I know {slice.entries.length === 1 ? "this" : "these"}
            </Btn>
          ) : null}
          {/* The bulk mirror of "Mark as not known" on the entry page: only
              once the caller has wired an onUnclaim (selections only — see
              the prop doc) and only while some of the selection IS claimed.
              Acts on exactly that subset (claimedFacts), so a mixed
              selection's "I know these" and "Mark as not known" never
              overlap on the same fact. */}
          {onUnclaim && claimedFacts.length > 0 ? (
            <Btn onClick={() => onUnclaim(claimedFacts)}>
              Mark as not known
            </Btn>
          ) : null}
          {/* Two ways to run a slice, with gates suited to their jobs.
              "Quiz me" is the one-off (startQuiz): straight to the questions, no
              teach screen and no rest loop, ending on the results page — the
              same run the Practice page starts, for when you already know this
              and just want to be asked. It is the highlighted default now that
              most Library visits are review. "Teach me" builds a normal SESSION
              (startSession): read the new material, then probe it, then rest and
              repeat — so セイ comes up at a distance from your having just read
              it, the only way a drill of something on screen scores anything
              (see the note up top).

              Quiz eligibility is based on quizzable FORMS, below. Teach remains
              a fact-based session: one stored fact is not a useful lesson loop,
              and an empty order has nothing to teach. */}
          {/* Teach me — learn the new, then probe. Gated on the full order, so it
              stays while there is anything at all to teach or review. */}
          {canDrill && order.length > 0 ? (
            <Btn
              onClick={() =>
                startSession(order, [...plan.teach], slice.label, "library")
              }
            >
              Teach me {order.length}
            </Btn>
          ) : null}
          {teachPlan?.facts.length ? (
            <Btn
              onClick={() =>
                startSession(
                  [...teachPlan.facts],
                  [...teachPlan.teach],
                  teachPlan.what,
                  "library",
                  undefined,
                  teachPlan.mode,
                )
              }
            >
              Teach me {teachPlan.displayCount ?? teachPlan.facts.length}
            </Btn>
          ) : null}
          {/* Quiz me is the highlighted primary and sits LAST, rightmost — the
              last thing in reach, after the file/claim/teach cluster. It follows
              one rule on shelves and entry pages alike: the selected pool must
              contain more than one quizzable form (ordinary facts count once; a
              generator category counts its round's questions). */}
          {canQuiz ? (
            <Btn sel onClick={() => setQuizzing(true)}>
              Quiz me {quizCount}
            </Btn>
          ) : null}
        </div>
      </div>
      {/* The pre-start step for "Quiz me". Mounted (and portalled) only while
          open, and Start runs the exact call the button used to run inline —
          startQuiz(order, { what: slice.label }) — so nothing about which facts
          get drilled changes, only that you see and can edit the config first. */}
      <QuizPreStart
        open={quizzing}
        onOpenChange={setQuizzing}
        label={slice.label}
        count={quizCount}
        generator={hasGenerator}
        onStart={() => {
          if (hasGenerator) {
            startQuiz(effectiveQuizOrder, {
              what: slice.label,
              mode: "drill",
              coverage: true,
            });
          } else if (quizMode) {
            startQuizInMode(effectiveQuizOrder, quizMode, { what: slice.label });
          } else {
            startQuiz(effectiveQuizOrder, { what: slice.label });
          }
        }}
      />
    </>
  );
}

// The "Quiz me" pre-start modal. Built on the same Radix AlertDialog pieces as
// ui/confirm-dialog.tsx and for the same reasons documented there in full: a
// native dialog is invisible to anything driving the app over CDP, and the
// portal-to-body + flat scrim + frosted panel arrangement is what lets a
// .kq-material panel actually frost (an overlay carrying its own backdrop-filter
// would blur the blur, and a .kq-material nested inside a Card frosts nothing).
// This one is not a yes/no confirm, so it renders its own body — the pool line,
// the ConfigPreview, and a Start — rather than going through useConfirm.
function QuizPreStart({
  open,
  onOpenChange,
  label,
  count,
  generator,
  onStart,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The pool being quizzed — slice.label, e.g. "Kana". */
  label: string;
  /** How many questions the run holds — order.length, the same number the
   * button showed. */
  count: number;
  /** Generator pools are always ordinary Drill with their full generated round. */
  generator: boolean;
  /** Runs the quiz. Navigates away, so the dialog need not close itself. */
  onStart: () => void;
}) {
  return (
    <AlertDialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <AlertDialogPrimitive.Portal>
        <AlertDialogPrimitive.Overlay
          className="fixed inset-0 z-50 bg-(--scrim) data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:animate-in data-[state=open]:fade-in-0"
        />
        <AlertDialogPrimitive.Content
          data-testid="quiz-prestart-dialog"
          className={[
            // Flex column, bounded to the viewport: the config editor can expand
            // to six rows when "Change" is open, which is taller than a phone. So
            // the panel caps its height and the MIDDLE scrolls, keeping the title
            // and the Start/Cancel footer on screen — Start must never be pushed
            // off where it can't be reached.
            "fixed left-1/2 top-1/2 z-50 flex max-h-[calc(100dvh-32px)] w-[calc(100vw-24px)] max-w-[460px] -translate-x-1/2 -translate-y-1/2 flex-col",
            // A Card over the page — the same four tokens and the same
            // rounded-(--radius) reasoning confirm-dialog.tsx spells out: it
            // must occlude what it covers, so it takes the panel radius, not the
            // Card/Btn class pairs that trigger the aizome dissolve. kq-overlay
            // gives it back the frost the scrolling cards gave up (see globals):
            // a dialog is one portalled element, not a wall, so the blur that
            // janks the Library is free here and is what lifts it off the page.
            "rounded-(--radius) border border-border bg-card p-[18px] shadow-card",
            "kq-material kq-overlay",
            "data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95",
          ].join(" ")}
        >
          <AlertDialogPrimitive.Title className="flex-none text-[15px] font-semibold text-text">
            {label} · {count} question{count === 1 ? "" : "s"}
          </AlertDialogPrimitive.Title>
          {/* Radix wants a description for a11y; the config line is it. Pointed
              at by aria wiring via the Description wrapper so a screen reader
              hears what the run will do, not just its size. The min-h-0 is what
              lets this shrink and scroll inside the flex column instead of
              overflowing it. */}
          <AlertDialogPrimitive.Description asChild>
            {/* The recessed row that holds the config, now owned here rather
                than drawn by ConfigPreview itself (it went container-neutral so
                the rest screen's Card stopped double-boxing it). bg-panel is the
                RECESSED tone (see Metric's note in ui.tsx) — right for a thing
                nested inside this dialog's card. This wrapper reproduces the box
                ConfigPreview used to draw, so the look here is unchanged. */}
            <div className="mt-3 min-h-0 flex-1 overflow-y-auto rounded-lg border border-border bg-panel px-3 py-2">
              {generator ? (
                <span className="text-[13px] text-text-muted">
                  Drill · Full generated round
                </span>
              ) : (
                <ConfigPreview />
              )}
            </div>
          </AlertDialogPrimitive.Description>
          <div className="mt-4 flex flex-none justify-end gap-2">
            {/* Cancel first in the DOM: it holds initial focus, so an Enter
                that arrives before the dialog is read closes it rather than
                starting a quiz — the same harmless-default rule confirm-dialog
                keeps. */}
            <AlertDialogPrimitive.Cancel asChild>
              <Btn data-testid="quiz-prestart-cancel">Cancel</Btn>
            </AlertDialogPrimitive.Cancel>
            <AlertDialogPrimitive.Action asChild>
              <Btn go data-testid="quiz-prestart-start" onClick={onStart}>
                Start
              </Btn>
            </AlertDialogPrimitive.Action>
          </div>
        </AlertDialogPrimitive.Content>
      </AlertDialogPrimitive.Portal>
    </AlertDialogPrimitive.Root>
  );
}
