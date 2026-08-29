// Run: node --import ./src/lib/conjugate/test-hooks.mjs --test src/lib/content/sentence-track.test.ts
//
// SAK-240: sentence-track.ts had zero tests. It re-expresses the hand-authored
// sentence-ordering tiers (src/data/assembly.ts) as the shared ContentItem /
// SentenceBuildUnit model — these tests cover that re-expression's own decision
// logic: which fields carry through unchanged, the glyph-label trim (SAK-11),
// and the tier-lookup fallback in sentenceBuildUnitsOf.

import assert from "node:assert/strict";
import test from "node:test";

import { sentenceItems, sentenceBuildUnitsOf } from "./sentence-track.ts";
import { contentTypeLabel } from "./item.ts";
import { SENTENCE_ORDERING_TIERS } from "@/data/assembly";
import { SENTENCE_ORDERING_GUIDES } from "@/data/sentence-ordering-guides";
import { sentenceTierEntry, sentenceTierMarkerFact } from "@/lib/sentence-ordering-progress";
import type { ContentItem } from "./item.ts";

test("sentenceItems — one item per tier, carrying the tier's own entry, marker fact, and fixed shape", () => {
  const items = sentenceItems();
  assert.equal(items.length, SENTENCE_ORDERING_TIERS.length, "one item per curriculum tier");

  for (const [i, tier] of SENTENCE_ORDERING_TIERS.entries()) {
    const item = items[i];
    assert.equal(item.entry, sentenceTierEntry(tier.id), `${tier.id} entry`);
    assert.equal(item.kind, "sentence-ordering");
    assert.equal(item.typeLabel, contentTypeLabel("sentence-ordering", []));
    assert.deepEqual(item.roles, [], `${tier.id} has no character roles`);
    assert.deepEqual(item.prereqs, [], `${tier.id} declares no teaching prereqs of its own`);
    assert.deepEqual(item.blockedBy, [], `${tier.id} declares no blocking prereqs of its own`);
    assert.equal(item.facts.length, 1, `${tier.id} carries exactly its own progress marker`);
    assert.equal(item.facts[0].id, sentenceTierMarkerFact(tier.id));
  }
});

test("sentenceItems — glyph strips a redundant trailing 'sentences', but leaves a label with no such suffix unchanged", () => {
  const byId = new Map(sentenceItems().map((item, i) => [SENTENCE_ORDERING_TIERS[i].id, item]));

  assert.equal(byId.get("simple")!.glyph, "Simple", "'Simple sentences' -> 'Simple'");
  assert.equal(byId.get("conditional")!.glyph, "Conditional", "'Conditional sentences' -> 'Conditional'");
  assert.equal(
    byId.get("sequential")!.glyph,
    "Te-form links and helpers",
    "a label with no 'sentences' suffix is never truncated or otherwise rewritten (SAK-11)",
  );
});

test("sentenceBuildUnitsOf — a real tier's unit carries its guide's hook as the rule and a real worked example", () => {
  const simple = sentenceItems().find((item) => item.entry === sentenceTierEntry("simple"))!;
  const [unit] = sentenceBuildUnitsOf(simple);

  assert.equal(unit.kind, "sentence-build");
  assert.equal(unit.rule, SENTENCE_ORDERING_GUIDES.simple.hook);
  assert.ok(unit.example.length > 0, "the simple tier has curated readable sentences under full knowledge");
  assert.deepEqual(unit.facts, simple.facts.map((f) => f.id));
  assert.equal(unit.cost, 1);
  assert.equal(unit.scheduling, "unit", "a sentence tier is one whole lesson, never combined with another unit");
});

test("sentenceBuildUnitsOf — every curriculum tier's item builds exactly one unit with a non-empty rule", () => {
  for (const item of sentenceItems()) {
    const units = sentenceBuildUnitsOf(item);
    assert.equal(units.length, 1, `${item.entry} yields one unit`);
    assert.ok(units[0].rule.length > 0, `${item.entry} has a rule`);
  }
});

test("sentenceBuildUnitsOf — an item with no matching curriculum tier falls back to its own glyph and an empty example", () => {
  const fake: ContentItem = {
    entry: sentenceTierEntry("does-not-exist"),
    kind: "sentence-ordering",
    glyph: "Mystery tier",
    facts: [{ id: sentenceTierMarkerFact("does-not-exist"), kind: "definition" }],
    roles: [],
    prereqs: [],
    blockedBy: [],
    typeLabel: contentTypeLabel("sentence-ordering", []),
  };
  const [unit] = sentenceBuildUnitsOf(fake);

  assert.equal(unit.rule, "Mystery tier", "falls back to the item's own glyph when no guide exists for the tier");
  assert.equal(unit.example, "", "no resolvable tier means no worked example");
  assert.deepEqual(unit.facts, [sentenceTierMarkerFact("does-not-exist")]);
});
