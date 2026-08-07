// Run: node --import ./src/lib/conjugate/test-hooks.mjs --test \
//        src/lib/library/counter-shelf.test.ts
//
// WHAT THESE TESTS ARE FOR
// ========================
// The counters are `word` facts, but they browse on their OWN shelf ("Numbers
// and counters", COUNTER_KIND) rather than mixing into Words — and the whole
// point of the shelf is that each counter has a page showing its counted form
// beside its reading (一本 · いっぽん). These pin: the shelf lists every counter
// entry exactly once, every listed entry resolves to a real Library page whose
// URL round-trips, and a counted form's page shows its reading while a kana
// form's shows its meaning alone.

import assert from "node:assert/strict";
import { describe, test } from "node:test";

import {
  COUNTER_CURRICULUM,
  counterEntry,
} from "../../data/counters.ts";
import {
  GRAMMAR_CONCEPT_SUBJECT,
  NUMBER_COMPOSITION_CONCEPT_ID,
  grammarConceptEntry,
} from "../../data/grammar-concepts.ts";
import {
  COUNTER_KIND,
  KINDS,
  KIND_LABEL,
  entryName,
  factRows,
  factsTitle,
  libEntry,
  LIB_ENTRIES,
} from "./entries.ts";
import { counterShelfSections } from "./counter-shelf.ts";
import { entryFromSlug, entryHref } from "./href.ts";

const byGlyph = (g: string) => COUNTER_CURRICULUM.find((f) => f.glyph === g)!;

describe("the shelf exists and lists the counters", () => {
  test("Numbers and counters is a shelf of its own", () => {
    assert.ok(KINDS.includes(COUNTER_KIND), "COUNTER_KIND is a browse kind");
    assert.ok(KIND_LABEL[COUNTER_KIND], "it has a shelf label");
  });

  test("the shelf lists every counter entry, exactly once", () => {
    const sections = counterShelfSections();
    // The counter forms — every listed entry EXCEPT the leading reference page,
    // which is a glyphless concept, not a counter (see the reference test below).
    const counterIds = sections
      .flatMap((s) => s.entries)
      .filter((e) => e.kind === COUNTER_KIND)
      .map((e) => e.id);
    assert.equal(counterIds.length, COUNTER_CURRICULUM.length, "one tile per curriculum form");
    assert.equal(new Set(counterIds).size, counterIds.length, "no entry listed twice");
    const expected = new Set(COUNTER_CURRICULUM.map(counterEntry));
    assert.equal(new Set(counterIds).size, expected.size);
    for (const id of counterIds) assert.ok(expected.has(id), `${id} is a counter entry`);
  });

  test("every listed entry is a COUNTER_KIND LibEntry, bar the reference page", () => {
    const referenceId = grammarConceptEntry(NUMBER_COMPOSITION_CONCEPT_ID);
    for (const s of counterShelfSections()) {
      for (const e of s.entries) {
        if (e.id === referenceId) {
          assert.equal(e.kind, GRAMMAR_CONCEPT_SUBJECT, "the reference is a concept");
          continue;
        }
        assert.equal(e.kind, COUNTER_KIND);
      }
    }
    // And the counters are in the global index under that kind, so search and
    // slice see them.
    const inIndex = LIB_ENTRIES.filter((e) => e.kind === COUNTER_KIND);
    assert.equal(inIndex.length, COUNTER_CURRICULUM.length);
  });

  test("a 'How it works' reference leads the shelf and is not drillable", () => {
    const sections = counterShelfSections();
    // It is the very first section, so the composition rule sits above the
    // numbers it explains.
    const first = sections[0];
    assert.equal(first.id, "counters-reference");
    assert.equal(first.entries.length, 1);
    const reference = first.entries[0];
    assert.equal(reference.id, grammarConceptEntry(NUMBER_COMPOSITION_CONCEPT_ID));
    assert.equal(entryName(reference), "How numbers compose");
    // A reference is read, never asked: no gradeable facts, exactly like a term.
    assert.deepEqual(factRows(reference), []);
  });
});

describe("a counter entry resolves to a real Library page", () => {
  test("its URL round-trips to the same id", () => {
    for (const glyph of ["一本", "ひとつ", "に", "二十歳"]) {
      const id = counterEntry(byGlyph(glyph));
      assert.ok(libEntry(id), `${glyph} has a LibEntry`);
      const href = entryHref(id);
      assert.ok(href.startsWith("/library/counter/"), `${glyph} lives under /counter`);
      const [, , kind, slug] = href.split("/");
      assert.equal(entryFromSlug(kind, slug), id, `${glyph} URL round-trips`);
    }
  });

  test("a counted form's page shows its reading; a kana form's does not", () => {
    // 一本 · いっぽん — the reading is the whole point of viewing.
    const hon = libEntry(counterEntry(byGlyph("一本")))!;
    const honRows = factRows(hon);
    const reading = honRows.find((r) => r.label === "Reading");
    assert.ok(reading, "一本 has a reading row");
    assert.equal(reading!.answer, "いっぽん");
    assert.equal(reading!.speak, "いっぽん", "the reading is spoken, not the kanji");
    assert.equal(factsTitle(hon, honRows), "Reading and meaning");

    // ひとつ IS its reading, so there is no reading row — meaning alone.
    const tsu = libEntry(counterEntry(byGlyph("ひとつ")))!;
    const tsuRows = factRows(tsu);
    assert.ok(!tsuRows.some((r) => r.label === "Reading"), "ひとつ has no reading row");
    assert.equal(tsuRows.find((r) => r.label === "Meaning")!.answer, "one thing");
    assert.equal(factsTitle(tsu, tsuRows), "Meaning");
  });
});
