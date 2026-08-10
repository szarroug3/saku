// DEV preview for the meaning-model view components — the cohesive Library glyph
// page (GlyphView) and the lesson pronunciation card (TeachingUnitView), on the
// app's real theme + a frosty (blur-free) surface. Not shipped UI. Route: /dev/views

import { GlyphView } from "@/components/library/glyph-view";
import { TeachingUnitView } from "@/components/lesson/teaching-unit-view";
import { buildGlyphItem } from "@/lib/content/build-item";
import { orderedUnits } from "@/lib/content/teach-unit";

const LIBRARY_SAMPLES = ["人", "三", "主", "日", "耳"];
const LESSON_SAMPLE = ["人", "三", "日"];

export default function ViewsDevPage() {
  const lessonUnits = orderedUnits(LESSON_SAMPLE).slice(0, 5);
  return (
    <main className="mx-auto max-w-3xl px-5 py-10 text-text">
      <h1 className="text-2xl font-semibold">Meaning-model views</h1>

      <h2 className="mb-1 mt-9 text-base font-medium">
        Lesson &mdash; one pronunciation per card
      </h2>
      <p className="mb-4 text-sm text-text-muted">
        What a lesson teaches, one unit at a time, most-spoken first. A merged
        meaning shows its synonyms together.
      </p>
      <div className="flex flex-wrap gap-4">
        {lessonUnits.map((u, i) => (
          <div key={`${u.glyph}-${u.reading ?? i}`} className="w-[180px]">
            <TeachingUnitView unit={u} />
          </div>
        ))}
      </div>

      <h2 className="mb-1 mt-11 text-base font-medium">
        Library &mdash; the whole glyph on one page
      </h2>
      <p className="mb-4 text-sm text-text-muted">
        Every pronunciation the glyph teaches, with its deduped meanings, most
        spoken first &mdash; the cohesive view the lesson units are drawn from.
      </p>
      <div className="flex flex-col gap-4">
        {LIBRARY_SAMPLES.map((g) => {
          const item = buildGlyphItem(g);
          return item ? <GlyphView key={g} item={item} /> : null;
        })}
      </div>
    </main>
  );
}
