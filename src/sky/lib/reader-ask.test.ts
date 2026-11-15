import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { AskModel } from "./ai-ask";
import { parseTranslation, translatePrompt, translateWith } from "./reader-ask";

const r = { selected: "見に行きました", passage: "昨日、友達と映画を見に行きました。" };

describe("translatePrompt", () => {
  it("carries the passage and the part to translate, and asks for English only", () => {
    const prompt = translatePrompt(r);
    assert.match(prompt, /THE TEXT AROUND IT\n昨日、友達と映画を見に行きました。/);
    assert.match(prompt, /TRANSLATE THIS PART\n見に行きました/);
    assert.match(prompt, /Write no Japanese/);
  });
});

describe("parseTranslation", () => {
  it("reads the translation field", () => assert.equal(parseTranslation('{"translation":"went to see"}'), "went to see"));
});

describe("translateWith", () => {
  const reply = (text: string, source: "on_device" | "in_cloud" = "on_device"): AskModel => async () => ({ text: JSON.stringify({ translation: text }), source });
  const never: AskModel = async () => { throw new Error("must not be asked"); };
  const ask = (first: AskModel, cloud: AskModel, req = r) => translateWith(req, { first, cloud, online: () => true, firstMs: 20, cloudMs: 20, warn: () => {} });

  it("keeps Nano's translation", async () => {
    assert.deepEqual(await ask(reply("went to see"), never), { text: "went to see", source: "on_device" });
  });
  it("asks the cloud when Nano writes Japanese that isn't in the passage", async () => {
    assert.deepEqual(await ask(reply("went to see (観る)"), reply("went to see", "in_cloud")), { text: "went to see", source: "in_cloud", replaced: true });
  });
  it("asks nothing for an empty selection", async () => {
    assert.equal(await ask(never, never, { ...r, selected: "  " }), null);
  });
});
