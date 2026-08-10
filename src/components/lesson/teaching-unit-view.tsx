// TeachingUnitView — the lesson-page unit: ONE pronunciation of a glyph and the
// meaning(s) read that way. This is what a lesson teaches on a page; the same
// unit the scheduler chose. Meanings are already deduped synonyms (e.g. 主/ぬし →
// "lord, head (of a household, etc.)"), so a merged meaning shows as one row.

import type { TeachingUnit } from "@/lib/content/teach-unit";

export function TeachingUnitView({ unit }: { unit: TeachingUnit }) {
  return (
    <section className="tu">
      <div className="tu__glyph" lang="ja">
        {unit.glyph}
      </div>
      {unit.reading ? (
        <div className="tu__reading" lang="ja">
          {unit.reading}
        </div>
      ) : (
        <div className="tu__reading tu__reading--none">meaning only</div>
      )}
      <ul className="tu__meanings">
        {unit.meanings.map((m) => (
          <li key={m.id} className="tu__meaning">
            {m.label}
          </li>
        ))}
      </ul>
    </section>
  );
}
