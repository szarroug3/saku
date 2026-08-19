// Run:
//   node --import ./src/lib/conjugate/test-hooks.mjs --test src/lib/grammar/production-coverage.test.ts
//
// Every conjugation class is a separately scheduled skill. A full-coverage deck
// therefore needs no card-level expansion: the facts themselves are the coverage.

import assert from "node:assert/strict";
import { describe, test } from "node:test";

import {
  classProductionFactId,
  FORM_RECIPE_IDS,
  grammarProduction,
  patternEntry,
  patternProductionFactId,
  specialVerbProductionFactId,
} from "@/data/grammar";
import { RECIPES, isProducible } from "@/data/grammar/recipes";
import { autoPatternPage } from "@/data/grammar/auto-page";
import { formLibraryPages } from "@/data/grammar/lessons";
import { factInfo, factsOf } from "@/lib/facts";
import { buildCoverageDeck } from "@/lib/ask-forms";
import { grammarVehicleFor } from "@/lib/engine/question";
import { apply } from "@/lib/grammar/apply";
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
  test("the adjective noun form scores both adjective class rules", () => {
    const iFact = patternProductionFactId("prenominal-form", "adj-i");
    const naFact = patternProductionFactId("prenominal-form", "adj-na");
    assert.deepEqual(productionFacts("prenominal-form"), [iFact, naFact]);
    assert.equal(factInfo(iFact)?.glyph, "高いみせ");
    assert.equal(factInfo(naFact)?.glyph, "静かなみせ");
  });

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

describe("every supported adjective class is a separate quiz skill", () => {
  test("all drillable adjective hosts mint their class fact", () => {
    for (const r of RECIPES.filter(isProducible)) {
      for (const host of ["adj-i", "adj-na"] as const) {
        if (!r.attach.some((a) => a.host === host)) continue;
        assert.ok(
          factInfo(patternProductionFactId(r.id, host)),
          `${r.id} is missing ${host}`,
        );
      }
    }
  });

  test("いい gets its own fact exactly where its result is irregular", () => {
    for (const r of RECIPES.filter(isProducible)) {
      if (!r.attach.some((a) => a.host === "adj-i")) continue;
      const real = apply(r, "いい", "adj-ix");
      const regular = apply(r, "いい", "adj-i");
      const irregular =
        real.ok &&
        real.value !== "いい" &&
        (!regular.ok || regular.value !== real.value);
      assert.equal(
        !!factInfo(specialVerbProductionFactId(r.id, "ii")),
        irregular,
        r.id,
      );
    }
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
    return formLibraryPages(recipeId).flatMap((page) => [
      ...(page.buildTables ?? []),
      ...(page.buildSections ?? []).flatMap((section) => section.tables ?? []),
    ]);
  }

  test("every form table lives under a heading and its instruction", () => {
    for (const recipeId of FORM_RECIPE_IDS) {
      const pages = formLibraryPages(recipeId);
      assert.ok(pages.length > 0, `${recipeId} has Library teaching`);
      for (const page of pages) {
        assert.equal(page.buildRules, undefined, `${page.id} has an unsectioned table`);
        assert.equal(page.buildTables, undefined, `${page.id} has unsectioned table groups`);
        for (const section of page.buildSections ?? []) {
          assert.ok(section.title, `${page.id} section has a heading`);
          assert.ok(section.body.length > 0, `${page.id}/${section.title} has an instruction`);
          assert.ok(
            section.rules?.length || section.tables?.length,
            `${page.id}/${section.title} has a table`,
          );
        }
      }
    }
  });

  test("every generated pattern table lives under a heading and its instruction", () => {
    for (const recipe of RECIPES) {
      const page = autoPatternPage(recipe);
      assert.equal(page.buildRules, undefined, `${recipe.id} has an unsectioned build table`);
      assert.equal(page.buildTables, undefined, `${recipe.id} has unsectioned build groups`);
      assert.equal(page.deriveRules, undefined, `${recipe.id} has an unsectioned pattern table`);
      for (const section of page.deriveTables ?? []) {
        assert.ok(section.title, `${recipe.id} section has a heading`);
        assert.ok(section.instruction, `${recipe.id}/${section.title} has an instruction`);
        assert.ok(section.rules.length > 0, `${recipe.id}/${section.title} has a table`);
      }
    }
  });

  test("a pattern that replaces a form ending shows the removal in its section", () => {
    const mashou = RECIPES.find((candidate) => candidate.id === "mashou")!;
    const section = autoPatternPage(mashou).deriveTables?.[0];
    assert.deepEqual(section?.formula, {
      base: "ます-form",
      trim: "ます",
      add: "ましょう",
    });
    assert.match(section?.instruction ?? "", /remove ます, then add ましょう/);
  });

  test("the adjective noun-form Library page has its own meaning and build page", () => {
    assert.deepEqual(
      formLibraryPages("prenominal-form").map((page) => page.id),
      ["gl-prenominal-form"],
    );
    const page = formLibraryPages("prenominal-form")[0];
    assert.match(page.title, /Describe a noun/);
    assert.deepEqual(page.buildSections?.map((section) => section.title), ["Adjectives"]);
    assert.equal(page.buildSections?.[0].body[0].heading, "Before a noun");
    assert.equal(page.buildSections?.[0].rules?.length, 2);
  });

  test("mixed verb and adjective pattern pages separate every word class", () => {
    const node = RECIPES.find((candidate) => candidate.id === "node")!;
    const page = autoPatternPage(node);

    assert.deepEqual(page.deriveTables?.map((table) => table.title), [
      "Verbs",
      "い-adjectives",
      "な-adjectives",
    ]);
    assert.equal(page.deriveRules, undefined);
    assert.equal(page.deriveTables?.[0].heads?.verb, "Verb");
    assert.equal(page.deriveTables?.[1].heads?.verb, "Adjective");
    assert.equal(page.deriveTables?.[2].heads?.form, "〜な form");
    assert.deepEqual(page.deriveTables?.map((table) => table.rules.length), [1, 1, 1]);
    assert.deepEqual(page.deriveTables?.[0].formula, { base: "verb", add: "ので" });
    assert.deepEqual(page.deriveTables?.[2].formula, {
      base: "な-adjective",
      add: "な + ので",
    });
    assert.match(page.deriveTables?.[0].instruction ?? "", /verb.*add ので/);
    assert.match(page.deriveTables?.[2].instruction ?? "", /before a noun.*add ので/);
    assert.match(page.deriveTables?.[0].rules[0].result ?? "", /ので$/);
    assert.match(page.deriveTables?.[1].rules[0].result ?? "", /ので$/);
    assert.match(page.deriveTables?.[2].rules[0].result ?? "", /なので$/);
  });

  test("mixed-host pages keep their sections even when the verb changes form", () => {
    const ba = RECIPES.find((candidate) => candidate.id === "ba")!;
    const page = autoPatternPage(ba);

    assert.deepEqual(page.deriveTables?.map((table) => table.title), [
      "Verbs",
      "い-adjectives",
    ]);
    assert.equal(page.buildRules, undefined);
  });

  test("て separates regular and irregular adjective tables", () => {
    const byTitle = new Map(tables("te-sequence").map((table) => [table.title, table.rules]));
    assert.equal(byTitle.get("Godan (う-verbs)")?.length, 9);
    assert.equal(byTitle.get("Ichidan (る-verbs)")?.length, 1);
    assert.equal(byTitle.get("Irregular verbs")?.length, 3);
    assert.equal(byTitle.get("Adjectives")?.length, 2);
    assert.deepEqual(byTitle.get("Adjectives")?.map((row) => row.label), [
      "い-adjective",
      "な-adjective",
    ]);
    const adjectiveTable = tables("te-sequence").find((table) => table.title === "Adjectives");
    assert.equal(adjectiveTable?.heads?.label, "Type");
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
      [],
    );
    assert.match(pages[0].body[0].text, /a verb in the て\/で-form/);
    assert.match(pages[0].body[1].text, /both verbs and adjectives/);
    assert.match(pages[0].body[2].text, /final predicate/);
    assert.deepEqual(pages[1].buildSections?.[0].tables?.map((table) => table.title), [
      "Godan (う-verbs)",
      "Ichidan (る-verbs)",
      "Irregular verbs",
    ]);
    assert.deepEqual(pages[2].buildSections?.[0].tables?.map((table) => table.title), [
      "Adjectives",
      "Irregular adjectives",
    ]);
    assert.equal(pages[1].title, "Verbs");
    assert.equal(pages[1].sectionTitle, true);
    assert.equal(pages[2].title, "Adjectives");
    assert.equal(pages[2].sectionTitle, true);
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

  // SAK-33: patternRuleTables' PATTERN_TABLE_GROUPS Adjectives group (高い/静か)
  // looked like a live kanji-with-no-reading gap on first read, but it is dead
  // code — autoPatternPage always prefers `deriveTables` (built from EXAMPLES,
  // which is all kana) whenever any host has a derivable row, which is every
  // producible verb-suffix pattern this table could apply to. Pinning both
  // halves of that so a change to the priority order gets caught here instead
  // of resurrecting an un-glossed kanji table nobody would notice regressed.
  test("SAK-33: patternRuleTables' kanji Adjectives rows never reach a page (deriveTables wins first)", () => {
    for (const recipe of RECIPES) {
      const page = autoPatternPage(recipe);
      assert.equal(page.buildTables, undefined, `${recipe.id} unexpectedly surfaced buildTables`);
    }
    // 〜すぎる is PATTERN_TABLE_GROUPS' Adjectives-bearing case specifically —
    // the one recipe whose verb-suffix attach also reaches adj-i/adj-na — and
    // it takes the deriveTables branch, all-kana, same as everything else.
    const sugiru = RECIPES.find((candidate) => candidate.id === "sugiru")!;
    const page = autoPatternPage(sugiru);
    assert.deepEqual(page.deriveTables?.map((table) => table.title), [
      "Verbs",
      "い-adjectives",
      "な-adjectives",
    ]);
  });
});
