// Run: node --import ./src/lib/conjugate/test-hooks.mjs --test src/lib/content/scheduler.test.ts
//
// The scheduler's algorithm, tested on SYNTHETIC items — no real facts/history.
// planLesson is the pure core; here dueness and cost are trivial injectables, so
// these pin the ORDERING (prereq before item), the DEPTH GATE, and the BUDGET.

import assert from "node:assert/strict";
import test from "node:test";

import { planLesson, nextLesson } from "./scheduler.ts";
import { buildGlyphItem } from "./build-item.ts";
import { emptyHistory } from "@/lib/history-ops";
import type { ContentItem } from "./item";
import type { Track } from "./track";
import type { EntryId } from "@/types";

// A bare item with just the fields the scheduler reads.
function mk(entry: string, prereqs: string[] = []): ContentItem {
  return {
    entry: entry as EntryId,
    kind: "word",
    glyph: entry,
    facts: [],
    roles: [],
    prereqs: prereqs as EntryId[],
    blockedBy: [],
    typeLabel: "",
  };
}

function world(...items: ContentItem[]) {
  const map = new Map(items.map((i) => [i.entry, i]));
  return (entry: EntryId) => map.get(entry);
}

const due = () => true; // everything unlearned
const cost1 = () => 1;
const roomy = { min: 100, max: 100 }; // never caps — for ordering/gate tests

test("planLesson — an item is preceded by its untaught prereq", () => {
  const b = mk("B");
  const a = mk("A", ["B"]);
  const out = planLesson([a], world(a, b), due, cost1, roomy);
  assert.deepEqual(
    out.map((i) => i.entry),
    ["B", "A"],
    "B (the prereq) is taught before A",
  );
});

test("planLesson — a learned prereq is neither re-taught nor extends the chain", () => {
  const b = mk("B");
  const a = mk("A", ["B"]);
  const learned = (i: ContentItem) => i.entry !== "B"; // B already known
  const out = planLesson([a], world(a, b), learned, cost1, roomy);
  assert.deepEqual(out.map((i) => i.entry), ["A"], "only A is taught");
});

test("planLesson — an item whose untaught chain is too deep is deferred", () => {
  // A→B→C→D→E, nothing known. With maxDepth 3, E sits at depth 4 → defer A.
  const chain = ["A", "B", "C", "D", "E"];
  const items = chain.map((c, i) => mk(c, i + 1 < chain.length ? [chain[i + 1]] : []));
  const out = planLesson([items[0]], world(...items), due, cost1, roomy, 3);
  assert.equal(out.length, 0, "A is gated out — its cascade is too deep for one lesson");
});

test("planLesson — the gate lifts once the deep tail is learned", () => {
  const chain = ["A", "B", "C", "D", "E"];
  const items = chain.map((c, i) => mk(c, i + 1 < chain.length ? [chain[i + 1]] : []));
  const eLearned = (i: ContentItem) => i.entry !== "E"; // deepest is now known
  const out = planLesson([items[0]], world(...items), eLearned, cost1, roomy, 3);
  assert.deepEqual(
    out.map((i) => i.entry),
    ["D", "C", "B", "A"],
    "with E known the chain is shallow enough; D..A teach in dependency order",
  );
});

test("planLesson — filling stops once the floor is reached", () => {
  const items = ["A", "B", "C", "D", "E"].map((c) => mk(c));
  const out = planLesson(items, world(...items), due, cost1, { min: 3, max: 7 });
  assert.equal(out.length, 3, "reaches min=3 and stops, though max leaves room");
});

test("planLesson — a bundle that would cross the ceiling ends the lesson below the floor", () => {
  // cost-3 bundles, range 5..5: A fills to 3 (< floor), but B would reach 6 > max.
  const items = ["A", "B"].map((c) => mk(c));
  const out = planLesson(items, world(...items), due, () => 3, { min: 5, max: 5 });
  assert.deepEqual(out.map((i) => i.entry), ["A"], "stops below min rather than exceed max");
});

test("planLesson — a lone bundle bigger than the whole range is still taught", () => {
  const a = mk("A");
  const out = planLesson([a], world(a), due, () => 9, { min: 3, max: 5 });
  assert.deepEqual(out.map((i) => i.entry), ["A"], "never an empty lesson for a due item");
});

test("planLesson — a prereq shared by two items is taught once", () => {
  const b = mk("B");
  const a = mk("A", ["B"]);
  const c = mk("C", ["B"]);
  const out = planLesson([a, c], world(a, b, c), due, cost1, roomy);
  assert.deepEqual(out.map((i) => i.entry), ["B", "A", "C"], "B appears once, before both");
});

// nextLesson wires the pure core to real history: dueness = a fresh fact, cost =
// glyphDifficulty. Against an EMPTY history every fact is fresh, so a real item is
// due and gets taught — proving the seam, not re-testing the algorithm.
test("nextLesson — a real due item is taught out of an empty history", () => {
  const item = buildGlyphItem("三")!;
  const track: Track = { id: "test", order: () => [item] };
  const resolve = (e: EntryId) => (e === item.entry ? item : undefined);
  const lesson = nextLesson(track, resolve, emptyHistory(), { min: 5, max: 7 });
  assert.ok(lesson, "an empty history leaves the number due");
  assert.ok(
    lesson!.items.some((i) => i.glyph === "三"),
    "the due number is in the lesson",
  );
});

test("nextLesson — an empty track yields no lesson", () => {
  const track: Track = { id: "empty", order: () => [] };
  const lesson = nextLesson(track, () => undefined, emptyHistory(), { min: 5, max: 7 });
  assert.equal(lesson, null);
});
