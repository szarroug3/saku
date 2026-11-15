import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { AskModel } from "./ai-ask";
import type { TeachPage } from "./lesson";
import { answerWith, cardText, pageAskPrompt, parsePageAnswer, unlearned, type PageQuestion } from "./page-ask";
import type { SkyItem } from "./types";

const item = { id: "grammar:te-request", kind: "grammar", glyph: "〜てください", english: "please do X" } as SkyItem;
const page: TeachPage = {
  eyebrow: "Step 1",
  title: "Asking politely",
  lead: "Put ください after the て-form.",
  paragraphs: [{ text: "It turns a verb into a request.", examples: [{ jp: [{ text: "見てください" }], en: "Please look.", words: [{ word: [{ text: "見る", ruby: "みる" }], meaning: "to see" }] }] }],
  tables: [{ heads: ["Verb", "Request"], rows: [[[{ text: "食べる" }], [{ text: "食べてください" }]]] }],
};

const q: PageQuestion = {
  page: cardText(item, { meanings: ["please do X"] }, page),
  question: "Why is it て and not た?",
  learned: { kana: "あいうえおてくだたさ", kanji: ["食"], words: ["食べる (たべる): to eat"], grammar: ["〜て: do X, and then"] },
};

describe("cardText", () => {
  it("holds the thing, its meaning and the open page", () => {
    for (const piece of ["〜てください: please do X", "Step 1", "Asking politely", "Put ください after the て-form.", "見てください (Please look.) words: 見る to see", "Verb | Request", "食べる | 食べてください"]) {
      assert.ok(q.page.includes(piece), piece);
    }
  });
  it("is cut short past the limit", () => {
    const long = cardText(item, { notes: ["a".repeat(9000)] });
    assert.equal(long.length, 4000);
  });
});

describe("pageAskPrompt", () => {
  const prompt = pageAskPrompt(q);
  it("carries the card, the learned lists and the question", () => {
    for (const piece of ["THE CARD", "kana: あいうえおてくだたさ", "kanji, with the readings they know: 食", "words: 食べる (たべる): to eat", "grammar: 〜て: do X, and then", "Why is it て and not た?"]) assert.ok(prompt.includes(piece), piece);
  });
  it("says to write only Japanese they have met, and to gloss it", () => {
    assert.match(prompt, /Write no Japanese except what is on the card, in the question, or in the lists above/);
    assert.match(prompt, /Only describe how a character is drawn/);
    assert.match(prompt, /Go past the card when that helps/);
    assert.match(prompt, /Put a Japanese word's meaning in round brackets after it the first time/);
  });
  it("says nothing yet for an empty list", () => {
    assert.match(pageAskPrompt({ ...q, learned: { kana: "", kanji: [], words: [], grammar: [] } }), /words: nothing yet/);
  });
});

describe("a thread", () => {
  const next = { ...q, question: "And with 飲む?", earlier: [{ question: "What is ください?", answer: "It asks politely." }] };
  it("carries the conversation and marks the next question", () => {
    const prompt = pageAskPrompt(next);
    for (const piece of ["THE CONVERSATION SO FAR", "Learner: What is ください?", "You: It asks politely.", "THE LEARNER'S NEXT QUESTION", "And with 飲む?", "Don't repeat what you already said."]) assert.ok(prompt.includes(piece), piece);
  });
  it("has neither on the first question", () => {
    assert.doesNotMatch(pageAskPrompt(q), /CONVERSATION|NEXT QUESTION/);
  });
  it("counts the learner's earlier questions as given", () => {
    const later = { ...q, question: "And this?", earlier: [{ question: "What about 飲む?", answer: "Later." }] };
    assert.deepEqual(unlearned("飲む works too.", later), []);
  });
});

describe("parsePageAnswer", () => {
  it("reads the answer field", () => assert.equal(parsePageAnswer('{"answer":" Because. "}'), "Because."));
  it("is null for no JSON or an empty answer", () => {
    assert.equal(parsePageAnswer("no"), null);
    assert.equal(parsePageAnswer('{"answer":""}'), null);
  });
});

describe("unlearned", () => {
  it("passes Japanese from the card, the question and the learned lists", () => {
    assert.deepEqual(unlearned("食べてください uses the て form (見る too).", q), []);
  });
  it("flags kana, kanji or katakana the learner hasn't met and the card doesn't have", () => {
    assert.deepEqual(unlearned("Like 飲む or テスト.", q), ["飲", "む", "テ", "ス", "ト"]);
  });
});

describe("unlearned, words", () => {
  it("flags a word of known kanji the learner hasn't met as a word", () => {
    const known = { ...q, learned: { ...q.learned, kanji: ["食", "水", "道"] } };
    assert.deepEqual(unlearned("Like 水道.", known), ["水道"]);
    assert.deepEqual(unlearned("Like 食べる.", known), []);
  });
});

describe("answerWith", () => {
  const reply = (text: string, source: "on_device" | "in_cloud" = "on_device"): AskModel => async () => ({ text: JSON.stringify({ answer: text }), source });
  const never: AskModel = async () => { throw new Error("must not be asked"); };
  const ask = (first: AskModel, cloud: AskModel, online = true) => answerWith(q, { first, cloud, online: () => online, firstMs: 20, cloudMs: 20, warn: () => {} });

  it("keeps Nano's answer when it uses only what the learner has met", async () => {
    assert.deepEqual(await ask(reply("て joins the verb to ください."), never), { text: "て joins the verb to ください.", source: "on_device" });
  });
  it("asks the cloud when Nano writes a kanji the learner hasn't met, and says so", async () => {
    assert.deepEqual(await ask(reply("Like 飲む."), reply("It is the て-form.", "in_cloud")), { text: "It is the て-form.", source: "in_cloud", replaced: true });
  });
  it("shows nothing when the cloud does the same", async () => {
    assert.equal(await ask(reply("Like 飲む."), reply("Or 飲む.", "in_cloud")), null);
  });
  it("doesn't ask the cloud offline", async () => {
    assert.equal(await ask(reply("Like 飲む."), never, false), null);
  });
});
