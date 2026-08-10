// DEV preview for the meaning-model view components: the cohesive Library glyph
// page (GlyphView) and the lesson pronunciation card (TeachingUnitView). Not
// shipped UI — a window to eyeball how the two view types render real data.
// Route: /dev/views

import { GlyphView } from "@/components/library/glyph-view";
import { TeachingUnitView } from "@/components/lesson/teaching-unit-view";
import { buildGlyphItem } from "@/lib/content/build-item";
import { orderedUnits } from "@/lib/content/teach-unit";

const LIBRARY_SAMPLES = ["人", "三", "主", "日", "耳"];
const LESSON_SAMPLE = ["人", "三", "日"];

export default function ViewsDevPage() {
  const lessonUnits = orderedUnits(LESSON_SAMPLE).slice(0, 5);
  return (
    <main className="page">
      <style>{CSS}</style>
      <h1>Meaning-model views</h1>

      <h2>Lesson — one pronunciation per card (`TeachingUnitView`)</h2>
      <p className="note">
        What a lesson teaches, one unit at a time, most-spoken first. A merged
        meaning shows its synonyms together.
      </p>
      <div className="lesson">
        {lessonUnits.map((u, i) => (
          <TeachingUnitView key={`${u.glyph}-${u.reading ?? i}`} unit={u} />
        ))}
      </div>

      <h2>Library — the whole glyph on one page (`GlyphView`)</h2>
      <p className="note">
        Every pronunciation the glyph teaches, with its deduped meanings, most
        spoken first — the cohesive view the lesson units are drawn from.
      </p>
      <div className="library">
        {LIBRARY_SAMPLES.map((g) => {
          const item = buildGlyphItem(g);
          return item ? <GlyphView key={g} item={item} /> : null;
        })}
      </div>
    </main>
  );
}

const CSS = `
.page { max-width: 900px; margin: 0 auto; padding: 2rem 1.25rem 4rem;
  font-family: system-ui, sans-serif; color: #1a1a1a; }
.page h1 { font-size: 1.6rem; margin: 0 0 .25rem; }
.page h2 { font-size: 1.05rem; margin: 2.25rem 0 .25rem; }
.note { color: #6b6b6b; margin: 0 0 1rem; font-size: .9rem; }

.lesson { display: flex; gap: 1rem; flex-wrap: wrap; }
.tu { flex: 1 1 160px; max-width: 200px; text-align: center;
  border: 1px solid #e5e2dc; border-radius: 12px; padding: 1.25rem .75rem;
  background: #fbfaf7; }
.tu__glyph { font-size: 3.25rem; line-height: 1; }
.tu__reading { margin-top: .5rem; font-size: 1.15rem; color: #b1500f; }
.tu__reading--none { color: #a2a2a2; font-size: .85rem; font-style: italic; }
.tu__meanings { list-style: none; margin: .6rem 0 0; padding: 0; }
.tu__meaning { font-size: .9rem; color: #333; }

.library { display: flex; flex-direction: column; gap: 1.25rem; }
.glyph { border: 1px solid #e5e2dc; border-radius: 12px; overflow: hidden;
  background: #fff; }
.glyph__head { display: flex; align-items: center; gap: 1rem;
  padding: .9rem 1.1rem; background: #f6f4ef; border-bottom: 1px solid #eceae3; }
.glyph__char { font-size: 2.5rem; line-height: 1; }
.glyph__roles { color: #8a7f6a; font-size: .8rem; text-transform: lowercase;
  letter-spacing: .04em; }
.glyph__units { width: 100%; border-collapse: collapse; font-size: .92rem; }
.glyph__units th { text-align: left; padding: .5rem 1.1rem; color: #9a9a9a;
  font-weight: 500; font-size: .78rem; border-bottom: 1px solid #eceae3; }
.glyph__units td { padding: .5rem 1.1rem; border-bottom: 1px solid #f3f1ea; }
.glyph__reading { color: #b1500f; font-size: 1.05rem; }
.glyph__freq { text-align: right; color: #9a9a9a; font-variant-numeric: tabular-nums; }

@media (prefers-color-scheme: dark) {
  .page { color: #ececec; }
  .note, .glyph__roles { color: #9a9a9a; }
  .tu { background: #1c1c1e; border-color: #333; }
  .tu__meaning { color: #cfcfcf; }
  .glyph { background: #161618; border-color: #333; }
  .glyph__head { background: #202022; border-color: #2c2c2e; }
  .glyph__units th { border-color: #2c2c2e; }
  .glyph__units td { border-color: #262628; }
  .tu__reading, .glyph__reading { color: #e2905a; }
}
`;
