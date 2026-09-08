// What the nine hand-built places emitted before SAK-367, pinned here so the
// one builder cannot quietly write a different URL. Every string below was
// captured by running the old expression; the two marked as moved are the
// Atlas's, which encoded a list of ids the other way round.

import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { EMPTY_RECIPE } from "@/sky/lib/practice";

import { idsFrom, skyHref } from "./hrefs";

const IDS = ["kanji:日", "kana:あ"];
const JOINED = "kanji%3A%E6%97%A5%2Ckana%3A%E3%81%82";
const RECIPE = { ...EMPTY_RECIPE, collections: ["kana"], size: 20 };

describe("skyHref writes what each place wrote before", () => {
  it("the ternaries: a bare path, or the flag on its own", () => {
    assert.equal(skyHref("/observatory", { sample: false }), "/observatory");
    assert.equal(skyHref("/observatory", { sample: true }), "/observatory?sample");
    assert.equal(skyHref("/lesson", { sample: false }), "/lesson");
    assert.equal(skyHref("/lesson", { sample: true }), "/lesson?sample");
    assert.equal(skyHref("/practice", { sample: true }), "/practice?sample");
  });

  it("the Atlas's quiz href", () => {
    assert.equal(skyHref("/quiz", { sample: false, from: "atlas" }), "/quiz?from=atlas");
    assert.equal(skyHref("/quiz", { sample: true, from: "atlas" }), "/quiz?sample&from=atlas");
  });

  it("the lesson's Drill", () => {
    assert.equal(skyHref("/quiz", { sample: false, from: "observatory", picks: IDS }), `/quiz?from=observatory&picks=${JOINED}`);
    assert.equal(skyHref("/quiz", { sample: true, from: "observatory", picks: IDS }), `/quiz?sample&from=observatory&picks=${JOINED}`);
  });

  it("Sessions' rerun", () => {
    assert.equal(skyHref("/quiz", { sample: false, from: "sessions", cards: IDS }), `/quiz?from=sessions&cards=${JOINED}`);
    assert.equal(skyHref("/quiz", { sample: true, from: "sessions", cards: IDS }), `/quiz?sample&from=sessions&cards=${JOINED}`);
  });

  it("the Observatory's Start lesson", () => {
    assert.equal(skyHref("/lesson", { sample: false, picks: IDS }), `/lesson?picks=${JOINED}`);
    assert.equal(skyHref("/lesson", { sample: true, picks: IDS }), `/lesson?sample&picks=${JOINED}`);
  });

  it("the quiz's retry", () => {
    assert.equal(skyHref("/quiz", { sample: false, cards: IDS }), `/quiz?cards=${JOINED}`);
    assert.equal(skyHref("/quiz", { sample: true, cards: IDS }), `/quiz?sample&cards=${JOINED}`);
  });

  it("a practice run, its retry, and the recipe packed as it always was", () => {
    const packed = encodeURIComponent(JSON.stringify(RECIPE));
    assert.equal(skyHref("/practice/run", { sample: false, recipe: RECIPE }), `/practice/run?recipe=${packed}`);
    assert.equal(skyHref("/practice/run", { sample: true, recipe: RECIPE }), `/practice/run?sample&recipe=${packed}`);
    assert.equal(skyHref("/practice/run", { sample: true, recipe: RECIPE, cards: IDS }), `/practice/run?sample&recipe=${packed}&cards=${JOINED}`);
  });

  it("the Atlas's two, the one pair that moved: a comma between ids, now encoded like every other list", () => {
    // before: `/observatory?picks=kanji%3A%E6%97%A5,kana%3A%E3%81%82`
    assert.equal(skyHref("/observatory", { picks: IDS }), `/observatory?picks=${JOINED}`);
    assert.equal(skyHref("/quiz", { sample: true, from: "atlas", picks: IDS }), `/quiz?sample&from=atlas&picks=${JOINED}`);
    // and both forms read back as the same two ids, so a link written before still opens
    assert.deepEqual(idsFrom(decodeURIComponent("kanji%3A%E6%97%A5,kana%3A%E3%81%82")), IDS);
    assert.deepEqual(idsFrom(decodeURIComponent(JOINED)), IDS);
  });

  it("an empty list is no key at all", () => {
    assert.equal(skyHref("/quiz", { picks: [], cards: [] }), "/quiz");
    assert.equal(skyHref("/quiz", { sample: true, picks: [] }), "/quiz?sample");
    assert.equal(skyHref("/quiz"), "/quiz");
  });
});

describe("idsFrom reads back what the pages read before", () => {
  it("a comma-joined list, blanks dropped", () => {
    assert.deepEqual(idsFrom("kanji:日,kana:あ"), IDS);
    assert.deepEqual(idsFrom(""), []);
    assert.deepEqual(idsFrom(undefined), []);
    assert.deepEqual(idsFrom("a,,b,"), ["a", "b"]);
  });

  it("a repeated key, which Next hands over as an array", () => {
    assert.deepEqual(idsFrom(["kanji:日", "kana:あ"]), IDS);
  });

  it("spaces around an id are not part of it", () => {
    assert.deepEqual(idsFrom(" a , b "), ["a", "b"]);
  });
});
