// Run: node --import ./src/lib/conjugate/test-hooks.mjs --test src/lib/content/unit-tracks.test.ts

import assert from "node:assert/strict";
import test from "node:test";

import { UNIT_TRACKS, simulateLessons } from "./unit-tracks.ts";
import { emptyHistory } from "@/lib/history-ops";
import { CURRICULUM_SEQUENCE } from "@/lib/curriculum-order.ts";
import type { PronunciationUnit } from "./teach-unit.ts";

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

// SAK-173 — vocabUnits() used to seed its glyph set from CURRICULUM_SEQUENCE
// (today's frozen, prerequisite-aware, per-pronunciation-frequency-interleaved
// order) and then hand it to orderedUnits(), which built every glyph's units
// and re-sorted the WHOLE track by raw CEJC frequency — discarding
// CURRICULUM_SEQUENCE's order entirely. The live Vocab lesson and the
// Library's own ranking (curriculum-sequence.json / word-rank.json) ended up
// reading two different orders for the same content. These tests pin the fix:
// the vocab track's actual unit sequence follows CURRICULUM_SEQUENCE, verbatim.
test("vocab track order matches CURRICULUM_SEQUENCE verbatim, position for position", () => {
  const vocab = UNIT_TRACKS.find((t) => t.id === "vocab")!;
  const units = vocab.units(emptyHistory()) as readonly PronunciationUnit[];
  assert.equal(
    units.length,
    CURRICULUM_SEQUENCE.length,
    "one vocab unit per CURRICULUM_SEQUENCE entry — nothing dropped, nothing added",
  );
  for (let i = 0; i < CURRICULUM_SEQUENCE.length; i++) {
    const item = CURRICULUM_SEQUENCE[i];
    const unit = units[i];
    assert.equal(unit.glyph, item.glyph, `position ${i}: glyph`);
    assert.equal(unit.reading, item.reading, `position ${i}: reading`);
  }
});

test("だ/です/と/よ/ね/も/って — punted particles are taught as Grammar, not Vocab at all", () => {
  // Surfaced live (SAK-173): a fresh account's first 10 Vocabulary words
  // included だ, ね, と, も, よ, って, です — a raw-frequency artifact. Every one
  // of these is a bound particle/copula, not a content word. SAK-173 fixed
  // the ORDERING bug (the vocab track now follows CURRICULUM_SEQUENCE); SAK-174
  // then decided these seven have no real vocabulary sense at all and pulled
  // them out of CURRICULUM_WORDS entirely (word-lesson.ts's PARTICLE_TRACK_KEBS),
  // so they don't surface anywhere on the Vocab track any more — they're taught
  // as bare Grammar recipes instead (da/desu/mo/ne/yo/tte/to-and/ga-nai).
  const vocab = UNIT_TRACKS.find((t) => t.id === "vocab")!;
  const units = vocab.units(emptyHistory()) as readonly PronunciationUnit[];
  const positionOf = (glyph: string) => units.findIndex((u) => u.glyph === glyph);

  for (const glyph of ["だ", "です", "と", "よ", "ね", "も", "って"]) {
    assert.equal(positionOf(glyph), -1, `${glyph} is no longer taught on the vocab track`);
  }

  // The curated conversational bootstrap that WAS already correct must stay
  // that way — this fix corrects the punted words without disturbing it.
  assert.ok(positionOf("うん") < 10, "うん still opens the track");
  assert.ok(positionOf("そう") < 10, "そう still opens the track");
});
