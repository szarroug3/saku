// Run: node --import ./src/lib/conjugate/test-hooks.mjs --test src/lib/content/numbers-track.test.ts

import assert from "node:assert/strict";
import test from "node:test";

import { unitItem } from "./numbers-track.ts";
import { GENERATIVE_UNITS } from "@/lib/counter-lesson";
import { kanjiEntry } from "@/data/kanji";

const unit = (id: string) => GENERATIVE_UNITS.find((u) => u.id === id)!;

test("unitItem — the tens unit is a generative-rule item carrying its Sino-number kanji as prereqs", () => {
  const item = unitItem(unit("tens"));
  assert.ok(item, "the tens unit builds");
  assert.equal(item!.kind, "generative-rule");
  assert.equal(item!.glyph, "十〜", "display glyph comes from the category fact");
  assert.ok(item!.facts.length >= 1, "carries its drillable category fact");
  for (const c of ["一", "五", "十"]) {
    assert.ok(
      item!.prereqs.includes(kanjiEntry(c)),
      `tens needs the Sino number ${c} taught first`,
    );
  }
});

test("unitItem — a counter unit's prereq is its own counter kanji", () => {
  const hon = unitItem(unit("hon"));
  assert.equal(hon!.glyph, "〜本");
  assert.deepEqual(hon!.prereqs, [kanjiEntry("本")], "〜本 needs 本, nothing else directly");
});

test("unitItem — every generative unit builds (none is hollow)", () => {
  for (const u of GENERATIVE_UNITS) {
    const item = unitItem(u);
    assert.ok(item, `${u.id} builds`);
    assert.equal(item!.kind, "generative-rule");
  }
});
