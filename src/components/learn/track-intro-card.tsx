// Track intro, "card 0": a one-time teaser shown in a track's Home/Learn slot
// BEFORE its first NextLessonPreview ever appears (SAK-28).
//
// NOT THE SAME CARD AS src/data/track-intros.ts's TRACK_INTROS. That mechanism
// is a longer, three-job explainer ("what this is / how it helps / why now")
// that fires INSIDE the lesson/teach walk itself (see src/lib/spine-intros.ts
// and src/lib/lesson-steps.ts); it is untouched by this file. This card is
// shorter, fires on Home/Learn itself, and answers one question only: "why
// this track, why now", the copy Sam approved for card 0 (SAK-28, sign-off
// 2026-08-19).
//
// GATING LIVES IN THE CALLER. This component is a dumb, stateless presenter;
// home-feed.tsx decides WHETHER a track is "opening" (via
// startedLearnTracks in src/lib/content/learn-index.ts) and swaps this in for
// NextLessonPreview at that track's slot. Once "Start track" is pressed, the
// caller's `onStart` is the SAME handler NextLessonPreview's own "Start" button
// calls (home-feed.tsx's startTrack): there is no second start path, and no
// flag on disk marks this card "shown". The gate is startedLearnTracks reading
// history, so once the track has a single met fact this card simply stops
// being the thing rendered in that slot.
//
// EDITORIAL / BOXLESS layout, matching NextLessonPreview verbatim: no panel, no
// fill, no shadow (see that file's PERFORMANCE RULE comment for why: the scroll
// mesh crawls under any blurred box-shadow). Separation comes only from the flat
// border-top hairline and whitespace, same as every other stacked Home card.

import { Btn } from "@/components/ui";

// Mirrors NextLessonPreview's CARD_FLUSH exactly (no hairline of its own; the
// grid's own `gap` separates cards, same as NextLessonPreview gets when
// home-feed passes it `separated={false}`). The two cards share one slot in
// the same grid, so they must separate identically whichever one renders there.
const CV = "[content-visibility:auto] [contain-intrinsic-size:auto_160px]";
const CARD_FLUSH = CV;

export function TrackIntroCard({
  title,
  description,
  onStart,
}: {
  /** The track's proper name, same heading NextLessonPreview would show for
   * this track ("Kana", "Vocabulary", …). */
  title: string;
  /** Sam's approved card-0 copy for this track, verbatim. */
  description: string;
  /** Start the track's first lesson: teach then drill, the same destination
   * the ordinary "Start" button reaches. Omit for an inert preview. */
  onStart?: () => void;
}) {
  return (
    <div className={CARD_FLUSH} data-learn-card data-track-intro>
      <h3 className="text-[22px] font-semibold leading-tight text-text">
        {title}
      </h3>
      <p className="mt-1.5 max-w-prose text-[13px] leading-relaxed text-text-muted">
        {description}
      </p>
      <div className="mt-4">
        <Btn go onClick={onStart}>
          Start track
        </Btn>
      </div>
    </div>
  );
}
