// Two words that gloss the same are one item (SAK-493). The Planetarium's
// Words row opened on "yes, yes, no, no", and Sam, 2026-10-02, chose to teach
// each pair as one item the way は and が are one (SAK-491): one tile, one
// pick, one claim, one lesson step with a page per word and a page telling
// them apart, one star, one Atlas tile, while the quiz still asks each word's
// own cards.

import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { WORD_CONTRAST_PAIRS } from "@/data/word-contrast-notes";
import { emptyHistory } from "@/lib/history-ops";
import { knownFactsOf, libEntry, type LibEntry } from "@/lib/library/entries";
import { cartSummary } from "@/sky/lib/cart";
import { buildGraph } from "@/sky/lib/graph";
import { lessonSteps, titleWordPitch } from "@/sky/lib/lesson";
import type { EntryId } from "@/types/facts";
import type { HistoryFile } from "@/types/store";

import { atlasEntryFromHistory, atlasFromHistory, atlasSearchFromHistory } from "./atlas";
import { skyFromHistory } from "./learner";
import { lessonFromPicks } from "./lesson";
import { beyondWords, offerings, pickFacts } from "./observatory";
import { tileOf } from "./particle-groups";
import { quizFromHistory } from "./quiz";
import { teachFor } from "./teach";
import { WORD_GROUPS, wordGroup } from "./word-groups";

const NOW = Date.UTC(2026, 9, 3);
const YES = "words:word:はい-word:うん";
const NO = "words:word:いいえ-word:いや";

const entryOf = (id: string): LibEntry => {
  const e = libEntry(id as EntryId);
  assert.ok(e, `${id} is an entry`);
  return e;
};

/** These words claimed, the way a learner's own sky says it. */
const claiming = (...words: string[]): HistoryFile => {
  const history = emptyHistory();
  for (const w of words) for (const f of knownFactsOf(entryOf(`word:${w}`))) history.claims = { ...history.claims, [f]: NOW };
  return history;
};

describe("the word groups", () => {
  it("are one per pair taught together, named and glossed as the pair writes it, made of its two words", () => {
    assert.deepEqual(WORD_GROUPS.map((g) => [g.id, g.glyph, g.english, g.parts]), [
      [YES, "はい vs うん", "yes, polite and casual", ["word:はい", "word:うん"]],
      [NO, "いいえ vs いや", "no, polite and casual", ["word:いいえ", "word:いや"]],
    ]);
    for (const g of WORD_GROUPS) for (const part of g.parts) assert.equal(tileOf(part), g.id, `${part} is not shown as its group`);
  });

  it("leave the ずる/じる pairs alone: those are one verb spelled two ways", () => {
    const zuru = WORD_CONTRAST_PAIRS.filter((p) => p.b.endsWith("ずる"));
    assert.ok(zuru.length > 0);
    for (const p of zuru) {
      assert.equal(tileOf(`word:${p.a}`), `word:${p.a}`);
      assert.equal(tileOf(`word:${p.b}`), `word:${p.b}`);
    }
  });
});

describe("a word group in the Observatory", () => {
  const o = offerings(emptyHistory(), NOW);
  const graph = buildGraph([...o.items.values()]);
  const words = o.sections.find((s) => s.id === "words")!;

  it("is one word item over its two words, drawn as one star", () => {
    const item = o.items.get(YES);
    assert.ok(item);
    assert.equal(item.kind, "word");
    assert.equal(item.glyph, "はい vs うん");
    assert.equal(item.english, "yes, polite and casual");
    assert.equal(item.group, true);
    assert.equal(item.oneCard, true);
    assert.equal(item.listsParts, true);
    assert.deepEqual(item.components, ["word:はい", "word:うん"]);
    assert.deepEqual(graph.constellationOf(YES).nodes.map((n) => n.id), [YES], "one star, not two");
  });

  it("opens the Words row with one yes tile and one no tile, and never offers a grouped word alone", () => {
    assert.deepEqual(words.items.slice(0, 2), [YES, NO]);
    const offered = o.sections.flatMap((s) => s.items);
    for (const g of WORD_GROUPS) {
      assert.equal(offered.filter((id) => id === g.id).length, 1, `${g.glyph} is not offered exactly once`);
      for (const part of g.parts) assert.ok(!offered.includes(part), `${part} is offered on its own`);
    }
  });

  it("weighs what its two words weigh, 2, and nothing of its own", () => {
    const summary = cartSummary(graph, [YES], o.learned);
    assert.equal(summary.weight, 2);
    assert.equal(summary.pieces, 2);
  });

  it("claims both words with one claim", () => {
    const facts = new Set(pickFacts([YES]));
    for (const w of ["はい", "うん"]) for (const f of knownFactsOf(entryOf(`word:${w}`))) assert.ok(facts.has(f), `${f} is not claimed`);
  });

  it("stands where its words stand, and is learned only when both are", () => {
    const one = offerings(claiming("はい"), NOW);
    assert.equal(one.items.get(YES)?.standing, "claimed");
    assert.ok(!one.learned.has(YES), "はい alone is not the pair");
    assert.ok(one.sections.find((s) => s.id === "words")!.items.includes(YES), "still on offer, for うん");
    assert.equal(cartSummary(buildGraph([...one.items.values()]), [YES], one.learned).weight, 1, "and it costs うん alone");
    const both = offerings(claiming("はい", "うん"), NOW);
    assert.ok(both.learned.has(YES));
    assert.ok(!both.sections.flatMap((s) => s.items).includes(YES), "not offered once both are known");
  });
});

describe("a word group's lesson", () => {
  it("is one step, whose card has a page per word and a page telling them apart", () => {
    const lesson = lessonFromPicks(emptyHistory(), [YES]);
    const graph = buildGraph(lesson.items);
    assert.deepEqual(lessonSteps(graph, lesson.picks, new Set(lesson.learned)).map((s) => s.id), [YES]);
    const teach = lesson.teach[YES];
    assert.deepEqual(teach?.meanings, ["yes, polite and casual"]);
    assert.deepEqual(teach?.pages?.map((p) => p.eyebrow), ["はい", "うん", "はい vs うん"]);
    assert.equal(teach?.pages?.[0].title, "はい yes");
    assert.equal(teach?.pages?.[2].paragraphs[0].text, wordGroup(YES)?.note);
  });

  it("shows each word's own sentence on its page, with the word picked out", () => {
    const pages = lessonFromPicks(emptyHistory(), [NO]).teach[NO]?.pages ?? [];
    for (const page of pages.slice(0, 2)) {
      const ex = page.paragraphs.find((p) => p.heading === "In a sentence")?.examples?.[0];
      assert.ok(ex, `${page.eyebrow} has no sentence`);
      assert.ok(ex.en.length > 0);
    }
  });

  it("gives each word's page what its hear button says: the word, its reading and its pitch, as the word's own card has them", () => {
    const pages = lessonFromPicks(emptyHistory(), [YES]).teach[YES]?.pages ?? [];
    for (const [i, word] of ["はい", "うん"].entries()) {
      const own = teachFor({ id: `word:${word}`, kind: "word", glyph: word, english: "", standing: "not-seen" });
      // the pitch is the word card's own, which is nothing for a word the
      // pitch table does not have, and then the button says it plain
      assert.deepEqual(pages[i].say, { word, reading: own.reading, pitch: own.pitch });
    }
    assert.equal(pages[2].say, undefined, "the page telling them apart says nothing");
  });

  it("draws each kana word's pitch over the word in its page title, and no line where the word has no pitch (SAK-517)", () => {
    const yes = lessonFromPicks(emptyHistory(), [YES]).teach[YES]?.pages ?? [];
    assert.deepEqual(titleWordPitch(yes[0]), { word: "はい", rest: " yes", pitch: 1 });
    assert.deepEqual(titleWordPitch(yes[1]), { word: "うん", rest: " yes", pitch: 1 });
    assert.equal(titleWordPitch(yes[2]), undefined, "the page telling them apart has no word to draw");
    const no = lessonFromPicks(emptyHistory(), [NO]).teach[NO]?.pages ?? [];
    assert.equal(no[0].say?.word, "いいえ");
    assert.equal(titleWordPitch(no[0]), undefined, "いいえ has no pitch, so no line");
    assert.equal(titleWordPitch(no[1]), undefined, "いや has no pitch, so no line");
  });

  it("keeps a reading that differs from the word beside the title, with no line over the title (SAK-517)", () => {
    const page = { title: "箸 chopsticks", paragraphs: [], say: { word: "箸", reading: "はし", pitch: 1 } };
    assert.equal(titleWordPitch(page), undefined);
  });

  it("is quizzed on each word's own cards", () => {
    const cards = quizFromHistory(emptyHistory(), [YES], NOW, { audio: false, pitch: false });
    const asked = new Set(cards.map((c) => c.item.id));
    assert.ok(asked.has("word:はい") && asked.has("word:うん"), `asked ${[...asked].join(", ")}`);
    assert.ok(!asked.has(YES), "the group has no cards of its own");
  });
});

describe("a word group in the sky and the Atlas", () => {
  it("is one star in the sky: in the firmament before, met once either word is", () => {
    const before = skyFromHistory(emptyHistory(), NOW, undefined, { everything: true, beyond: beyondWords });
    assert.ok(before.firmament?.includes(YES));
    assert.ok(!before.firmament?.includes("word:はい") && !before.firmament?.includes("word:うん"));
    const after = skyFromHistory(claiming("はい"), NOW, undefined, { everything: true, beyond: beyondWords });
    assert.ok(after.roots.includes(YES));
    assert.ok(!after.roots.includes("word:はい"), "the word is under the pair, not a star of its own");
  });

  it("is one tile on the Words shelf", () => {
    const atlas = atlasFromHistory(emptyHistory(), NOW);
    const tiles = atlas.shelves.find((s) => s.id === "words")!.sections.flatMap((c) => c.items);
    for (const g of WORD_GROUPS) {
      assert.equal(tiles.filter((id) => id === g.id).length, 1, `the Words shelf has ${g.glyph} ${tiles.filter((id) => id === g.id).length} times`);
      for (const part of g.parts) assert.ok(!tiles.includes(part), `the Words shelf still has ${part} on its own`);
    }
  });

  it("is found by a search for either word", () => {
    for (const query of ["はい", "うん"]) {
      const found = atlasSearchFromHistory(emptyHistory(), query).sections.flatMap((s) => s.items);
      assert.ok(found.includes(YES), `${query} does not find はい vs うん`);
      assert.ok(!found.includes("word:はい") && !found.includes("word:うん"), `${query} finds a word on its own`);
    }
  });

  it("opens in the Atlas with its three pages, and each word still opens by its own id", () => {
    const entry = atlasEntryFromHistory(emptyHistory(), YES, NOW);
    assert.deepEqual(entry?.teach?.pages?.map((p) => p.eyebrow), ["はい", "うん", "はい vs うん"]);
    const word = atlasEntryFromHistory(emptyHistory(), "word:うん", NOW);
    assert.equal(word?.id, "word:うん");
    assert.ok(word?.related.some((g) => g.title === "Often compared with"));
  });
});
