// REDESIGNED Learn "Up next" card — the curriculum lesson preview, frosted.
//
// Same information as next-curriculum-lesson.tsx (the shipped card): the position
// label, the lesson's item tiles with their type line, and the three routes in
// (already-know / quiz / start). What changes is the SURFACE. The shipped card is
// a flat bordered panel with flat bordered tiles; this gives the card and each
// tile a translucent frosted body and a soft drop shadow — the frost look without
// a backdrop-filter (no blur, so no paint cost). Tiles sit slightly more opaque
// than the card so they lift off it.
//
// Presentational: it renders a CurriculumLesson. Handlers are optional so the dev
// gallery can show it inert.

import type { CSSProperties } from "react";

import { frostCard } from "@/components/ui/frost";
import { characterRoleTitle } from "@/lib/character-role";
import { compositePositionLabel } from "@/lib/lesson-position";
import type { CurriculumLesson, CurriculumLessonItem } from "@/lib/curriculum-lesson";

const TILE_GLYPH_MIN_PX = 12;

/** Simple words (a lone word whose kanji are all pre-known) lead, then the rest in
 * curriculum order — the same tile ordering the shipped card uses. */
function orderedCards(lesson: CurriculumLesson): CurriculumLessonItem[] {
  const built = new Set(
    lesson.cards
      .filter((c) => c.roles.includes("kanji") || c.roles.includes("radical"))
      .map((c) => c.glyph),
  );
  const isSimple = (c: CurriculumLessonItem) =>
    c.roles.length === 1 && c.roles[0] === "word" && ![...c.glyph].some((ch) => built.has(ch));
  return [...lesson.cards.filter(isSimple), ...lesson.cards.filter((c) => !isSimple(c))];
}

function FrostTile({ glyph, type }: { glyph: string; type: string }) {
  return (
    <div className="min-w-[96px] flex-1 rounded-xl border border-border/60 bg-[color-mix(in_srgb,var(--card)_88%,transparent)] px-2 pb-3 pt-4 text-center shadow-[inset_0_1px_0_0_rgba(255,255,255,0.05),0_1px_2px_rgba(0,0,0,0.06),0_14px_28px_-22px_rgba(0,0,0,0.55)] [container-type:inline-size]">
      <span className="flex h-[46px] items-center justify-center">
        <span
          className="block whitespace-nowrap font-kana font-extralight leading-none text-text"
          lang="ja"
          style={
            {
              "--chars": [...glyph].length,
              fontSize: `clamp(${TILE_GLYPH_MIN_PX}px, calc(90cqi / var(--chars)), 40px)`,
            } as CSSProperties
          }
        >
          {glyph}
        </span>
      </span>
      <span className="mt-1.5 block text-[10px] uppercase tracking-[0.05em] text-text-muted/80">
        {type}
      </span>
    </div>
  );
}

function GhostBtn({ children }: { children: React.ReactNode }) {
  return (
    <span className="cursor-default rounded-lg border border-border/70 bg-[color-mix(in_srgb,var(--card)_70%,transparent)] px-3.5 py-[7px] text-sm text-text">
      {children}
    </span>
  );
}

export function NextLessonPreview({ lesson }: { lesson: CurriculumLesson }) {
  const cards = orderedCards(lesson);
  return (
    <div className={frostCard}>
      <p className="text-[13px] font-semibold uppercase tracking-[0.06em] text-text-muted">
        Up next · {compositePositionLabel(lesson.position)}
      </p>

      <div className="mt-4 flex flex-wrap gap-2.5">
        {cards.map((card) => (
          <FrostTile key={card.glyph} glyph={card.glyph} type={characterRoleTitle(card.glyph) ?? "Word"} />
        ))}
      </div>

      <div className="mt-5 flex flex-wrap items-center justify-between gap-2">
        <GhostBtn>
          I already know {cards.length === 1 ? "this" : `these ${cards.length}`}
        </GhostBtn>
        <div className="flex flex-wrap items-center gap-1.5">
          <GhostBtn>Quiz me</GhostBtn>
          <span className="cursor-default rounded-lg border border-transparent bg-text px-3.5 py-[7px] text-sm font-medium text-bg">
            Start
          </span>
        </div>
      </div>

      <div className="mt-4 border-t border-border/50 pt-3.5 text-[13px] leading-relaxed text-text-muted">
        <span className="font-medium text-text">
          Radicals, kanji and words are one climb, so they arrive in one order.
        </span>{" "}
        Each lesson teaches whatever comes next, and nothing arrives before the pieces it is built
        from. <span className="text-accent">Why?</span>
      </div>
    </div>
  );
}
