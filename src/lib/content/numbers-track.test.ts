// Run: node --import ./src/lib/conjugate/test-hooks.mjs --test src/lib/content/numbers-track.test.ts

import assert from "node:assert/strict";
import test from "node:test";

import { unitItem, formItem } from "./numbers-track.ts";
import { GENERATIVE_UNITS } from "@/lib/counter-lesson";
import { COUNTER_CURRICULUM } from "@/data/counters";
import { kanjiEntry } from "@/data/kanji";

const unit = (id: string) => GENERATIVE_UNITS.find((u) => u.id === id)!;
const form = (key: string) => COUNTER_CURRICULUM.find((f) => f.key === key)!;

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

test("formItem — a kana 〜つ form is a counter item with a meaning fact, no prereqs", () => {
  const item = formItem(form("counter:tsu:3"));
  assert.ok(item, "みっつ builds");
  assert.equal(item!.kind, "counter");
  assert.equal(item!.glyph, "みっつ");
  assert.deepEqual(item!.facts.map((f) => f.kind), ["definition"], "meaning only — kana");
  assert.equal(item!.prereqs.length, 0, "pure kana needs no kanji");
});

test("formItem — 二十歳 carries reading + meaning and its kanji prereqs", () => {
  const item = formItem(form("counter:sai:20"));
  assert.equal(item!.glyph, "二十歳");
  const kinds = new Set(item!.facts.map((f) => f.kind));
  assert.ok(kinds.has("romaji") && kinds.has("definition"), "reading + meaning");
  for (const c of ["二", "十", "歳"]) {
    assert.ok(item!.prereqs.includes(kanjiEntry(c)), `二十歳 needs ${c}`);
  }
});

test("formItem — every base curriculum form builds (none is hollow)", () => {
  for (const f of COUNTER_CURRICULUM) {
    assert.ok(formItem(f), `${f.key} builds`);
  }
});
