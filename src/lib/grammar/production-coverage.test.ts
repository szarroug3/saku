// Run:
//   node --import ./src/lib/conjugate/test-hooks.mjs --test src/lib/grammar/production-coverage.test.ts
//
// "ALL QUIZZES TEST ALL THE ENDINGS" — the generalization past the て-form.
//
// Three things this pins, one per way production coverage now works:
//
//   1. 音便 (て/た/たら) split into five per-ending facts, the same five buckets and
//      qualifiers regardless of the suffix — 書いた is 書いて's 音便, so 〜たことが
//      ある drills って/いて/いで/んで/して exactly as 〜てから does.
//   2. ROW-SHIFT forms (ます, ない, 〜ば …) keep ONE mastery fact but their full-
//      coverage round asks a verb of EVERY ending — one per godan ending plus the
//      v5r and v1 classes — by expanding that fact per-card, never fragmenting it.
//   3. The irregular verbs 行く / する / 来る are their own facts wherever they are
//      special: 行く on 音便 only, する/来る on every producible form except ば.

import assert from "node:assert/strict";
import { describe, test } from "node:test";

import {
  grammarProduction,
  patternEntry,
  patternProductionFactId,
  productionCoverageBuckets,
  specialVerbProductionFactId,
  teEndingProductionFactId,
  usesSoundChange,
} from "@/data/grammar";
import { RECIPES, isProducible } from "@/data/grammar/recipes";
import { factInfo, factsOf } from "@/lib/facts";
import { buildCoverageDeck } from "@/lib/ask-forms";
import { grammarVehicleFor } from "@/lib/engine/question";
import { wordMeaningFactId } from "@/data/vocab";
import { ROW_SHIFT_CLASSES, TE_ENDINGS } from "./te-endings";
import type { WordClass } from "@/lib/conjugate";
import type { AskConfig, FactId, HistoryFile } from "@/types";

const AT = Date.UTC(2026, 0, 1);

function history(over: Partial<HistoryFile> = {}): HistoryFile {
  return { sessions: [], facts: {}, claims: {}, ...over };
}

/** A history in which every named word is "known" — claims, which is what
 * wordKnown reads. Lets a bucketed roll return the v5r/v1 verbs a beginner could
 * not be shown unknown. */
function knowing(...kebs: string[]): HistoryFile {
  const claims: Record<string, number> = {};
  for (const keb of kebs) claims[wordMeaningFactId(keb)] = AT;
  return history({ claims: claims as HistoryFile["claims"] });
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

/** The distinct production facts a full-coverage round over an entry's drills
 * actually asks — the deck's production cards, deduped to their fact ids. */
function coveredProductionFacts(recipeId: string): Set<FactId> {
  const drills = factsOf(patternEntry(recipeId));
  const { deck } = buildCoverageDeck(drills, ALL);
  return new Set(deck.filter((f) => grammarProduction(f)));
}

const SPECIAL = ["iku", "suru", "kuru"] as const;

describe("a た pattern splits into the same five 音便 endings, plus 行く/する/来る", () => {
  const ID = "ta-koto-ga-aru";

  // The た-form's 音便 is byte-for-byte the て-form's, so the answers are the
  // 音便 た-forms carrying the full pattern — pinned literally, because a re-cut of
  // the conjugation data that changed one would be changing the fact's meaning.
  const EXPECTED: Record<string, string> = {
    "te-utsu": "買ったことがある",
    "te-ku": "書いたことがある",
    "te-gu": "泳いだことがある",
    "te-mbn": "飲んだことがある",
    "te-su": "話したことがある",
  };

  test("mints the five per-ending facts, each the full 音便 た-form", () => {
    for (const ending of TE_ENDINGS) {
      const info = factInfo(teEndingProductionFactId(ID, ending));
      assert.ok(info, `${ending}: no fact`);
      assert.equal(info!.glyph, EXPECTED[ending], ending);
      assert.deepEqual(grammarProduction(teEndingProductionFactId(ID, ending))!.bucket, {
        kind: "ending",
        ending,
      });
    }
    // Replaced, not doubled: no unqualified grammar:ta-koto-ga-aru/production.
    assert.equal(factInfo(patternProductionFactId(ID)), undefined);
  });

  test("mints @iku, @suru and @kuru — all three irregular in the た-form", () => {
    assert.equal(factInfo(specialVerbProductionFactId(ID, "iku"))!.glyph, "行ったことがある");
    assert.equal(factInfo(specialVerbProductionFactId(ID, "suru"))!.glyph, "したことがある");
    assert.equal(factInfo(specialVerbProductionFactId(ID, "kuru"))!.glyph, "来たことがある");
    for (const q of SPECIAL) {
      assert.deepEqual(grammarProduction(specialVerbProductionFactId(ID, q))!.bucket, {
        kind: "verb",
        surface: { iku: "行く", suru: "する", kuru: "来る" }[q],
      });
    }
  });

  test("its full-coverage deck asks all eight, each a distinct question", () => {
    const covered = coveredProductionFacts(ID);
    assert.deepEqual(
      covered,
      new Set<FactId>([
        ...TE_ENDINGS.map((e) => teEndingProductionFactId(ID, e)),
        ...SPECIAL.map((q) => specialVerbProductionFactId(ID, q)),
      ]),
    );
    assert.equal(covered.size, 8); // 5 音便 + 行く + する + 来る
  });

  test("the eight facts roll eight distinct verbs", () => {
    // Every ending anchor and every irregular known, so a roll returns a real
    // vehicle rather than falling back to the baked one.
    const h = knowing("買う", "書く", "泳ぐ", "飲む", "話す", "行く", "する", "来る");
    const rolled = new Set<string>();
    for (const ending of TE_ENDINGS) {
      const v = grammarVehicleFor(teEndingProductionFactId(ID, ending), h);
      assert.ok(v, ending);
      rolled.add(v!.surface);
    }
    for (const q of SPECIAL) {
      const v = grammarVehicleFor(specialVerbProductionFactId(ID, q), h);
      assert.ok(v, q);
      assert.equal(v!.surface, { iku: "行く", suru: "する", kuru: "来る" }[q]);
      rolled.add(v!.surface);
    }
    assert.equal(rolled.size, 8, "some endings/verbs collided");
  });
});

describe("a ます pattern is ONE mastery fact whose round tests every ending", () => {
  const ID = "mashou";
  const PLAIN = patternProductionFactId(ID); // unqualified — the mastery fact

  test("exactly one regular production fact, plus @suru and @kuru (no @iku)", () => {
    const prods = factsOf(patternEntry(ID)).filter((f) => grammarProduction(f));
    assert.deepEqual(
      new Set(prods),
      new Set<FactId>([
        PLAIN,
        specialVerbProductionFactId(ID, "suru"),
        specialVerbProductionFactId(ID, "kuru"),
      ]),
    );
    // 行く is REGULAR in the ます-form (行きます), so it carries no @iku fact.
    assert.equal(factInfo(specialVerbProductionFactId(ID, "iku")), undefined);
    // The regular side is ONE fact, not one-per-ending — the design decision.
    const regular = prods.filter((f) => !grammarProduction(f)!.bucket);
    assert.equal(regular.length, 1);
    assert.equal(regular[0], PLAIN);
  });

  test("its coverage is the ten classes: every godan ending plus v5r and v1", () => {
    const buckets = productionCoverageBuckets(PLAIN);
    assert.deepEqual(
      buckets.map((b) => (b.kind === "class" ? b.cls : b.kind)),
      ROW_SHIFT_CLASSES,
    );
  });

  test("the full-coverage round expands the ONE fact into a card per ending", () => {
    const drills = factsOf(patternEntry(ID));
    const { deck, forms } = buildCoverageDeck(drills, ALL);
    // The mastery fact appears many times — once per (bucket × card kind) — but it
    // is the SAME fact id every time: 'solid' on 〜ます stays one fact.
    const classesOnPlain = new Set<WordClass>();
    deck.forEach((f, i) => {
      if (f !== PLAIN) return;
      const b = forms[i].bucket;
      assert.ok(b && b.kind === "class", "a mastery-fact card has no class bucket");
      classesOnPlain.add((b as { cls: WordClass }).cls);
    });
    // Every ending is covered in the one round.
    assert.deepEqual(classesOnPlain, new Set(ROW_SHIFT_CLASSES));
  });

  test("each ending's card rolls a verb of exactly that class", () => {
    // v5r (帰る) and v1 (食べる) are ambiguous-when-unknown, so they must be known
    // to roll; the godan endings roll from the pool regardless.
    const h = knowing("帰る", "食べる");
    for (const cls of ROW_SHIFT_CLASSES) {
      const v = grammarVehicleFor(PLAIN, h, Math.random, { kind: "class", cls });
      assert.ok(v, `no vehicle for ${cls}`);
      assert.equal(v!.cls, cls, `${cls}: rolled ${v!.surface} (${v!.cls})`);
    }
  });
});

describe("a ば pattern has no irregular-verb facts but full ending coverage", () => {
  const ID = "ba";
  const PLAIN = patternProductionFactId(ID);

  test("する and 来る coincide with the ichidan rule here, so @suru/@kuru are ABSENT", () => {
    for (const q of SPECIAL) {
      assert.equal(
        factInfo(specialVerbProductionFactId(ID, q)),
        undefined,
        `${ID} should not carry @${q}`,
      );
    }
  });

  test("its regular fact still covers every ending", () => {
    assert.deepEqual(
      productionCoverageBuckets(PLAIN).map((b) =>
        b.kind === "class" ? b.cls : b.kind,
      ),
      ROW_SHIFT_CLASSES,
    );
  });
});

describe("行く is drilled ONLY where it is special — the 音便 forms", () => {
  test("every @iku fact belongs to a 音便 pattern, and no other", () => {
    for (const r of RECIPES) {
      if (!factInfo(specialVerbProductionFactId(r.id, "iku"))) continue;
      assert.ok(
        isProducible(r) && usesSoundChange(r),
        `${r.id} carries @iku but is not a 音便 pattern`,
      );
    }
  });

  test("a row-shift pattern never carries @iku, a 音便 one (that takes 行く) does", () => {
    for (const id of ["mashou", "tai", "potential", "nai-de", "ba"]) {
      assert.equal(factInfo(specialVerbProductionFactId(id, "iku")), undefined, id);
    }
    for (const id of ["te-kara", "te-sequence", "ta-koto-ga-aru", "tara"]) {
      assert.ok(factInfo(specialVerbProductionFactId(id, "iku")), id);
    }
  });
});
