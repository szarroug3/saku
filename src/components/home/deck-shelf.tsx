"use client";

// "Decks" — the static shelf. Six cards: the four script halves, one full pass
// over everything, and the door to the character picker.
//
// Everything on it comes from src/lib/decks.ts, so a future kanji or vocab set
// lands here without touching this file.

import { DeckCard, Shelf, VolumeBar } from "@/components/home/deck-card";
import { accuracyFor, volumeFor } from "@/lib/accuracy";
import { DECKS, type Deck } from "@/lib/decks";
import type { HistoryFile, QuizConfig } from "@/types";

export function DeckShelf({
  history,
  cfg,
  disabled,
  pickerOpen,
  onPick,
  onCustom,
}: {
  history: HistoryFile;
  cfg: QuizConfig;
  /** The hero's setup can't run a quiz (no directions) — nothing can start. */
  disabled?: boolean;
  pickerOpen: boolean;
  onPick: (deck: Deck) => void;
  onCustom: () => void;
}) {
  const seen = DECKS.map((d) => volumeFor(history, d.chars));
  // Volume is relative to the busiest deck on this shelf, never an absolute.
  const busiest = Math.max(0, ...seen);

  return (
    <Shelf>
      {DECKS.map((deck, i) => {
        const acc = accuracyFor(history, deck.chars, cfg.accuracyMetric);
        const tail = deck.note ?? (seen[i] ? `seen ${seen[i]}×` : "not practised yet");
        return (
          <DeckCard
            key={deck.id}
            glyph={deck.glyph}
            label={deck.label}
            subtitle={`${deck.chars.length} characters · ${tail}`}
            pct={acc}
            volume={
              cfg.showVolume ? <VolumeBar seen={seen[i]} max={busiest} /> : null
            }
            disabled={disabled}
            onClick={() => onPick(deck)}
          />
        );
      })}
      <DeckCard
        dashed
        glyph="⚙"
        label="Custom…"
        subtitle={pickerOpen ? "open below" : "choose exactly what you want"}
        onClick={onCustom}
      />
    </Shelf>
  );
}
