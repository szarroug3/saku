// TEACHING UNIT — the taught slice of a glyph: ONE pronunciation and the
// meaning(s) taught with it. This is the schedulable/costable atom, distinct from
// the cohesive `ContentItem` (a whole glyph) the Library page renders.
//
// The grain follows the data: CEJC can rank a PRONUNCIATION but not a sense
// (meaning.ts, doc §7). So a unit is a reading; the sense(s) read that way ride
// with it. 人 splits into three units — ひと (person), じん (-ian), にん (counter) —
// each scheduled when its reading-frequency lands; 三 is one unit (さん / three).
// A kanji/radical CORE meaning (no reading of its own) attaches to the glyph's
// primary pronunciation; a kanji taught with no word at all is a meaning-only unit
// (reading null — its readings arrive with the words that attest them).
//
// COST is on the unit: a pronunciation→meaning association is one fact ("read さん,
// means three"). Two meanings under one reading is two facts; the reading itself
// is shared, not a separate cost. So `unitCost` = the unit's distinct meanings.
//
// A lesson PAGE may group several units of the same word (the viewport combines
// them); that grouping is a rendering concern, not this model's.

import { factInfo } from "@/lib/facts";
import { wordReadingUnit, readingFrequency } from "@/data/vocab";
import { canonicalMeaningId } from "./meaning";
import type { FactId } from "@/types";
import type { MeaningId } from "./meaning";
import type { ContentItem } from "./item";

/** One meaning taught within a unit — its identity (dedup key) and display gloss. */
export interface UnitMeaning {
  readonly id: MeaningId;
  readonly label: string;
}

/** The taught slice of a glyph: one pronunciation and the meaning(s) read that way. */
export interface TeachingUnit {
  readonly glyph: string;
  /** The pronunciation taught (kana), or null for a meaning-only unit (a kanji
   * whose readings ride its words). */
  readonly reading: string | null;
  /** The distinct meanings read this way, deduped by MeaningId. Never empty. */
  readonly meanings: readonly UnitMeaning[];
  /** The underlying facts this unit teaches — history stays on these ids. */
  readonly facts: readonly FactId[];
}

/**
 * Split a glyph item into its teaching units — one per pronunciation. Word facts
 * group by their reading (`wordReadingUnit`); a kanji/radical core-meaning fact
 * (no reading) attaches to the glyph's primary pronunciation, or forms a
 * reading-null unit when the glyph is taught with no word.
 */
export function teachUnitsOf(item: ContentItem): readonly TeachingUnit[] {
  const rebOf = (id: FactId): string | null => wordReadingUnit(id)?.unit.reb ?? null;
  const primaryReb =
    item.facts.map((f) => rebOf(f.id)).find((r): r is string => r != null) ?? null;

  const order: (string | null)[] = [];
  const groups = new Map<
    string | null,
    { meanings: Map<MeaningId, string>; facts: FactId[] }
  >();
  for (const f of item.facts) {
    const key = rebOf(f.id) ?? primaryReb; // core meaning → the primary pronunciation
    let group = groups.get(key);
    if (!group) {
      group = { meanings: new Map(), facts: [] };
      groups.set(key, group);
      order.push(key);
    }
    group.facts.push(f.id);
    if (f.kind === "definition") {
      const gloss = factInfo(f.id)?.meaning;
      if (gloss) {
        const id = canonicalMeaningId(f.id, gloss);
        // Label with the CANONICAL gloss (the MeaningId), not the first fact's
        // gloss — so a merged unit shows "person", not the radical's "man".
        if (!group.meanings.has(id)) group.meanings.set(id, id);
      }
    }
  }
  return order.map((reading) => {
    const group = groups.get(reading)!;
    return {
      glyph: item.glyph,
      reading,
      meanings: [...group.meanings].map(([id, label]) => ({ id, label })),
      facts: group.facts,
    };
  });
}

/** The cost of teaching a unit: its distinct meanings (each a pronunciation→meaning
 * fact). The reading is shared context, not counted. */
export function unitCost(unit: TeachingUnit): number {
  return unit.meanings.length;
}

/** How often this unit's pronunciation is spoken (CEJC occurrences). The key the
 * curriculum orders units by — a reading is the only grain CEJC can rank (not a
 * sense; see doc §7). A meaning-only unit has no pronunciation, so 0. */
export function unitFrequency(unit: TeachingUnit): number {
  return unit.reading ? readingFrequency(unit.glyph, unit.reading) : 0;
}

/** Units most-spoken first — 人 → ひと (6580), にん (1270), じん (389). This is
 * "teach by pronunciation frequency": a common reading is taught before a rare
 * one, across the whole curriculum. Stable for equal frequencies. */
export function byFrequencyDesc(a: TeachingUnit, b: TeachingUnit): number {
  return unitFrequency(b) - unitFrequency(a);
}
