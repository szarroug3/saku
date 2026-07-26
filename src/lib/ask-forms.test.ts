import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { kanaFact } from "@/data/characters";
import { READING_INDEX, meaningFactId as kanjiMeaningFactId, KANJI } from "@/data/kanji";
import { patternMeaningFactId, patternProductionFactId } from "@/data/grammar";
import { RECIPES } from "@/data/grammar/recipes";
import { KEIGO_SETS, keigoWordFactId } from "@/data/keigo";
import { VERB_PAIRS } from "@/data/transitivity";
import { sideFactId } from "@/data/transitivity-facts";
import { VOCAB, isKanaWord, wordMeaningFactId, wordReadingFactId } from "@/data/vocab";
import {
  buildCoverageDeck,
  enabledFormsFor,
  formIsMc,
  configIsReachable,
} from "@/lib/ask-forms";
import { ALL_FACTS } from "@/lib/facts";
import type { AskConfig } from "@/types";

const word = VOCAB.find((w) => !isKanaWord(w))!;
const reading = wordReadingFactId(word.keb);
const meaning = wordMeaningFactId(word.keb);
const firstKanjiReading = READING_INDEX.keys().next().value;
const grammarProductionFact = patternProductionFactId(RECIPES.find((r) => r.producible !== false)!.id);
const keigoFact = keigoWordFactId(KEIGO_SETS[0], KEIGO_SETS[0].words[0]);
const transitivityFact = sideFactId(VERB_PAIRS[0], "happens");

const ALL: AskConfig = {
  japanese: {
    prompts: ["text", "audio"],
    responses: ["definition", "romaji"],
    answers: ["typed", "mc"],
  },
  sentence: { prompts: [], responses: [], answers: [], englishResponses: [] },
  english: { answers: ["typed", "mc"] },
};

describe("enabledFormsFor", () => {
  test("a word reading covers text/audio × typed/MC plus both English forms", () => {
    const forms = enabledFormsFor(reading, ALL);
    assert.equal(forms.length, 6);
    assert.equal(forms.filter((f) => f.listen).length, 2);
    assert.deepEqual(
      new Set(forms.map((f) => f.source)),
      new Set(["japanese", "english"]),
    );
  });

  test("response selection narrows meaning and reading facts independently", () => {
    const definitionOnly: AskConfig = {
      ...ALL,
      japanese: { ...ALL.japanese, responses: ["definition"] },
      english: { answers: [] },
    };
    assert.equal(enabledFormsFor(reading, definitionOnly).length, 0);
    assert.equal(enabledFormsFor(meaning, definitionOnly).length, 4);
  });

  test("kana supports exactly its three approved question shapes", () => {
    const fact = kanaFact("あ");
    const forms = enabledFormsFor(fact, ALL);
    assert.deepEqual(forms, [
      {
        source: "japanese",
        response: "romaji",
        listen: false,
        dir: "jp2en",
        answer: "typed",
      },
      {
        source: "japanese",
        response: "romaji",
        listen: false,
        dir: "jp2en",
        answer: "mc",
      },
      {
        source: "japanese",
        response: "japanese",
        listen: true,
        dir: "en2jp",
        answer: "typed",
      },
      {
        source: "japanese",
        response: "japanese",
        listen: true,
        dir: "en2jp",
        answer: "mc",
      },
      {
        source: "english",
        response: "japanese",
        listen: false,
        dir: "en2jp",
        answer: "mc",
      },
    ]);

    const shapes = new Set(
      forms.map((form) =>
        form.listen
          ? "hear-kana"
          : form.dir === "jp2en"
            ? "see-kana"
            : "see-romaji",
      ),
    );
    assert.deepEqual(
      shapes,
      new Set(["see-kana", "hear-kana", "see-romaji"]),
    );
    assert.equal(
      forms.some(
        (form) =>
          form.dir === "en2jp" && !form.listen && !formIsMc(fact, form),
      ),
      false,
      "visible Romaji → kana must never become typed",
    );
    assert.equal(
      forms.some(
        (form) =>
          form.dir === "en2jp" && form.listen && !formIsMc(fact, form),
      ),
      true,
      "audio → kana must retain its typed form",
    );

    for (const kana of ALL_FACTS.filter((candidate) =>
      candidate.startsWith("kana:"),
    )) {
      const generated = enabledFormsFor(kana, ALL);
      assert.deepEqual(
        generated.map((form) =>
          form.listen
            ? "hear-kana"
            : form.dir === "jp2en"
              ? "see-kana"
              : "see-romaji",
        ),
        [
          "see-kana",
          "see-kana",
          "hear-kana",
          "hear-kana",
          "see-romaji",
        ],
        `${kana} must expose only the approved kana matrix`,
      );
    }
  });

  test("kana audio produces typed and picked kana forms", () => {
    const audioOnly: AskConfig = {
      ...ALL,
      japanese: {
        prompts: ["audio"],
        responses: ["romaji"],
        answers: ["typed", "mc"],
      },
      english: { answers: [] },
    };
    const forms = enabledFormsFor(kanaFact("あ"), audioOnly);
    assert.equal(forms.length, 2);
    assert.ok(forms.every((form) => form.listen && form.dir === "en2jp"));
    assert.equal(formIsMc(kanaFact("あ"), forms[0]), false);
    assert.equal(formIsMc(kanaFact("あ"), forms[1]), true);
  });

  test("kanji reading facts never get audio forms", () => {
    assert.ok(firstKanjiReading, "expected at least one kanji reading fact");
    const forms = enabledFormsFor(firstKanjiReading, ALL);
    assert.ok(forms.length > 0, "kanji reading should still have non-audio forms");
    assert.equal(forms.some((f) => f.listen), false);
  });

  test("forms that resolve to the same forced control are deduped", () => {
    const forms = enabledFormsFor(kanaFact("あ"), {
      ...ALL,
      japanese: {
        prompts: ["text"],
        responses: ["romaji"],
        answers: ["typed", "mc"],
      },
      english: { answers: [] },
    });
    assert.equal(forms.length, 2);
    assert.deepEqual(forms.map((f) => formIsMc(kanaFact("あ"), f)), [false, true]);
  });

  test("visible Romaji generates exactly one kana-picking form", () => {
    const forms = enabledFormsFor(kanaFact("あ"), {
      japanese: { prompts: [], responses: [], answers: [] },
      sentence: { prompts: [], responses: [], answers: [], englishResponses: [] },
      english: { answers: ["typed"] },
    });
    assert.deepEqual(forms, [
      {
        source: "english",
        response: "japanese",
        listen: false,
        dir: "en2jp",
        answer: "mc",
      },
    ]);
  });


  test("typed forms that resolve to MC are kept and rendered as MC", () => {
    const typedOnly: AskConfig = {
      japanese: {
        prompts: ["text"],
        responses: ["definition", "romaji"],
        answers: ["typed"],
      },
      sentence: {
        prompts: [],
        responses: [],
        answers: ["typed"],
        englishResponses: [],
      },
      english: { answers: ["typed"] },
    };
    // Facts that require MC for some directions (like a kanji-word meaning) should still
    // generate forms when typed is selected — they render as MC. This ensures
    // users see all available facts even when selecting typed-only.
    const forms = enabledFormsFor(meaning, typedOnly);
    const enJpForms = forms.filter((f) => f.dir === "en2jp");
    assert.ok(enJpForms.length > 0, "English should produce a form for a kanji word");
    for (const form of enJpForms) {
      // The form is typed in intent, but resolves to MC because the written
      // kanji target cannot be entered through the kana answer box.
      assert.equal(form.answer, "typed");
      assert.equal(formIsMc(meaning, form), true);
    }
  });

  test("sentence romaji currently emits no forms", () => {
    const forms = enabledFormsFor(reading, {
      japanese: { prompts: [], responses: [], answers: [] },
      sentence: {
        prompts: ["text", "audio"],
        responses: ["romaji"],
        answers: ["typed", "mc"],
        englishResponses: [],
      },
      english: { answers: [] },
    });
    assert.deepEqual(forms, []);
  });

  for (const prompt of ["text", "audio"] as const) {
    test(`sentence definition supports ${prompt} + multiple choice`, () => {
      const fact = patternMeaningFactId(RECIPES[0].id);
      const forms = enabledFormsFor(fact, {
        japanese: { prompts: [], responses: [], answers: [] },
        sentence: {
          prompts: [prompt],
          responses: ["definition"],
          answers: ["mc"],
          englishResponses: [],
        },
        english: { answers: [] },
      });
      assert.deepEqual(forms, [
        {
          source: "sentence",
          response: "definition",
          listen: prompt === "audio",
          dir: "jp2en",
          answer: "mc",
        },
      ]);
    });
  }

  test("sentence definition stays multiple choice regardless of the kana answer format", () => {
    const fact = patternMeaningFactId(RECIPES[0].id);
    assert.deepEqual(
      enabledFormsFor(fact, {
        japanese: { prompts: [], responses: [], answers: [] },
        sentence: {
          prompts: ["text"],
          responses: ["definition"],
          answers: ["typed"],
          englishResponses: [],
        },
        english: { answers: [] },
      }),
      [
        {
          source: "sentence",
          response: "definition",
          listen: false,
          dir: "jp2en",
          answer: "mc",
        },
      ],
    );
  });
});

describe("buildCoverageDeck", () => {
  test("expands every fact into every enabled form and keeps pairs aligned", () => {
    const expected = [
      ...enabledFormsFor(reading, ALL).map((form) => ({ f: reading, form })),
      ...enabledFormsFor(meaning, ALL).map((form) => ({ f: meaning, form })),
    ];
    const got = buildCoverageDeck([reading, meaning], ALL, (pairs) => pairs);
    assert.deepEqual(got.deck, expected.map((p) => p.f));
    assert.deepEqual(got.forms, expected.map((p) => p.form));
    assert.ok(got.forms.some((f) => f.listen), "Audio must be in coverage");
  });

  test("the injected shuffle moves a fact and its form as one card", () => {
    const got = buildCoverageDeck([reading], ALL, (pairs) => pairs.reverse());
    const expected = enabledFormsFor(reading, ALL).reverse();
    assert.deepEqual(got.forms, expected);
    assert.ok(got.deck.every((f) => f === reading));
  });
});

describe("Unreachable Planned forms (settings selected but forms not generated)", () => {
  test("grammar meaning audio is silently dropped (grammar not listenable)", () => {
    const grammarFact = patternMeaningFactId(RECIPES[0].id);
    const audioOnly: AskConfig = {
      japanese: {
        prompts: ["audio"],
        responses: ["definition"],
        answers: ["mc"],
      },
      sentence: { prompts: [], responses: [], answers: [] },
      english: { answers: [] },
    };
    const forms = enabledFormsFor(grammarFact, audioOnly);
    assert.deepEqual(forms, [], "Grammar meaning with audio should produce no forms");
  });

  test("kana audio is emitted as kana production", () => {
    const kanaChar = kanaFact("あ");
    const audioOnly: AskConfig = {
      japanese: {
        prompts: ["audio"],
        responses: ["romaji"],
        answers: ["mc"],
      },
      sentence: { prompts: [], responses: [], answers: [] },
      english: { answers: [] },
    };
    const forms = enabledFormsFor(kanaChar, audioOnly);
    assert.deepEqual(forms, [
      {
        source: "japanese",
        response: "japanese",
        listen: true,
        dir: "en2jp",
        answer: "mc",
      },
    ]);
  });

  test("kanji reading audio is silently dropped (kanji reading not listenable)", () => {
    const firstKanjiReading = READING_INDEX.keys().next().value;
    assert.ok(firstKanjiReading, "expected at least one kanji reading fact");
    const audioOnly: AskConfig = {
      japanese: {
        prompts: ["audio"],
        responses: ["romaji"],
        answers: ["mc"],
      },
      sentence: { prompts: [], responses: [], answers: [] },
      english: { answers: [] },
    };
    const forms = enabledFormsFor(firstKanjiReading, audioOnly);
    assert.deepEqual(forms, [], "Kanji reading with audio should produce no forms");
  });

  test("sentence romaji is silently dropped (not yet implemented)", () => {
    const wordReading = wordReadingFactId(word.keb);
    const sentenceRomajiOnly: AskConfig = {
      japanese: { prompts: [], responses: [], answers: [] },
      sentence: {
        prompts: ["text", "audio"],
        responses: ["romaji"],
        answers: ["typed", "mc"],
      },
      english: { answers: [] },
    };
    const forms = enabledFormsFor(wordReading, sentenceRomajiOnly);
    assert.deepEqual(forms, [], "Sentence romaji should produce no forms");
  });
});

describe("Multiple settings paths to same question format (text vs audio as different FORMS)", () => {
  test("word reading can be reached via text prompt", () => {
    const textOnly: AskConfig = {
      japanese: {
        prompts: ["text"],
        responses: ["romaji"],
        answers: ["typed"],
      },
      sentence: { prompts: [], responses: [], answers: [] },
      english: { answers: [] },
    };
    const forms = enabledFormsFor(reading, textOnly);
    assert.equal(forms.length, 1);
    assert.deepEqual(forms[0], {
      source: "japanese",
      response: "romaji",
      listen: false,
      dir: "jp2en",
      answer: "typed",
    });
  });

  test("word reading can be reached via audio prompt (creates different FORM)", () => {
    const audioOnly: AskConfig = {
      japanese: {
        prompts: ["audio"],
        responses: ["romaji"],
        answers: ["typed"],
      },
      sentence: { prompts: [], responses: [], answers: [] },
      english: { answers: [] },
    };
    const forms = enabledFormsFor(reading, audioOnly);
    assert.equal(forms.length, 1);
    assert.deepEqual(forms[0], {
      source: "japanese",
      response: "romaji",
      listen: true,
      dir: "jp2en",
      answer: "typed",
    });
  });

  test("word reading deduped when both text and audio selected", () => {
    const both: AskConfig = {
      japanese: {
        prompts: ["text", "audio"],
        responses: ["romaji"],
        answers: ["typed"],
      },
      sentence: { prompts: [], responses: [], answers: [] },
      english: { answers: [] },
    };
    const forms = enabledFormsFor(reading, both);
    assert.equal(forms.length, 2, "Text and audio are different FORMS");
    assert.deepEqual(forms.map((f) => f.listen), [false, true]);
  });

  test("word meaning can be reached via text or audio (creates different FORMS)", () => {
    const textOnly: AskConfig = {
      japanese: {
        prompts: ["text"],
        responses: ["definition"],
        answers: ["mc"],
      },
      sentence: { prompts: [], responses: [], answers: [] },
      english: { answers: [] },
    };
    const audioOnly: AskConfig = {
      ...textOnly,
      japanese: { ...textOnly.japanese, prompts: ["audio"] },
    };
    const textForms = enabledFormsFor(meaning, textOnly);
    const audioForms = enabledFormsFor(meaning, audioOnly);
    assert.equal(textForms.length, 1);
    assert.equal(audioForms.length, 1);
    assert.equal(textForms[0].listen, false);
    assert.equal(audioForms[0].listen, true);
  });

  test("grammar sentence definition can be reached via text or audio (creates different FORMS)", () => {
    const grammarFact = patternMeaningFactId(RECIPES[0].id);
    const textOnly: AskConfig = {
      japanese: { prompts: [], responses: [], answers: [] },
      sentence: {
        prompts: ["text"],
        responses: ["definition"],
        answers: ["mc"],
      },
      english: { answers: [] },
    };
    const audioOnly: AskConfig = {
      ...textOnly,
      sentence: { ...textOnly.sentence, prompts: ["audio"] },
    };
    const textForms = enabledFormsFor(grammarFact, textOnly);
    const audioForms = enabledFormsFor(grammarFact, audioOnly);
    assert.equal(textForms.length, 1);
    assert.equal(audioForms.length, 1);
    assert.equal(textForms[0].listen, false);
    assert.equal(audioForms[0].listen, true);
  });
});

describe("Blocked production facts (not yet implemented)", () => {
  test("keigo production via English not generated (awaiting implementation)", () => {
    // Keigo production facts don't exist in current data model;
    // this test documents that when they do, they should be blocked.
    // For now, we verify that sentence source with non-grammar facts
    // produces no forms.
    const wordMeaning = wordMeaningFactId(word.keb);
    const enToJp: AskConfig = {
      japanese: { prompts: [], responses: [], answers: [] },
      sentence: {
        prompts: ["text"],
        responses: ["definition"],
        answers: ["mc"],
      },
      english: { answers: ["mc"] },
    };
    const forms = enabledFormsFor(wordMeaning, enToJp);
    // Sentence source only emits for grammar meaning facts, so word facts get no sentence forms.
    assert.equal(
      forms.filter((f) => f.source === "sentence").length,
      0,
      "Sentence source should not emit for non-grammar facts",
    );
  });
});

describe("configIsReachable diagnostic", () => {
  test("all sources disabled is unreachable", () => {
    const empty: AskConfig = {
      japanese: { prompts: [], responses: [], answers: [] },
      sentence: { prompts: [], responses: [], answers: [] },
      english: { answers: [] },
    };
    const result = configIsReachable([reading], empty);
    assert.equal(result.isReachable, false);
    assert.match(result.reason!, /All sources disabled/);
  });

  test("audio-only with only a non-listenable kanji reading is unreachable", () => {
    const audioOnly: AskConfig = {
      japanese: {
        prompts: ["audio"],
        responses: ["definition", "romaji"],
        answers: ["mc"],
      },
      sentence: { prompts: [], responses: [], answers: [] },
      english: { answers: [] },
    };
    const result = configIsReachable([firstKanjiReading], audioOnly);
    assert.equal(result.isReachable, false);
    assert.match(result.reason!, /Audio selected/);
  });

  test("audio-only with listenable facts is reachable", () => {
    const audioOnly: AskConfig = {
      japanese: {
        prompts: ["audio"],
        responses: ["romaji"],
        answers: ["mc"],
      },
      sentence: { prompts: [], responses: [], answers: [] },
      english: { answers: [] },
    };
    const result = configIsReachable([reading], audioOnly);
    assert.equal(result.isReachable, true);
  });

  test("text prompt with any fact is reachable", () => {
    const text: AskConfig = {
      japanese: {
        prompts: ["text"],
        responses: ["definition"],
        answers: ["mc"],
      },
      sentence: { prompts: [], responses: [], answers: [] },
      english: { answers: [] },
    };
    const result = configIsReachable([meaning], text);
    assert.equal(result.isReachable, true);
  });

  test("english-only produces forms for en→jp facts", () => {
    const englishOnly: AskConfig = {
      japanese: { prompts: [], responses: [], answers: [] },
      sentence: { prompts: [], responses: [], answers: [] },
      english: { answers: ["mc"] },
    };
    const result = configIsReachable([reading], englishOnly);
    assert.equal(result.isReachable, true, "en→jp reading should be reachable");
  });

  test("romaji-only with only meaning facts is unreachable", () => {
    const romajiOnly: AskConfig = {
      japanese: {
        prompts: ["text"],
        responses: ["romaji"],
        answers: ["typed"],
      },
      sentence: { prompts: [], responses: [], answers: [] },
      english: { answers: [] },
    };
    const result = configIsReachable([meaning], romajiOnly);
    assert.equal(result.isReachable, false, "no reading fact to enable romaji");
  });
});

// ── Coverage of doc §5.2, §6.1, §6.2 — subject-specific form shapes ──────────

describe("Grammar production fact (§5.2 Current)", () => {
  // Grammar production: answered by picking a Japanese form. ask-forms sees this
  // as jp→en direction with a 'romaji' response (the answer IS Japanese).
  // There is no fixedDir, but answerIsJapanese(prod, 'jp2en') is true, so
  // candidateDirs returns ['jp2en'] only — no en→jp form is generated.
  test("grammar production fact produces jp→en 'romaji' forms (answer IS Japanese)", () => {
    const forms = enabledFormsFor(grammarProductionFact, ALL);
    assert.ok(forms.length > 0, "grammar production should yield forms");
    assert.ok(
      forms.every((f) => f.dir === "jp2en" && f.response === "romaji"),
      "grammar production forms should be jp→en with romaji response",
    );
  });

  test("grammar production has no en→jp form (answerIsJapanese pins it to jp→en)", () => {
    const forms = enabledFormsFor(grammarProductionFact, ALL);
    assert.equal(
      forms.filter((f) => f.dir === "en2jp").length,
      0,
      "grammar production fact should produce no en→jp forms",
    );
  });

  test("grammar production audio is silently dropped (not listenable)", () => {
    const audioPromptOnly: AskConfig = {
      japanese: {
        prompts: ["audio"],
        responses: ["definition", "romaji"],
        answers: ["mc"],
      },
      sentence: { prompts: [], responses: [], answers: [] },
      english: { answers: [] },
    };
    const forms = enabledFormsFor(grammarProductionFact, audioPromptOnly);
    assert.deepEqual(forms, [], "grammar production with audio-only → no forms (not listenable)");
  });
});

describe("Word meaning en→jp MC enforcement (§3.x — non-kana target)", () => {
  // The doc marks word meaning en→jp as MC-only for kanji words because the
  // written form (e.g. 先生) is not kana-only and therefore not typeable.
  // ask-forms enforces this: a typed en→jp form for such a fact is MC-forced
  // (en2jpTypeable returns false) and dropped by the dedup product rule.
  test("word meaning en→jp: typed intent resolves to MC for words with kanji", () => {
    const typedEnOnly: AskConfig = {
      japanese: { prompts: [], responses: [], answers: [] },
      sentence: { prompts: [], responses: [], answers: [] },
      english: { answers: ["typed"] },
    };
    const forms = enabledFormsFor(meaning, typedEnOnly);
    // The written form of a kanji word (e.g. 先生) is not kana-only, so the
    // selected typed intent is resolved to the only safe control: MC.
    assert.ok(
      forms.some((f) => f.dir === "en2jp" && formIsMc(meaning, f)),
      "en→jp typed intent should resolve to MC for a word with kanji",
    );
  });

  test("word meaning en→jp: mc form IS emitted", () => {
    const mcEnOnly: AskConfig = {
      japanese: { prompts: [], responses: [], answers: [] },
      sentence: { prompts: [], responses: [], answers: [] },
      english: { answers: ["mc"] },
    };
    const forms = enabledFormsFor(meaning, mcEnOnly);
    assert.ok(
      forms.some((f) => f.dir === "en2jp" && formIsMc(meaning, f)),
      "en→jp mc form should be emitted",
    );
  });

  test("word reading en→jp: typed form IS emitted (kana reading is typeable)", () => {
    const typedEnOnly: AskConfig = {
      japanese: { prompts: [], responses: [], answers: [] },
      sentence: { prompts: [], responses: [], answers: [] },
      english: { answers: ["typed"] },
    };
    const forms = enabledFormsFor(reading, typedEnOnly);
    assert.ok(
      forms.some((f) => f.dir === "en2jp" && f.answer === "typed"),
      "reading en→jp typed should be emitted (kana reading target is typeable)",
    );
  });
});

describe("Keigo recognition fact (§6.1 Current)", () => {
  // Keigo: jp→en MC-only (recognition). en→jp and audio are Planned / By design.
  test("keigo fact produces a jp→en MC form via japanese source", () => {
    const forms = enabledFormsFor(keigoFact, ALL);
    const jp2en = forms.filter((f) => f.dir === "jp2en" && !f.listen);
    assert.ok(jp2en.length > 0, "keigo should produce at least one jp→en text form");
    assert.ok(jp2en.every((f) => formIsMc(keigoFact, f)), "keigo jp→en must be MC-only");
  });

  test("keigo audio is silently dropped (Planned → not yet listenable)", () => {
    const audioOnly: AskConfig = {
      japanese: { prompts: ["audio"], responses: ["definition"], answers: ["mc"] },
      sentence: { prompts: [], responses: [], answers: [] },
      english: { answers: [] },
    };
    const forms = enabledFormsFor(keigoFact, audioOnly);
    assert.deepEqual(forms, [], "keigo with audio-only → no forms");
  });

  test("keigo en→jp is not generated (production is Planned, not Current)", () => {
    const forms = enabledFormsFor(keigoFact, ALL);
    assert.equal(
      forms.filter((f) => f.dir === "en2jp").length,
      0,
      "keigo en→jp should not be generated (production is Planned)",
    );
  });
});

describe("Transitivity fact (§6.2 Current)", () => {
  // Transitivity: en→jp (Current). jp→en is Planned and should be silently dropped.
  test("transitivity fact produces an en→jp form (english source, en2jp fixed)", () => {
    const forms = enabledFormsFor(transitivityFact, ALL);
    const en2jp = forms.filter((f) => f.dir === "en2jp");
    assert.ok(en2jp.length > 0, "transitivity should yield at least one en→jp form");
    assert.ok(en2jp.every((f) => !f.listen), "en→jp forms are never audio");
    assert.ok(en2jp.every((f) => formIsMc(transitivityFact, f)), "transitivity en→jp is MC");
  });

  test("transitivity jp→en is not generated (Planned, fixedDir = en2jp)", () => {
    // transitivityQuestions has fixedDir: 'en2jp', so jp→en is never a candidate.
    const forms = enabledFormsFor(transitivityFact, ALL);
    assert.equal(
      forms.filter((f) => f.dir === "jp2en").length,
      0,
      "transitivity jp→en should not be generated (fixedDir en2jp)",
    );
  });

  test("transitivity audio produces no forms (en→jp direction has no audio)", () => {
    const audioOnly: AskConfig = {
      japanese: { prompts: ["audio"], responses: ["definition", "romaji"], answers: ["mc"] },
      sentence: { prompts: [], responses: [], answers: [] },
      english: { answers: [] },
    };
    const forms = enabledFormsFor(transitivityFact, audioOnly);
    assert.deepEqual(forms, [], "transitivity with audio-only jp source → no forms");
  });
});

// ── "By design" exclusions — things that must NEVER appear ───────────────────

describe("By design: audio exclusions that must never generate forms", () => {
  const audioOnly: AskConfig = {
    japanese: {
      prompts: ["audio"],
      responses: ["definition", "romaji"],
      answers: ["typed", "mc"],
    },
    sentence: { prompts: [], responses: [], answers: [] },
    english: { answers: [] },
  };

  // §2.1: kanji MEANING audio is By design excluded (no audio form for kanji meaning).
  // Distinct from §2.2 kanji reading audio (also excluded, tested separately).
  test("kanji meaning audio: By design excluded (no audio form for kanji meaning fact)", () => {
    const kanjiMeaning = kanjiMeaningFactId(KANJI[0].char);
    const forms = enabledFormsFor(kanjiMeaning, audioOnly);
    assert.deepEqual(forms, [], "kanji meaning with audio-only → no forms (By design)");
  });

  // §3.1: kana-only WORD audio is Current (words are listenable, unlike kana entries).
  // Guard that the kana-only word case is NOT excluded, to prevent regressions.
  test("kana-only word audio: correctly NOT excluded (kana-only words are listenable)", () => {
    const kanaWord = VOCAB.find(isKanaWord)!;
    const kanaWordMeaning = wordMeaningFactId(kanaWord.keb ?? kanaWord.reb!);
    const forms = enabledFormsFor(kanaWordMeaning, audioOnly);
    assert.ok(forms.length > 0, "kana-only word meaning with audio should produce forms");
    assert.ok(forms.some((f) => f.listen), "at least one form should be audio");
  });
});

describe("By design: self-copy forms are structurally impossible", () => {
  // The jp→jp self-copy rows in the doc (あ→type あ, 一→type 一, etc.) cannot be
  // generated because Direction = 'jp2en' | 'en2jp' — there is no jp2jp value.
  // This test asserts the structural guarantee: no form produced by enabledFormsFor
  // for any fact in the corpus has a direction outside the two valid values.
  test("every form produced across all facts has direction 'jp2en' or 'en2jp' only", () => {
    const validDirs = new Set(["jp2en", "en2jp"]);
    for (const fact of ALL_FACTS) {
      for (const form of enabledFormsFor(fact, ALL)) {
        assert.ok(
          validDirs.has(form.dir),
          `fact ${fact} produced a form with invalid dir '${form.dir}' — self-copy guard violated`,
        );
      }
    }
  });
});
