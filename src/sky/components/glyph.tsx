// A glyph, drawn the way the Sky draws a glyph (SAK-369): the display face,
// the Japanese font that suits the character, and its standing's color. Four
// places wrote the same four classes out, each with its own size, which is
// the only thing about them that ever differed.
//
// No standing means the ink: a star already picked for tonight is not "not
// seen" any more, and a card being taught in a lesson has no standing to
// show yet.

import { japaneseFont } from "@/sky/lib/japanese";
import { STANDING, type Standing } from "@/sky/lib/standing";

interface GlyphProps {
  glyph: string;
  /** Its standing's color. Omitted, the glyph is the ink. */
  standing?: Standing;
  /** How big, as a class: the one thing every caller says for itself. */
  size?: string;
  className?: string;
}

export function Glyph({ glyph, standing, size = "text-[17px]", className = "" }: GlyphProps) {
  const tone = standing ? STANDING[standing].text : "text-sky-ink";
  return <span className={`font-sky-display ${size} leading-none ${tone} ${japaneseFont(glyph)}${className ? ` ${className}` : ""}`}>{glyph}</span>;
}

interface GlyphNameProps {
  glyph: string;
  /** Its standing's color. Omitted, the glyph is the ink. */
  standing?: Standing;
  /** Whether the name has a column to fit in. A cut name is unreadable
   * without its tooltip, so the two travel together; `false` is the glyph
   * named inside a sentence, which takes the sentence's own size and hides
   * nothing. */
  cut?: boolean;
  className?: string;
}

/** A glyph as a NAME, not as the thing itself: the UI's own face rather than
 * the display one, in its standing's color, with the Japanese font the
 * character wants.
 *
 * `Glyph` above is the glyph you are looking at. This is the one in a row
 * beside its English, which Sessions and Practice wrote out in the same four
 * classes and the same tooltip, and the Atlas a third time in its "built
 * from" line. */
export function GlyphName({ glyph, standing, cut = true, className = "" }: GlyphNameProps) {
  const tone = standing ? STANDING[standing].text : "text-sky-ink";
  const face = cut ? "truncate text-[17px] font-medium leading-tight " : "";
  return <span className={`${face}${tone} ${japaneseFont(glyph)}${className ? ` ${className}` : ""}`} {...(cut ? { title: glyph } : {})}>{glyph}</span>;
}
