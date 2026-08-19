// The "Counting" shelf, cut into the groups the track teaches.
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
import {
  NUMBER_CONSTRUCTIONS,
  numberConstructionEntry,
} from "@/data/number-construction";
import { NUMBER_KANJI } from "@/data/number-kanji";
import { wordEntry } from "@/lib/vocab-ids";
import { libEntry } from "@/lib/library/library-index";
import type { ShelfSection } from "@/lib/library/shelf-view";

// The Sino numbers 1-10, in counting order (NUMBER_KANJI, shared with the prereq
// walk and builtFrom). Since the dedupe (drop the rote counter:num:1..10 kana
// forms), the number KANJI carry these — 二 = に = two — so the shelf surfaces the
// standalone WORD entries. A number tile is a spoken word (四 = し / よん = four),
// not the kanji's shape/meaning entry; routing it through kanji pages lost the
// alternate number readings and made its quiz ask kanji-reading facts instead of
// pronunciation. The kanji remains reachable from the Kanji shelf.

/** One section of the shelf: a name and the predicate that fills it. In teaching
 * order, and mutually exclusive over the curriculum — every form falls in
 * exactly one group. */
interface CounterGroup {
  readonly id: string;
  readonly label: string;
  readonly keep: (form: CounterForm) => boolean;
}

// The object counters (本, 匹, 枚, and the tail) are no longer rote-form sections:
// each is a generative CATEGORY whose "How to build them" page (below) carries the
// rule, so tiling 一本…十本 would only repeat what the page generates. The groups
// that remain are the MEMORISED material a page cannot build: the native 〜つ escape
// hatch, the Sino numbers 1-10, and the handful of irregulars (〜人's ひとり/ふたり/
// よにん, 二十歳 はたち) that are their own words.
const GROUPS: readonly CounterGroup[] = [
  // 〜つ leads, because it is the escape hatch taught first (see counters.ts).
  { id: "tsu", label: "Native numbers (〜つ)", keep: (f) => f.counter === "つ" },
  // The bare Sino numbers 1..10 are no longer curriculum FORMS (the dedupe removed
  // counter:num:1..10); the number kanji 一…十 carry them, injected below as their
  // own section (numberKanjiSection) between 〜つ and the tail. 〜人's regular
  // counts are generated and its irregulars ride the 〜人 category, so no bare
  // number or 〜人 form remains to group here.
  // The one memorised tail reading, 二十歳 はたち.
  { id: "tail", label: "More counters", keep: (f) => f.phase === 3 },
];

/**
 * The Sino numbers 1-10 as a shelf section — the number kanji 一…十 resolved to
 * their WORD pages, in counting order. These are word entries (not counter
 * forms), so they are built here rather than filtered out of COUNTER_CURRICULUM.
 * A word with no build is skipped,
 * the same degradation the counter groups take.
 */
function numberKanjiSection(): ShelfSection {
  return {
    id: "counters-numbers",
    label: "Numbers",
    entries: NUMBER_KANJI.flatMap((c) => {
      const e = libEntry(wordEntry(c));
      return e ? [e] : [];
    }),
  };
}

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
  const groups = GROUPS.map((g) => ({
    id: `counters-${g.id}`,
    label: g.label,
    entries: COUNTER_CURRICULUM.filter(g.keep).flatMap((f) => {
      const e = libEntry(counterEntry(f));
      return e ? [e] : [];
    }),
  })).filter((s) => s.entries.length > 0);

  // A leading reference section: the "how to build them" pages — the tens, the
  // big base words, and one per counter — read and never drilled (each mints no
  // facts and offers only a Quiz button). They are their own Library kind (see
  // number-construction.ts) resolved by the same libEntry lookup the counters
  // use, injected here so the rules sit at the top of the shelf they explain. It
  // renders as ROWS (asRows): each page carries a 十〜 / 〜本 plate, so it is not
  // glyphless, but a named reference page reads across a line, not in a tile. An
  // entry with no build (degraded dictionaries) is skipped, exactly as an empty
  // counter group drops out.
  const constructions = NUMBER_CONSTRUCTIONS.flatMap((c) => {
    const e = libEntry(numberConstructionEntry(c.id));
    return e ? [e] : [];
  });
  const referenceSection: ShelfSection[] = constructions.length
    ? [
        {
          id: "counters-constructions",
          label: "How to build them",
          entries: constructions,
          asRows: true,
        },
      ]
    : [];

  // The Sino numbers 一…十 sit between the native 〜つ and the tail — the teaching
  // order this file documents (〜つ escape hatch, then the numbers, then what is
  // built on them). Injected after the 〜つ group by id so it lands in place even
  // if the group set changes; dropped whole if no number kanji resolves.
  const numbers = numberKanjiSection();
  const withNumbers =
    numbers.entries.length > 0
      ? groups.flatMap((s) => (s.id === "counters-tsu" ? [s, numbers] : [s]))
      : groups;

  return [...referenceSection, ...withNumbers];
}
