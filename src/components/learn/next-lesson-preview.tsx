// REDESIGNED Learn "Up next" card — the next lesson, on the NEW content model.
//
// The redesign target, written against the unified model (a UnitLesson of
// TeachingUnits) rather than the old CurriculumLesson. A NEW component, kept out
// of the shipped tree until the app moves onto the content model — then it drops
// in where next-curriculum-lesson.tsx is now.
//
// Each tile IS the shared unit card, `ItemPreview` — the exact component the Learn
// "next-lesson preview" gallery shows, so the accented type line and frosted body
// are reused verbatim, not re-styled. The card arranges the lesson's items (its
// units, deduped to items in teach order) as a row of those cards, over a lighter
// frosted panel so the item cards lift, plus the three routes in (Btn) and the
// one-climb note (WhyDisclosure). Handlers are optional so the dev gallery can
// render it inert.

import { Btn, Lbl } from "@/components/ui";
import { ItemPreview } from "@/components/learn/item-preview";
import { WhyDisclosure } from "@/components/lesson/why";
import { WHY_TRACK } from "@/data/why";
import type { Why } from "@/data/why";
import type { ContentItem } from "@/lib/content/item";
import type { UnitLesson } from "@/lib/content/teach-unit";
import type { FactId } from "@/types";

/** The distinct items of a lesson, in teach order — a glyph shown more than once
 * (a word across two pronunciation units) is one tile, at its first appearance. */
function lessonItems(lesson: UnitLesson): ContentItem[] {
  const seen = new Set<string>();
  const items: ContentItem[] = [];
  for (const unit of lesson.units) {
    const key = String(unit.item.entry);
    if (seen.has(key)) continue;
    seen.add(key);
    items.push(unit.item);
  }
  return items;
}

/** A lighter frosted panel than the item cards, so the ItemPreview tiles (card at
 * 72%) lift off it. Same soft shadow, no backdrop-filter. */
const panel =
  "rounded-2xl border border-border/70 p-5 " +
  "bg-[color-mix(in_srgb,var(--card)_46%,transparent)] " +
  "shadow-[0_1px_3px_rgba(0,0,0,0.05),0_22px_48px_-28px_rgba(0,0,0,0.40)]";

export function NextLessonPreview({
  lesson,
  positionLabel,
  why = WHY_TRACK.curriculum,
  onStart,
  onClaim,
  onContinue,
}: {
  /** The next lesson, in the new content model. */
  lesson: UnitLesson;
  /** Optional "Radical 1 of 90 · Kanji 2–3 of 2,136" position line. Omitted until
   * the content model exposes a track position. */
  positionLabel?: string;
  /** The "why this track, why now" pull shown under the buttons. Defaults to the
   * one-climb curriculum reason; each track passes its own (WHY_TRACK.keigo, …). */
  why?: Why;
  /** Start the lesson (teach then drill); `teach:false` drills now. Omit for an
   * inert preview. */
  onStart?: (facts: FactId[], opts?: { teach?: boolean }) => void;
  /** "I already know these", over the lesson's facts. Omit for an inert preview. */
  onClaim?: (facts: FactId[]) => void;
  /** Resume an in-progress run of THIS lesson. When present, the primary action is
   * "Continue session" in place of "Start" — the same mid-lesson resume Home has
   * always offered. Omit for a fresh lesson (or an inert preview). */
  onContinue?: () => void;
}) {
  const items = lessonItems(lesson);
  const facts = lesson.units.flatMap((u) => u.facts);
  return (
    <div className={panel}>
      <Lbl>Up next{positionLabel ? ` · ${positionLabel}` : ""}</Lbl>

      {/* Five to a row — a lesson is ~5–7 items, so the sixth and seventh wrap to
          a second row at the same tile size. */}
      <div className="mt-4 grid grid-cols-5 gap-3">
        {items.map((item) => (
          <ItemPreview key={String(item.entry)} item={item} />
        ))}
      </div>

      <div className="mt-5 flex flex-wrap items-center justify-between gap-2">
        <Btn onClick={onClaim && (() => onClaim(facts))}>
          I already know {items.length === 1 ? "this" : `these ${items.length}`}
        </Btn>
        <div className="flex flex-wrap items-center gap-1.5">
          <Btn onClick={onStart && (() => onStart(facts, { teach: false }))}>Quiz me</Btn>
          {onContinue ? (
            <Btn go onClick={onContinue}>
              Continue session
            </Btn>
          ) : (
            <Btn go onClick={onStart && (() => onStart(facts))}>
              Start
            </Btn>
          )}
        </div>
      </div>

      <WhyDisclosure why={why} />
    </div>
  );
}
