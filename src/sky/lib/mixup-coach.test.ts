import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { coachPrompt, explainWith, parseCoach, ungrounded, type AskCoach, type CoachRequest } from "./mixup-coach";

const req: CoachRequest = {
  asked: { glyph: "待", kind: "kanji", facts: ["means: wait", "read: ま, タイ", "made of: 彳 and 寺"] },
  other: { glyph: "持", kind: "kanji", facts: ["means: hold", "read: も, ジ", "made of: 扌 and 寺"] },
};
const reply = (text: string, source: "on_device" | "in_cloud" = "on_device"): AskCoach => async () => ({ text: JSON.stringify({ explanation: text }), source });
const never: AskCoach = async () => { throw new Error("must not be asked"); };
const fails: AskCoach = async () => { throw new Error("down"); };
const hangs: AskCoach = () => new Promise(() => {});
const quiet = () => {};
const ask = (first: AskCoach, cloud: AskCoach, online = true) => explainWith(req, { first, cloud, online: () => online, firstMs: 20, cloudMs: 20, warn: quiet });

const GOOD = "Both have 寺 (temple) on the right; 待 (wait) has the street piece 彳 and 持 (hold) has the hand 扌, so the hand is holding.";

describe("coachPrompt", () => {
  const prompt = coachPrompt({ ...req, tip: "扌 is a hand." });
  it("carries both sides' facts and the pair's tip", () => {
    for (const piece of ["待 (kanji)", "- made of: 彳 and 寺", "持 (kanji)", "- means: hold", "扌 is a hand."]) assert.ok(prompt.includes(piece), piece);
  });
  it("says to use only the facts and to gloss Japanese", () => {
    assert.match(prompt, /Use only the facts above/);
    assert.match(prompt, /Put its meaning in brackets after it once/);
  });
  it("only lets it describe strokes a fact or the tip describes", () => {
    assert.match(prompt, /Only describe strokes or the parts of a shape when a fact or the tip above describes them/);
  });
});

describe("parseCoach", () => {
  it("reads the explanation", () => {
    assert.equal(parseCoach('```json\n{"explanation":" Look at the left. "}\n```'), "Look at the left.");
  });
  it("turns down anything else", () => {
    assert.equal(parseCoach("Look at the left."), null);
    assert.equal(parseCoach('{"explanation":""}'), null);
    assert.equal(parseCoach('{"note":"x"}'), null);
  });
});

describe("ungrounded", () => {
  it("passes an answer whose Japanese is all in the facts", () => {
    assert.deepEqual(ungrounded(GOOD, req), []);
  });
  it("does not count the prompt's own wording as a fact", () => {
    assert.deepEqual(ungrounded("時", { ...req, asked: { ...req.asked, facts: [] }, other: { ...req.other, facts: [] } }), ["時"]);
  });
  it("names a run of kana the facts never write, even when each letter is there", () => {
    const hiragana = { ...req, asked: { ...req.asked, facts: ["read: ま, たい"] } };
    assert.deepEqual(ungrounded("待 is read たま.", hiragana), ["たま"]);
    assert.deepEqual(ungrounded("待 is read たい or ま.", hiragana), []);
  });
  it("names Japanese the facts don't have", () => {
    assert.deepEqual(ungrounded("待 is read たんべい.", req), ["た", "ん", "べ", "い"]);
    assert.deepEqual(ungrounded("It looks like 侍 (samurai).", req), ["侍"]);
  });
});

describe("explainWith", () => {
  it("keeps a grounded device answer", async () => {
    assert.deepEqual(await ask(reply(GOOD), never), { text: GOOD, source: "on_device" });
  });
  it("asks the cloud when the device makes something up, and says so", async () => {
    assert.deepEqual(await ask(reply("It looks like 侍 (samurai)."), reply(GOOD, "in_cloud")), { text: GOOD, source: "in_cloud", replaced: true });
  });
  it("doesn't say Nano was replaced when the first answer was the cloud's", async () => {
    assert.deepEqual(await ask(reply("侍.", "in_cloud"), reply(GOOD, "in_cloud")), { text: GOOD, source: "in_cloud" });
  });
  it("asks the cloud when the device fails or hangs, without saying it replaced anything", async () => {
    for (const first of [fails, hangs]) assert.deepEqual(await ask(first, reply(GOOD, "in_cloud")), { text: GOOD, source: "in_cloud" });
  });
  it("shows nothing made up, even from the cloud", async () => {
    assert.equal(await ask(reply("侍."), reply("侍.", "in_cloud")), null);
  });
  it("offline, shows nothing when the device can't answer", async () => {
    assert.equal(await ask(fails, never, false), null);
  });
});
