"use client";

// Accuracy per deck — "where am I strong, where am I weak", at a glance.
//
// Deliberately Home's deck-card language (glyph, ring in the corner, label,
// tabular subtitle, optional volume bar) over the same DECKS, so the two
// screens read as one app and a new set added to src/lib/decks.ts lands here
// for free. The one difference is that these DON'T start a quiz: on Home every
// card is a launcher and is therefore a <button>; here nothing starts, so a
// button would be a lie about what a click does. That's also why the ring is
// re-drawn rather than imported — DeckCard's is welded to its button.

import { VolumeBar } from "@/components/home/deck-card";
import { Lbl } from "@/components/ui";
import { accuracyFor, formatAccuracy, volumeFor } from "@/lib/accuracy";
import { DECKS } from "@/lib/decks";
import type { HistoryFile, QuizConfig } from "@/types";

/** Accuracy as a filled arc — the same conic read as Home's rings, and the
 * same dashed empty state for a deck with no history. */
function DeckRing({ pct }: { pct: number | null }) {
  if (pct === null) {
    return (
      <span
        title="not practised yet"
        className="block h-[34px] w-[34px] flex-none rounded-full border border-dashed border-border bg-panel"
      />
    );
  }
  return (
    <span
      className="grid h-[34px] w-[34px] flex-none place-items-center rounded-full"
      style={{
        background: `conic-gradient(var(--accent) ${pct}%, var(--panel) 0)`,
      }}
    >
      <span className="grid h-[27px] w-[27px] place-items-center rounded-full bg-bg text-[9px] tabular-nums text-text">
        {formatAccuracy(pct)}
      </span>
    </span>
  );
}

export function DeckAccuracy({
  history,
  cfg,
}: {
  history: HistoryFile;
  cfg: QuizConfig;
}) {
  const seen = DECKS.map((d) => volumeFor(history, d.chars));
  // Volume is relative to the busiest deck, never an absolute target — the
  // same claim Home's shelf makes: "you drill this one less than that one".
  const busiest = Math.max(0, ...seen);

  return (
    <>
      <Lbl>Accuracy by deck</Lbl>
      <div className="mb-3.5 grid grid-cols-3 gap-2">
        {DECKS.map((deck, i) => {
          const pct = accuracyFor(history, deck.chars, cfg.accuracyMetric);
          return (
            <div
              key={deck.id}
              // rounded-[12px], not the kit's rounded-xl Card: globals.css
              // hangs per-theme card treatments off rounded-xl + bg-card, and
              // those suit a full-width card, not a 3-up grid of tiles. Same
              // opt-out Home's tiles and the picker's rows take.
              className="relative flex min-h-[92px] flex-col items-start gap-0.5 rounded-[12px] border border-border bg-card p-3"
            >
              <span className="absolute top-2.5 right-2.5">
                <DeckRing pct={pct} />
              </span>
              <span
                aria-hidden="true"
                className="mb-0.5 font-kana text-[22px] leading-tight font-extralight opacity-80"
              >
                {deck.glyph}
              </span>
              <span className="text-[13px] leading-tight font-semibold">
                {deck.label}
              </span>
              <span className="text-[11px] leading-snug tabular-nums text-text-muted">
                {deck.chars.length} characters ·{" "}
                {seen[i] ? `seen ${seen[i]}×` : "not practised yet"}
              </span>
              {cfg.showVolume ? (
                <VolumeBar seen={seen[i]} max={busiest} />
              ) : null}
            </div>
          );
        })}
      </div>
    </>
  );
}
