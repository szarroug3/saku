// Run: node --import ./src/lib/conjugate/test-hooks.mjs --test src/lib/content/numbers-track.test.ts

import assert from "node:assert/strict";
import test from "node:test";

import { unitItem, formItem, numbersTrack } from "./numbers-track.ts";
import { nextLesson } from "./scheduler.ts";
import { resolveItem } from "./resolve.ts";
import { GENERATIVE_UNITS } from "@/lib/counter-lesson";
import { COUNTER_CURRICULUM } from "@/data/counters";
import { emptyHistory } from "@/lib/history-ops";
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

test("numbersTrack — order follows SCHEDULE: 〜つ natives, then the range units", () => {
  const items = numbersTrack().order(emptyHistory());
  assert.equal(items[0].glyph, "ひとつ", "the 〜つ natives lead");
  const tens = items.findIndex((i) => i.glyph === "十〜");
  const too = items.findIndex((i) => i.glyph === "とお");
  assert.ok(tens > too && too >= 0, "the tens unit comes after the last 〜つ form");
  assert.ok(
    items.some((i) => i.kind === "generative-rule"),
    "the generative units are in the order",
  );
});

test("numbersTrack — the Sino numbers 一…十, 百千万 are first-class cohesive items", () => {
  const items = numbersTrack().order(emptyHistory());
  const numbers = items.filter((i) => i.kind === "character");
  for (const g of ["一", "五", "十", "百", "千", "万"]) {
    const n = numbers.find((i) => i.glyph === g);
    assert.ok(n, `${g} is a character item in the number track`);
    assert.ok(n!.facts.some((f) => f.kind === "romaji"), `${g} carries its reading (さん…)`);
  }
  // Numbers sit before the range unit that composes them.
  const three = items.findIndex((i) => i.kind === "character" && i.glyph === "三");
  const tens = items.findIndex((i) => i.glyph === "十〜");
  assert.ok(three >= 0 && three < tens, "三 is taught before the compose-11-99 unit");
});

test("numbersTrack — a number appears ONCE, not split into kanji + number", () => {
  // The whole point of the cohesive item: 三 is a single row, carrying both its
  // kanji facts and its さん reading — never taught twice.
  const threes = numbersTrack()
    .order(emptyHistory())
    .filter((i) => i.glyph === "三");
  assert.equal(threes.length, 1, "three appears exactly once");
  assert.equal(threes[0].entry, kanjiEntry("三"), "identified by the canonical kanji entry");
});

test("numbersTrack × nextLesson — a first lesson comes out of an empty history", () => {
  // End to end: the shared scheduler drives the migrated track. The 〜つ natives
  // are due (empty history) and lead, proving the track plugs into nextLesson.
  const lesson = nextLesson(numbersTrack(), resolveItem, emptyHistory(), { min: 5, max: 7 });
  assert.ok(lesson, "there is a first lesson");
  assert.equal(lesson!.items[0].glyph, "ひとつ", "it opens on the first native");
});
