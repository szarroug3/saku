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
// NextLessonPreview at that track's slot. "Start track" does NOT launch a
// lesson (Sam, Changes Requested on the first pass of this ticket: hitting it
// used to call the same handler as NextLessonPreview's own "Start" button and
// jump straight into a session, which is wrong). It only dismisses the
// teaser for this page load, so home-feed re-renders the track's normal
// NextLessonPreview in this same slot and the learner picks Start / Quiz me /
// I already know from there, same as any track already underway. That
// dismissal is local render state in home-feed.tsx, not history: the gate
// that actually and permanently marks a track "started" stays
// startedLearnTracks reading history, so once the track has a single met fact
// this card stops being the thing rendered in that slot regardless of
// whether the teaser was ever dismissed.
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
  /** Dismiss the teaser so the caller reveals the track's normal
   * NextLessonPreview in this slot. Does NOT start a lesson itself. Omit for
   * an inert preview. */
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
