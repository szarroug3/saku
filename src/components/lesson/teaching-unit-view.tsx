// TeachingUnitView — the lesson-page unit: ONE pronunciation of a glyph and the
// meaning(s) read that way. What a lesson teaches on a page — the same unit the
// scheduler chose. Merged synonyms show together (主/ぬし → "lord, head …").
// Frosty surface (see frost.ts), not a wireframe box.

import { frostCard } from "@/components/ui/frost";
import type { TeachingUnit } from "@/lib/content/teach-unit";

export function TeachingUnitView({ unit }: { unit: TeachingUnit }) {
  return (
    <div className={`${frostCard} text-center`}>
      <div className="font-kana text-[64px] leading-none text-text" lang="ja">
        {unit.glyph}
      </div>
      {unit.reading ? (
        <div className="mt-2 font-kana text-[20px] text-accent" lang="ja">
          {unit.reading}
        </div>
      ) : (
        <div className="mt-2 text-[13px] italic text-text-muted">meaning only</div>
      )}
      <ul className="mt-3 space-y-0.5">
        {unit.meanings.map((m) => (
          <li key={m.id} className="text-[15px] leading-snug text-text">
            {m.label}
          </li>
        ))}
      </ul>
    </div>
  );
}
