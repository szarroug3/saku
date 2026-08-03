import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { kanaFact } from "@/data/characters";
import { READING_INDEX, meaningFactId as kanjiMeaningFactId, KANJI } from "@/data/kanji";
import {
  classProductionFactId,
  patternMeaningFactId,
} from "@/data/grammar";
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
import { ALL_FACTS, entryOf } from "@/lib/facts";
import type { AskConfig } from "@/types";

const word = VOCAB.find((w) => !isKanaWord(w))!;
const reading = wordReadingFactId(word.keb);
const meaning = wordMeaningFactId(word.keb);
const firstKanjiReading = READING_INDEX.keys().next().value!;
const grammarProductionFact = classProductionFactId("tai", "v5k");
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
  test("a word reading is two jp→en typed cards (text and audio)", () => {
    // Rule A pins a word fact to jp→en (no en→jp word card), and Rule B drops the
    // MC sibling of each typed card, so text and audio typed cards are all that
    // remain — both from the Japanese source.
    const forms = enabledFormsFor(reading, ALL);
    assert.equal(forms.length, 2);
    assert.equal(forms.filter((f) => f.listen).length, 1);
    assert.ok(forms.every((f) => f.dir === "jp2en" && f.answer === "typed"));
    assert.deepEqual(
      new Set(forms.map((f) => f.source)),
      new Set(["japanese"]),
    );
  });

  test("response selection narrows meaning and reading facts independently", () => {
    const definitionOnly: AskConfig = {
      ...ALL,
      japanese: { ...ALL.japanese, responses: ["definition"] },
      english: { answers: [] },
    };
    assert.equal(enabledFormsFor(reading, definitionOnly).length, 0);
    // Meaning under definition-only keeps its two jp→en typed cards (text and
    // audio); the MC siblings are dropped by Rule B.
    assert.equal(enabledFormsFor(meaning, definitionOnly).length, 2);
  });

  test("kana supports exactly its approved question shapes", () => {
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
        source: "english",
        response: "japanese",
        listen: false,
        dir: "en2jp",
        answer: "mc",
      },
    ]);

    const shapes = new Set(
      forms.map((form) =>
        form.dir === "jp2en"
            ? "see-kana"
            : "see-romaji",
      ),
    );
    assert.deepEqual(
      shapes,
      new Set(["see-kana", "see-romaji"]),
    );
    assert.equal(
      forms.some(
        (form) =>
          form.dir === "en2jp" && !form.listen && !formIsMc(fact, form),
      ),
      false,
      "visible Romaji → kana must never become typed",
    );
    for (const kana of ALL_FACTS.filter((candidate) =>
      candidate.startsWith("kana:"),
    )) {
      const generated = enabledFormsFor(kana, ALL);
      assert.deepEqual(
        generated.map((form) =>
          form.dir === "jp2en"
              ? "see-kana"
              : "see-romaji",
        ),
        [
          "see-kana",
          "see-kana",
          "see-romaji",
        ],
        `${kana} must expose only the approved kana matrix`,
      );
    }
  });

  test("kana audio produces no forms", () => {
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
    assert.deepEqual(forms, []);
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
    const kanjiMeaning = kanjiMeaningFactId(KANJI[0].c);
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
    // A kanji meaning en→jp has no typed sibling to defer to — the glyph target
    // cannot be entered through the kana answer box (en2jpTypeable is false) — so
    // Rule B does not drop it. The typed intent survives and resolves to MC,
    // which is how a typed-only config still shows this fact as a usable board.
    const forms = enabledFormsFor(kanjiMeaning, typedOnly);
    const enJpForms = forms.filter((f) => f.dir === "en2jp");
    assert.ok(enJpForms.length > 0, "English should produce a form for a kanji glyph");
    for (const form of enJpForms) {
      assert.equal(form.answer, "typed");
      assert.equal(formIsMc(kanjiMeaning, form), true);
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
  // buildCoverageDeck now runs its pairs through spread() (avoids two same-entry
  // cards landing adjacent), and spread reorders using its own internal
  // randomness that the injected shuffle does not reach. So an exact-order
  // assertion is no longer valid; these tests assert the invariants instead —
  // the whole product is present, and every card keeps its fact paired with its
  // own form (spread reorders whole pairs, never the two arrays independently).
  const formSig = (form: unknown) => JSON.stringify(form);

  test("expands every fact into every enabled form and keeps each card's fact and form paired", () => {
    const expected = [
      ...enabledFormsFor(reading, ALL).map((form) => ({ f: reading, form })),
      ...enabledFormsFor(meaning, ALL).map((form) => ({ f: meaning, form })),
    ];
    const got = buildCoverageDeck([reading, meaning], ALL, (pairs) => pairs);
    assert.equal(got.deck.length, expected.length);
    assert.equal(got.forms.length, got.deck.length);
    // Each card's form is one of its own fact's enabled forms (pairing kept).
    for (let i = 0; i < got.deck.length; i++) {
      assert.ok(
        enabledFormsFor(got.deck[i], ALL).some(
          (f) => formSig(f) === formSig(got.forms[i]),
        ),
        `card ${i} pairs a fact with a form it does not own`,
      );
    }
    // The full product is present — spread neither drops nor duplicates a card.
    const key = (f: string, form: unknown) => `${f}::${formSig(form)}`;
    assert.deepEqual(
      got.deck.map((f, i) => key(f, got.forms[i])).sort(),
      expected.map((p) => key(p.f, p.form)).sort(),
    );
    assert.ok(got.forms.some((f) => f.listen), "Audio must be in coverage");
  });

  test("a fact and its form move as one card, and distinct entries spread apart", () => {
    // reading (a word) and firstKanjiReading are DIFFERENT entries, so a full
    // spread is feasible: no two adjacent cards share an entry.
    const got = buildCoverageDeck([reading, firstKanjiReading], ALL, (pairs) => pairs);
    for (let i = 0; i < got.deck.length; i++) {
      assert.ok(
        enabledFormsFor(got.deck[i], ALL).some(
          (f) => formSig(f) === formSig(got.forms[i]),
        ),
        `card ${i} pairs a fact with a form it does not own`,
      );
    }
    for (let i = 1; i < got.deck.length; i++) {
      assert.notEqual(
        entryOf(got.deck[i]),
        entryOf(got.deck[i - 1]),
        "distinct-entry cards must not sit adjacent when a spread is feasible",
      );
    }
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

  test("kana audio is silently dropped", () => {
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
    assert.deepEqual(forms, []);
  });

  test("kanji reading audio is silently dropped (kanji reading not listenable)", () => {
    const firstKanjiReading = READING_INDEX.keys().next().value!;
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

  test("english-only produces forms for facts that still have an en→jp card", () => {
    // A word reading is jp→en only now (Rule A), so english-only would leave it
    // with no card. A keigo fact still has an en→jp production card, so
    // english-only is reachable for it.
    const englishOnly: AskConfig = {
      japanese: { prompts: [], responses: [], answers: [] },
      sentence: { prompts: [], responses: [], answers: [] },
      english: { answers: ["mc"] },
    };
    assert.equal(enabledFormsFor(reading, englishOnly).length, 0);
    const result = configIsReachable([keigoFact], englishOnly);
    assert.equal(result.isReachable, true, "en→jp keigo production should be reachable");
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

describe("Word facts are jp→en only (§3 — one card per fact, per reading-unit)", () => {
  // Rule A: a word fact is asked ONLY in the jp→en direction (wordQuestions.fixedDir).
  // The old "produce the written word from English" en→jp card is gone entirely, so
  // neither a word MEANING nor a word READING emits any en→jp form, whatever the
  // English answer format. The MC-enforcement for an un-typeable en→jp target now
  // lives only on non-word subjects (kanji/radical meaning); see the kanji tests.
  test("word meaning emits no en→jp card, typed OR mc", () => {
    for (const answers of [["typed"], ["mc"], ["typed", "mc"]] as const) {
      const englishOnly: AskConfig = {
        japanese: { prompts: [], responses: [], answers: [] },
        sentence: { prompts: [], responses: [], answers: [] },
        english: { answers: [...answers] },
      };
      const forms = enabledFormsFor(meaning, englishOnly);
      assert.equal(
        forms.filter((f) => f.dir === "en2jp").length,
        0,
        `word meaning must not emit en→jp for english answers ${answers}`,
      );
    }
    // The jp→en meaning card is still present under a full config.
    assert.ok(enabledFormsFor(meaning, ALL).some((f) => f.dir === "jp2en"));
  });

  test("word reading emits no en→jp card, typed OR mc", () => {
    for (const answers of [["typed"], ["mc"], ["typed", "mc"]] as const) {
      const englishOnly: AskConfig = {
        japanese: { prompts: [], responses: [], answers: [] },
        sentence: { prompts: [], responses: [], answers: [] },
        english: { answers: [...answers] },
      };
      assert.equal(
        enabledFormsFor(reading, englishOnly).length,
        0,
        `word reading must not emit any form for english-only answers ${answers}`,
      );
    }
    // The jp→en reading card is still present under a full config.
    assert.ok(enabledFormsFor(reading, ALL).some((f) => f.dir === "jp2en"));
  });
});

describe("Keigo fact (§6.1 Current)", () => {
  // Recognition is MC-only; audio recognition and kana/kanji production are
  // also current because every Keigo fact stores an authoritative reading.
  test("keigo fact produces a jp→en MC form via japanese source", () => {
    const forms = enabledFormsFor(keigoFact, ALL);
    const jp2en = forms.filter((f) => f.dir === "jp2en" && !f.listen);
    assert.ok(jp2en.length > 0, "keigo should produce at least one jp→en text form");
    assert.ok(jp2en.every((f) => formIsMc(keigoFact, f)), "keigo jp→en must be MC-only");
  });

  test("keigo audio produces a meaning/register recognition form", () => {
    const audioOnly: AskConfig = {
      japanese: { prompts: ["audio"], responses: ["definition"], answers: ["mc"] },
      sentence: { prompts: [], responses: [], answers: [] },
      english: { answers: [] },
    };
    const forms = enabledFormsFor(keigoFact, audioOnly);
    assert.equal(forms.length, 1);
    assert.equal(forms[0].listen, true);
    assert.equal(forms[0].dir, "jp2en");
    assert.equal(formIsMc(keigoFact, forms[0]), true);
  });

  test("keigo en→jp production collapses to one typed kana card", () => {
    // Production had a typed and an MC card; Rule B drops the MC one because the
    // kana reading is typeable, so only the typed production card survives.
    const forms = enabledFormsFor(keigoFact, ALL);
    const production = forms.filter((f) => f.dir === "en2jp");
    assert.equal(production.length, 1);
    assert.equal(formIsMc(keigoFact, production[0]), false);
  });
});

describe("Transitivity fact (§6.2 Current)", () => {
  test("transitivity produces a single typed English-cue production card", () => {
    // Production had a typed and an MC card; Rule B drops the MC one because the
    // kana reading is typeable, so only the typed production card survives.
    const forms = enabledFormsFor(transitivityFact, ALL);
    const en2jp = forms.filter((f) => f.dir === "en2jp");
    assert.equal(en2jp.length, 1);
    assert.ok(en2jp.every((f) => !f.listen), "en→jp forms are never audio");
    assert.equal(formIsMc(transitivityFact, en2jp[0]), false);
  });

  test("transitivity Japanese text recognition is MC-only", () => {
    const forms = enabledFormsFor(transitivityFact, ALL);
    const text = forms.filter((f) => f.dir === "jp2en" && !f.listen);
    assert.equal(text.length, 1);
    assert.ok(
      text.every((form) => formIsMc(transitivityFact, form)),
      "role recognition must be MC",
    );
  });

  test("transitivity audio produces MC role recognition", () => {
    const audioOnly: AskConfig = {
      japanese: { prompts: ["audio"], responses: ["definition", "romaji"], answers: ["mc"] },
      sentence: { prompts: [], responses: [], answers: [] },
      english: { answers: [] },
    };
    const forms = enabledFormsFor(transitivityFact, audioOnly);
    assert.equal(forms.length, 1);
    assert.equal(forms[0].listen, true);
    assert.equal(forms[0].dir, "jp2en");
    assert.equal(formIsMc(transitivityFact, forms[0]), true);
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
    const kanjiMeaning = kanjiMeaningFactId(KANJI[0].c);
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
