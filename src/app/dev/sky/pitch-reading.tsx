"use client";

// A word's reading with its pitch drawn over it, the app's own PitchReading,
// wrapped as a client component so the route can hand it to the Sky's
// lesson card the way it hands in the hear button.

import { PitchReading } from "@/components/library/pitch-mark";

export function PitchMark({ reading, downstep, className = "" }: { reading: string; downstep: number; className?: string }) {
  // the marks are one-pixel borders in the reading's own colour; on the
  // wash they need some weight to read, so that is restyled from outside
  return <PitchReading reading={reading} downstep={downstep} className={`${className} [&_span.border-t]:border-t-2 [&_span.border-r]:border-r-2`} />;
}
