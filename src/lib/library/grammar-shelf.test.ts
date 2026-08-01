// Run: node --import ./src/lib/conjugate/test-hooks.mjs --test \
//        src/lib/library/grammar-shelf.test.ts
//
// WHAT THESE TESTS ARE FOR
// ========================
// The Grammar shelf is cut by the FORM a pattern is built on (grammar-shelf.ts),
// not by JLPT level. Four things have to hold, and the renderer (a .tsx the
// runner cannot load) trusts this function to deliver them:
//
//   1. The four form sections lead, in teaching order (て/で, ない, た, stem), each
//      labelled by its form and HEADED by its own form recipe.
//   2. "Other patterns" trails, holding the plain-form and no-verb-form patterns
//      and nothing that belongs to a real form section.
//   3. Every pattern lands in exactly one section — the cut tiles the whole shelf
//      with no gap, overlap or duplicate.
//   4. Within a section the patterns run in teaching order (grammarRank up), so
//      the shelf reads in lesson order top to bottom.

import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { RECIPES } from "@/data/grammar/recipes";
import { patternEntry, verbAttachForm } from "@/data/grammar";
import { cluster } from "@/data/grammar/clusters";
import { grammarRank } from "@/lib/library/grammar-order";
import { grammarShelfSections } from "@/lib/library/grammar-shelf";

/** entry id → its recipe, so a section's entries can be read back as patterns. */
const RECIPE_OF_ENTRY = new Map(RECIPES.map((r) => [patternEntry(r.id), r]));

describe("the grammar shelf is cut by form", () => {
  test("the foundational form sections lead in teaching order, headed by their recipe", () => {
    const sections = grammarShelfSections();
    const lead = sections.slice(0, 5);
    assert.deepEqual(
      lead.map((s) => s.label),
      ["〜な form", "て/で-form", "ない-form", "た-form", "stem"],
      "the foundational forms lead in teaching order",
    );
    assert.deepEqual(
      lead.map((s) => s.entries[0].id),
      ["prenominal-form", "te-sequence", "nai-form", "ta-form", "stem-form"].map(patternEntry),
      "each form section is headed by its own form recipe",
    );
  });

  test("every form section holds only patterns built on that form", () => {
    for (const section of grammarShelfSections()) {
      if (section.id === "form-other") continue;
      const form = section.id.replace(/^form-/, "");
      for (const entry of section.entries) {
        const r = RECIPE_OF_ENTRY.get(entry.id);
        assert.ok(r, `${entry.id} resolves to a recipe`);
        const forms = r.attach
          .filter((a) => a.form && a.form !== "dictionary")
          .map((a) => a.form);
        assert.ok(forms.some((candidate) => candidate === form), `${r.id} is a ${form} pattern`);
      }
    }
  });

  test("the context-dependent bare 〜て meanings share one shelf entry", () => {
    const section = grammarShelfSections().find((candidate) => candidate.id === "form-te")!;
    const bareTe = section.entries
      .map((entry) => RECIPE_OF_ENTRY.get(entry.id)!)
      .filter((recipe) => recipe.pattern === "〜て");
    assert.equal(bareTe.length, 1);
    assert.equal(bareTe[0].id, "te-sequence");
    assert.match(bareTe[0].gloss, /and then/);
    assert.match(bareTe[0].gloss, /because/);
  });

  test("'Other patterns' trails and holds the plain-form and no-verb patterns", () => {
    const sections = grammarShelfSections();
    const other = sections[sections.length - 1];
    assert.equal(other.label, "Other patterns", "the bucket is last");
    const ids = new Set(
      other.entries.map((e) => RECIPE_OF_ENTRY.get(e.id)?.id),
    );
    // A plain-form verb pattern and a bare noun/particle pattern both belong here.
    assert.ok(ids.has("koto-ga-dekiru"), "〜ことができる (plain form) is in Other");
    assert.ok(ids.has("wo"), "を (a particle, no verb host) is in Other");
    // And nothing built on a real conjugation form leaks in.
    for (const e of other.entries) {
      const f = verbAttachForm(RECIPE_OF_ENTRY.get(e.id)!);
      assert.ok(
        f === undefined || f === "dictionary",
        `${RECIPE_OF_ENTRY.get(e.id)?.id} has no build-a-shape form`,
      );
    }
  });
});

describe("the shelf cut tiles the whole shelf", () => {
  test("rows omit the unexplained JLPT pattern label", () => {
    const entries = grammarShelfSections().flatMap((section) => section.entries);
    const byId = new Map(entries.map((entry) => [entry.id, entry]));

    for (const recipe of RECIPES) {
      const entry = byId.get(patternEntry(recipe.id));
      assert.ok(entry, `${recipe.id} appears on the shelf`);
      assert.equal(entry.sub, recipe.cluster ? cluster(recipe.cluster)?.title ?? "" : "");
      assert.doesNotMatch(entry.sub, /N[1-5] pattern/);
    }
  });

  test("every pattern appears in exactly one section", () => {
    const seen = new Map<string, number>();
    for (const section of grammarShelfSections()) {
      for (const entry of section.entries) {
        seen.set(entry.id, (seen.get(entry.id) ?? 0) + 1);
      }
    }
    // Exactly the recipes, each once.
    assert.equal(seen.size, RECIPES.length, "every recipe is shown");
    for (const count of seen.values()) assert.equal(count, 1, "no duplicates");
    for (const r of RECIPES) assert.ok(seen.has(patternEntry(r.id)), `${r.id} appears`);
  });

  test("within a section the patterns run in teaching order", () => {
    for (const section of grammarShelfSections()) {
      const ranks = section.entries.map((e) => grammarRank(RECIPE_OF_ENTRY.get(e.id)!.id));
      for (let i = 1; i < ranks.length; i += 1) {
        assert.ok(ranks[i] > ranks[i - 1], `${section.label} is not rank-ascending`);
      }
    }
  });
});
