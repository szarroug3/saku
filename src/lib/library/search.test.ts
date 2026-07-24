// Run: node --import ./src/lib/conjugate/test-hooks.mjs --test \
//        src/lib/library/search.test.ts
//
// WHAT THIS TEST IS FOR
// =====================
// The Library's knowledge filter (Known / Not known) reaches search through the
// `keep` predicate on SearchOpts. Two properties have to hold, and neither is
// visible from the page:
//
//   IT ACTUALLY FILTERS. Every hit in every section passes `keep`, across all
//   kinds — the filter is not a kind chip that only touches the browse shelf.
//   IT FILTERS BEFORE THE CAP. A section shows `perSection` hits and a "+N more"
//   count; both must describe the FILTERED population, or "Known" would hand you
//   a section of eight that are mostly not known, and a remainder count over a
//   pile you can't see.

import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { search, searchAll, searchByType } from "@/lib/library/search";
import { KINDS } from "@/lib/library/entries";

describe("search keep — the knowledge filter reaching the results", () => {
  test("keeping nothing returns no sections", () => {
    // The empty-results case the page has to render a message for.
    assert.deepEqual(search("a", { keep: () => false }), []);
  });

  test("every hit passes the predicate, across every section", () => {
    const kanjiOnly = search("生", { keep: (e) => e.kind === "kanji" });
    assert.ok(kanjiOnly.length > 0, "生 must still match some kanji");
    for (const s of kanjiOnly) {
      for (const h of s.hits) {
        assert.equal(h.entry.kind, "kanji", `${h.entry.glyph} slipped the filter`);
      }
    }
  });

  test("filtering never grows the result — it is a subset of the unfiltered hits", () => {
    const q = "生";
    const base = searchAll(q).length;
    const filtered = searchAll(q, { keep: (e) => e.kind === "kanji" }).length;
    assert.ok(filtered > 0 && filtered <= base);
  });

  test("the filter runs BEFORE the per-section cap", () => {
    // A query whose prefix section overflows a cap of one, so there is a hidden
    // remainder to reach past.
    const q = "n";
    const capped = search(q, { perSection: 1 }).find((s) => s.more > 0);
    assert.ok(capped, "need a query section that overflows perSection:1");

    // An entry the cap HID (not the one it showed).
    const shownId = capped.hits[0].entry.id;
    const hidden = searchAll(q).find(
      (h) => h.why === capped.why && h.entry.id !== shownId,
    );
    assert.ok(hidden, "need a hidden entry to prove before-cap filtering");

    // Keep only that hidden entry. If the cap ran first it would never appear;
    // because the filter runs first, it is the section's sole hit with no
    // remainder behind it.
    const filtered = search(q, {
      perSection: 1,
      keep: (e) => e.id === hidden.entry.id,
    });
    const sec = filtered.find((s) => s.why === capped.why);
    assert.ok(sec, "the hidden entry's section must survive the filter");
    assert.equal(sec.hits.length, 1);
    assert.equal(sec.hits[0].entry.id, hidden.entry.id);
    assert.equal(sec.more, 0, "the remainder count must reflect the filtered set");
  });
});

describe("searchByType — the All tab's results, grouped by type", () => {
  test("empty query returns no blocks", () => {
    assert.deepEqual(searchByType(""), []);
    assert.deepEqual(searchByType("   "), []);
  });

  test("one query splits into per-TYPE blocks — every hit matches its block's kind", () => {
    // 生 is a kanji AND appears inside many words, so a by-type search must land
    // those in separate typed blocks, not one mixed list.
    const blocks = searchByType("生");
    assert.ok(blocks.length >= 2, "生 should reach more than one subject");
    for (const b of blocks) {
      assert.ok(b.hits.length > 0, `${b.kind} block must not be empty`);
      for (const h of b.hits) {
        assert.equal(h.entry.kind, b.kind, `${h.entry.glyph} is in the wrong block`);
      }
    }
    // The kanji itself, and the words it is inside, are present as distinct blocks.
    const kinds = blocks.map((b) => b.kind);
    assert.ok(kinds.includes("kanji"), "生 the kanji");
    assert.ok(kinds.includes("word"), "words containing 生");
  });

  test("blocks are in curriculum TEACHING ORDER (a subsequence of KINDS)", () => {
    const blocks = searchByType("生");
    const positions = blocks.map((b) => KINDS.indexOf(b.kind));
    const sorted = [...positions].sort((a, b) => a - b);
    assert.deepEqual(positions, sorted, "blocks must follow KINDS order");
    assert.ok(positions.every((p) => p >= 0), "every block is a known kind");
  });

  test("a type with zero matches is ABSENT — no empty header", () => {
    const blocks = searchByType("生");
    for (const b of blocks) assert.ok(b.hits.length > 0);
    // A query that can only be a kana: no kanji/word/grammar block appears.
    const kanaOnly = searchByType("し");
    assert.ok(
      kanaOnly.some((b) => b.kind === "kana"),
      "し must produce a kana block",
    );
    // Whatever blocks come back, none is empty — emptiness is dropped, not headed.
    for (const b of kanaOnly) assert.ok(b.hits.length > 0);
  });

  test("the knowledge filter reaches by-type results too", () => {
    const kanjiOnly = searchByType("生", { keep: (e) => e.kind === "kanji" });
    assert.ok(kanjiOnly.length > 0, "生 still matches a kanji");
    assert.deepEqual(
      kanjiOnly.map((b) => b.kind),
      ["kanji"],
      "keep=kanji leaves only the kanji block",
    );
  });

  test("a subject TAB stays scoped — search(kind) returns only that kind", () => {
    // The contrast the tabs promise: All spans everything, a subject tab does
    // not. searchByType finds 生 across kinds; search scoped to Words finds only
    // words, and never the kanji 生 itself.
    const spanning = searchByType("生");
    assert.ok(spanning.some((b) => b.kind === "kanji"));
    const wordsTab = search("生", { kind: "word" });
    assert.ok(wordsTab.length > 0, "生 should match some words");
    for (const s of wordsTab) {
      for (const h of s.hits) {
        assert.equal(h.entry.kind, "word", `${h.entry.glyph} escaped the Words tab`);
      }
    }
  });
});
