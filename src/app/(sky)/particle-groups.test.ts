// Two particles a learner mixes up are one item (SAK-491). Sam, 2026-09-26:
// "this should be one item. we moved away from separating them, remember."
// And: "all particles that are merged like that should be one item." So every
// shared particle note is a group over its two patterns: one tile, one pick,
// one claim, one lesson step with the note's pages, one moon, one Atlas tile,
// while the quiz still asks each pattern's own cards.

import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { patternEntry } from "@/data/grammar";
import { PARTICLE_NOTES } from "@/data/grammar/particle-notes";
import { emptyHistory } from "@/lib/history-ops";
import { knownFactsOf, libEntry, type LibEntry } from "@/lib/library/entries";
import { cartSummary } from "@/sky/lib/cart";
import { buildGraph } from "@/sky/lib/graph";
import { lessonSteps } from "@/sky/lib/lesson";
import type { EntryId } from "@/types/facts";
import type { HistoryFile } from "@/types/store";

import { atlasEntryFromHistory, atlasFromHistory, atlasSearchFromHistory } from "./atlas";
import { lessonFromPicks } from "./lesson";
import { beyondWords, offerings, pickFacts } from "./observatory";
import { PARTICLE_GROUPS, particleGroup, tileOf } from "./particle-groups";
import { quizFromHistory } from "./quiz";

const NOW = Date.UTC(2026, 8, 26);
const WA_GA = "particles:wa-ga";
const NI_DE = "particles:ni-de";

const entryOf = (id: string): LibEntry => {
  const e = libEntry(id as EntryId);
  assert.ok(e, `${id} is an entry`);
  return e;
};

/** These patterns claimed, the way a learner's own sky says it. */
const claiming = (...recipes: string[]): HistoryFile => {
  const history = emptyHistory();
  for (const r of recipes) for (const f of knownFactsOf(entryOf(patternEntry(r)))) history.claims = { ...history.claims, [f]: NOW };
  return history;
};

describe("the particle groups", () => {
  it("are one per shared note, named by its eyebrow, made of its two patterns", () => {
    const shared = PARTICLE_NOTES.filter((n) => n.recipes.length > 1);
    assert.equal(PARTICLE_GROUPS.length, shared.length);
    for (const note of shared) {
      const group = PARTICLE_GROUPS.find((g) => g.recipes.join() === note.recipes.join());
      assert.ok(group, `${note.eyebrow} has no group`);
      assert.equal(group.glyph, note.eyebrow);
      assert.deepEqual(group.parts, note.recipes.map((r) => patternEntry(r)));
      for (const part of group.parts) assert.equal(tileOf(part), group.id, `${part} is not shown as its group`);
    }
    assert.deepEqual(PARTICLE_GROUPS.map((g) => g.glyph), ["は vs が", "に vs で", "まで vs までに", "だけ vs しか", "ね vs よ"]);
    // a particle with a note of its own is its own tile
    assert.equal(tileOf(patternEntry("wo")), patternEntry("wo"));
  });

  it("say what they mean in one short written line", () => {
    // Sam, 2026-09-26: short, like a single pattern's line; "only" for the only ones
    assert.equal(particleGroup(WA_GA)?.english, "mark the topic and the subject");
    assert.equal(particleGroup(NI_DE)?.english, "mark where something is and where it happens");
    assert.equal(particleGroup("particles:made-made-ni")?.english, "until and by");
    assert.equal(particleGroup("particles:dake-shika-nai")?.english, "only");
    assert.equal(particleGroup("particles:ne-yo")?.english, "ask for agreement and tell something new");
    for (const g of PARTICLE_GROUPS) assert.ok(!/[\u2013\u2014]/.test(g.english), `${g.glyph}'s meaning line has a dash`);
  });
});

describe("a particle group in the Observatory", () => {
  const o = offerings(emptyHistory(), NOW);
  const graph = buildGraph([...o.items.values()]);
  const offered = o.sections.flatMap((s) => s.items);

  it("is one item over its two patterns, labeled Particle and drawn as a moon", () => {
    const item = o.items.get(WA_GA);
    assert.ok(item);
    assert.equal(item.kind, "grammar");
    assert.equal(item.glyph, "は vs が");
    assert.equal(item.english, "は marks the topic, が marks the subject");
    assert.equal(item.label, "particle");
    assert.equal(item.particle, true);
    assert.equal(item.group, true);
    assert.equal(item.oneCard, true);
    assert.deepEqual(item.components, ["grammar:wa", "grammar:ga"]);
    assert.deepEqual(graph.constellationOf(WA_GA).nodes.map((n) => n.id), [WA_GA], "one moon, not two");
  });

  it("offers one tile for は and が in the Sentences row, and never either of the two", () => {
    const sentences = o.sections.find((s) => s.id === "sentences")!;
    assert.equal(sentences.items.filter((id) => id === WA_GA).length, 1);
    for (const g of PARTICLE_GROUPS) {
      for (const part of g.parts) assert.ok(!offered.includes(part), `${part} is offered on its own`);
      assert.ok(offered.filter((id) => id === g.id).length <= 1, `${g.glyph} is offered twice`);
    }
  });

  it("weighs what its two patterns weigh, 6, and nothing of its own", () => {
    const summary = cartSummary(graph, [WA_GA], o.learned);
    assert.equal(summary.weight, 6);
    assert.equal(summary.pieces, 2);
  });

  it("meets Simple's need for は and が", () => {
    const needs = o.sections.find((s) => s.id === "sentences")!.needs?.["writing-rule:sentence-rule-simple"] ?? [];
    assert.ok(needs.includes(WA_GA));
    assert.ok(!needs.includes("grammar:wa") && !needs.includes("grammar:ga"));
  });

  it("claims both patterns with one claim", () => {
    const facts = new Set(pickFacts([WA_GA]));
    for (const r of ["wa", "ga"]) for (const f of knownFactsOf(entryOf(patternEntry(r)))) assert.ok(facts.has(f), `${f} is not claimed`);
  });

  it("stands where its patterns stand, and is learned only when both are", () => {
    const one = offerings(claiming("wa"), NOW);
    assert.equal(one.items.get(WA_GA)?.standing, "claimed");
    assert.ok(!one.learned.has(WA_GA), "は alone is not the group");
    assert.ok(one.sections.flatMap((s) => s.items).includes(WA_GA), "still on offer, for が");
    assert.equal(cartSummary(buildGraph([...one.items.values()]), [WA_GA], one.learned).weight, 3, "and it costs が alone");
    const both = offerings(claiming("wa", "ga"), NOW);
    assert.ok(both.learned.has(WA_GA));
    assert.ok(!both.sections.flatMap((s) => s.items).includes(WA_GA), "not offered once both are known");
  });
});

describe("a particle group's lesson", () => {
  for (const [id, pills] of [[WA_GA, ["〜は", "〜が", "は vs が", "Family"]], [NI_DE, ["〜に", "〜で", "に vs で", "Family"]]] as const) {
    it(`teaches ${id} as one step, whose card has the four pages`, () => {
      const lesson = lessonFromPicks(emptyHistory(), [id]);
      const graph = buildGraph(lesson.items);
      assert.deepEqual(lessonSteps(graph, lesson.picks, new Set(lesson.learned)).map((s) => s.id), [id]);
      assert.deepEqual(lesson.teach[id]?.pages?.map((p) => p.eyebrow), [...pills]);
      assert.equal(lesson.teach[id]?.meanings?.[0], particleGroup(id)?.english);
    });
  }

  it("heads each pattern's page with that pattern, since the card is headed by the pair", () => {
    const pages = lessonFromPicks(emptyHistory(), [WA_GA]).teach[WA_GA]?.pages ?? [];
    assert.equal(pages[0].title, "〜は marks the topic");
    assert.equal(pages[1].title, "〜が marks the subject");
  });

  it("is quizzed on each pattern's own cards", () => {
    const cards = quizFromHistory(emptyHistory(), [WA_GA], NOW, { audio: false, pitch: false });
    const asked = new Set(cards.map((c) => c.item.id));
    assert.ok(asked.has("grammar:wa") && asked.has("grammar:ga"), `asked ${[...asked].join(", ")}`);
    assert.ok(!asked.has(WA_GA), "the group has no cards of its own");
  });
});

describe("a particle group in the sky and the Atlas", () => {
  it("is one moon in the sky: in the firmament before, met once either pattern is", () => {
    const before = beyondWords(emptyHistory(), NOW);
    assert.ok(before.firmament.includes(WA_GA));
    assert.ok(!before.firmament.includes("grammar:wa") && !before.firmament.includes("grammar:ga"));
    const after = beyondWords(claiming("wa"), NOW);
    assert.ok(after.met.includes(WA_GA));
    assert.ok(!after.met.includes("grammar:wa"));
  });

  it("is one tile on the Grammar shelf and one on the Sentences shelf", () => {
    const atlas = atlasFromHistory(emptyHistory(), NOW);
    for (const shelfId of ["grammar", "sentences"]) {
      const tiles = atlas.shelves.find((s) => s.id === shelfId)!.sections.flatMap((c) => c.items);
      assert.equal(tiles.filter((id) => id === WA_GA).length, 1, `${shelfId} has は vs が ${tiles.filter((id) => id === WA_GA).length} times`);
      assert.ok(!tiles.includes("grammar:wa") && !tiles.includes("grammar:ga"), `${shelfId} still has は or が on its own`);
    }
    const particles = atlas.shelves.find((s) => s.id === "grammar")!.sections.find((c) => c.label === "Particles");
    assert.ok(particles?.items.includes(WA_GA), "the Particles cut holds it");
    assert.ok(atlas.items.some((it) => it.id === WA_GA), "and its tile travels");
  });

  it("is found by a search for either particle", () => {
    for (const query of ["は", "が"]) {
      const found = atlasSearchFromHistory(emptyHistory(), query).sections.flatMap((s) => s.items);
      assert.ok(found.includes(WA_GA), `${query} does not find は vs が`);
      assert.ok(!found.includes("grammar:wa") && !found.includes("grammar:ga"), `${query} finds a pattern on its own`);
    }
  });

  it("opens in the Atlas with the four pages and the way back to the Particle page", () => {
    const entry = atlasEntryFromHistory(emptyHistory(), WA_GA, NOW);
    assert.ok(entry);
    assert.deepEqual(entry.teach?.pages?.map((p) => p.eyebrow), ["〜は", "〜が", "は vs が", "Family"]);
    assert.ok(entry.related.some((g) => g.title === "Read about it"));
  });
});
