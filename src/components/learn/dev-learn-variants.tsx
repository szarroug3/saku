// DEV-ONLY design variants of the Learn "Up next" card — a comparison gallery for
// the author to pick a direction. NOT shipped UI, and deliberately kept OUT of the
// shipped tree: the real card is `NextLessonPreview`, unchanged. Route: /dev/learn.
//
// WHY THESE EXIST. The shipped card is a full-width rounded translucent-dark slab,
// repeated identically down the page, with a one-line "why" floating dead-centre in
// a large empty right half — it reads as generic packaging and covers the mesh's
// colour. These four variants each move away from that: no slab, the mesh showing
// through, the "why" pulled back to the left.
//
// THE PERFORMANCE RULE THEY ALL HONOUR. The Learn page scrolls over a position:fixed
// mesh that must stay a cached compositor layer. ANY blurred box-shadow / glow on
// these big scrolling cards (even a 0-blur ring) reintroduces scroll jank. So the
// only edge treatments used here are FREE ones: flat background fills
// (background-color) and real CSS borders. No box-shadow anywhere on the big cards.
// The tiles are the shared `ItemPreview`, reused verbatim — liked as-is, never
// restyled.

import { Btn, Lbl } from "@/components/ui";
import { ItemPreview } from "@/components/learn/item-preview";
import type { Why } from "@/data/why";
import type { ContentItem } from "@/lib/content/item";
import type { UnitLesson } from "@/lib/content/teach-unit";

/** The distinct items of a lesson, in teach order — a glyph shown more than once is
 * one tile, at its first appearance. Mirrors `lessonItems` in next-lesson-preview. */
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

export interface VariantProps {
  lesson: UnitLesson;
  /** "Vocab 7–13 of 9,140" — the position line, shown in the eyebrow. */
  positionLabel: string;
  /** The one-line "why this track" pull. */
  why: Why;
  /** A larger track title ("Vocabulary", "Keigo") — used by the editorial variant. */
  title: string;
}

/** The three routes in, INERT (no onClick) — this is a visual gallery. Reuses the
 * shipped Btn so the pills match the app exactly. */
function Actions({ count }: { count: number }) {
  return (
    <>
      <Btn>I already know {count === 1 ? "this" : `these ${count}`}</Btn>
      <Btn>Quiz me</Btn>
      <Btn go>Start</Btn>
    </>
  );
}

/** The lesson's tile row — the shared ItemPreview, unchanged. */
function Tiles({ items }: { items: ContentItem[] }) {
  return (
    <div className="flex flex-wrap gap-3">
      {items.map((item) => (
        <ItemPreview key={String(item.entry)} item={item} />
      ))}
    </div>
  );
}

/** The one-line reason as a paragraph, at `className`. */
function WhyLine({ why, className }: { why: Why; className: string }) {
  return (
    <p className={className}>
      {why.lede.strong}
      {why.lede.rest ? ` ${why.lede.rest}` : ""}
    </p>
  );
}

// The hairline that separates one stacked track from the next — a REAL CSS border
// in a low-alpha white, not a shadow. `first:` drops it on the top track.
const RULE = "border-t border-white/[0.08] first:border-t-0";

/**
 * OPTION A — BOXLESS. No panel at all: eyebrow, tiles, actions, why, straight on
 * the mesh. Tracks separated by a hairline border-top. The why sits at the left,
 * under the actions, near the eyebrow — never floating in a right-side void.
 */
export function OptionA({ lesson, positionLabel, why }: VariantProps) {
  const items = lessonItems(lesson);
  return (
    <div className={`${RULE} pt-6 first:pt-0`}>
      <Lbl>Up next · {positionLabel}</Lbl>
      <div className="mt-3">
        <Tiles items={items} />
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <Actions count={items.length} />
      </div>
      <WhyLine
        why={why}
        className="mt-3.5 max-w-prose text-[13px] leading-relaxed text-text-muted"
      />
    </div>
  );
}

/**
 * OPTION B — EDITORIAL HEADINGS. No box; hierarchy from type. A small accent
 * eyebrow (the position) over a larger track title, the why as a subhead, then the
 * tiles and actions — a magazine section head.
 */
export function OptionB({ lesson, positionLabel, why, title }: VariantProps) {
  const items = lessonItems(lesson);
  return (
    <div className={`${RULE} pt-7 first:pt-0`}>
      <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-accent/80">
        {positionLabel}
      </p>
      <h3 className="mt-1 text-[22px] font-semibold leading-tight text-text">{title}</h3>
      <WhyLine
        why={why}
        className="mt-1.5 max-w-prose text-[13px] leading-relaxed text-text-muted"
      />
      <div className="mt-4">
        <Tiles items={items} />
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <Actions count={items.length} />
      </div>
    </div>
  );
}

/**
 * OPTION C — TWO-COLUMN, BOXLESS. Roughly today's left(tiles+actions)/right(why)
 * split, but with NO box — straight on the mesh — and the why pulled UP to align
 * with the eyebrow/tiles rather than centring in the empty space beside a lone
 * tile. The split is a container query on the block's own width (@container), so a
 * narrow host stacks instead of forcing the why into a sliver.
 */
export function OptionC({ lesson, positionLabel, why }: VariantProps) {
  const items = lessonItems(lesson);
  return (
    <div className={`${RULE} @container pt-6 first:pt-0`}>
      <Lbl>Up next · {positionLabel}</Lbl>
      <div className="mt-3 flex flex-col gap-x-10 gap-y-4 @4xl:flex-row @4xl:items-start">
        {/* Left: tiles + actions, capped to the tile row so the buttons sit under
            the tiles rather than spreading across the block. */}
        <div className="w-full max-w-[568px] @4xl:shrink-0">
          <Tiles items={items} />
          <div className="mt-5 flex flex-wrap items-center gap-2">
            <Actions count={items.length} />
          </div>
        </div>
        {/* Right: the why, TOP-aligned (no vertical centring) so it rides beside the
            tiles at the eyebrow's height, not in the middle of the void. */}
        <WhyLine
          why={why}
          className="min-w-0 max-w-prose text-[13px] leading-relaxed text-text-muted @4xl:flex-1"
        />
      </div>
    </div>
  );
}

/**
 * OPTION D — ACCENT RAIL. No full box: a single left vertical accent rail beside
 * the content, with a very subtle flat translucent fill (rgba, no shadow) and the
 * content indented from the rail. Reads as "a marked section" without being a
 * rounded rectangle.
 */
export function OptionD({ lesson, positionLabel, why }: VariantProps) {
  const items = lessonItems(lesson);
  return (
    <div className={`${RULE} pt-6 first:pt-0`}>
      <div className="flex gap-4">
        {/* The rail — a flat accent fill, a few px wide. No shadow. */}
        <div className="w-[3px] shrink-0 rounded-full bg-accent/70" aria-hidden />
        {/* Content, indented from the rail, over a barely-there flat fill. */}
        <div className="min-w-0 flex-1 rounded-r-lg bg-[rgba(0,0,0,0.12)] px-4 py-3.5">
          <Lbl>Up next · {positionLabel}</Lbl>
          <div className="mt-3">
            <Tiles items={items} />
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <Actions count={items.length} />
          </div>
          <WhyLine
            why={why}
            className="mt-3.5 max-w-prose text-[13px] leading-relaxed text-text-muted"
          />
        </div>
      </div>
    </div>
  );
}
