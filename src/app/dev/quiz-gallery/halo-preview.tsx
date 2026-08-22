// The real halo, lifted from drill-screen.tsx — shared by every card on this
// page that shows a glyph/sentence stage (QuizCard, PitchPreview, ...), so a
// gallery card's prompt display is never a hand-copied second implementation.

import { DrillHalo, GLYPH_PX } from "@/components/quiz/drill-halo";

/** The glyph/sentence stage, at rest — no timer, no animation, always the
 * card's first attempt. Same component, same geometry as a live drill. */
export function Halo({
  glyph,
  jp,
  listen,
  sentenceFrame,
  context,
  body,
}: {
  glyph: string;
  jp: boolean;
  listen?: boolean;
  sentenceFrame?: string;
  context?: React.ReactNode;
  body?: React.ReactNode;
}) {
  const size = jp ? GLYPH_PX : Math.round(GLYPH_PX * 0.6);
  return (
    <DrillHalo
      state="resting"
      cardKey="gallery"
      timerLeft={0}
      drainWindow={5}
      glyph={glyph}
      jp={jp}
      font=""
      fontSize={size}
      maxFontSize={size}
      crossFade={false}
      listen={listen}
      sentenceFrame={sentenceFrame}
      context={context}
      body={body}
      paused
    />
  );
}
