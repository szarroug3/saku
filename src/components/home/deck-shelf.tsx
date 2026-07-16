"use client";

// "Decks" — the static shelf. Six cards: the four script halves, everything,
// and the door to the character picker.
//
// Every card but the last is a TOGGLE over the selection, and they multi-select
// with the weakness shelf above: the two shelves edit one cfg.enabled map, so
// "Weakest 20 and all of hiragana basic" is two clicks and the overlap counts
// once. See selection.ts for why that costs no code.
//
// Everything comes from src/lib/decks.ts, so a future kanji or vocab set lands
// here without touching this file.

import { DeckCard, Shelf, VolumeBar } from "@/components/home/deck-card";
import { stateOf } from "@/components/home/selection";
import { accuracyFor, volumeFor } from "@/lib/accuracy";
import { DECKS, type Deck } from "@/lib/decks";
import type { HistoryFile, QuizConfig } from "@/types";

export function DeckShelf({
  history,
  cfg,
  pickerOpen,
  onToggle,
  onCustom,
}: {
  history: HistoryFile;
  cfg: QuizConfig;
  pickerOpen: boolean;
  /** Flip this deck's characters on (true) or off (false) in the selection. */
  onToggle: (deck: Deck, on: boolean) => void;
  onCustom: () => void;
}) {
  const seen = DECKS.map((d) => volumeFor(history, d.chars));
  // Volume is relative to the busiest deck on this shelf, never an absolute.
  const busiest = Math.max(0, ...seen);

  return (
    <Shelf>
      {DECKS.map((deck, i) => {
        const acc = accuracyFor(history, deck.chars, cfg.accuracyMetric);
        const state = stateOf(deck.chars, cfg.enabled);
        const on = deck.chars.filter((c) => cfg.enabled[c]).length;
        const tail = seen[i] ? `seen ${seen[i]}×` : "not practised yet";
        return (
          <DeckCard
            key={deck.id}
            glyph={deck.glyph}
            label={deck.label}
            // A partial card spends its subtitle saying HOW partial, because
            // that is the only thing about it you can't see from the border,
            // and "46 characters" would be actively misleading on a deck only
            // 12 of which will be drilled.
            subtitle={
              state === "partial"
                ? `${on} of ${deck.chars.length} on · ${tail}`
                : `${deck.chars.length} characters · ${tail}`
            }
            pct={acc}
            state={state}
            volume={
              cfg.showVolume ? <VolumeBar seen={seen[i]} max={busiest} /> : null
            }
            onClick={() => onToggle(deck, state !== "on")}
          />
        );
      })}
      {/* No ring, and no state: Custom… is not a deck with an accuracy, it is
          a door. A percentage on it would have to be an accuracy OF something,
          and there is nothing here to be the something. */}
      <DeckCard
        dashed
        glyph="⚙"
        label="Custom…"
        subtitle={pickerOpen ? "open below" : "pick exact rows"}
        onClick={onCustom}
      />
    </Shelf>
  );
}
