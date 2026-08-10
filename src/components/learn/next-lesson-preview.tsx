// REDESIGNED Learn "Up next" card — the next lesson, on the NEW content model.
//
// This is the redesign target, written against the unified model (a UnitLesson of
// TeachingUnits from the shared scheduler) rather than the old CurriculumLesson.
// It is a NEW component, kept out of the shipped tree until the app moves onto the
// content model — then it drops in where next-curriculum-lesson.tsx is now.
//
// It reuses the shared building blocks (PreviewTile, Btn, Lbl, WhyDisclosure,
// frostCard) so it is real and promotable, not a throwaway mock. The surface is
// the frost treatment: a translucent card body and frosted tiles with a soft drop
// shadow, no backdrop-filter (so no paint cost). A tile is one ITEM (its glyph and
// type); a lesson's units are deduped to their items, preserving teach order.
//
// Handlers are optional so the dev gallery can render it inert; wire them (and a
// position label, once the model exposes one) to ship it.

import { Btn, Lbl } from "@/components/ui";
import { PreviewTile } from "@/components/lesson/preview-tile";
import { WhyDisclosure } from "@/components/lesson/why";
import { frostCard } from "@/components/ui/frost";
import { WHY_TRACK } from "@/data/why";
import { entryHref } from "@/lib/library/href";
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

export function NextLessonPreview({
  lesson,
  positionLabel,
  onStart,
  onClaim,
}: {
  /** The next lesson, in the new content model. */
  lesson: UnitLesson;
  /** Optional "Radical 1 of 90 · Kanji 2–3 of 2,136" position line. Omitted until
   * the content model exposes a track position. */
  positionLabel?: string;
  /** Start the lesson (teach then drill); `teach:false` drills now. Omit for an
   * inert preview. */
  onStart?: (facts: FactId[], opts?: { teach?: boolean }) => void;
  /** "I already know these", over the lesson's facts. Omit for an inert preview. */
  onClaim?: (facts: FactId[]) => void;
}) {
  const items = lessonItems(lesson);
  const facts = lesson.units.flatMap((u) => u.facts);
  return (
    <div className={frostCard}>
      <Lbl>Up next{positionLabel ? ` · ${positionLabel}` : ""}</Lbl>

      <div className="mt-4 flex flex-wrap gap-2.5">
        {items.map((item) => (
          <PreviewTile
            key={String(item.entry)}
            glyph={item.glyph}
            type={item.typeLabel}
            href={entryHref(item.entry)}
            variant="frost"
          />
        ))}
      </div>

      <div className="mt-5 flex flex-wrap items-center justify-between gap-2">
        <Btn onClick={onClaim && (() => onClaim(facts))}>
          I already know {items.length === 1 ? "this" : `these ${items.length}`}
        </Btn>
        <div className="flex flex-wrap items-center gap-1.5">
          <Btn onClick={onStart && (() => onStart(facts, { teach: false }))}>Quiz me</Btn>
          <Btn go onClick={onStart && (() => onStart(facts))}>
            Start
          </Btn>
        </div>
      </div>

      <WhyDisclosure why={WHY_TRACK.curriculum} />
    </div>
  );
}
