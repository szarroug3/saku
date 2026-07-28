// Run:
//   node --import ./src/lib/conjugate/test-hooks.mjs --test src/lib/grammar/te-endings.test.ts
//
// THE PER-ENDING て-FORM DRILL.
//
// The te-form's production used to be ONE fact (行く → 行って), so a full-coverage
// round asked the learner to build the て-form of a single verb. It now splits
// into one fact per 音便 ending — って, いて, いで, んで, して — so a round asks one
// verb of EACH ending. These tests pin the four things that split rests on:
//
//   1. the five facts exist, baked on the right verb, and the plain
//      grammar:te-sequence/production fact is gone (replaced, not doubled);
//   2. each fact rolls a vehicle of ITS ending, and — the whole reason る has no
//      fact — never an unknown る-verb or a する/来る/行く irregular;
//   3. grading accepts the built form in BOTH kanji and kana (never mark correct
//      Japanese wrong);
//   4. the te-form lesson deck carries exactly one production card per ending.

import assert from "node:assert/strict";
import { describe, test } from "node:test";

import {
  TE_FORM_RECIPE_ID,
  grammarProduction,
  patternMeaningFactId,
  patternProductionFactId,
  teEndingProductionFactId,
} from "@/data/grammar";
import { CURRICULUM_LESSONS } from "@/data/grammar/lessons";
import { factInfo } from "@/lib/facts";
import { buildCoverageDeck } from "@/lib/ask-forms";
import { VERB_VEHICLES } from "@/lib/grammar/vehicles";
import { wordMeaningFactId } from "@/data/vocab";
import {
  ENDING_ANCHOR,
  TE_ENDINGS,
  endingBucketOf,
  type TeEnding,
} from "./te-endings";
import { grammarVehicleFor, questionsFor } from "@/lib/engine/question";
import type { AskConfig, FactId, HistoryFile } from "@/types";

const AT = Date.UTC(2026, 0, 1);

/** The built て-form each ending's fact must carry, in kanji and kana. This is
 * the answer the drill grades against, so it is pinned literally rather than
 * recomputed — a re-cut of the conjugation data that changed one of these would
 * be changing the fact's meaning and should trip a test. */
const EXPECTED: Record<TeEnding, { form: string; kana: string }> = {
  "te-utsu": { form: "買って", kana: "かって" },
  "te-ku": { form: "書いて", kana: "かいて" },
  "te-gu": { form: "泳いで", kana: "およいで" },
  "te-mbn": { form: "飲んで", kana: "のんで" },
  "te-su": { form: "話して", kana: "はなして" },
};

function history(over: Partial<HistoryFile> = {}): HistoryFile {
  return { sessions: [], facts: {}, claims: {}, ...over };
}

/** A history in which one word is "known" — a claim, which is what wordKnown
 * reads. Mirrors /api/claim and the grammar-lesson tests. */
function knowing(keb: string): HistoryFile {
  return history({
    claims: { [wordMeaningFactId(keb)]: AT } as HistoryFile["claims"],
  });
}

const ALL: AskConfig = {
  japanese: {
    prompts: ["text", "audio"],
    responses: ["definition", "romaji"],
    answers: ["typed", "mc"],
  },
  sentence: { prompts: [], responses: [], answers: [], englishResponses: [] },
  english: { answers: ["typed", "mc"] },
};

describe("the five per-ending te-form facts", () => {
  test("each ending's fact exists, baked on its representative verb", () => {
    for (const ending of TE_ENDINGS) {
      const id = teEndingProductionFactId(ending);
      const info = factInfo(id);
      assert.ok(info, `${ending}: no fact in the registry`);
      const want = EXPECTED[ending];
      assert.equal(info!.glyph, want.form, `${ending}: glyph`);
      assert.deepEqual(
        new Set(info!.answers),
        new Set([want.form, want.kana]),
        `${ending}: answers accept kanji AND kana`,
      );
    }
  });

  test("the plain te-sequence production fact is REPLACED, not doubled", () => {
    // Replacing is the whole point: the lesson references the per-ending set, and
    // nothing should still schedule the old single "build the て-form" fact.
    const plain = patternProductionFactId(TE_FORM_RECIPE_ID);
    assert.equal(factInfo(plain), undefined);
    assert.equal(grammarProduction(plain), null);
  });

  test("grammarProduction resolves each fact to its ending and anchor verb", () => {
    for (const ending of TE_ENDINGS) {
      const prod = grammarProduction(teEndingProductionFactId(ending));
      assert.ok(prod, `${ending}: not a production fact`);
      assert.equal(prod!.ending, ending);
      assert.equal(prod!.host, "verb");
      assert.equal(prod!.lemma, ENDING_ANCHOR[ending].surface);
    }
  });
});

describe("endingBucketOf keys on the class, and refuses る and the irregulars", () => {
  test("every drillable ending maps its godan classes and nothing else", () => {
    assert.equal(endingBucketOf("v5u"), "te-utsu");
    assert.equal(endingBucketOf("v5t"), "te-utsu");
    assert.equal(endingBucketOf("v5k"), "te-ku");
    assert.equal(endingBucketOf("v5g"), "te-gu");
    assert.equal(endingBucketOf("v5m"), "te-mbn");
    assert.equal(endingBucketOf("v5b"), "te-mbn");
    assert.equal(endingBucketOf("v5n"), "te-mbn");
    assert.equal(endingBucketOf("v5s"), "te-su");
  });

  test("る-ending and the irregulars are NO bucket — they never roll", () => {
    // The spelling-ambiguous and lexical-irregular classes: a godan る (帰る), an
    // ichidan る (食べる/見る), the 行く exception, and する/来る. None is a per-ending
    // skill, so each maps to null and can never be picked as a vehicle.
    for (const cls of ["v5r", "v1", "v5k-s", "vs-i", "vs-s", "vk", "v5u-s"] as const) {
      assert.equal(endingBucketOf(cls), null, cls);
    }
    assert.equal(endingBucketOf(null), null);
  });
});

describe("the vehicle rolled for a per-ending fact matches its ending", () => {
  const NEVER = new Set(["帰る", "食べる", "見る", "起きる", "行く", "する", "来る"]);

  test("empty history: rolls a predictable verb of the right ending, never a る-verb or irregular", () => {
    for (const ending of TE_ENDINGS) {
      const fact = teEndingProductionFactId(ending);
      for (let i = 0; i < 80; i++) {
        const v = grammarVehicleFor(fact, history());
        assert.ok(v, `${ending}: no vehicle rolled`);
        assert.equal(
          endingBucketOf(v!.cls),
          ending,
          `${ending}: rolled ${v!.surface} (${v!.cls}), wrong ending`,
        );
        assert.ok(
          !NEVER.has(v!.surface),
          `${ending}: rolled the forbidden ${v!.surface}`,
        );
        assert.ok(
          !v!.surface.endsWith("る"),
          `${ending}: rolled a る-verb ${v!.surface}`,
        );
        // No known verb → shown in kana (the caller draws the filler in kana).
        assert.equal(v!.known, false);
      }
    }
  });

  test("a known verb of the ending is preferred and shown in its own script", () => {
    // 待つ is a te-utsu verb; once known it should win over the 買う anchor and be
    // shown known (kanji), because a production item on a known word tests the
    // pattern, not vocabulary.
    const fact = teEndingProductionFactId("te-utsu");
    const seen = new Set<string>();
    for (let i = 0; i < 80; i++) {
      const v = grammarVehicleFor(fact, knowing("待つ"));
      assert.ok(v);
      assert.equal(endingBucketOf(v!.cls), "te-utsu");
      seen.add(v!.surface);
    }
    assert.ok(seen.has("待つ"), "the known te-utsu verb was never rolled");
    // Every roll is a known verb, so all are shown in their own script.
    const known = grammarVehicleFor(fact, knowing("待つ"));
    assert.equal(known!.surface, "待つ");
    assert.equal(known!.known, true);
  });
});

describe("grading never marks correct Japanese wrong", () => {
  const grammar = questionsFor(teEndingProductionFactId("te-utsu"));

  test("both the kanji and kana built forms grade true for a rolled vehicle", () => {
    for (const ending of TE_ENDINGS) {
      const anchor = ENDING_ANCHOR[ending];
      const fact = teEndingProductionFactId(ending);
      const qt = questionsFor(fact);
      // Show the anchor as a KNOWN vehicle; both scripts of the built form count.
      const ctx = {
        grammarVehicle: {
          surface: anchor.surface,
          kana: anchor.kana,
          cls: anchor.cls,
          known: true,
        },
      };
      const want = EXPECTED[ending];
      assert.ok(
        qt.check(fact, "jp2en", want.form, ctx),
        `${ending}: kanji form ${want.form} graded wrong`,
      );
      assert.ok(
        qt.check(fact, "jp2en", want.kana, ctx),
        `${ending}: kana form ${want.kana} graded wrong`,
      );
    }
  });

  test("a wrong ending's form does NOT grade true", () => {
    const fact = teEndingProductionFactId("te-utsu");
    // 書いて is the answer to te-ku, not to te-utsu built on 買う (買って).
    assert.equal(grammar.check(fact, "jp2en", "書いて", {
      grammarVehicle: { surface: "買う", kana: "かう", cls: "v5u", known: true },
    }), false);
  });
});

describe("the te-form lesson deck carries one production card per ending", () => {
  const lesson = CURRICULUM_LESSONS.find((l) => l.primaryPattern === TE_FORM_RECIPE_ID)!;

  test("its drills are the meaning fact plus the five per-ending production facts", () => {
    const expected = new Set<FactId>([
      patternMeaningFactId(TE_FORM_RECIPE_ID),
      ...TE_ENDINGS.map(teEndingProductionFactId),
    ]);
    assert.deepEqual(new Set(lesson.drills), expected);
  });

  test("buildCoverageDeck expands to exactly the five ending production facts", () => {
    const { deck } = buildCoverageDeck(lesson.drills, ALL);
    const prod = new Set(deck.filter((f) => grammarProduction(f)));
    assert.deepEqual(prod, new Set(TE_ENDINGS.map(teEndingProductionFactId)));
    assert.equal(prod.size, 5);
    // The meaning fact is also asked, so the deck is not production-only.
    assert.ok(deck.includes(patternMeaningFactId(TE_FORM_RECIPE_ID)));
  });
});
