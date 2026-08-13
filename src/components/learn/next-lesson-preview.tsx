// Learn "Up next" card — the next lesson, on the unified content model.
//
// EDITORIAL / BOXLESS layout. No panel, no fill, no rounded rectangle: the card
// sits straight on the page mesh and builds hierarchy from type alone, like a
// magazine section head — a small accent eyebrow (the position line) over a
// larger track title, the "why" as a subhead, then the lesson's tiles and the
// routes in. Stacked tracks are set apart by a single flat border-top hairline
// (and whitespace), never a box.
//
// PERFORMANCE RULE — the whole reason for this layout. The Learn page scrolls
// over a position:fixed mesh that must stay a cached compositor layer. ANY
// blurred box-shadow / glow on these scrolling cards — even a 0-blur `0 0 0 1px`
// ring — re-rasterises the card every scroll frame and reintroduces the crawl.
// So there is NO box-shadow anywhere here: separation comes ONLY from the flat
// `border-top` hairline and whitespace. There is also no translucent fill and no
// translateZ(0) promotion — with nothing to cache, a compositor layer would just
// be a needless extra surface. The one free win kept is content-visibility:auto
// (with contain-intrinsic-size reserving ~the card's height), which lets the
// browser skip layout+paint for cards scrolled off-screen in a long feed.
//
// Each tile IS the shared unit card, `ItemPreview`, reused verbatim (liked as-is,
// never restyled). Handlers are optional so a dev preview can render it inert;
// when present they carry the real Start / Quiz / claim behaviour.

import { Btn } from "@/components/ui";
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

// The hairline that separates one stacked track from the next — a REAL CSS border
// in a low-alpha white, not a shadow. `first:` drops it on the top track.
const RULE = "border-t border-white/[0.08] first:border-t-0";

// content-visibility:auto lets the browser skip layout+paint for any card not on
// screen (contain-intrinsic-size reserves ~its height so the scrollbar doesn't
// jump). Free, and it helps a long feed — no fill, no shadow, no layer promotion.
const CARD = `${RULE} pt-7 first:pt-0 [content-visibility:auto] [contain-intrinsic-size:auto_260px]`;

export function NextLessonPreview({
  lesson,
  title = "Up next",
  positionLabel,
  why = WHY_TRACK.curriculum,
  onStart,
  onClaim,
  claimAll,
  onContinue,
}: {
  /** The next lesson, in the new content model. */
  lesson: UnitLesson;
  /** The editorial heading — the track's title ("Kana", "Vocabulary"). Defaults
   * to "Up next" for an inert preview that has no track to name. */
  title?: string;
  /** Optional "Radical 1 of 90 · Kanji 2–3 of 2,136" position line, shown as the
   * accent eyebrow. Omitted until the content model exposes a track position. */
  positionLabel?: string;
  /** The "why this track, why now" pull shown under the heading. Defaults to the
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
    // the styling classes are not a contract.
    <div className={CARD} data-learn-card>
      {positionLabel ? (
        <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-accent/80">
          {positionLabel}
        </p>
      ) : null}
      <h3 className="mt-1 text-[22px] font-semibold leading-tight text-text">{title}</h3>
      <p className="mt-1.5 max-w-prose text-[13px] leading-relaxed text-text-muted">
        {why.lede.strong}
        {why.lede.rest ? ` ${why.lede.rest}` : ""}
      </p>

      <div className="mt-4">
        <div className="flex flex-wrap gap-3">
          {items.map((item) => (
            <ItemPreview key={String(item.entry)} item={item} />
          ))}
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <Btn onClick={onClaim && (() => onClaim(facts))}>
          I already know {items.length === 1 ? "this" : `these ${items.length}`}
        </Btn>
        {claimAll ? (
          <Btn onClick={claimAll.onClaim}>I already know {claimAll.label}</Btn>
        ) : null}
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
  );
}
