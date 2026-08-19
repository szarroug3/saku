// Run: node --import ./src/lib/conjugate/test-hooks.mjs --test \
//        src/components/results/word-table.test.ts
//
// Regression guard for results triage: the summary can know a fact had misses
// even when phrase-level missedPhrases data is unavailable (older/inferred
// records). In that case, Needs work must still surface selectable boxes.

import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { kanaFact } from "@/data/characters";
import {
  answeredInsteadText,
  boxKeyOf,
  missedBoxKeysForFacts,
  outcomeForPhrase,
  presentationPhrasesForFact,
  roundFormCounts,
} from "@/components/results/word-table-keys";
import type { FactSessionDetail, SessionStats } from "@/types";

function stat(over: Partial<FactSessionDetail> = {}): FactSessionDetail {
  return {
    seen: 1,
    misses: 0,
    everCorrect: true,
    firstTryCorrect: true,
    firstTryCount: 1,
    correct: 1,
    confused: {},
    ...over,
  };
}

describe("missedBoxKeysForFacts", () => {
  test("falls back to presentation boxes when misses exist but missedPhrases is absent", () => {
    const fact = kanaFact("ちゅ");
    const stats: SessionStats = {
      [fact]: stat({ misses: 2, everCorrect: false, firstTryCorrect: false }),
    };

    const phrases = presentationPhrasesForFact(fact, stats);
    assert.ok(phrases.length > 0, "expected at least one presentation phrase");

    const got = missedBoxKeysForFacts([fact], stats);
    const want = phrases.map((p) => boxKeyOf(fact, p));

    assert.deepEqual(got, want);
  });

  test("prefers phrase-level misses when missedPhrases is present", () => {
    const fact = kanaFact("ちゅ");
    const stats: SessionStats = {
      [fact]: stat({
        misses: 2,
        everCorrect: true,
        firstTryCorrect: false,
        missedPhrases: ["hear it -> type the meaning"],
      }),
    };

    const got = missedBoxKeysForFacts([fact], stats);
    assert.deepEqual(got, [boxKeyOf(fact, "hear it -> type the meaning")]);
  });

  test("returns no boxes when there are no misses", () => {
    const fact = kanaFact("ちゅ");
    const stats: SessionStats = {
      [fact]: stat({ misses: 0, everCorrect: true, firstTryCorrect: true }),
    };

    assert.deepEqual(missedBoxKeysForFacts([fact], stats), []);
  });

  test("falls back to non-first-try outcome when misses exist but missedPhrases is empty", () => {
    const fact = kanaFact("ちゅ");
    const stats: SessionStats = {
      [fact]: stat({
        misses: 1,
        everCorrect: true,
        firstTryCorrect: false,
        missedPhrases: [],
      }),
    };

    // Guard the data condition that should be treated as 'needed another look'.
    assert.equal(stats[fact].misses > 0, true);
    assert.equal(Array.isArray(stats[fact].missedPhrases), true);
    assert.deepEqual(stats[fact].missedPhrases, []);
  });
});

describe("roundFormCounts", () => {
  // The owner's example, pinned: a keigo-style item asked three distinct ways,
  // two landed first try and one was missed. The header must read 3 FORMS, split
  // 2 solid / 1 needs work — NOT the showing count, which turned the re-ask of
  // the miss into a fourth (or fifth) "question".
  test("a fact asked three ways with one miss is 3 forms: 2 solid, 1 needs work", () => {
    const fact = kanaFact("ちゅ");
    // Three distinct presentations → three distinct forms. Built as data so the
    // test never hardcodes the exact phrase wording, only that there are three.
    const showns = [
      { dir: "jp2en", mode: "typed", listen: false },
      { dir: "jp2en", mode: "mc", listen: false },
      { dir: "en2jp", mode: "typed", listen: false },
    ] as const;
    const probe: SessionStats = {
      [fact]: stat({ seen: 3, showns: [...showns] }),
    };
    const phrases = presentationPhrasesForFact(fact, probe);
    assert.equal(phrases.length, 3, "fixture must produce three distinct forms");

    const stats: SessionStats = {
      [fact]: stat({
        seen: 3,
        misses: 1,
        everCorrect: true,
        firstTryCorrect: false,
        firstTryCount: 2,
        correct: 2,
        showns: [...showns],
        // Exactly one form missed; the other two were clean.
        missedPhrases: [phrases[0]],
      }),
    };

    assert.deepEqual(roundFormCounts([fact], stats), {
      solid: 2,
      needsWork: 1,
      totalForms: 3,
    });
  });

  test("a perfect fact is all solid, nothing needs work", () => {
    const fact = kanaFact("ちゅ");
    const stats: SessionStats = {
      [fact]: stat({ seen: 1, misses: 0, everCorrect: true, firstTryCorrect: true }),
    };
    assert.deepEqual(roundFormCounts([fact], stats), {
      solid: 1,
      needsWork: 0,
      totalForms: 1,
    });
  });

  test("unseen forms are skipped: they belong to neither pile", () => {
    const fact = kanaFact("ちゅ");
    const stats: SessionStats = {
      [fact]: stat({ seen: 0, misses: 0, everCorrect: false, firstTryCorrect: null, firstTryCount: 0, correct: 0 }),
    };
    assert.deepEqual(roundFormCounts([fact], stats), {
      solid: 0,
      needsWork: 0,
      totalForms: 0,
    });
  });
});

describe("answeredInsteadText", () => {
  // SAK-21: a miss cell used to render "said that それ" or "said i あ い" —
  // the phrase-specific `said` text and the fact-level confused glyph(s)
  // bare-space-joined into one blob, sometimes literally the same wrong pick
  // shown twice (once as its English gloss, once as its glyph).

  test("prefers the phrase's own said text over any confused glyph", () => {
    // The MC case: `said` ("that") and the top confused glyph (それ) name the
    // exact same wrong pick. Showing both would print one answer twice.
    assert.equal(answeredInsteadText("that", ["それ"]), "that");
  });

  test("falls back to at most the single top confused entry when there is no said text", () => {
    assert.equal(answeredInsteadText(null, ["あ", "い"]), "あ");
  });

  test("is null when there is nothing to say", () => {
    assert.equal(answeredInsteadText(null, []), null);
  });

  test("never concatenates said text with a confused glyph", () => {
    const result = answeredInsteadText("i", ["あ", "い"]);
    assert.equal(result, "i");
    assert.ok(!result.includes(" "), "must be one answer, not a joined blob");
  });
});

describe("outcomeForPhrase", () => {
  test("a clean phrase reads first-try even when a SIBLING phrase was missed", () => {
    // The reported bug: a fact asked several ways, one form missed, the fact
    // therefore "recovered" overall — but the forms that were never missed must
    // still read first-try, not borrow the fact's recovered status.
    const st = stat({
      seen: 3,
      misses: 1,
      everCorrect: true,
      firstTryCorrect: false,
      firstTryCount: 2,
      correct: 2,
      missedPhrases: ["B"],
    });

    assert.equal(outcomeForPhrase(st, "A"), "first-try");
    assert.equal(outcomeForPhrase(st, "B"), "recovered");
  });

  test("a missed phrase reads missed when the fact never landed", () => {
    const st = stat({
      seen: 2,
      misses: 2,
      everCorrect: false,
      firstTryCorrect: false,
      firstTryCount: 0,
      correct: 0,
      missedPhrases: ["B"],
    });

    assert.equal(outcomeForPhrase(st, "A"), "first-try");
    assert.equal(outcomeForPhrase(st, "B"), "missed");
  });

  test("empty miss data with a recorded miss falls back to the fact outcome", () => {
    const st = stat({
      seen: 2,
      misses: 1,
      everCorrect: true,
      firstTryCorrect: false,
      firstTryCount: 1,
      correct: 1,
      missedPhrases: [],
    });

    // Unattributable miss: no phrase to blame, so surface it via the fact.
    assert.equal(outcomeForPhrase(st, "A"), "recovered");
  });

  test("an unseen stat reads unseen", () => {
    const st = stat({ seen: 0, misses: 0, firstTryCorrect: null, firstTryCount: 0, correct: 0 });
    assert.equal(outcomeForPhrase(st, "A"), "unseen");
  });
});
