// SAK-20 — a transitivity pair's round-summary row used to be labelled after
// whichever side was minted first (出る), even on a row showing the OTHER
// side's question (出す). See entry-display-label.ts's header for the root
// cause: both sides of a pair share one entry, and the old default label
// (glyphOf(entry)) reads only the first-inserted fact's glyph.
//
// This file checks the fix directly — entryDisplayLabel reads the GLYPH OF
// THE FACT PASSED IN, not the entry — and then replays the exact table
// pipeline (groupByEntry → groupRowsByDisplayLabel) a round-complete/triage
// screen runs, to prove a round asking both sides of a pair renders as two
// rows, each correctly named.

import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { entryDisplayLabel } from "@/components/results/entry-display-label";
import { groupByEntry } from "@/lib/results-grouping";
import { groupRowsByDisplayLabel } from "@/components/results/word-table-grouping";
import { glyphOf } from "@/lib/facts";
import { pairEntry, sideFactId } from "@/data/transitivity-facts";
import { VERB_PAIRS } from "@/data/transitivity";
import type { HistoryFile } from "@/types";

const EMPTY_HISTORY: HistoryFile = { sessions: [], facts: {} };

// The pair the bug report was filed against.
const DERU_DASU = VERB_PAIRS.find(
  (p) => p.happens.word === "出る" && p.doIt.word === "出す",
);

describe("entryDisplayLabel — transitivity pairs", () => {
  test("出る／出す exists in the curated table (guards the fixture)", () => {
    assert.ok(DERU_DASU, "expected a 出る/出す pair in VERB_PAIRS");
  });

  test("labels each side by the verb actually asked, not the pair's first-minted side", () => {
    const p = DERU_DASU!;
    const entry = pairEntry(p);
    const happens = sideFactId(p, "happens"); // 出る
    const doIt = sideFactId(p, "doIt"); // 出す

    assert.equal(entryDisplayLabel(entry, happens, EMPTY_HISTORY), "出る");
    assert.equal(entryDisplayLabel(entry, doIt, EMPTY_HISTORY), "出す");
  });

  test("every verb pair labels its two sides distinctly", () => {
    for (const p of VERB_PAIRS) {
      const entry = pairEntry(p);
      const happens = sideFactId(p, "happens");
      const doIt = sideFactId(p, "doIt");
      assert.equal(entryDisplayLabel(entry, happens, EMPTY_HISTORY), p.happens.word);
      assert.equal(entryDisplayLabel(entry, doIt, EMPTY_HISTORY), p.doIt.word);
    }
  });

  test("the un-fixed default (glyphOf(entry)) really does collapse both sides — the bug this test guards against", () => {
    // This is not asserting a fix; it demonstrates the failure mode
    // entryDisplayLabel exists to avoid, so a future refactor that quietly
    // routes transitivity rows back through glyphOf(entry) gets caught here
    // even before it reaches round-complete.tsx.
    const p = DERU_DASU!;
    const entry = pairEntry(p);
    const doIt = sideFactId(p, "doIt"); // asking about 出す...
    // ...but the shared-entry glyph always reads back the first-minted side.
    assert.equal(glyphOf(entry), "出る");
    assert.notEqual(glyphOf(entry), entryDisplayLabel(entry, doIt, EMPTY_HISTORY));
  });
});

describe("round-summary table pipeline — a round that asks both sides of a pair", () => {
  test("renders two rows, each labelled with the verb actually asked", () => {
    const p = DERU_DASU!;
    const happens = sideFactId(p, "happens"); // 出る, asked
    const doIt = sideFactId(p, "doIt"); // 出す, asked directly (the bug report's だす answer)

    // Exactly what round-complete.tsx feeds WordTable: the facts this round
    // answered, grouped into entry-rows first (results-grouping.groupByEntry)
    // and then split into display rows by the label actually asked
    // (word-table-grouping.groupRowsByDisplayLabel + entryDisplayLabel).
    const entryRows = groupByEntry([happens, doIt]);
    assert.equal(entryRows.length, 1, "both sides share one entry, as minted");

    const displayRows = groupRowsByDisplayLabel(
      entryRows,
      glyphOf,
      (entry, fact) => entryDisplayLabel(entry, fact, EMPTY_HISTORY),
    );

    assert.equal(displayRows.length, 2, "the round played both sides — two rows, not one");
    const headings = displayRows.map((r) => r.heading).sort();
    assert.deepEqual(headings, ["出す", "出る"].sort());

    // Each row carries only the fact it was actually named after — 出す's row
    // must not silently also hold 出る's fact (that would just move the
    // collapse from the label to the row contents).
    const deruRow = displayRows.find((r) => r.heading === "出る")!;
    const dasuRow = displayRows.find((r) => r.heading === "出す")!;
    assert.deepEqual(deruRow.facts, [happens]);
    assert.deepEqual(dasuRow.facts, [doIt]);
  });

  test("a round that only ever asks one side still renders that one row, correctly labelled", () => {
    const p = DERU_DASU!;
    const doIt = sideFactId(p, "doIt"); // only 出す asked this round

    const entryRows = groupByEntry([doIt]);
    const displayRows = groupRowsByDisplayLabel(
      entryRows,
      glyphOf,
      (entry, fact) => entryDisplayLabel(entry, fact, EMPTY_HISTORY),
    );

    assert.equal(displayRows.length, 1);
    assert.equal(displayRows[0].heading, "出す");
    assert.deepEqual(displayRows[0].facts, [doIt]);
  });
});
