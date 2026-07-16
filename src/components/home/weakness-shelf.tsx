"use client";

// "Target a weakness" — three decks the app computes from your history rather
// than reads from the character data. One click each: the card picks WHICH
// characters, the hero already said HOW, so there is nothing left to confirm.

import { DeckCard, metricWord, plural, Shelf } from "@/components/home/deck-card";
import { accuracyFor, formatAccuracy } from "@/lib/accuracy";
import { confusionDecks, lastMisses, weakestChars } from "@/lib/decks";
import type { HistoryFile, QuizConfig } from "@/types";

export function WeaknessShelf({
  history,
  cfg,
  enabled,
  disabled,
  onPick,
}: {
  history: HistoryFile;
  cfg: QuizConfig;
  /** Currently-selected characters — the day-one lookalike fallback's scope. */
  enabled: string[];
  /** The hero's setup can't run a quiz (no directions) — nothing can start. */
  disabled?: boolean;
  onPick: (chars: string[]) => void;
}) {
  const metric = cfg.accuracyMetric;

  const weakest = weakestChars(history, metric, 20);
  const weakestAcc = accuracyFor(history, weakest, metric);
  const confusions = confusionDecks(history, enabled);
  const misses = lastMisses(history);

  const topPair = confusions.pairs[0];

  return (
    <Shelf>
      <DeckCard
        smart
        glyph="弱"
        label="Weakest 20"
        subtitle={
          weakestAcc === null
            ? "nothing to go on yet"
            : `${formatAccuracy(weakestAcc)} ${metricWord(metric)}`
        }
        disabled={disabled || !weakest.length}
        onClick={() => onPick(weakest)}
      />
      <DeckCard
        smart
        glyph={topPair ? `${topPair.a}↔${topPair.b}` : "↔"}
        label="Confusions"
        subtitle={
          !confusions.pairs.length
            ? "no pairs to drill"
            : confusions.fromHistory
              ? `${plural(confusions.pairs.length, "pair")} you mix up`
              : "common lookalikes"
        }
        disabled={disabled || !confusions.chars.length}
        onClick={() => onPick(confusions.chars)}
      />
      <DeckCard
        smart
        glyph="↺"
        label="Last Misses"
        subtitle={
          misses.length ? plural(misses.length, "character") : "nothing missed yet"
        }
        disabled={disabled || !misses.length}
        onClick={() => onPick(misses)}
      />
    </Shelf>
  );
}
