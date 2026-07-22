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
  COUNTER_KIND,
  KINDS,
  KIND_LABEL,
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
    const ids = sections.flatMap((s) => s.entries.map((e) => e.id));
    assert.equal(ids.length, COUNTER_CURRICULUM.length, "one tile per curriculum form");
    assert.equal(new Set(ids).size, ids.length, "no entry listed twice");
    const expected = new Set(COUNTER_CURRICULUM.map(counterEntry));
    assert.equal(new Set(ids).size, expected.size);
    for (const id of ids) assert.ok(expected.has(id), `${id} is a counter entry`);
  });

  test("every listed entry is a COUNTER_KIND LibEntry", () => {
    for (const s of counterShelfSections()) {
      for (const e of s.entries) assert.equal(e.kind, COUNTER_KIND);
    }
    // And they are in the global index under that kind, so search and slice see
    // them.
    const inIndex = LIB_ENTRIES.filter((e) => e.kind === COUNTER_KIND);
    assert.equal(inIndex.length, COUNTER_CURRICULUM.length);
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
