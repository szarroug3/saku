// Run: node --import ./src/lib/conjugate/test-hooks.mjs --test \
//        src/lib/library/all-tab.test.ts
//
// The All-tab browse decides two things, both pure and both here: it ENUMERATES
// every subject in teaching order, and it DROPS a subject the knowledge filter
// empties (no empty heading). Both are read off `shownSectionsOf`, so a subject
// is shown iff its own tab would show a shelf.

import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { allTabBrowseKinds } from "@/lib/library/all-tab";
import { KINDS, type Kind, type LibEntry } from "@/lib/library/entries";
import type { ShelfSection } from "@/lib/library/shelf-view";

/** A throwaway entry with just the fields the view math reads. */
function entry(id: string, kind: Kind): LibEntry {
  return {
    id: id as LibEntry["id"],
    kind,
    glyph: id,
    readings: [],
    meanings: [],
    sub: "",
    weight: 0,
  };
}

/** One non-empty section for a kind — enough for `shownSectionsOf` to keep it. */
function oneSection(kind: Kind): ShelfSection[] {
  return [{ id: `${kind}-1`, label: "1", entries: [entry(`${kind}-a`, kind)] }];
}

describe("allTabBrowseKinds — which subjects the All browse stacks", () => {
  test("with no filter, EVERY subject is enumerated, in KINDS teaching order", () => {
    const kinds = allTabBrowseKinds(undefined, oneSection);
    assert.deepEqual(kinds, [...KINDS], "All spans the whole curriculum, in order");
  });

  test("a subject whose shelf the filter empties DROPS OUT — no empty header", () => {
    // Keep only entries of one kind: every other subject's sections empty out and
    // must be absent from the browse, exactly as filterSections drops them.
    const only: Kind = KINDS[2];
    const keep = (e: LibEntry) => e.kind === only;
    const kinds = allTabBrowseKinds(keep, oneSection);
    assert.deepEqual(kinds, [only]);
  });

  test("a subject with no sections at all is absent", () => {
    // Half the subjects have a shelf, half have nothing to cut — only the former
    // are enumerated, still in order.
    const withSections = new Set(KINDS.filter((_, i) => i % 2 === 0));
    const sectionsForKind = (k: Kind): ShelfSection[] =>
      withSections.has(k) ? oneSection(k) : [];
    const kinds = allTabBrowseKinds(undefined, sectionsForKind);
    assert.deepEqual(kinds, KINDS.filter((k) => withSections.has(k)));
  });

  test("everything filtered away leaves NO subjects (the all-empty case)", () => {
    const kinds = allTabBrowseKinds(() => false, oneSection);
    assert.deepEqual(kinds, []);
  });
});
