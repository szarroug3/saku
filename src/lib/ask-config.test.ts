import assert from "node:assert/strict";
import { describe, test } from "node:test";

import {
  askFromInput,
  askIsEmpty,
  defaultAsk,
  deriveInput,
  inputFromAsk,
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

describe("askFromInput — the derived, everything-on ask", () => {
  test("text: text prompts, both responses, typed; en→jp production on", () => {
    assert.deepEqual(askFromInput("text"), {
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

  test("audio: prompts become audio for both japanese and sentence", () => {
    const ask = askFromInput("audio");
    assert.deepEqual(ask.japanese.prompts, ["audio"]);
    assert.deepEqual(ask.sentence.prompts, ["audio"]);
    // Everything else is still the full, always-on set.
    assert.deepEqual(ask.japanese.responses, ["definition", "romaji"]);
    assert.deepEqual(ask.english.answers, ["typed"]);
  });

  test("both: mixes text and audio prompts", () => {
    const ask = askFromInput("both");
    assert.deepEqual(ask.japanese.prompts, ["text", "audio"]);
    assert.deepEqual(ask.sentence.prompts, ["text", "audio"]);
  });

  test("every derived ask is non-empty (Start is never wrongly disabled)", () => {
    for (const input of ["text", "audio", "both"] as const) {
      assert.equal(askIsEmpty(askFromInput(input)), false, input);
    }
  });
});

describe("inputFromAsk — reading the axis back for migration", () => {
  test("round-trips every input format", () => {
    for (const input of ["text", "audio", "both"] as const) {
      assert.equal(inputFromAsk(askFromInput(input)), input, input);
    }
  });

  test("text+audio ⇒ both, audio alone ⇒ audio, else ⇒ text", () => {
    const ask = defaultAsk();
    assert.equal(inputFromAsk({ ...ask, japanese: { ...ask.japanese, prompts: ["text", "audio"] } }), "both");
    assert.equal(inputFromAsk({ ...ask, japanese: { ...ask.japanese, prompts: ["audio"] } }), "audio");
    assert.equal(inputFromAsk({ ...ask, japanese: { ...ask.japanese, prompts: ["text"] } }), "text");
    assert.equal(inputFromAsk({ ...ask, japanese: { ...ask.japanese, prompts: [] } }), "text");
  });
});

describe("deriveInput — migration precedence", () => {
  test("an explicit input field wins outright", () => {
    assert.equal(deriveInput({ input: "both" }), "both");
    assert.equal(deriveInput({ input: "audio", ask: askFromInput("text") }), "audio");
  });

  test("a bad input field falls through to the next source", () => {
    assert.equal(deriveInput({ input: "nonsense", ask: askFromInput("audio") }), "audio");
  });

  test("a stored task-30 ask reads its prompt format back", () => {
    assert.equal(deriveInput({ ask: askFromInput("both") }), "both");
    assert.equal(deriveInput({ ask: askFromInput("audio") }), "audio");
  });

  test("pre-task-30 dirs/listen fields migrate through the same lens", () => {
    // jp→en text + a listen flag ⇒ text+audio ⇒ both
    assert.equal(
      deriveInput({ dirs: { jp2en: true }, styleJp2en: "typed", listenMeaning: true }),
      "both",
    );
    // jp→en text, no listening ⇒ text
    assert.equal(deriveInput({ dirs: { jp2en: true }, styleJp2en: "typed" }), "text");
  });

  test("an empty/unknown object defaults to text", () => {
    assert.equal(deriveInput({}), "text");
    assert.equal(deriveInput({ mode: "drill" }), "text");
  });
});
