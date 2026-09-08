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

export interface GlyphProps {
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
