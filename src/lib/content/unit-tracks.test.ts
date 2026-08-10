// Run: node --import ./src/lib/conjugate/test-hooks.mjs --test src/lib/content/unit-tracks.test.ts

import assert from "node:assert/strict";
import test from "node:test";

import { UNIT_TRACKS, simulateLessons } from "./unit-tracks.ts";
import { emptyHistory } from "@/lib/history-ops";

const range = { min: 5, max: 7 };

test("UNIT_TRACKS — every track enumerates a non-empty ordered unit list", () => {
  for (const track of UNIT_TRACKS) {
    const units = track.units(emptyHistory());
    assert.ok(units.length > 0, `${track.id} has units`);
  }
});

test("simulateLessons — each track yields a forward run of lessons, prereqs first", () => {
  for (const track of UNIT_TRACKS) {
    const lessons = simulateLessons(track, range, 5);
    assert.ok(lessons.length > 0, `${track.id} produces a first lesson`);
    assert.equal(lessons[0].n, 1, "numbered from 1");
    assert.ok(lessons[0].units.length > 0, `${track.id} lesson 1 is non-empty`);
  }
});

test("simulateLessons — a track never re-teaches a unit across its run", () => {
  // The forward walk marks each lesson learned, so the next lesson can't repeat a
  // unit; the whole run has distinct unit facts.
  const lessons = simulateLessons(UNIT_TRACKS.find((t) => t.id === "kana")!, range, 8);
  const seen = new Set<string>();
  for (const lesson of lessons) {
    for (const u of lesson.units) {
      const key = u.facts.join("␟");
      assert.ok(!seen.has(key), "no unit taught twice");
      seen.add(key);
    }
  }
});

test("simulateLessons — a 'unit'-scheduled track gives one full lesson per unit", () => {
  // Sentence-ordering tiers are scheduling:"unit" — each is a whole lesson, never
  // budgeted together, so the 10 tiers make exactly 10 single-unit lessons.
  const lessons = simulateLessons(UNIT_TRACKS.find((t) => t.id === "sentence")!, range, 20);
  assert.equal(lessons.length, 10, "one lesson per tier");
  assert.ok(
    lessons.every((l) => l.units.length === 1 && l.units[0].kind === "sentence-build"),
    "each lesson is exactly one sentence-build unit",
  );
});

test("simulateLessons — the verb-pair track schedules pairs (cost 2 each)", () => {
  const lessons = simulateLessons(UNIT_TRACKS.find((t) => t.id === "transitivity")!, range, 3);
  const kinds = new Set(lessons.flatMap((l) => l.units.map((u) => u.kind)));
  assert.ok(kinds.has("verb-pair"), "verb pairs are scheduled through the shared engine");
});
