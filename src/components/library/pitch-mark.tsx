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
 */
export function PitchReading({
  reading,
  downstep,
  className,
}: {
  reading: string;
  downstep: number;
  className?: string;
}) {
  const morae = pitchPattern(reading, downstep);
  return (
    <span
      className={className}
      // The reading, then the plain-language accent for anyone not seeing the line.
      aria-label={`${reading}, pitch accent: ${accentName(downstep)}`}
    >
      <span aria-hidden="true" className="inline-flex">
        {morae.map((mora, i) => (
          <span
            key={i}
            className={[
              "inline-block leading-tight",
              mora.high ? "border-t border-current" : "",
              mora.drop ? "border-r border-current" : "",
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
