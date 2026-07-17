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

import { DeckCard, Shelf } from "@/components/home/deck-card";
import { stateOf } from "@/components/home/selection";
import { accuracyFor, volumeFor } from "@/lib/accuracy";
import { DECKS, deckChars, type Deck } from "@/lib/decks";
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
  const seen = DECKS.map((d) => volumeFor(history, d.facts));

  return (
    <Shelf>
      {DECKS.map((deck, i) => {
        const acc = accuracyFor(history, deck.facts, cfg.accuracyMetric);
        // The ring reads FACTS (what you're scored on); the selection reads
        // CHARACTERS (what cfg.enabled is still keyed by). deckChars is the
        // bridge, and it dies with cfg.enabled.
        const chars = deckChars(deck);
        const state = stateOf(chars, cfg.enabled);
        const on = chars.filter((c) => cfg.enabled[c]).length;
        // A partial card spends its head saying HOW partial, because that is
        // the only thing about it you can't see from the border, and "46
        // characters" would be actively misleading on a deck only 12 of which
        // will be drilled.
        const head =
          state === "partial"
            ? `${on} of ${chars.length} on`
            : `${chars.length} characters`;
        // THIS is cfg.showVolume now. It used to gate a bar drawn relative to
        // the busiest deck, which was reported as unreadable and rightly so:
        // the denominator was invisible, and a second percentage-shaped mark
        // next to the accuracy ring read as another accuracy. "seen 68×" was
        // already sitting one line above it saying the same thing absolutely
        // and unambiguously, so the setting now toggles the clause that always
        // did the job — which is what its label claimed all along.
        const tail = cfg.showVolume
          ? seen[i]
            ? `seen ${seen[i]}×`
            : "not practised yet"
          : null;
        return (
          <DeckCard
            key={deck.id}
            glyph={deck.glyph}
            label={deck.label}
            subtitle={[head, tail].filter(Boolean).join(" · ")}
            pct={acc}
            state={state}
            onClick={() => onToggle(deck, state !== "on")}
          />
        );
      })}
      {/* No ring, and no state: Custom is not a deck with an accuracy, it is
          a door. A percentage on it would have to be an accuracy OF something,
          and there is nothing here to be the something. */}
      <DeckCard
        dashed
        glyph="⚙"
        label="Custom"
        subtitle={pickerOpen ? "Open below" : "Pick exact rows"}
        onClick={onCustom}
      />
    </Shelf>
  );
}
