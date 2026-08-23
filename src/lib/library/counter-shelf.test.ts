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
  COUNTER_TAIL_FORM_ALIASES,
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

// SAK-172: 二十歳 is still a real COUNTER_CURRICULUM form (teaching/quizzing is
// unchanged — see counters.test.ts), but it no longer mints its own shelf tile
// or Library page; it folded into 〜歳's construction page as an Irregular row
// instead. Every shelf/index count below that used to be COUNTER_CURRICULUM.length
// is now that minus this one folded-in form.
const SHELVED_CURRICULUM = COUNTER_CURRICULUM.filter((f) => !COUNTER_TAIL_FORM_ALIASES.has(f.glyph));

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
    // SAK-172: 二十歳 is folded into 〜歳's page instead of a tile of its own —
    // one fewer tile than a full curriculum walk.
    assert.equal(counterIds.length, SHELVED_CURRICULUM.length, "one tile per shelved curriculum form");
    assert.equal(new Set(counterIds).size, counterIds.length, "no entry listed twice");
    const expected = new Set(SHELVED_CURRICULUM.map(counterEntry));
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
    // slice see them. SAK-172: one fewer than the full curriculum — 二十歳
    // folded into 〜歳's page instead.
    const inIndex = LIB_ENTRIES.filter((e) => e.kind === COUNTER_KIND);
    assert.equal(inIndex.length, SHELVED_CURRICULUM.length);
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
    // It sits right after the native 〜つ group, the teaching order. (SAK-172
    // removed the "tail" group entirely — 二十歳/はたち folded into 〜歳's own
    // construction page instead of a shelf tile of its own — so the numbers no
    // longer sit "between 〜つ and the tail"; they simply follow 〜つ.)
    const ids = sections.map((s) => s.id);
    assert.ok(
      ids.indexOf("counters-tsu") < ids.indexOf("counters-numbers"),
      "〜つ leads the numbers",
    );
    assert.ok(!ids.includes("counters-tail"), "the tail group no longer exists");
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
      // Every construction page owns exactly the one category fact the normal
      // Drill rolls a round from — day/month included, since SAK-163 round 4
      // made them generative categories too, matching every page above them.
      assert.equal(factsOf(entry.id).length, 1, c.id);
    }
    // The tens and big range pages lead, then the counters.
    assert.equal(first.entries[0].name, "Numbers 11–99");
    assert.equal(first.entries[1].name, "Hundreds and up");
  });
});

describe("a counter entry resolves to a real Library page", () => {
  test("its URL round-trips to the same id", () => {
    // A 〜つ kana form; the bare Sino numbers (に …) are no longer counter
    // forms (the number kanji carry them), and 二十歳 no longer has a page of
    // its own (SAK-172 — see the describe block below).
    for (const glyph of ["ひとつ", "とお"]) {
      const id = counterEntry(byGlyph(glyph));
      assert.ok(libEntry(id), `${glyph} has a LibEntry`);
      const href = entryHref(id);
      assert.ok(href.startsWith("/library/counting/"), `${glyph} lives under /counting`);
      const [, , kind, slug] = href.split("/");
      assert.equal(entryFromSlug(kind, slug), id, `${glyph} URL round-trips`);
    }
  });

  test("a kana form's page shows only its meaning, never a redundant reading row", () => {
    // ひとつ IS its reading, so there is no reading row — meaning alone. (The
    // one counted form that DID carry its own reading, 二十歳/はたち, no longer
    // has a page of its own — see "SAK-172" below for where it went instead.)
    const tsu = libEntry(counterEntry(byGlyph("ひとつ")))!;
    const tsuRows = factRows(tsu);
    assert.ok(!tsuRows.some((r) => r.label === "Reading"), "ひとつ has no reading row");
    assert.equal(tsuRows.find((r) => r.label === "Meaning")!.answer, "one thing");
    assert.equal(factsTitle(tsu, tsuRows), "Meaning");
  });
});

describe("SAK-172: 二十歳/はたち folds into 〜歳's Irregular table instead of its own page", () => {
  test("二十歳 no longer resolves to its own COUNTER_KIND LibEntry", () => {
    const id = counterEntry(byGlyph("二十歳"));
    assert.equal(libEntry(id), undefined, "二十歳's own entry should no longer mint a Library page");
  });

  test("二十歳 no longer has its own row on the Counting shelf", () => {
    const sections = counterShelfSections();
    const onShelf = sections
      .flatMap((s) => s.entries)
      .some((e) => e.kind === COUNTER_KIND && e.glyph === "二十歳");
    assert.equal(onShelf, false, "二十歳 must not appear as its own shelf row");
  });

  test("〜歳's construction page carries はたち as a real Irregular row, the same way 〜日's page shows はつか", () => {
    const sai = NUMBER_CONSTRUCTIONS.find((c) => c.id === "sai")!;
    const irregular = sai.exampleGroups.find((g) => g.title === "Irregular")!;
    const row = irregular.examples.find((r) => r.word === "二十歳");
    assert.ok(row, "〜歳's Irregular table must carry a 二十歳 row");
    assert.equal(row!.reading, "はたち");
    assert.equal(row!.build.length, 0, "はたち is suppletive — no additive equation");
  });
});
