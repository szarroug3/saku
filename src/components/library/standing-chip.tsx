"use client";

// The one adjective a row is allowed to wear. See src/lib/library/standing.ts
// for what each word may mean; this file only paints it.

import { STANDING_LABEL, STANDING_TONE, type Standing } from "@/lib/library/standing";

const TONE_CLASS: Record<"good" | "warn" | "bad" | "mute", string> = {
  good: "border-success text-success",
  warn: "border-warning text-warning",
  bad: "border-danger text-danger",
  mute: "border-border text-text-muted",
};

/** `rounded-full` + `border` IS the Chip recipe in globals.css — it is the one
 * accidental-pair the kit means on purpose, and this is a chip, so it opts IN
 * rather than around it. `bg-card` is deliberately absent: the fill is what the
 * tone owns here, and a chip in a table row wants the row's ground, not a
 * second card floating on it. */
export function StandingChip({ standing }: { standing: Standing }) {
  return (
    <span
      className={`inline-block whitespace-nowrap rounded-full border px-2 py-0.5 text-[11px] ${
        TONE_CLASS[STANDING_TONE[standing]]
      }`}
    >
      {STANDING_LABEL[standing]}
    </span>
  );
}
