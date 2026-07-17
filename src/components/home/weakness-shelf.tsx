"use client";

// "Target a weakness" — three decks the app computes from your history rather
// than reads from the character data.
//
// Same toggles as the Decks shelf below, over the same cfg.enabled map, so
// "Weakest 20 plus all of hiragana basic" is one selection across two shelves
// and the overlap is counted once. They differ only in where their characters
// come from, which is why they look like decks and behave like decks.
//
// Each card exposes its chars upward, because the start bar has to name the
// selection and these three are half of what it might be naming.
//
// NO RINGS HERE, and that is not an oversight. The deck shelf's rings answer
// "how good am I at hiragana basic"; "how good am I at the twenty characters
// I am worst at" answers itself, and "how good am I at the pairs I mix up" is
// the same tautology. These three spend their subtitle on WHY they exist —
// the thing you cannot work out by looking — and Weakest 20 does print its
// accuracy there, through accuracyFor like everything else.

import { DeckCard, metricWord, plural, Shelf } from "@/components/home/deck-card";
import { stateOf, type Selectable } from "@/components/home/selection";
import { accuracyFor, formatAccuracy } from "@/lib/accuracy";
import { confusionDecks, lastMisses, weakestFacts } from "@/lib/decks";
import { entryOf, glyphOf } from "@/lib/facts";
import type { FactId, HistoryFile, QuizConfig } from "@/types";

/** The characters behind a list of facts — these cards' bridge to cfg.enabled,
 * the same one decks.deckChars() is for the static shelf, and it goes the same
 * way. Deduped: two facts of one entry are one character to select. */
function charsOf(facts: FactId[]): string[] {
  return [...new Set(facts.map((f) => glyphOf(entryOf(f))))];
}

/** The three weakness decks for this history, in shelf order. Exported so the
 * start bar can name them and Home can toggle them without recomputing — one
 * history read, one answer, no drift between the cards and the sentence. */
export function weaknessDecks(
  history: HistoryFile,
  cfg: QuizConfig,
  enabled: string[],
): Array<Selectable & { glyph: string; subtitle: string }> {
  const metric = cfg.accuracyMetric;

  const weakest = weakestFacts(history, metric, 20);
  const weakestAcc = accuracyFor(history, weakest, metric);
  const confusions = confusionDecks(history, enabled);
  const misses = lastMisses(history);
  const topPair = confusions.pairs[0];

  return [
    {
      id: "weakest-20",
      label: "Weakest 20",
      glyph: "弱",
      chars: charsOf(weakest),
      subtitle:
        weakestAcc === null
          ? "Nothing to go on yet"
          : `${formatAccuracy(weakestAcc)} ${metricWord(metric)}`,
    },
    {
      id: "confusions",
      label: "Confusions",
      glyph: topPair ? `${glyphOf(topPair.a)}↔${glyphOf(topPair.b)}` : "↔",
      chars: charsOf(confusions.facts),
      subtitle: !confusions.pairs.length
        ? "No pairs to drill"
        : confusions.fromHistory
          ? `${plural(confusions.pairs.length, "pair")} you mix up`
          : "Common lookalikes",
    },
    {
      id: "last-misses",
      label: "Last Misses",
      glyph: "↺",
      chars: charsOf(misses),
      subtitle: misses.length
        ? plural(misses.length, "character")
        : "Nothing missed yet",
    },
  ];
}

export function WeaknessShelf({
  decks,
  cfg,
  onToggle,
}: {
  decks: ReturnType<typeof weaknessDecks>;
  cfg: QuizConfig;
  onToggle: (chars: string[], on: boolean) => void;
}) {
  return (
    <Shelf>
      {decks.map((deck) => {
        const state = stateOf(deck.chars, cfg.enabled);
        const on = deck.chars.filter((c) => cfg.enabled[c]).length;
        return (
          <DeckCard
            key={deck.id}
            smart
            glyph={deck.glyph}
            label={deck.label}
            subtitle={
              state === "partial"
                ? `${on} of ${deck.chars.length} on`
                : deck.subtitle
            }
            state={state}
            // A card with no characters has nothing to select. It stays on the
            // shelf greyed rather than vanishing: "Nothing missed yet" is an
            // answer, and a shelf that changes length as history arrives is
            // harder to learn than one that fills in.
            disabled={!deck.chars.length}
            onClick={() => onToggle(deck.chars, state !== "on")}
          />
        );
      })}
    </Shelf>
  );
}
