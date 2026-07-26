import assert from "node:assert/strict";
import { describe, test } from "node:test";

import {
  askIsEmpty,
  defaultAsk,
  migrateLegacyAsk,
  normalizeAsk,
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
  test("normalization drops unknown values, dedupes, and keeps canonical order", () => {
    assert.deepEqual(
      normalizeAsk({
        japanese: {
          prompts: ["audio", "wat", "text", "audio"],
          responses: ["romaji"],
          answers: ["mc", "typed", "mc"],
        },
        sentence: {},
        english: { answers: ["mc", "nope"] },
      }),
      {
        japanese: {
          prompts: ["text", "audio"],
          responses: ["romaji"],
          answers: ["typed", "mc"],
        },
        sentence: {
          prompts: [],
          responses: [],
          answers: [],
          englishResponses: ["ordering"],
        },
        english: { answers: ["mc"] },
      },
    );
  });

  test("legacy listening flags become an Audio prompt with the matching response", () => {
    const ask = migrateLegacyAsk({
      dirs: { jp2en: true, en2jp: true },
      styleJp2en: "typed",
      styleEn2jp: "mc",
      listenMeaning: true,
      listenRomaji: false,
    });
    assert.deepEqual(ask.japanese.prompts, ["text", "audio"]);
    assert.ok(ask.japanese.responses.includes("definition"));
    assert.deepEqual(ask.english.answers, ["mc"]);
  });

  test("each source can be fully off and an all-off setup is empty", () => {
    const empty = normalizeAsk({
      japanese: {},
      sentence: { englishResponses: [] },
      english: {},
    });
    assert.equal(askIsEmpty(empty), true);
    assert.equal(askIsEmpty(defaultAsk()), false);
  });

  test("an audio sentence-definition board is a complete way to ask", () => {
    const ask = normalizeAsk({
      japanese: {},
      sentence: {
        prompts: ["audio"],
        responses: ["definition"],
        answers: ["mc"],
      },
      english: {},
    });
    assert.equal(askIsEmpty(ask), false);
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
      test(`Japanese sentence romaji: ${prompt} + ${answer} is complete`, () => {
        const ask = emptyAsk();
        ask.sentence = {
          prompts: [prompt],
          responses: ["romaji"],
          answers: [answer],
          englishResponses: [],
        };
        assert.equal(sentenceAsksRomaji(ask), true);
        assert.equal(sentenceAsks(ask), true);
        assert.equal(askIsEmpty(ask), false);
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
