import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { KANJI_SUBJECT } from "../../data/kanji.ts";
import {
  filterSections,
  shownSectionsOf,
  visibleShelfIds,
  type ShelfSection,
} from "./shelf-view.ts";
import type { LibEntry } from "./entries.ts";
import type { EntryId } from "../../types/index.ts";

function entry(id: string): LibEntry {
  return {
    id: id as EntryId,
    kind: KANJI_SUBJECT,
    glyph: id,
    readings: [],
    meanings: [],
    sub: "",
    weight: 0,
    speakable: true,
  };
}

function section(id: string, count: number): ShelfSection {
  return {
    id,
    label: id,
    entries: Array.from({ length: count }, (_, i) => entry(`${id}-${i}`)),
  };
}

describe("Library shelf visibility", () => {
  test("every section is shown; no subject-level cap remains", () => {
    const sections = Array.from({ length: 30 }, (_, i) => section(`s${i}`, 4));
    assert.deepEqual(shownSectionsOf(KANJI_SUBJECT, sections), sections);
  });

  test("every entry in every section is visible", () => {
    const sections = [section("grade-1", 5), section("grade-2", 5)];
    assert.equal(visibleShelfIds(KANJI_SUBJECT, sections).length, 10);
  });

  test("filters see the whole shelf and only drop empty sections", () => {
    const sections = [section("known", 3), section("mixed", 3)];
    const keep = (e: LibEntry) => e.id.endsWith("-2");
    assert.deepEqual(
      shownSectionsOf(KANJI_SUBJECT, sections, keep).map((s) => s.id),
      ["known", "mixed"],
    );
    assert.deepEqual(visibleShelfIds(KANJI_SUBJECT, sections, keep), [
      "known-2",
      "mixed-2",
    ]);
  });

  test("a filter that matches nothing produces an empty shelf", () => {
    assert.deepEqual(
      filterSections([section("s", 2)], () => false),
      [],
    );
  });

  test("no filter returns a copy without changing the sections", () => {
    const sections = [section("s", 2)];
    const out = filterSections(sections);
    assert.deepEqual(out, sections);
    assert.notEqual(out, sections);
  });
});
