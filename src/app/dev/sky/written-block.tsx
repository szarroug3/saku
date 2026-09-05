"use client";

// "How it's written" for the Sky's lesson card, from the app's own stroke
// order: the same StrokeOrder diagram and the same "why" the current lesson
// shows. Dev-side, because it reaches into the app; the route hands it to
// the card as a slot, so nothing in src/sky imports it.

import { StrokeOrder } from "@/components/lesson/stroke-order";
import { WhyDisclosure } from "@/components/lesson/why";
import { WHY_STROKE_ORDER, WHY_WRITING_EARLY } from "@/data/why";
import { useGlyphStrokes } from "@/lib/use-glyph-strokes";

export function WrittenBlock({ glyph }: { glyph: string }) {
  const strokes = useGlyphStrokes(glyph);
  return (
    <div className="flex flex-col gap-3">
      {/* the disclosure carries its own line, "We don't recommend learning to write early. Why?" */}
      <div className="text-[13.5px] text-sky-ink"><WhyDisclosure why={WHY_WRITING_EARLY} /></div>
      {strokes.status === "loading" ? (
        <p className="text-[13px] text-sky-muted">Loading stroke order…</p>
      ) : strokes.data ? (
        <>
          <StrokeOrder data={strokes.data} />
          <WhyDisclosure why={WHY_STROKE_ORDER} />
        </>
      ) : (
        <p className="text-[13px] text-sky-muted">No stroke order for this one yet.</p>
      )}
    </div>
  );
}
