// Run: node --import ./src/lib/conjugate/test-hooks.mjs --test src/lib/content/unit-scheduler.test.ts
//
// The unit scheduler's algorithm, tested on REAL teaching units (teach-unit.ts)
// and synthetic histories. `nextUnitLesson` is the wired entry; `planUnitLesson`
// is the pure core exposed so the depth gate can be exercised at a chosen depth —
// the real curriculum's deepest Built-from chain is 3, so the gate at the shipped
// MAX_PREREQ_DEPTH never fires on real data (verified: 荷→何→可→口 is exactly 3).

import assert from "node:assert/strict";
import test from "node:test";

import { nextUnitLesson, nextTrackLesson, planUnitLesson } from "./unit-scheduler.ts";
import { transitivityItems } from "./verb-pair-unit.ts";
import { teachUnitsOf } from "./teach-unit.ts";
import {
  orderedUnits,
  pronunciationUnitsOf,
  isUnitDue,
  byFrequencyDesc,
  unitFrequency,
  unitCost,
} from "./teach-unit.ts";
import { buildGlyphItem } from "./build-item.ts";
import { emptyHistory, applyClaims, applyDropClaims } from "@/lib/history-ops";
import { factsOf } from "@/lib/facts";
import { CURRICULUM_SEQUENCE } from "@/lib/curriculum-order";
import type { FactId } from "@/types";
import type { PronunciationUnit } from "./teach-unit";

const roomy = { min: 100, max: 100 }; // never caps — for ordering/gate tests
const key = (u: PronunciationUnit) => `${u.glyph}:${u.reading}`;

/** The teaching units of one glyph, most-spoken first. */
function units(glyph: string): PronunciationUnit[] {
  return [...pronunciationUnitsOf(buildGlyphItem(glyph)!)].sort(byFrequencyDesc);
}

/** Mark a unit learned by claiming all of its facts. */
function learn(hist: ReturnType<typeof emptyHistory>, unit: PronunciationUnit) {
  return applyClaims(hist, unit.facts as FactId[], 1_000);
}

test("empty history — independent glyphs come out highest-frequency first", () => {
  // 人 and 口 have no prereqs and share no components; the walk is pure frequency.
  const lesson = nextUnitLesson(["人", "口"], emptyHistory(), roomy)!;
  const freqs = (lesson.units as readonly PronunciationUnit[]).map(unitFrequency);
  for (let i = 1; i < freqs.length; i++) {
    assert.ok(freqs[i - 1] >= freqs[i], "non-increasing frequency");
  }
  assert.equal((lesson.units as readonly PronunciationUnit[])[0].reading, "ひと", "人 ひと (6580) leads");
});

test("empty history — a unit's prereqs are taught before it", () => {
  // 何 is built on 人 and 可; 可 on 口. 何 なん is the single most-spoken reading of
  // all, so it is reached first and must drag its whole component chain in front.
  const lesson = nextUnitLesson(["何"], emptyHistory(), roomy)!;
  const seq = (lesson.units as readonly PronunciationUnit[]).map(key);
  const nan = seq.indexOf("何:なん");
  assert.ok(nan >= 0, "何 なん is taught");
  for (const pre of ["人:ひと", "可:か", "口:くち"]) {
    const i = seq.indexOf(pre);
    assert.ok(i >= 0 && i < nan, `${pre} (a component's primary unit) precedes 何 なん`);
  }
  // 口 (deepest, via 可) precedes 可, which precedes 何 — dependency order holds.
  assert.ok(seq.indexOf("口:くち") < seq.indexOf("可:か"), "口 before 可");
});

test("a learned unit is skipped, its siblings still taught", () => {
  const hito = units("人").find((u) => u.reading === "ひと")!;
  const hist = learn(emptyHistory(), hito); // 人 ひと now claimed → not due
  const lesson = nextUnitLesson(["人"], hist, roomy)!;
  const readings = (lesson.units as readonly PronunciationUnit[]).map((u) => u.reading);
  assert.ok(!readings.includes("ひと"), "the learned reading is not re-taught");
  assert.ok(readings.includes("にん") && readings.includes("じん"), "its siblings remain");
});

test("budget — fills toward min and stops there", () => {
  // Five prereq-free, cost-1 units available; min 3 with headroom to spare.
  const lesson = nextUnitLesson(["人", "口", "木", "大", "一"], emptyHistory(), {
    min: 3,
    max: 100,
  })!;
  const spent = (lesson.units as readonly PronunciationUnit[]).reduce((n, u) => n + unitCost(u), 0);
  assert.equal(spent, 3, "reaches min=3 and stops, though max leaves room");
});

test("budget — a lone oversized bundle is taught, but nothing more is added", () => {
  // 何 なん drags in 人 + 口 + 可 = a 4-cost bundle; range ceiling is only 2. The
  // first bundle is emitted whole (a due unit can't yield an empty lesson), and no
  // later unit (何 なに) is allowed to push past the ceiling on top of it.
  const lesson = nextUnitLesson(["何"], emptyHistory(), { min: 1, max: 2 })!;
  const spent = (lesson.units as readonly PronunciationUnit[]).reduce((n, u) => n + unitCost(u), 0);
  assert.ok(spent > 2, "the lone bundle exceeds max on its own");
  const readings = (lesson.units as readonly PronunciationUnit[]).map(key);
  assert.ok(readings.includes("何:なん"), "the oversized bundle is taught");
  assert.ok(!readings.includes("何:なに"), "no further unit is added past the ceiling");
});

test("depth gate — a unit whose untaught chain is too deep is deferred", () => {
  // 荷 → 何 → 可 → 口 is a depth-3 component chain, all untaught from empty history.
  // At the shipped depth it is teachable; drop the ceiling to 2 and 荷 is gated.
  const order = orderedUnits(["荷"]);
  const at3 = planUnitLesson(order, emptyHistory(), roomy, 3);
  assert.ok(at3.some((u) => u.item.glyph === "荷"), "at maxDepth 3 荷 に is taught");

  const at2 = planUnitLesson(order, emptyHistory(), roomy, 2);
  assert.ok(!at2.some((u) => u.item.glyph === "荷"), "at maxDepth 2 荷 は deferred (chain too deep)");
  assert.equal(at2.length, 0, "荷 is the only glyph and it is gated → nothing emitted");
});

test("depth gate — learning the deep tail lifts the gate", () => {
  // With 口 (the depth-3 leaf) learned, 荷's remaining untaught chain is only 2 deep.
  const kuchi = units("口").find((u) => u.reading === "くち")!;
  const hist = learn(emptyHistory(), kuchi);
  const at2 = planUnitLesson(orderedUnits(["荷"]), hist, roomy, 2);
  assert.ok(at2.some((u) => u.item.glyph === "荷"), "荷 teaches once its deep leaf is known");
});

test("invariants over the real curriculum — every unit due, none twice", () => {
  const glyphs = CURRICULUM_SEQUENCE.map((i) => i.glyph);

  const check = (hist: ReturnType<typeof emptyHistory>) => {
    const lesson = nextUnitLesson(glyphs, hist, { min: 5, max: 7 });
    assert.ok(lesson, "something is always due");
    const seen = new Set<string>();
    for (const u of (lesson!.units as readonly PronunciationUnit[])) {
      assert.ok(isUnitDue(u, hist), `${key(u)} is due`);
      assert.ok(!seen.has(key(u)), `${key(u)} appears only once`);
      seen.add(key(u));
    }
  };

  check(emptyHistory());

  // Partial history: learn the first lesson, the next must still hold the invariants.
  const first = nextUnitLesson(glyphs, emptyHistory(), { min: 5, max: 7 })!;
  let hist = emptyHistory();
  for (const u of (first.units as readonly PronunciationUnit[])) hist = learn(hist, u);
  check(hist);
});

test("null when nothing is due", () => {
  let hist = emptyHistory();
  for (const u of units("人")) hist = learn(hist, u);
  assert.equal(nextUnitLesson(["人"], hist, roomy), null, "all units learned → no lesson");
});

test("polymorphic — the same scheduler drives a non-pronunciation track", () => {
  // Verb-pair units carry no reading; the base contract (item/facts/cost) is all
  // the scheduler reads, so nextTrackLesson orders and budgets them uniformly.
  const order = transitivityItems().flatMap(teachUnitsOf);
  // A pair is BLOCKED by its verbs, so from an empty history nothing is teachable.
  assert.equal(
    nextTrackLesson(order, emptyHistory(), { min: 2, max: 4 }),
    null,
    "every pair is blocked until its verbs are learned",
  );
  // Learn one pair's verbs and it becomes teachable — alone, no kanji pulled in.
  const open = transitivityItems().find((i) => String(i.entry) === "transitivity:開く/開ける")!;
  let hist = emptyHistory();
  for (const w of open.blockedBy) hist = applyClaims(hist, factsOf(w) as FactId[], 1);
  const lesson = nextTrackLesson(order, hist, { min: 2, max: 4 });
  assert.ok(lesson, "with its verbs known, the pair schedules");
  assert.ok(
    lesson!.units.every((u) => u.kind === "verb-pair"),
    "a blocking prereq is never pulled in — the lesson is pairs only",
  );
});

// SAK-103: "Mark as not known" (Library's unclaim, applyDropClaims) has to
// bring a fact's lesson back, not just make it due somewhere far down the
// track's frozen order. Reproduces the prod bug: 木 (learned, then reset) is
// due at the same time as 人 (never met, and far more frequent — see the
// empty-history ordering test above, 人 leads every empty-history lesson). A
// budget of exactly one unit forces the walk to pick between them, and the
// walk used to pick purely by frequency — 人, every time — leaving a reset
// fact invisible behind the track's genuinely-new material for as long as
// that material lasted (14k+ units on the real vocab track). The regression
// (a fact `history.learnedAt` remembers as once-met, applyDropClaims never
// erases that) has to win the tie instead.
test("SAK-103 — a reset (regressed) unit outranks a never-met, higher-frequency one", () => {
  const ki = units("木").find((u) => u.reading === "き")!;
  let hist = applyClaims(emptyHistory(), ki.facts as FactId[], 1_000);
  hist = applyDropClaims(hist, ki.facts as FactId[]); // "Mark as not known"
  assert.equal(hist.claims?.["word:木/reading" as FactId], undefined, "the claim is gone");
  assert.notEqual(hist.learnedAt?.["word:木/reading" as FactId], undefined, "learnedAt survives the reset");

  const lesson = nextUnitLesson(["人", "木"], hist, { min: 1, max: 1 })!;
  const readings = (lesson.units as readonly PronunciationUnit[]).map((u) => u.reading);
  assert.ok(readings.includes("き"), "the reset 木 き is taught, not buried behind fresh 人");
});
