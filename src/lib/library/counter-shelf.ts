// The "Numbers and counters" shelf, cut into the groups the track teaches.
//
// A shelf is cut where the cut MEANS something to the reader (see shelves.tsx).
// The counters carry that cut in their own data — the `counter` a form belongs
// to (〜つ, 〜人, 〜本…) and the `phase` that separates the taught-as-a-system
// counters from the ungated tail — so the sections are those groups, in teaching
// order: the native 〜つ escape hatch first, then the numbers, then the counters
// built on them, then the long tail.
//
// It lives in a .ts, not beside the JSX in shelves.tsx, so the test runner (no
// JSX) can hold the property that matters here: the shelf lists every counter
// entry, exactly once, resolved to a real Library page.

import {
  COUNTER_CURRICULUM,
  counterEntry,
  type CounterForm,
} from "@/data/counters";
import { libEntry } from "@/lib/library/entries";
import type { ShelfSection } from "@/lib/library/shelf-view";

/** One section of the shelf: a name and the predicate that fills it. In teaching
 * order, and mutually exclusive over the curriculum — every form falls in
 * exactly one group. */
interface CounterGroup {
  readonly id: string;
  readonly label: string;
  readonly keep: (form: CounterForm) => boolean;
}

const GROUPS: readonly CounterGroup[] = [
  // 〜つ leads, because it is the escape hatch taught first (see counters.ts).
  { id: "tsu", label: "Native numbers (〜つ)", keep: (f) => f.counter === "つ" },
  // The bare Sino numbers — 1..10, the teens and tens, and the big base words.
  { id: "numbers", label: "Numbers", keep: (f) => f.counter === "" },
  { id: "nin", label: "People (〜人)", keep: (f) => f.counter === "人" },
  { id: "hon", label: "Long things (〜本)", keep: (f) => f.counter === "本" },
  { id: "hiki", label: "Small animals (〜匹)", keep: (f) => f.counter === "匹" },
  { id: "mai", label: "Flat things (〜枚)", keep: (f) => f.counter === "枚" },
  // The ungated tail: one representative form each, taught as plain vocabulary.
  { id: "tail", label: "More counters", keep: (f) => f.phase === 3 },
];

/**
 * The counters shelf's sections, each holding its group's entries in curriculum
 * order.
 *
 * An empty group drops out — a card with nothing under it is a worse answer than
 * no card — though none is empty today. Each form is resolved to its LibEntry by
 * a lookup (`libEntry(counterEntry(f))`), never a parse, and skipped if the
 * build has no entry for it, the same degradation every other shelf takes.
 */
export function counterShelfSections(): ShelfSection[] {
  return GROUPS.map((g) => ({
    id: `counters-${g.id}`,
    label: g.label,
    entries: COUNTER_CURRICULUM.filter(g.keep).flatMap((f) => {
      const e = libEntry(counterEntry(f));
      return e ? [e] : [];
    }),
  })).filter((s) => s.entries.length > 0);
}
