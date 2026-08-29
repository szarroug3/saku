// Run: node --import ./src/lib/conjugate/test-hooks.mjs --test src/lib/content/learn-scheduler.test.ts
//
// SAK-240: learn-scheduler.ts had zero tests despite driving the home feed,
// current-sessions, and the /learn index — the /learn twin of the app's
// spaced-repetition engine. These are hand-built, content-free fixtures (no
// dictionary, no learn-index.json) exercising the decision logic each export
// owns directly, rather than only the equivalence-with-the-live-scheduler
// coverage learn-index.equiv.test.ts already provides for the sentence-gate
// functions.

import assert from "node:assert/strict";
import test from "node:test";

import {
  learnDepsOf,
  nextLearnLesson,
  nextSentenceLearnLesson,
  nextSentenceTierId,
  sentenceLearnLessonForRun,
  sentenceTierIdOfEntry,
  startedLearnTracks,
  trackIdOfFact,
  trackIdOfFactMap,
  type LearnDepsIndex,
} from "./learn-scheduler.ts";
import type { IndexSentenceGate, IndexTrack, IndexUnit } from "./learn-index-types.ts";
import { emptyHistory, applyClaims } from "@/lib/history-ops";
import { sentenceTierMarkerFact } from "@/lib/sentence-ordering-progress";
import type { EntryId, FactId } from "@/types";

const fact = (id: string): FactId => id as FactId;
const entry = (id: string): EntryId => id as EntryId;

/** A minimal, valid IndexUnit — only the fields a test cares about vary. */
function unit(
  entryId: string,
  facts: FactId[],
  opts: { prereqs?: EntryId[]; blockedBy?: EntryId[] } = {},
): IndexUnit {
  return {
    kind: "character",
    scheduling: "cost",
    cost: 1,
    facts,
    item: {
      entry: entry(entryId),
      glyph: entryId,
      typeLabel: "kanji",
      kind: "character",
      roles: [],
      prereqs: opts.prereqs ?? [],
      blockedBy: opts.blockedBy ?? [],
    },
  };
}

// ── learnDepsOf ──────────────────────────────────────────────────────────────
// The adapter that wires a precomputed index into the shared scheduler core.
// Nothing else in the app exercises its three touch-points on their own.

test("learnDepsOf.resolvePrereq — undefined for an entry the index cannot reach", () => {
  const index: LearnDepsIndex = { resolve: {}, blockerFacts: {} };
  assert.equal(learnDepsOf(index).resolvePrereq(entry("missing")), undefined);
});

test("learnDepsOf.resolvePrereq — undefined when the corpus resolves the entry but builds no primary unit", () => {
  const index: LearnDepsIndex = {
    resolve: { e1: { glyph: "一", prereqs: [], unit: null } },
    blockerFacts: {},
  };
  assert.equal(learnDepsOf(index).resolvePrereq(entry("e1")), undefined);
});

test("learnDepsOf.resolvePrereq — passes through the node's glyph/prereqs/unit when it resolves", () => {
  const u = unit("e2", [fact("f2")]);
  const index: LearnDepsIndex = {
    resolve: { e2: { glyph: "二", prereqs: [entry("e1")], unit: u } },
    blockerFacts: {},
  };
  assert.deepEqual(learnDepsOf(index).resolvePrereq(entry("e2")), {
    glyph: "二",
    prereqs: [entry("e1")],
    unit: u,
  });
});

test("learnDepsOf.isLearned — false for an entry with no recorded blocker facts", () => {
  const deps = learnDepsOf({ resolve: {}, blockerFacts: {} });
  assert.equal(deps.isLearned(entry("e1"), emptyHistory()), false);
});

test("learnDepsOf.isLearned — true only once EVERY one of the entry's blocker facts is claimed", () => {
  const index: LearnDepsIndex = {
    resolve: {},
    blockerFacts: { e1: [fact("f1"), fact("f2")] },
  };
  const deps = learnDepsOf(index);
  let history = emptyHistory();
  assert.equal(deps.isLearned(entry("e1"), history), false);
  history = applyClaims(history, [fact("f1")], 1);
  assert.equal(deps.isLearned(entry("e1"), history), false, "one of two facts is not enough");
  history = applyClaims(history, [fact("f2")], 2);
  assert.equal(deps.isLearned(entry("e1"), history), true);
});

test("learnDepsOf.isFactFresh — a fact with no history record is fresh, a claimed one is not", () => {
  const deps = learnDepsOf({ resolve: {}, blockerFacts: {} });
  assert.equal(deps.isFactFresh(fact("f1"), emptyHistory()), true);
  assert.equal(
    deps.isFactFresh(fact("f1"), applyClaims(emptyHistory(), [fact("f1")], 1)),
    false,
  );
});

// ── nextLearnLesson ──────────────────────────────────────────────────────────
// The wired-up walk: an untaught prerequisite gets pulled in ahead of the unit
// that needs it, and the lesson fills toward the range floor across units.

test("nextLearnLesson — a due unit's untaught prereq is pulled in ahead of it", () => {
  const a = unit("e-a", [fact("f-a")]);
  const b = unit("e-b", [fact("f-b")], { prereqs: [entry("e-a")] });
  const index: LearnDepsIndex = {
    resolve: { "e-a": { glyph: "A", prereqs: [], unit: a } },
    blockerFacts: {},
  };

  const tight = nextLearnLesson([a, b], emptyHistory(), { min: 1, max: 5 }, index);
  assert.deepEqual(tight?.units.map((u) => u.item.entry), [entry("e-a")], "the floor stops at the first due unit");

  const wider = nextLearnLesson([a, b], emptyHistory(), { min: 2, max: 5 }, index);
  assert.deepEqual(
    wider?.units.map((u) => u.item.entry),
    [entry("e-a"), entry("e-b")],
    "a wider floor keeps filling, and A is not duplicated once already emitted",
  );
});

test("nextLearnLesson — null once every unit's facts are claimed", () => {
  const a = unit("e-a", [fact("f-a")]);
  const index: LearnDepsIndex = { resolve: {}, blockerFacts: {} };
  const history = applyClaims(emptyHistory(), [fact("f-a")], 1);
  assert.equal(nextLearnLesson([a], history, { min: 1, max: 5 }, index), null);
});

// ── nextSentenceTierId / nextSentenceLearnLesson / sentenceLearnLessonForRun /
//    sentenceTierIdOfEntry ────────────────────────────────────────────────────
// The sentence gate: a linear pool-size + grammar-prereq admission check per
// tier, evaluated purely from precomputed fact ids.

function gate(over: Partial<IndexSentenceGate> & Pick<IndexSentenceGate, "tierId" | "entry">): IndexSentenceGate {
  return { minReadable: 0, grammarPrereqFacts: [], poolSize: 10, facts: [], ...over };
}

test("nextSentenceTierId — a tier whose structural pool is too small blocks every later tier too", () => {
  // The gate loop `return`s (not `continue`s) on an undersized pool, so a small
  // early tier is not merely skipped — nothing after it is reachable either.
  const gates = [
    gate({ tierId: "simple", entry: entry("s-simple"), poolSize: 1, minReadable: 3 }),
    gate({ tierId: "conditional", entry: entry("s-conditional") }),
  ];
  assert.equal(nextSentenceTierId({ sentenceGates: gates }, emptyHistory()), null);
});

test("nextSentenceTierId — an unmet grammar prerequisite blocks the tier (and every tier after it)", () => {
  const gates = [
    gate({
      tierId: "simple",
      entry: entry("s-simple"),
      grammarPrereqFacts: [fact("grammar:wa/meaning")],
    }),
    gate({ tierId: "conditional", entry: entry("s-conditional") }),
  ];
  assert.equal(nextSentenceTierId({ sentenceGates: gates }, emptyHistory()), null);
  const history = applyClaims(emptyHistory(), [fact("grammar:wa/meaning")], 1);
  assert.equal(
    nextSentenceTierId({ sentenceGates: gates }, history),
    "simple",
    "knowing any ONE of the ANY-of grammar prereqs admits the tier",
  );
});

test("nextSentenceTierId — a completed tier is skipped in favor of the next admitted one", () => {
  const gates = [
    gate({ tierId: "simple", entry: entry("s-simple") }),
    gate({ tierId: "conditional", entry: entry("s-conditional") }),
  ];
  const history = applyClaims(emptyHistory(), [sentenceTierMarkerFact("simple")], 1);
  assert.equal(nextSentenceTierId({ sentenceGates: gates }, history), "conditional");
});

test("nextSentenceTierId — null once every tier is completed", () => {
  const gates = [gate({ tierId: "simple", entry: entry("s-simple") })];
  const history = applyClaims(emptyHistory(), [sentenceTierMarkerFact("simple")], 1);
  assert.equal(nextSentenceTierId({ sentenceGates: gates }, history), null);
});

test("nextSentenceLearnLesson — resolves the admitted tier's entry to its unit", () => {
  const gates = [gate({ tierId: "simple", entry: entry("s-simple") })];
  const units = [unit("s-simple", [sentenceTierMarkerFact("simple")])];
  const lesson = nextSentenceLearnLesson(units, emptyHistory(), { sentenceGates: gates });
  assert.deepEqual(lesson?.units.map((u) => u.item.entry), [entry("s-simple")]);
});

test("nextSentenceLearnLesson — null when no tier is admitted, or the admitted tier has no matching unit", () => {
  const gates = [
    gate({ tierId: "simple", entry: entry("s-simple"), poolSize: 0, minReadable: 1 }),
  ];
  assert.equal(nextSentenceLearnLesson([], emptyHistory(), { sentenceGates: gates }), null);

  const openGates = [gate({ tierId: "simple", entry: entry("s-simple") })];
  assert.equal(
    nextSentenceLearnLesson([], emptyHistory(), { sentenceGates: openGates }),
    null,
    "the tier is admitted but no unit in the track builds its entry",
  );
});

test("sentenceLearnLessonForRun — rebuilds the tier pinned by an open run's marker fact", () => {
  const gates = [
    gate({ tierId: "simple", entry: entry("s-simple") }),
    gate({ tierId: "conditional", entry: entry("s-conditional") }),
  ];
  const units = [
    unit("s-simple", [sentenceTierMarkerFact("simple")]),
    unit("s-conditional", [sentenceTierMarkerFact("conditional")]),
  ];
  const index = { sentenceGates: gates };

  const resting = sentenceLearnLessonForRun(units, [sentenceTierMarkerFact("conditional")], index);
  assert.deepEqual(resting?.units.map((u) => u.item.entry), [entry("s-conditional")]);

  assert.equal(sentenceLearnLessonForRun(units, [], index), null, "no held marker fact means no open run");
});

test("sentenceTierIdOfEntry — resolves a sentence lesson entry back to its tier", () => {
  const gates = [gate({ tierId: "simple", entry: entry("s-simple") })];
  const index = { sentenceGates: gates };
  assert.equal(sentenceTierIdOfEntry(entry("s-simple"), index), "simple");
  assert.equal(sentenceTierIdOfEntry(entry("unknown"), index), null);
});

// ── trackIdOfFactMap / trackIdOfFact ─────────────────────────────────────────

function track(id: string, unitsFacts: FactId[][]): IndexTrack {
  return { id, title: id, units: unitsFacts.map((facts, i) => unit(`${id}-${i}`, facts)) };
}

test("trackIdOfFactMap — maps every fact to the track that teaches it", () => {
  const tracks = [track("kana", [[fact("f1")], [fact("f2")]]), track("kanji", [[fact("f3")]])];
  const map = trackIdOfFactMap(tracks);
  assert.equal(trackIdOfFact(fact("f1"), map), "kana");
  assert.equal(trackIdOfFact(fact("f3"), map), "kanji");
  assert.equal(trackIdOfFact(fact("nowhere"), map), undefined);
});

test("trackIdOfFactMap — the earlier track wins when a fact is shared by two tracks", () => {
  const tracks = [track("first", [[fact("shared")]]), track("second", [[fact("shared")]])];
  assert.equal(trackIdOfFact(fact("shared"), trackIdOfFactMap(tracks)), "first");
});

// ── startedLearnTracks ───────────────────────────────────────────────────────
// The SAK-28 "track intro" card-0 gate: has the learner touched this track
// before, ignoring the very lesson about to be taught.

test("startedLearnTracks — a track counts as started once any of its facts has been met", () => {
  const map = trackIdOfFactMap([track("kana", [[fact("k1")]]), track("kanji", [[fact("j1")]])]);
  const history = applyClaims(emptyHistory(), [fact("k1")], 1);
  assert.deepEqual([...startedLearnTracks(history, new Set(), map)], ["kana"]);
});

test("startedLearnTracks — excludes the facts of the lesson about to be taught", () => {
  const map = trackIdOfFactMap([track("kana", [[fact("k1")]])]);
  const history = applyClaims(emptyHistory(), [fact("k1")], 1);
  const started = startedLearnTracks(history, new Set([fact("k1")]), map);
  assert.equal(started.size, 0, "the lesson's own fact doesn't retroactively count as an already-started track");
});

test("startedLearnTracks — a met fact the index has no track for is ignored, not an error", () => {
  const history = applyClaims(emptyHistory(), [fact("orphan")], 1);
  assert.equal(startedLearnTracks(history, new Set(), trackIdOfFactMap([])).size, 0);
});
