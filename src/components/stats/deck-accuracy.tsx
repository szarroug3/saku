"use client";

// Accuracy per deck — "where am I strong, where am I weak", at a glance.
//
// Deliberately Home's deck-card language (glyph, ring in the corner, label,
// tabular subtitle) over the same DECKS, so the two screens read as one app and
// a new set added to src/lib/decks.ts lands here for free. That extends to the
// subtitle's WORDING, which is built the way DeckShelf builds it — the two
// screens describing one deck differently is the bug this shape exists to
// prevent. The one difference is that these DON'T start a quiz: on Home every
// card is a launcher and is therefore a <button>; here nothing starts, so a
// button would be a lie about what a click does — but only the CARD was welded
// to that button, never the ring, so the ring is Home's own AccuracyRing rather
// than a third copy of the same arc to keep in sync.

import { AccuracyRing } from "@/components/home/accuracy-ring";
import { Lbl } from "@/components/ui";
import { accuracyFor, volumeFor } from "@/lib/accuracy";
import { DECKS } from "@/lib/decks";
import type { HistoryFile, QuizConfig } from "@/types";

export function DeckAccuracy({
  history,
  cfg,
}: {
  history: HistoryFile;
  cfg: QuizConfig;
}) {
  const seen = DECKS.map((d) => volumeFor(history, d.facts));

  return (
    <>
      <Lbl>Accuracy by deck</Lbl>
      <div className="mb-3.5 grid grid-cols-3 gap-2">
        {DECKS.map((deck, i) => {
          const pct = accuracyFor(history, deck.facts, cfg.accuracyMetric);
          // Word for word what DeckShelf builds, and deliberately so: the two
          // screens draw the same decks and must not disagree about what one
          // says. Home has a third case these tiles can't — "12 of 46 on" —
          // because a card there is a toggle over the selection and these start
          // nothing, so the head is always the plain count.
          //
          // cfg.showVolume gates THIS CLAUSE, not a bar. The bar it used to gate
          // is gone (from Home first, and now from here): drawn relative to the
          // busiest deck, its denominator was invisible, and a second
          // percentage-shaped mark beside the accuracy ring simply read as a
          // second accuracy — "a circle that says 88% and a bar at 30%ish" was
          // the report. `seen 68×` says the same thing absolutely, one line up,
          // and was already doing so.
          const tail = cfg.showVolume
            ? seen[i]
              ? `seen ${seen[i]}×`
              : "not practised yet"
            : null;
          return (
            <div
              key={deck.id}
              // rounded-[12px], not the kit's rounded-xl Card: globals.css
              // hangs per-theme card treatments off rounded-xl + bg-card, and
              // those suit a full-width card, not a 3-up grid of tiles. Same
              // opt-out Home's tiles and the picker's rows take.
              className="kq-material relative flex min-h-[92px] flex-col items-start gap-0.5 rounded-[12px] border border-border bg-card p-3"
            >
              <span className="absolute top-2.5 right-2.5">
                <AccuracyRing pct={pct} unpractised="dashed" />
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
                {[`${deck.facts.length} characters`, tail]
                  .filter(Boolean)
                  .join(" · ")}
              </span>
            </div>
          );
        })}
      </div>
    </>
  );
}
