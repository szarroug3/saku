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
import {
  VOCAB_SUBJECT,
  readingUnits,
  vocabRow,
  wordEntry,
} from "../../data/vocab.ts";
import { factsOf } from "../facts.ts";
import { counterShelfSections } from "./counter-shelf.ts";
import { entryFromSlug, entryHref } from "./href.ts";
import { subLabel } from "./sub-label.ts";

// The Sino numbers 1-10, in counting order — the kanji the "Numbers" section
// surfaces since the dedupe removed the rote counter:num forms.
const NUMBER_KANJI = ["一", "二", "三", "四", "五", "六", "七", "八", "九", "十"];

const byGlyph = (g: string) => COUNTER_CURRICULUM.find((f) => f.glyph === g)!;

describe("the shelf exists and lists the counters", () => {
  test("Counting is a shelf of its own", () => {
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

  test("every listed entry is a COUNTER_KIND LibEntry, bar the construction and number-word pages", () => {
    const constructionIds = new Set(
      NUMBER_CONSTRUCTIONS.map((c) => numberConstructionEntry(c.id)),
    );
    const numberWordIds = new Set(NUMBER_KANJI.map((c) => wordEntry(c)));
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
        if (numberWordIds.has(e.id)) {
          assert.equal(e.kind, VOCAB_SUBJECT, "the numbers are word pages");
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

  test("the Sino numbers 1-10 have a 'Numbers' section of their word pages", () => {
    const sections = counterShelfSections();
    const numbers = sections.find((s) => s.id === "counters-numbers");
    assert.ok(numbers, "the shelf has a Numbers section");
    assert.equal(numbers.label, "Numbers");
    // Every number kanji 一…十, in counting order, resolved to its own page.
    assert.deepEqual(
      numbers.entries.map((e) => e.id),
      NUMBER_KANJI.map((c) => wordEntry(c)),
    );
    for (const e of numbers.entries) {
      assert.equal(e.kind, VOCAB_SUBJECT);
      assert.match(entryHref(e.id), /^\/library\/word\//);
      assert.equal(subLabel(e), e.meanings.join(", "));
    }
    // It sits between the native 〜つ group and the tail, the teaching order.
    const ids = sections.map((s) => s.id);
    assert.ok(
      ids.indexOf("counters-tsu") < ids.indexOf("counters-numbers"),
      "〜つ leads the numbers",
    );
    assert.ok(
      ids.indexOf("counters-numbers") < ids.indexOf("counters-tail"),
      "the numbers precede the tail",
    );
  });

  test("4 and 7 carry both spoken number readings on their word pages", () => {
    assert.deepEqual(readingUnits(vocabRow("四")!).map((u) => u.reb), ["よん", "し"]);
    assert.deepEqual(readingUnits(vocabRow("七")!).map((u) => u.reb), ["なな", "しち"]);
  });

  test("the 'how to build them' constructions lead the shelf and own their generated fact", () => {
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
      // The reference does not print a generic facts table, either way.
      assert.deepEqual(factRows(entry), []);
      // Every GENERATIVE page (a bare-number range or a counter) owns the one
      // category fact the normal Drill rolls a round from. day/month
      // (SAK-163 round 2) are the one exception: closed, fixed-size sets with
      // no generative round of their own — their practice is the 43 real
      // CounterForm facts already on the shelf below, not a category fact on
      // THIS entry — so they mint none. See day-month-construction.ts's header.
      const isGenerative = c.id !== "day" && c.id !== "month";
      assert.equal(factsOf(entry.id).length, isGenerative ? 1 : 0, c.id);
    }
    // The tens and big range pages lead, then the counters.
    assert.equal(first.entries[0].name, "Numbers 11–99");
    assert.equal(first.entries[1].name, "Hundreds and up");
  });
});

describe("a counter entry resolves to a real Library page", () => {
  test("its URL round-trips to the same id", () => {
    // A 〜つ kana form and the one memorised counted form; the bare Sino numbers
    // (に …) are no longer counter forms — the number kanji carry them.
    for (const glyph of ["ひとつ", "とお", "二十歳"]) {
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
