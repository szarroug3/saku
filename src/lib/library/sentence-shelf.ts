// The "Sentences" shelf, cut into the ten sentence types, each holding the
// grammar it is built out of.
//
// A shelf is cut where the cut MEANS something to the reader (see shelves.tsx).
// This one used to be a single "Sentence rules" list of the ten types and
// nothing else, so a reader looking for は or 〜てから under Sentences found
// neither: the particles were on the Grammar shelf, cut by the FORM they attach
// to, which answers "how is this made" and never "what is this for" (Sam,
// 2026-09-08).
//
// So the sections are the sentence types, in teaching order, and each one holds
// the type followed by the patterns the curriculum places before it
// (src/lib/sentence-rule-order.ts). は and が sit under "Simple sentences",
// 〜てから under "Te-form links and helpers", and the shelf answers "what do I
// need in order to say this kind of thing".
//
// A pattern is on TWO shelves now, here and on Grammar, which is allowed and
// already true elsewhere (the number-construction pages browse on Counting
// while their kanji are Words). The two shelves cut the same material along
// different questions, and dropping either cut to keep them disjoint would lose
// a real answer.
//
// THE LEFTOVERS ARE NOT HERE. A pattern no sentence type ever needs (〜へ, か,
// the whole N4 tail) has no type to sit under, and inventing an "Other" bucket
// for it would put half the grammar table on a shelf named Sentences. Those
// keep the Grammar shelf, which is where they are cut by something true.
//
// It lives in a .ts, not beside the JSX in shelves.tsx, so the test runner (no
// JSX) can hold the properties that matter: one section per type, in the
// track's order, each headed by its own type, and nothing listed twice.

import { markEntry } from "@/data/marks";
import { libEntry, patternEntry } from "@/lib/library/library-index";
import { sentenceRuleOrder } from "@/lib/sentence-rule-order";
import type { LibEntry } from "@/lib/library/entries";
import type { ShelfSection } from "@/lib/library/shelf-view";

function resolve(id: LibEntry["id"] | null): LibEntry[] {
  if (!id) return [];
  const e = libEntry(id);
  return e ? [e] : [];
}

/** The sentences shelf's sections: one per sentence type, in the order the
 * track teaches them, each holding the type and then the patterns placed
 * before it. A type with no entry in this build drops out, and takes its
 * patterns with it, the same degradation every other shelf takes. */
export function sentenceShelfSections(): ShelfSection[] {
  const sections: ShelfSection[] = [];
  let waiting: LibEntry[] = [];
  for (const step of sentenceRuleOrder()) {
    if (step.kind === "pattern") {
      waiting.push(...resolve(patternEntry(step.id)));
      continue;
    }
    const type = resolve(markEntry(`sentence-rule-${step.id}`));
    if (type.length) {
      sections.push({
        id: `sentence-rule-${step.id}`,
        label: type[0].name ?? type[0].meanings[0] ?? step.id,
        entries: [...type, ...waiting],
      });
    }
    waiting = [];
  }
  return sections;
}
