"use client";

// The teach phase, as a full-screen stepped page — the session's OWN teach
// screen, structured like the drill.
//
// WHY THIS REPLACED THE TILE WALL
// ===============================
// A session has two phases: teach, then drill. The drill is a full-screen stage
// — one card at a time under a quiet HUD (see quiz/drill-screen.tsx). The teach
// phase used to be the odd one out: a wall of small tiles showing every fact at
// once. The owner wanted the two to match — "a session page similar to the
// drill" — so the teach phase is now the same shape: the same SessionHud strip
// above (supplied by the /session route), then a centered stage that steps
// through the lesson's items ONE AT A TIME, each a rich detail view (glyph,
// mnemonic, how it's written, readings). Same chrome, same full-screen feel;
// the difference is that here the material is SHOWN, not asked.
//
// STILL SHOWN, NOT ASKED
// ======================
// The teach phase's whole job is unchanged from the tile wall this replaced:
// read the new material, then drill it. Nothing here is graded, and the one
// action that leaves is the same one that always left — Start the round. "Seen
// before" is still a quiet, presentation-only note on material the budget put
// here because you'd forgotten it, never a score.
//
// HOLDS ONLY A STEP
// =================
// Where you are in the walk is not a fact about your memory and is not on the
// session. It is local state, reset on remount — the same call the teach-me
// walkthrough this replaced made, and for the same reason. The session's own state (its facts, its round, its
// progress) is untouched, so resume and the Current-lesson nav keep working
// exactly as they did: this changed what the teach phase LOOKS like, not what it
// IS.

import { useMemo } from "react";

import { ConversionCard } from "@/components/lesson/conversion-card";
import { TeachItemView } from "@/components/session/teach-item-view";
import { TermEntryView } from "@/components/library/term-entry-view";
import { PhaseIntroView } from "@/components/lesson/phase-intro-view";
import { AttributionLink } from "@/components/library/attribution-link";
import { FlatSurfaceProvider } from "@/components/ui";
import { lessonSteps } from "@/lib/lesson-steps";
import type { FactId, HistoryFile } from "@/types";

export function TeachWalk({
  facts,
  history,
  shownIntros,
  familiar,
  step,
}: {
  /** The teach set — what the budget put in front of you before the drill. */
  facts: FactId[];
  /** What the learner has already met. Read for ONE thing: whether this lesson
   * opens a track, which decides whether the walk leads with that track's intro
   * card (src/lib/track-open.ts). The session page derives its "N of M" from the
   * same two inputs, so the count and the content stay in step. */
  history: HistoryFile;
  /** The concept cards this learner has already been shown, by intro id. Passed
   * in from the session page so the walk and the HUD's "N of M" are derived from
   * the identical inputs and cannot disagree about how many steps there are. */
  shownIntros?: ReadonlySet<string>;
  /** Which of these you've met before — shown before and forgotten, rather than
   * never met. Presentation only, exactly as the tile wall used it. */
  familiar: (f: FactId) => boolean;
  /** Which item is showing. Lifted to the session page so the top HUD bar can
   * read the position ("N of M") and the frozen footer can drive Back/Next
   * without the walk owning a second copy of it. */
  step: number;
}) {
  // The walk's units. A step is usually a character; where the curriculum
  // changes shape it is a teaching card instead (src/lib/lesson-steps.ts). A
  // lesson with no card produces exactly the item list this used to hold, so
  // everything below — Back/Next, the last-card "Quiz me", the HUD's count —
  // works unchanged for the phases that have none.
  const steps = useMemo(
    () => lessonSteps(facts, history, shownIntros),
    [facts, history, shownIntros],
  );
  const at = Math.min(step, steps.length - 1);
  const current = steps[at];
  // "Seen before" is a fact about material you've met. A concept card is not
  // material you can have forgotten, so it never wears the badge.
  const familiarHere =
    current?.type === "item" ? current.item.facts.some(familiar) : false;

  if (!current) return null;

  return (
    <div className="mx-auto max-w-[920px] px-3 pt-2">
      {/* The quiet "seen before" note when the budget re-surfaced material you'd
          already met. Rendered ONLY when present — no reserved height — so a fresh
          step sits tight under the frozen bar instead of behind a standing gap.
          (The row of dots that used to live here duplicated the bar's "N of M".) */}
      {familiarHere ? (
        <div className="mb-2 flex items-center gap-3">
          <span className="rounded-full border border-border px-1.5 py-0.5 text-[9px] uppercase tracking-[0.08em] text-text-muted/80">
            seen before
          </span>
        </div>
      ) : null}

      {/* The item — glyph/picture, the kana hook, how it's written, readings
          (kanji), example words. NO card around it: the lesson is meant to read
          as one coherent page, not a page within a page, so the item sits
          directly on the session ground (the owner's note). Keyed on the entry
          so each step is a clean remount: the persisted-preference sections
          re-read their state and no open/closed disclosure leaks between
          glyphs. */}
      {/* FLAT SECTION SURFACES, exactly as on the Library entry page. The teach
          walk shows the SAME flat-aware section panels the entry page does
          (LessonPanel, WordSensePanel, VerbPairView, KeigoSetView, the intro
          panels, Card), and the owner wants them flat HERE too — border kept,
          the frosty fill dropped. Those panels flatten by WHERE they render, so
          wrapping the item content in the same provider the entry page uses
          (src/app/library/[...entry]/page.tsx) flattens them without threading a
          prop through every intermediary. Scoped to the item only: the config
          strip and step buttons below sit outside it and keep their own
          treatment. */}
      <div>
        <FlatSurfaceProvider>
          {current.type === "intro" ? (
            <PhaseIntroView key={current.key} intro={current.intro} />
          ) : current.type === "term" ? (
            <TermEntryView key={current.key} entry={current.entry} />
          ) : current.type === "conversion" ? (
            <ConversionCard key={current.key} row={current.row} />
          ) : (
            <TeachItemView key={current.key} item={current.item} />
          )}
        </FlatSurfaceProvider>
      </div>

      {/* Step controls live in the session frame's FROZEN FOOTER now, not here —
          Back and the forward button ("Next" → "Quiz me", plus the kana scope
          fork) hold a fixed screen position so you can page through a lesson
          without moving the mouse. The round's config shows there too, above the
          button, on the last card. See src/app/session/page.tsx. */}

      {/* The acknowledgement link — a licence obligation, not decoration. This
          screen shows dictionary data (readings, meanings, example words) AND
          KanjiVG stroke diagrams, so it is exactly the kind of screen from which
          the credits have to be reachable. See attribution-link.tsx. */}
      <AttributionLink />
    </div>
  );
}
