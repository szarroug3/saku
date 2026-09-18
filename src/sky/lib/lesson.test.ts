// The lesson teaches bottom up, once each, skips what is in the sky, and
// opens one step at a time. What it rests on and does not teach is the
// references: the stars already in the sky under tonight's picks, and the
// terms and intros the walk put behind them (SAK-416).

import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { buildGraph } from "@/sky/lib/graph";
import { isUnlocked, lessonReferences, lessonSteps, orderNote, referencePages, starState, unseenPages, type LessonPage } from "@/sky/lib/lesson";
import type { SkyItem } from "@/sky/lib/types";

const item = (id: string, kind: SkyItem["kind"], extra: Partial<SkyItem> = {}): SkyItem => ({ id, kind, glyph: id, english: id, standing: "not-seen", ...extra });

// train = 電 (雨 田) + 車; fireworks = 花 (艹 化) + 火; the sky already has 雨 田 車 艹 火
const graph = buildGraph([
  item("雨", "radical"), item("田", "radical"), item("車", "kanji"), item("艹", "radical"), item("化", "kanji"), item("火", "kanji"),
  item("電", "kanji", { components: ["雨", "田"] }), item("花", "kanji", { components: ["艹", "化"] }),
  item("電車", "word", { components: ["電", "車"] }), item("花火", "word", { components: ["花", "火"] }),
  ...["か", "き"].map((k) => item(k, "kana")), item("row:k", "kana", { group: true, components: ["か", "き"] }),
]);
const sky = new Set(["雨", "田", "車", "艹", "火"]);

/** A page the app's walk put behind a star: a term it defines, an intro it
 * opens. `id` is what the page's own item is called. */
const pageBehind = (before: string, why: LessonPage["why"], id: string, english: string): LessonPage =>
  ({ before, why, item: item(id, "term", { english }), teach: {} });

const KANJI = pageBehind("電", "term", "term:kanji", "Kanji");
const BUILT = pageBehind("電", "intro", "page:built-from", "How a kanji is built");
const PITCH = pageBehind("花火", "term", "term:pitch", "Pitch accent");

describe("the lesson", () => {
  it("teaches the pieces, then the character, then the word, skipping what is in the sky", () => {
    const steps = lessonSteps(graph, ["電車", "花火"], sky);
    assert.deepEqual(steps.map((s) => s.id), ["電", "電車", "化", "花", "花火"]);
    assert.deepEqual(steps.map((s) => s.pick), ["電車", "電車", "花火", "花火", "花火"]);
  });

  it("a shared piece is taught once, at its first use", () => {
    const g = buildGraph([item("a", "radical"), item("X", "kanji", { components: ["a"] }), item("Y", "kanji", { components: ["a"] })]);
    assert.deepEqual(lessonSteps(g, ["X", "Y"], new Set()).map((s) => s.id), ["a", "X", "Y"]);
  });

  it("a kana row's sounds are the steps; the row itself is not", () => {
    assert.deepEqual(lessonSteps(graph, ["row:k"], new Set()).map((s) => s.id), ["か", "き"]);
  });

  it("opens one step at a time, and known stars are open for reference", () => {
    const steps = lessonSteps(graph, ["電車"], sky);
    const opened = new Set<string>();
    assert.equal(isUnlocked(steps, 0, opened), true);
    assert.equal(isUnlocked(steps, 1, opened), false);
    assert.equal(starState(steps, "電", opened, "電"), "selected");
    assert.equal(starState(steps, "電車", opened, "電"), "locked");
    assert.equal(starState(steps, "雨", opened, "電"), "open");
    opened.add("電");
    assert.equal(starState(steps, "電", opened, "電車"), "lit");
    assert.equal(starState(steps, "電車", opened, "電車"), "selected");
    opened.add("雨");
    assert.equal(starState(steps, "雨", opened, null), "lit");
  });
});

describe("the lesson's references", () => {
  it("a kanji whose parts are in the sky lists those parts, and never teaches them", () => {
    // 電 is built from 雨 and 田, both already in the sky, and 車 is too
    const steps = lessonSteps(graph, ["電車"], sky);
    assert.deepEqual(steps.map((s) => s.id), ["電", "電車"]);
    const refs = lessonReferences(graph, ["電車"], sky);
    assert.deepEqual(refs.map((r) => r.id), ["雨", "田", "車"]);
    assert.deepEqual([...new Set(refs.map((r) => r.why))], ["known"]);
    // nothing is in both lists
    assert.deepEqual(refs.filter((r) => steps.some((s) => s.id === r.id)), []);
  });

  it("a word whose kanji are in the sky lists the kanji and their pieces", () => {
    const learned = new Set(["雨", "田", "車", "電"]);
    assert.deepEqual(lessonSteps(graph, ["電車"], learned).map((s) => s.id), ["電車"]);
    assert.deepEqual(lessonReferences(graph, ["電車"], learned).map((r) => r.id), ["雨", "田", "電", "車"]);
  });

  it("a fresh learner has no stars to refer back to, only the terms and intros", () => {
    const refs = lessonReferences(graph, ["電車"], new Set(), [KANJI, BUILT]);
    assert.deepEqual(refs.map((r) => r.id), ["page:term:kanji", "page:page:built-from"]);
    assert.deepEqual(refs.map((r) => r.why), ["term", "intro"]);
    assert.deepEqual(refs.map((r) => r.label), ["Kanji", "How a kanji is built"]);
    // and the order is the stars alone, terms and all
    assert.deepEqual(lessonSteps(graph, ["電車"], new Set()).map((s) => s.id), ["雨", "田", "電", "車", "電車"]);
  });

  it("the known stars come first, then the terms and intros", () => {
    const refs = lessonReferences(graph, ["電車"], sky, [KANJI, BUILT]);
    assert.deepEqual(refs.map((r) => r.why), ["known", "known", "known", "term", "intro"]);
  });

  it("a page behind a star that is not tonight's is dropped", () => {
    const refs = lessonReferences(graph, ["電車"], sky, [KANJI, PITCH]);
    assert.deepEqual(refs.filter((r) => r.page).map((r) => r.label), ["Kanji"]);
  });

  it("a page is listed once, however many stars put it in play", () => {
    const refs = lessonReferences(graph, ["電車"], sky, [KANJI, KANJI]);
    assert.deepEqual(refs.filter((r) => r.page).length, 1);
  });
});

// SAK-467. A lesson opens on the first reference page it has never shown,
// and a page counts as shown once it has been in a lesson at all.
describe("the pages a lesson opens on", () => {
  const sky = new Set(["雨", "田", "車"]);
  const refs = lessonReferences(graph, ["電車"], sky, [KANJI, BUILT]);

  it("is every page of the lesson, in the order they are listed, for a learner who has read none", () => {
    assert.deepEqual(unseenPages(refs, new Set()), ["page:term:kanji", "page:page:built-from"]);
  });

  it("skips a page that has been shown before and keeps the rest", () => {
    assert.deepEqual(unseenPages(refs, new Set(["page:term:kanji"])), ["page:page:built-from"]);
  });

  it("is nothing at all once every page has been shown, so the lesson opens on step one", () => {
    assert.deepEqual(unseenPages(refs, new Set(["page:term:kanji", "page:page:built-from"])), []);
  });

  it("never holds a star already in the sky: those are there to look at, not to read", () => {
    assert.ok(refs.some((r) => r.why === "known"), "the fixture has known stars to leave out");
    assert.deepEqual(unseenPages(refs, new Set()).filter((id) => !id.startsWith("page:")), []);
  });

  it("marks every page of the lesson, listed or opened or not", () => {
    assert.deepEqual(referencePages(refs), ["page:term:kanji", "page:page:built-from"]);
  });
});

// SAK-464. The line under "Tonight, in order" read "Pieces first, then the
// character, then the word." whatever the night held, including a night of
// particles, which have no pieces and are not characters or words. Sam: make
// it describe the lesson it is on, or leave it out.
describe("what the order says about itself", () => {
  const note = (...kinds: SkyItem["kind"][]) => orderNote(kinds.map((k, i) => item(`${k}${i}`, k)));

  it("says the whole ladder when the night is a word over its characters and their pieces", () => {
    assert.equal(note("radical", "kanji", "word"), "Pieces first, then the character, then the word.");
  });

  it("says the half it really has", () => {
    assert.equal(note("kanji", "word"), "The characters first, then the word.");
    assert.equal(note("radical", "word"), "The pieces first, then the word.");
    assert.equal(note("radical", "kanji"), "The pieces first, then the character they build.");
  });

  it("says nothing about a night of things that stand on their own", () => {
    assert.equal(note("grammar", "grammar"), undefined, "a night of particles");
    assert.equal(note("sentence"), undefined);
    assert.equal(note("kana", "kana"), undefined);
    assert.equal(note("word", "word"), undefined, "words with no kanji under them");
    assert.equal(note("counter", "keigo", "verbPair"), undefined);
    assert.equal(note(), undefined);
  });
});
