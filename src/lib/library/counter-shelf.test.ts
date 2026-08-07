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
  NUMBER_CONSTRUCTIONS,
  numberConstructionEntry,
} from "../../data/number-construction.ts";
import {
  COUNTER_KIND,
  NUMBER_CONSTRUCTION_KIND,
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

  test("every listed entry is a COUNTER_KIND LibEntry, bar the construction pages", () => {
    const constructionIds = new Set(
      NUMBER_CONSTRUCTIONS.map((c) => numberConstructionEntry(c.id)),
    );
    for (const s of counterShelfSections()) {
      for (const e of s.entries) {
        if (constructionIds.has(e.id)) {
          assert.equal(
            e.kind,
            NUMBER_CONSTRUCTION_KIND,
            "the reference pages are constructions",
          );
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

  test("the 'how to build them' constructions lead the shelf and are not drillable", () => {
    const sections = counterShelfSections();
    // The construction pages are the very first section, so the build rules sit
    // above the numbers and counters they explain. Rendered as rows (asRows),
    // since a named reference page reads across a line, not in a tile.
    const first = sections[0];
    assert.equal(first.id, "counters-constructions");
    assert.equal(first.asRows, true);
    assert.equal(first.entries.length, NUMBER_CONSTRUCTIONS.length);
    // One page per construction, each resolving to its own entry.
    for (const c of NUMBER_CONSTRUCTIONS) {
      const entry = first.entries.find(
        (e) => e.id === numberConstructionEntry(c.id),
      );
      assert.ok(entry, `${c.id} is not on the shelf`);
      assert.equal(entry.kind, NUMBER_CONSTRUCTION_KIND);
      // The row shows the page name (its meaning) beside the 十〜 / 〜本 plate;
      // entryName leads with the plate, since the entry has one.
      assert.equal(entry.name, c.name);
      assert.equal(entry.meanings[0], c.name);
      assert.equal(entryName(entry), c.glyph);
      // A construction page is read, never asked: no gradeable facts, like a term.
      assert.deepEqual(factRows(entry), []);
    }
    // The tens and big range pages lead, then the counters.
    assert.equal(first.entries[0].name, "Numbers 11–99");
    assert.equal(first.entries[1].name, "Hundreds and up");
  });
});

describe("a counter entry resolves to a real Library page", () => {
  test("its URL round-trips to the same id", () => {
    for (const glyph of ["ひとつ", "に", "よにん", "二十歳"]) {
      const id = counterEntry(byGlyph(glyph));
      assert.ok(libEntry(id), `${glyph} has a LibEntry`);
      const href = entryHref(id);
      assert.ok(href.startsWith("/library/counter/"), `${glyph} lives under /counter`);
      const [, , kind, slug] = href.split("/");
      assert.equal(entryFromSlug(kind, slug), id, `${glyph} URL round-trips`);
    }
  });

  test("a counted form's page shows its reading; a kana form's does not", () => {
    // 二十歳 · はたち — the special reading is the whole point of viewing. (The
    // regular counted forms are generated now, so this is the one counted form
    // left with a page of its own.)
    const hon = libEntry(counterEntry(byGlyph("二十歳")))!;
    const honRows = factRows(hon);
    const reading = honRows.find((r) => r.label === "Reading");
    assert.ok(reading, "二十歳 has a reading row");
    assert.equal(reading!.answer, "はたち");
    assert.equal(reading!.speak, "はたち", "the reading is spoken, not the kanji");
    assert.equal(factsTitle(hon, honRows), "Reading and meaning");

    // ひとつ IS its reading, so there is no reading row — meaning alone.
    const tsu = libEntry(counterEntry(byGlyph("ひとつ")))!;
    const tsuRows = factRows(tsu);
    assert.ok(!tsuRows.some((r) => r.label === "Reading"), "ひとつ has no reading row");
    assert.equal(tsuRows.find((r) => r.label === "Meaning")!.answer, "one thing");
    assert.equal(factsTitle(tsu, tsuRows), "Meaning");
  });
});
