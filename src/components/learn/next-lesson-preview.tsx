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

/** The whole "Up next" card as a frosted-GLASS panel, so a stacked lesson reads as
 * a distinct pane rather than a slab of the page.
 *
 * NO BORDER. What sets one lesson off from the next is the shadowing, not an
 * outline: a top inset highlight glints the upper edge like a glow of light
 * catching glass, while inset shades down the left, right and bottom darken those
 * rims so the pane reads as a raised piece of glass. A deep lift shadow floats it,
 * and a real backdrop blur frosts it (one filter per card, a handful on screen). */
// NO BACKDROP BLUR (a filter root re-snapshotted every frame), and — the real
// scroll fix — each card is PROMOTED TO ITS OWN COMPOSITOR LAYER (translateZ(0)).
//
// The page mesh is a position:fixed layer that never repaints; the whole design
// relies on the scrolling content riding OVER it as a cached texture (see
// globals.css, the .kq-stage note). A card that is NOT promoted is re-rasterised
// every scroll frame — its translucent fill, its shadow and its tiles' gradients
// all repainting — which is the crawl. translateZ(0) rasterises the card once and
// then only TRANSLATES it on scroll (GPU), so the translucent look stays and the
// per-frame paint goes away. The edge glow is a 1px ring + inset highlight, both
// box-shadow (free), baked into that one texture.
// content-visibility:auto lets the browser SKIP layout+paint for any card not on
// screen (contain-intrinsic-size reserves ~its height so the scrollbar doesn't
// jump) — the "stop rendering content far down the page" lever. translateZ(0)
// keeps the on-screen cards on their own compositor layer so they translate
// rather than repaint.
const panel =
  "@container rounded-2xl px-5 py-5 [transform:translateZ(0)] " +
  "[content-visibility:auto] [contain-intrinsic-size:auto_260px] " +
  // An explicit translucent-black fill, NOT color-mix(var(--card) …): in kiri
  // --card is transparent, so a --card mix resolves to nothing (that is why the
  // card only showed while the glow was on). A flat rgba fill is a single alpha
  // blend per pixel — no blur — so it sets the card off from the mesh and keeps
  // the scroll smooth.
  "bg-[rgba(0,0,0,0.18)] " +
  // FAKE the glow with a hairline ring, not a blur. Any blurred shadow re-rasters
  // on the promoted layer every scroll frame (the jank); a 0-blur box-shadow ring
  // is just a 1px band of colour — free. Kept at a low alpha so it reads as a soft
  // lifted edge catching light, not an obvious outline. (box-shadow, not `border`,
  // so it adds no layout box and can't shift the content.)
  "shadow-[0_0_0_1px_rgba(255,255,255,0.08)]";

export function NextLessonPreview({
  lesson,
  positionLabel,
  why = WHY_TRACK.curriculum,
  onStart,
  onClaim,
  claimAll,
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
  /** A SECOND, wider claim beside the per-lesson one — "I already know all
   * hiragana", claiming the whole current script at once. Only the kana card
   * passes it (a returning learner skips a script in one click); omitted elsewhere. */
  claimAll?: { label: string; onClaim: () => void };
  /** Resume an in-progress run of THIS lesson. When present, the primary action is
   * "Continue session" in place of "Start" — the same mid-lesson resume Home has
   * always offered. Omit for a fresh lesson (or an inert preview). */
  onContinue?: () => void;
}) {
  const items = lessonItems(lesson);
  const facts = lesson.units.flatMap((u) => u.facts);
  return (
    // data-learn-card is the stable hook the e2e suite finds a lesson card by —
    // the styling classes (once backdrop-blur-xl) are not a contract.
    <div className={panel} data-learn-card>
      <Lbl>Up next{positionLabel ? ` · ${positionLabel}` : ""}</Lbl>

      {/* TWO COLUMNS ON A WIDE PANE. A lesson is a few fixed-size tiles and three
          controls — narrow content in a wide card, which left everything shoved
          left. So the interactive column (tiles + the routes in) sits on the left,
          capped to the tile row's width so the buttons stay UNDER the tiles rather
          than spreading across the whole pane, and the one-line reason fills the
          space to its right. The split is a CONTAINER query on the pane's own width
          (not the viewport), so it only goes two-column when the CARD is actually
          wide enough — a narrow host (a dev-gallery slot, a phone) stacks instead
          of forcing the reason into an overflowing sliver. */}
      <div className="mt-4 flex flex-col gap-x-10 gap-y-4 @4xl:flex-row @4xl:items-start">
        {/* Left: the tiles and the routes in, capped to the tile row (five 104px
            squares = 568px) so the controls sit directly beneath them. */}
        <div className="w-full max-w-[568px] @4xl:shrink-0">
          <div className="flex flex-wrap gap-3">
            {items.map((item) => (
              <ItemPreview key={String(item.entry)} item={item} />
            ))}
          </div>

          <div className="mt-5 flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <Btn onClick={onClaim && (() => onClaim(facts))}>
                I already know {items.length === 1 ? "this" : `these ${items.length}`}
              </Btn>
              {claimAll ? (
                <Btn onClick={claimAll.onClaim}>I already know {claimAll.label}</Btn>
              ) : null}
            </div>
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
        </div>

        {/* Right: the one-line reason, filling the space beside the tiles. Just the
            lede — no "Why?" disclosure, no folded paragraphs — set at the same size
            as the rest. Given the tile row's height (104px) and centered within it,
            so the text sits on the tiles' centre line rather than the taller
            tiles-plus-buttons column. */}
        <p className="min-w-0 max-w-prose text-[13px] leading-relaxed text-text-muted @4xl:flex @4xl:h-[104px] @4xl:flex-1 @4xl:items-center">
          <span>
            {why.lede.strong}
            {why.lede.rest ? ` ${why.lede.rest}` : ""}
          </span>
        </p>
      </div>
    </div>
  );
}
