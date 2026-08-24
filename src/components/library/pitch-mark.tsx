// The pitch-accent mark: a reading drawn in the standard overline notation.
//
// A line sits over the morae the voice stays HIGH on, and turns down at the
// downstep — the same mark the NHK accent dictionary and OJAD print. It is DRAWN
// with borders, not written with colour, so it reads the same to someone who
// cannot tell the line's colour from the text's (the overline is a shape); the
// pattern is also spelled out in an aria-label for a screen reader. It is
// static, so prefers-reduced-motion has nothing to honour.
//
// The DISPLAY-ONLY rule lives above this component: the app shows pitch so a
// learner does not set a wrong habit that is very hard to unlearn, but never
// grades it. This only ever renders — a word with no verified pitch is given no
// `downstep` and this is not mounted at all.

import { pitchPattern, accentName } from "@/lib/pitch";

/**
 * A reading with its pitch-accent overline.
 *
 * `downstep` is the mora position of the drop (0 heiban, 1 atamadaka, n odaka /
 * nakadaka) — see src/lib/pitch.ts. The line runs over every high mora; on the
 * drop mora it also closes down the right-hand side, giving the ¬ that marks
 * where the voice falls. Heiban has an overline from the second mora to the end
 * and no closing fall, because the voice stays up into a following particle.
 *
 * `className` styles the reading text (size, colour) exactly as the plain
 * reading it replaces would have been; the overline inherits that colour via
 * `border-current`, so it never becomes a colour-only cue.
 *
 * `wordMoraCount` (SAK-142 round 2) marks how many morae from the START of
 * `reading` belong to the word actually being taught. Set it when `reading`
 * has been extended past the word with a follow-up mora purely so an odaka
 * word's drop has something to land on (see `PitchExampleRow.followUp` in
 * src/data/phase-intros.ts) — the trailing morae still take part in the
 * pattern (the overline must run through them to show the real drop) but
 * render in a visibly muted colour and are named separately in the
 * `aria-label`, so neither sight nor a screen reader mistakes the follow-up
 * for part of the word. Omitted (the common case) when `reading` already IS
 * the whole word.
 */
export function PitchReading({
  reading,
  downstep,
  className,
  wordMoraCount,
}: {
  reading: string;
  downstep: number;
  className?: string;
  wordMoraCount?: number;
}) {
  const morae = pitchPattern(reading, downstep);
  const hasFollowUp = wordMoraCount !== undefined && wordMoraCount < morae.length;
  const wordText = hasFollowUp
    ? morae
        .slice(0, wordMoraCount)
        .map((m) => m.text)
        .join("")
    : reading;
  const followUpText = hasFollowUp
    ? morae
        .slice(wordMoraCount)
        .map((m) => m.text)
        .join("")
    : "";
  return (
    <span
      className={className}
      // The reading, then the plain-language accent for anyone not seeing the
      // line. When a follow-up mora is present, name it separately so the
      // announcement doesn't imply it's part of the word.
      aria-label={
        hasFollowUp
          ? `${wordText} (+${followUpText} added to hear the drop), pitch accent: ${accentName(downstep)}`
          : `${reading}, pitch accent: ${accentName(downstep)}`
      }
    >
      <span aria-hidden="true" className="inline-flex">
        {morae.map((mora, i) => (
          <span
            key={i}
            className={[
              "inline-block leading-tight",
              mora.high ? "border-t border-current" : "",
              mora.drop ? "border-r border-current" : "",
              hasFollowUp && i >= wordMoraCount! ? "text-text-muted/70" : "",
            ]
              .filter(Boolean)
              .join(" ")}
          >
            {mora.text}
          </span>
        ))}
      </span>
    </span>
  );
}
