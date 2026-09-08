import assert from "node:assert/strict";
import { describe, test } from "node:test";

import {
  askFromAudioPrompts,
  askIsEmpty,
  defaultAsk,
  normalizeGridResponses,
  normalizePairResponses,
  sentenceAsks,
  sentenceAsksRomaji,
  sentenceAsksSelection,
  togglePairResponse,
  toggleGridResponse,
} from "@/lib/ask-config";
import type {
  AnswerStyle,
  AskConfig,
  PromptFormat,
  ResponseKind,
} from "@/types";

function emptyAsk(): AskConfig {
  return {
    japanese: { prompts: [], responses: [], answers: [] },
    sentence: {
      prompts: [],
      responses: [],
      answers: [],
      englishResponses: [],
    },
    english: { answers: [] },
  };
}

describe("AskConfig storage", () => {
  test("each source can be fully off and an all-off setup is empty", () => {
    assert.equal(askIsEmpty(emptyAsk()), true);
    assert.equal(askIsEmpty(defaultAsk()), false);
  });
});

describe("Match-pairs menu", () => {
  test("stored values are canonical, deduped, and unknown values are dropped", () => {
    assert.deepEqual(
      normalizePairResponses(["sentence", "wat", "definition", "sentence"]),
      ["definition", "sentence"],
    );
  });

  test("a missing stored selection defaults to all three", () => {
    const all = ["definition", "romaji", "sentence"];
    assert.deepEqual(normalizePairResponses(undefined), all);
    assert.deepEqual(normalizePairResponses({}), all);
  });

  test("an explicitly empty stored selection stays empty", () => {
    assert.deepEqual(normalizePairResponses([]), []);
  });

  test("each option can be added and removed, including the last one", () => {
    assert.deepEqual(togglePairResponse(["definition"], "romaji"), [
      "definition",
      "romaji",
    ]);
    assert.deepEqual(
      togglePairResponse(["definition", "romaji"], "definition"),
      ["romaji"],
    );
    assert.deepEqual(togglePairResponse(["romaji"], "romaji"), []);
  });
});

describe("Grid menu", () => {
  test("missing uses both defaults, while explicit empty stays empty", () => {
    assert.deepEqual(normalizeGridResponses(undefined), [
      "definition",
      "romaji",
    ]);
    assert.deepEqual(normalizeGridResponses([]), []);
  });

  test("stored values are canonical and unknown values are dropped", () => {
    assert.deepEqual(
      normalizeGridResponses(["romaji", "wat", "definition", "romaji"]),
      ["definition", "romaji"],
    );
  });

  test("either option, including the last one, can be toggled", () => {
    assert.deepEqual(toggleGridResponse(["definition"], "romaji"), [
      "definition",
      "romaji",
    ]);
    assert.deepEqual(
      toggleGridResponse(["definition", "romaji"], "definition"),
      ["romaji"],
    );
    assert.deepEqual(toggleGridResponse(["romaji"], "romaji"), []);
  });
});

describe("every atomic source combination", () => {
  const prompts: PromptFormat[] = ["text", "audio"];
  const responses: ResponseKind[] = ["definition", "romaji"];
  const answers: AnswerStyle[] = ["typed", "mc"];

  for (const prompt of prompts) {
    for (const response of responses) {
      for (const answer of answers) {
        test(`Japanese: ${prompt} + ${response} + ${answer} is complete`, () => {
          const ask = emptyAsk();
          ask.japanese = {
            prompts: [prompt],
            responses: [response],
            answers: [answer],
          };
          assert.equal(askIsEmpty(ask), false);
        });
      }
    }
  }

  for (const prompt of prompts) {
    for (const answer of answers) {
      test(`Japanese sentence definition: ${prompt} is complete and inherently multiple choice`, () => {
        const ask = emptyAsk();
        ask.sentence = {
          prompts: [prompt],
          responses: ["definition"],
          answers: [answer],
          englishResponses: [],
        };
        assert.equal(sentenceAsksSelection(ask), true);
        assert.equal(sentenceAsks(ask), true);
        assert.equal(askIsEmpty(ask), false);
      });
    }
  }

  for (const prompt of prompts) {
    for (const answer of answers) {
      test(`Japanese sentence kana transcription stays disabled: ${prompt} + ${answer}`, () => {
        const ask = emptyAsk();
        ask.sentence = {
          prompts: [prompt],
          responses: ["romaji"],
          answers: [answer],
          englishResponses: [],
        };
        assert.equal(sentenceAsksRomaji(ask), false);
        assert.equal(sentenceAsks(ask), false);
        assert.equal(askIsEmpty(ask), true);
      });
    }
  }

  for (const answer of answers) {
    test(`English: ${answer} is complete`, () => {
      const ask = emptyAsk();
      ask.english.answers = [answer];
      assert.equal(askIsEmpty(ask), false);
    });
  }
});

describe("incomplete source rows do not enable Start", () => {
  test("Japanese needs a prompt, response, and answer", () => {
    const complete = {
      prompts: ["text" as const],
      responses: ["romaji" as const],
      answers: ["typed" as const],
    };
    for (const missing of ["prompts", "responses", "answers"] as const) {
      const ask = emptyAsk();
      ask.japanese = { ...complete, [missing]: [] };
      assert.equal(askIsEmpty(ask), true, `missing ${missing}`);
    }
  });

  test("a sentence response without a prompt or answer is incomplete", () => {
    const noPrompt = emptyAsk();
    noPrompt.sentence = {
      prompts: [],
      responses: ["romaji"],
      answers: ["typed"],
      englishResponses: [],
    };
    assert.equal(askIsEmpty(noPrompt), true);

    const noAnswer = emptyAsk();
    noAnswer.sentence = {
      prompts: ["text"],
      responses: ["romaji"],
      answers: [],
      englishResponses: [],
    };
    assert.equal(askIsEmpty(noAnswer), true);
  });

  test("English needs an answer format", () => {
    assert.equal(askIsEmpty(emptyAsk()), true);
  });
});

describe("askFromAudioPrompts — the derived, everything-on ask", () => {
  test("off: text prompts, both responses, typed; en→jp production on", () => {
    assert.deepEqual(askFromAudioPrompts(false), {
      japanese: {
        prompts: ["text"],
        responses: ["definition", "romaji"],
        answers: ["typed"],
      },
      sentence: {
        prompts: ["text"],
        responses: ["definition"],
        answers: ["mc"],
        englishResponses: ["ordering", "selection"],
      },
      english: { answers: ["typed"] },
    });
  });

  test("on: text AND audio prompts — text is always present", () => {
    const ask = askFromAudioPrompts(true);
    // The whole point of the fix: text is never dropped, so audio is additive.
    assert.deepEqual(ask.japanese.prompts, ["text", "audio"]);
    assert.deepEqual(ask.sentence.prompts, ["text", "audio"]);
    // Everything else is still the full, always-on set.
    assert.deepEqual(ask.japanese.responses, ["definition", "romaji"]);
    assert.deepEqual(ask.english.answers, ["typed"]);
  });

  test("both on and off include a text prompt (production stays reachable)", () => {
    for (const audio of [true, false]) {
      assert.ok(askFromAudioPrompts(audio).japanese.prompts.includes("text"), String(audio));
    }
  });

  test("every derived ask is non-empty (Start is never wrongly disabled)", () => {
    for (const audio of [true, false]) {
      assert.equal(askIsEmpty(askFromAudioPrompts(audio)), false, String(audio));
    }
  });
});
