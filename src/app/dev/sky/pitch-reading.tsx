"use client";

// A word's reading with its pitch drawn over it, the app's own PitchReading,
// wrapped as a client component so the route can hand it to the Sky's
// lesson card the way it hands in the hear button.

import { PitchReading } from "@/components/library/pitch-mark";

export function PitchMark({ reading, downstep, className }: { reading: string; downstep: number; className?: string }) {
  return <PitchReading reading={reading} downstep={downstep} className={className} />;
}
