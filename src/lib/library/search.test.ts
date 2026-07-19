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

import { search, searchAll } from "@/lib/library/search";

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
