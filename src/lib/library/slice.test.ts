// Run: node --import ./src/lib/conjugate/test-hooks.mjs --test \
//        src/lib/library/slice.test.ts
//
// WHAT THIS TEST IS FOR
// =====================
// Library teaching remains fact-based, while Quiz eligibility is based on the
// number of real question forms. Most facts represent one form; a generator's
// one category fact represents its configured generated round.

import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { KANA_SUBJECT } from "@/data/characters";
import { KANJI_SUBJECT } from "@/data/kanji";
import { VOCAB_SUBJECT } from "@/data/vocab";
import type { Claims } from "@/lib/claims";
import { factsOf } from "@/lib/facts";
import { LIB_ENTRIES, NUMBER_CONSTRUCTION_KIND } from "@/lib/library/entries";
import {
  drillOrder,
  drillPlan,
  hasMultipleQuizForms,
  quizFormCount,
  sliceFacts,
  sliceIsDrillable,
  sliceSentence,
} from "@/lib/library/slice";
import type { FactAggregate, FactId } from "@/types";

/** One real entry id of each kind, so the assertions run against ids the app
 * actually mints and the fact counts its data actually carries. */
const kana = LIB_ENTRIES.find((e) => e.kind === KANA_SUBJECT)!;
const kanji = LIB_ENTRIES.find((e) => e.kind === KANJI_SUBJECT)!;
const word = LIB_ENTRIES.find((e) => e.kind === VOCAB_SUBJECT)!;
const generator = LIB_ENTRIES.find((e) => e.kind === NUMBER_CONSTRUCTION_KIND)!;

describe("Library quiz eligibility — more than one quizzable form", () => {
  test("one ordinary fact is one form and cannot start alone", () => {
    const forms = sliceFacts({ label: kana.glyph, entries: [kana.id] });
    assert.equal(quizFormCount(forms), 1);
    assert.equal(hasMultipleQuizForms(forms), false);
  });

  test("an ordinary multi-fact entry can start alone", () => {
    const forms = sliceFacts({ label: word.glyph, entries: [word.id] });
    assert.ok(quizFormCount(forms) > 1);
    assert.equal(hasMultipleQuizForms(forms), true);
  });

  test("one generator category fact expands to a full quiz and can start alone", () => {
    const forms = sliceFacts({ label: generator.name ?? generator.glyph, entries: [generator.id] });
    assert.equal(forms.length, 1, "the generator keeps one persisted category fact");
    assert.equal(quizFormCount(forms), 10);
    assert.equal(hasMultipleQuizForms(forms), true);
  });
});

describe("sliceIsDrillable — one thing to learn is not a drill", () => {
  test("a single kana has exactly one fact and is NOT drillable", () => {
    // The premise of the whole rule: a kana carries one reading fact, so its
    // slice is a one-question session. If this ever stops being 1, the rule's
    // reason has changed and the gate should be revisited.
    assert.equal(factsOf(kana.id).length, 1, "a kana must be a single fact");
    assert.equal(sliceIsDrillable({ label: kana.glyph, entries: [kana.id] }), false);
  });

  test("a kanji has many facts and IS drillable", () => {
    assert.ok(factsOf(kanji.id).length > 1, "a kanji must be multi-fact");
    assert.equal(sliceIsDrillable({ label: kanji.glyph, entries: [kanji.id] }), true);
  });

  test("a word has at least two facts and IS drillable", () => {
    assert.ok(factsOf(word.id).length > 1, "a word must be multi-fact");
    assert.equal(sliceIsDrillable({ label: word.glyph, entries: [word.id] }), true);
  });

  test("an empty slice is not drillable", () => {
    // No entries, no facts, nothing to ask — the button would be a lie.
    assert.equal(sliceIsDrillable({ label: "", entries: [] }), false);
  });

  test("two single-fact kana together ARE drillable — the gate is fact count, not subject", () => {
    // A multi-select that resolves to two facts is a real two-question drill,
    // even though each part alone would be hidden. The rule is about how many
    // things there are to learn, not about what kind of thing they are.
    const kana2 = LIB_ENTRIES.filter((e) => e.kind === KANA_SUBJECT).slice(0, 2);
    assert.equal(kana2.length, 2, "need two kana for this case");
    assert.equal(
      sliceIsDrillable({ label: "two kana", entries: kana2.map((e) => e.id) }),
      true,
    );
  });
});

describe("drillPlan includeSolid — an explicit selection drills what you know", () => {
  const now = Date.UTC(2026, 0, 1);
  // A fresh claim on every fact makes them all solid/quiet right now — the exact
  // shape of "I selected these and they are all well-known".
  const allClaimed = (ids: readonly FactId[]): Claims => {
    const claims: Claims = {};
    for (const id of ids) claims[id] = now;
    return claims;
  };
  // No test evidence: solidity comes purely from the claims above.
  const noFacts: Record<FactId, FactAggregate> = {};

  test("the default DROPS solid facts — the whole-shelf feature is preserved", () => {
    const ids = factsOf(kanji.id);
    const slice = { label: kanji.glyph, entries: [kanji.id] };
    const plan = drillPlan(slice, noFacts, allClaimed(ids), now);
    assert.equal(plan.probe.length, 0, "solid facts must not be probed by default");
    assert.equal(plan.teach.length, 0, "solid facts are not teach either");
  });

  test("includeSolid=true puts solid facts into probe, asked directly", () => {
    const ids = factsOf(kanji.id);
    const slice = { label: kanji.glyph, entries: [kanji.id] };
    const plan = drillPlan(slice, noFacts, allClaimed(ids), now, true);
    assert.equal(plan.teach.length, 0, "already-known facts need no teaching");
    assert.equal(
      plan.probe.length,
      ids.length,
      "every selected solid fact is drillable",
    );
    assert.deepEqual([...plan.probe].sort(), [...ids].sort());
  });
});

// "Drill 0 shouldn't be an option." A multi-fact slice clears sliceIsDrillable
// (fact count > 1), but if every one of its facts is already solid the default
// drill drops them all and the order is empty. The bar must offer no drill —
// and never print "Drill 0" — so its condition is drillable AND a non-empty
// order, not drillable alone.
describe("a zero-item drill is never offered", () => {
  const now = Date.UTC(2026, 0, 1);
  const allClaimed = (ids: readonly FactId[]): Claims => {
    const claims: Claims = {};
    for (const id of ids) claims[id] = now;
    return claims;
  };
  const noFacts: Record<FactId, FactAggregate> = {};

  test("a multi-fact slice with every fact solid drills nothing and offers no button", () => {
    const ids = factsOf(kanji.id);
    const slice = { label: kanji.glyph, entries: [kanji.id] };

    // The single-fact gate would let this through: a kanji is multi-fact.
    assert.equal(sliceIsDrillable(slice), true);

    // But the default drill drops every solid fact, so the order is empty.
    const order = drillOrder(slice, noFacts, allClaimed(ids), now);
    assert.equal(order.length, 0, "an all-solid slice drills nothing");

    // The bar's offer condition — drillable AND a non-empty order — is false,
    // so no "Drill 0" is ever shown even though sliceIsDrillable is true.
    const offersDrill = sliceIsDrillable(slice) && order.length > 0;
    assert.equal(offersDrill, false);
  });
});

// The bar's sentence, and one case that must stay empty: a slice with no facts
// at all (an empty filtered shelf or a search with no hits). The surface it sits
// on already shows its own empty message, so the bar says nothing rather than
// repeating "nothing here to drill".
describe("sliceSentence — an empty slice has no sentence", () => {
  test("total 0 returns the empty string", () => {
    assert.equal(
      sliceSentence({ drillable: 0, total: 0, seen: 0, solid: 0, slipping: 0 }),
      "",
    );
  });

  test("a non-empty slice still gets its sentence", () => {
    assert.equal(
      sliceSentence({ drillable: 3, total: 3, seen: 0, solid: 0, slipping: 0 }),
      "3 questions · not seen yet",
    );
    assert.equal(
      sliceSentence({ drillable: 0, total: 4, seen: 4, solid: 4, slipping: 0 }),
      "all 4 solid, nothing to ask",
    );
  });
});

// SAK-157: a slipping fact (seen before, decayed to `teach`) is not "not
// known" and drillPlan must not offer to re-teach it — see standing.ts's
// "you had it. It's gone." and drillPlan's own doc comment for why `probe`
// isn't the fix either (rank() refuses a teach-status candidate outright).
describe("drillPlan — a slipping fact is neither taught nor probed", () => {
  const now = Date.UTC(2026, 0, 1);

  // A fact decayed to `teach` (p ~ 0) with real showings behind it: seen
  // (and passed) before, but tested long enough ago at low enough stability
  // that recall has decayed past SCORING.teachBelow. Same shape standing.test.ts
  // uses for its own "slipping" case.
  const decayed: FactAggregate = {
    seen: 8,
    missed: 0,
    firstTry: 8,
    correct: 8,
    stability: 5,
    lastTested: now - 60 * 86_400_000,
  };

  test("a never-seen fact enters `teach`", () => {
    const ids = factsOf(kanji.id);
    const facts: Record<FactId, FactAggregate> = {};
    const slice = { label: kanji.glyph, entries: [kanji.id] };
    const plan = drillPlan(slice, facts, {}, now);
    assert.deepEqual([...plan.teach].sort(), [...ids].sort());
    assert.equal(plan.probe.length, 0);
  });

  test("a decayed, previously-seen fact enters neither `teach` nor `probe`", () => {
    const ids = factsOf(kanji.id);
    const facts: Record<FactId, FactAggregate> = {};
    for (const id of ids) facts[id] = decayed;
    const slice = { label: kanji.glyph, entries: [kanji.id] };
    const plan = drillPlan(slice, facts, {}, now);
    assert.equal(plan.teach.length, 0, "slipping facts must not be re-taught");
    assert.equal(plan.probe.length, 0, "rank() would refuse them anyway");
  });

  test("a mixed slice teaches only the genuinely-new fact", () => {
    const ids = factsOf(kanji.id);
    assert.ok(ids.length > 1, "need at least two facts for a mixed case");
    const facts: Record<FactId, FactAggregate> = { [ids[0]]: decayed };
    const slice = { label: kanji.glyph, entries: [kanji.id] };
    const plan = drillPlan(slice, facts, {}, now);
    assert.deepEqual([...plan.teach].sort(), ids.slice(1).sort());
    assert.equal(plan.probe.length, 0);
  });
});
