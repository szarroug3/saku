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
import {
  drillPlan,
  sliceCount,
  sliceIsDrillable,
  sliceSentence,
  type Slice,
} from "@/lib/library/slice";
import { useQuizSession } from "@/lib/quiz-session";
import type { Claims } from "@/lib/claims";
import type { FactAggregate, FactId } from "@/types";

export function SliceBar({
  slice,
  facts,
  claims,
  now,
  onClaim,
  showLabel = true,
  includeSolid = false,
}: {
  slice: Slice;
  facts: Record<FactId, FactAggregate>;
  claims: Claims;
  /** Passed in, never read from a clock here: every screen in this feature
   * renders against ONE `now`, or the bar and the table it summarises can
   * disagree about whether a fact is solid. */
  now: number;
  /** Marks the slice known. Async and owned by the page, because the page holds
   * the history this bar is rendered from and has to refresh it. */
  onClaim(facts: FactId[]): void;
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
}) {
  const { startSession, startQuiz } = useQuizSession();
  const [adding, setAdding] = useState(false);
  // "Quiz me" no longer drops straight into the drill. It opens a pre-start step
  // so the config that WILL run is visible and changeable first — the same gap
  // Practice already closes by showing the editor inline, closed here for the
  // launch points that used to bypass it. See QuizPreStart below.
  const [quizzing, setQuizzing] = useState(false);

  const plan = drillPlan(slice, facts, claims, now, includeSolid);
  // Teach first, then probe — the order the session should MEET them, which is
  // budget.planFacts's rule and not this bar's to invent.
  const order = [...plan.teach, ...plan.probe];
  // Claim only ever touches NOT-solid facts: claiming what the model already
  // calls solid is a documented no-op. So even when Drill is force-including
  // solid facts, claim runs off the default plan and is disabled once every
  // not-solid fact is claimed.
  const claimOrder = includeSolid
    ? (() => {
        const base = drillPlan(slice, facts, claims, now);
        return [...base.teach, ...base.probe];
      })()
    : order;
  const count = sliceCount(slice, facts, claims, now, includeSolid);
  const sentence = sliceSentence(count);
  // ONE thing to learn is not a drill. A single kana IS its one reading, and a
  // "drill" of it is a one-question session that teaches nothing the screen above
  // this bar hasn't already shown — so hide Drill (only Drill) on single-fact
  // slices. Add-to-list and I-know-this stay: you may still file か or claim it.
  const canDrill = sliceIsDrillable(slice);

  return (
    <>
      {adding ? (
        <AddToList
          entries={slice.entries}
          label={slice.label}
          onDone={() => setAdding(false)}
        />
      ) : null}
      {/* `kq-band`, not `kq-material`: this is a sticky band over the page's
          ground and it MUST occlude — the table has to vanish under it, not
          show through it. kq-material would give it the card's frost, which in
          the three opaque themes is nothing at all and in kiri is a 5.5% wash
          the rows read straight through.

          `rounded-(--radius)` rather than `rounded-xl`: the radius+fill recipes
          in globals.css are a real hazard (rounded-xl + bg-card IS the Card),
          and this asks for its material by name instead, so its geometry is
          nobody's business but its own. */}
      <div className="kq-band sticky bottom-0 z-10 mt-3.5 flex flex-wrap items-center gap-3 rounded-(--radius) border border-border p-3 shadow-card">
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
        <div className="flex flex-none flex-wrap items-center gap-1.5">
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
          {/* Two ways to run a slice, both gated identically (see below).
              "Quiz me" is the one-off (startQuiz): straight to the questions, no
              teach screen and no rest loop, ending on the results page — the
              same run the Practice page starts, for when you already know this
              and just want to be asked. It is the highlighted default now that
              most Library visits are review. "Teach me" builds a normal SESSION
              (startSession): read the new material, then probe it, then rest and
              repeat — so セイ comes up at a distance from your having just read
              it, the only way a drill of something on screen scores anything
              (see the note up top).

              N is the real number, and the buttons are GONE when N would be
              zero. It used to be `drillChars(order).length` — the facts filtered
              to the ones whose subject was kana, because the runtime drilled
              CHARACTERS and CHAR_INDEX has no kanji in it. On 生 that filter
              matched nothing and the button said "Drill 0" next to nine facts.
              The runtime is fact-native now, so the filter, the note and the
              whole of src/lib/library/drill.ts are gone: what the model would
              drill and what the quiz can ask are the same list again. A run of 0
              can still surface the honest way — a multi-fact slice every fact of
              which is already solid drills nothing, so `order` is empty — and a
              run of nothing is not a thing to offer (the sentence beside them
              already says "all N solid, nothing to ask"), so both buttons are
              HIDDEN, not shown disabled. `sliceIsDrillable` hides them on
              single-fact slices; `order.length` hides them on empty ones. */}
          {canDrill && order.length > 0 ? (
            <>
              <Btn sel onClick={() => setQuizzing(true)}>
                Quiz me {order.length}
              </Btn>
              <Btn
                onClick={() =>
                  startSession(order, [...plan.teach], slice.label, "library")
                }
              >
                Teach me {order.length}
              </Btn>
            </>
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
        count={order.length}
        onStart={() => startQuiz(order, { what: slice.label })}
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
  onStart,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The pool being quizzed — slice.label, e.g. "Kana". */
  label: string;
  /** How many questions the run holds — order.length, the same number the
   * button showed. */
  count: number;
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
            <div className="mt-3 min-h-0 flex-1 overflow-y-auto">
              <ConfigPreview />
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
