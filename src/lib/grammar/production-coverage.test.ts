// Run:
//   node --import ./src/lib/conjugate/test-hooks.mjs --test src/lib/grammar/production-coverage.test.ts
//
// Every conjugation class is a separately scheduled skill. A full-coverage deck
// therefore needs no card-level expansion: the facts themselves are the coverage.

import assert from "node:assert/strict";
import { describe, test } from "node:test";

import {
  classProductionFactId,
  grammarProduction,
  patternEntry,
  specialVerbProductionFactId,
} from "@/data/grammar";
import { RECIPES, isProducible } from "@/data/grammar/recipes";
import { formLibraryPages } from "@/data/grammar/lessons";
import { factInfo, factsOf } from "@/lib/facts";
import { buildCoverageDeck } from "@/lib/ask-forms";
import { grammarVehicleFor } from "@/lib/engine/question";
import { recipeAllows } from "@/lib/grammar/vehicles";
import { CLASS_ANCHOR } from "./te-endings";
import type { AskConfig, HistoryFile } from "@/types";

const ALL: AskConfig = {
  japanese: {
    prompts: ["text", "audio"],
    responses: ["definition", "romaji"],
    answers: ["typed", "mc"],
  },
  sentence: { prompts: [], responses: [], answers: [], englishResponses: [] },
  english: { answers: ["typed", "mc"] },
};

const EMPTY: HistoryFile = { sessions: [], facts: {}, claims: {} };
const CLASSES = CLASS_ANCHOR.map((a) => a.cls);

function productionFacts(recipeId: string) {
  return factsOf(patternEntry(recipeId)).filter((f) => grammarProduction(f));
}

describe("one production skill per conjugation class", () => {
  test("a た pattern mints all ten classes plus its three irregular verbs", () => {
    const id = "ta-koto-ga-aru";
    const expected = new Set([
      ...CLASSES.map((cls) => classProductionFactId(id, cls)),
      ...["iku", "suru", "kuru"].map((q) => specialVerbProductionFactId(id, q)),
    ]);
    assert.deepEqual(new Set(productionFacts(id)), expected);
    assert.equal(factInfo(classProductionFactId(id, "v5t"))?.glyph, "待ったことがある");
    assert.equal(factInfo(classProductionFactId(id, "v5n"))?.glyph, "死んだことがある");
  });

  test("a ます pattern mints ten class facts plus する and 来る, but not 行く", () => {
    const id = "mashou";
    assert.equal(productionFacts(id).length, 12);
    for (const cls of CLASSES) assert.ok(factInfo(classProductionFactId(id, cls)), cls);
    assert.equal(factInfo(specialVerbProductionFactId(id, "iku")), undefined);
    assert.ok(factInfo(specialVerbProductionFactId(id, "suru")));
    assert.ok(factInfo(specialVerbProductionFactId(id, "kuru")));
  });

  test("each class fact rolls only a vehicle of that class", () => {
    for (const cls of CLASSES) {
      const vehicle = grammarVehicleFor(classProductionFactId("mashou", cls), EMPTY, () => 0);
      assert.ok(vehicle, cls);
      assert.equal(vehicle.cls, cls, `${cls}: rolled ${vehicle.surface}`);
    }
  });

  test("the full-coverage deck contains every class as a distinct fact", () => {
    const id = "mashou";
    const { deck, forms } = buildCoverageDeck(factsOf(patternEntry(id)), ALL);
    const covered = new Set(deck.filter((f) => grammarProduction(f)));
    for (const cls of CLASSES) assert.ok(covered.has(classProductionFactId(id, cls)), cls);
    assert.ok(forms.every((form) => !("bucket" in form)));
  });
});

describe("irregular facts exist only where the engine finds an exception", () => {
  test("ば has ten verb classes, no irregular verbs, and two adjective productions", () => {
    assert.equal(productionFacts("ba").length, 12);
    for (const q of ["iku", "suru", "kuru"] as const) {
      assert.equal(factInfo(specialVerbProductionFactId("ba", q)), undefined, q);
    }
  });

  test("行く appears only on て, た, and たら based recipes", () => {
    for (const r of RECIPES) {
      const hasIku = !!factInfo(specialVerbProductionFactId(r.id, "iku"));
      const form = r.attach.find((a) => a.host === "verb")?.form;
      const soundChange = form === "te" || form === "ta" || form === "tara";
      assert.equal(hasIku, isProducible(r) && soundChange && recipeAllows(r, "行く"), r.id);
    }
  });

  test("ある is a scored exception wherever the ない-form is transformed", () => {
    assert.equal(factInfo(specialVerbProductionFactId("nai-form", "aru"))?.glyph, "ない");
    assert.equal(factInfo(specialVerbProductionFactId("masu-form", "aru")), undefined);
  });
});

describe("form tables mirror the separately scored production groups", () => {
  function tables(recipeId: string) {
    return formLibraryPages(recipeId).flatMap((page) => page.buildTables ?? []);
  }

  test("て separates regular and irregular adjective tables", () => {
    const byTitle = new Map(tables("te-sequence").map((table) => [table.title, table.rules]));
    assert.equal(byTitle.get("Godan (う-verbs)")?.length, 9);
    assert.equal(byTitle.get("Ichidan (る-verbs)")?.length, 1);
    assert.equal(byTitle.get("Irregular verbs")?.length, 3);
    assert.equal(byTitle.get("Adjectives")?.length, 2);
    assert.deepEqual(byTitle.get("Adjectives")?.map((row) => row.label), ["い", "な"]);
    assert.equal(byTitle.get("Irregular adjectives")?.length, 1);
    assert.equal(byTitle.get("Irregular adjectives")?.[0]?.label, "exception");
    assert.ok(
      byTitle.get("Irregular adjectives")?.every((row) => row.note === undefined),
      "the irregular-adjective table should not create a Note column",
    );
  });

  test("て introduces both uses, then builds verbs before adjectives", () => {
    const pages = formLibraryPages("te-sequence");
    assert.deepEqual(pages.map((page) => page.id), [
      "gl-te-form-use",
      "gl-te-build-verbs",
      "gl-te-build-adjectives",
    ]);
    assert.deepEqual(
      [...pages[0].body, ...(pages[0].bodyAfterBuild ?? [])].flatMap(
        (paragraph) => paragraph.heading ?? [],
      ),
      ["As a verb", "As an adjective"],
    );
    assert.deepEqual(pages[1].buildTables?.map((table) => table.title), [
      "Godan (う-verbs)",
      "Ichidan (る-verbs)",
      "Irregular verbs",
    ]);
    assert.deepEqual(pages[2].buildTables?.map((table) => table.title), [
      "Adjectives",
      "Irregular adjectives",
    ]);
  });

  test("た includes adjective rows and ない includes the scored ある exception", () => {
    assert.equal(
      tables("ta-form").find((table) => table.title === "Adjectives")?.rules.length,
      2,
    );
    assert.equal(
      tables("ta-form").find((table) => table.title === "Irregular adjectives")?.rules.length,
      1,
    );
    const naiIrregulars = tables("nai-form").find((table) => table.title === "Irregular verbs")!;
    assert.ok(naiIrregulars.rules.some((row) => row.verb === "ある" && row.to === "ない"));
  });
});
