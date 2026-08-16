// Run: node --import ./src/lib/conjugate/test-hooks.mjs --test \
//        src/lib/library/grammar-shelf.test.ts
//
// WHAT THESE TESTS ARE FOR
// ========================
// The Grammar shelf is cut by the FORM a pattern is built on (grammar-shelf.ts),
// not by JLPT level. Four things have to hold, and the renderer (a .tsx the
// runner cannot load) trusts this function to deliver them:
//
//   1. The foundational form sections lead in teaching order (〜な, て/で, ない,
//      た, stem), each labelled by its form and HEADED by its own form recipe;
//      "Particles" falls right after て/で, where the curriculum reaches it —
//      the particles are taught right after the three foundation rows.
//   2. "Other patterns" trails, holding the plain-form and no-verb-form patterns
//      and nothing that belongs to a real form section or the Particles section.
//   3. Every pattern lands in exactly one section — the cut tiles the whole shelf
//      with no gap, overlap or duplicate.
//   4. Within a section the patterns run in teaching order (grammarRank up), so
//      the shelf reads in lesson order top to bottom.

import assert from "node:assert/strict";
import { describe, test } from "node:test";

import {
  RECIPES,
  isPrimaryPatternRecipe,
  patternGroup,
} from "@/data/grammar/recipes";
import { patternEntry, verbAttachForm } from "@/data/grammar";
import { cluster } from "@/data/grammar/clusters";
import { grammarRank } from "@/lib/library/grammar-order";
import { grammarShelfSections } from "@/lib/library/grammar-shelf";
import { COMPARISON_CLUSTER_IDS } from "@/lib/library/entries";

/** entry id → its recipe, so a section's entries can be read back as patterns. */
const RECIPE_OF_ENTRY = new Map(RECIPES.map((r) => [patternEntry(r.id), r]));

describe("the grammar shelf is cut by form", () => {
  test("the foundational form sections lead, and every section runs in teaching order", () => {
    const sections = grammarShelfSections();
    // The particles are taught right after the three foundation rows
    // (prenominal-form, te-sequence, te-iru), so their section falls right
    // after て/で-form — ahead of every other form section, not after them.
    const lead = sections.slice(0, 5);
    assert.deepEqual(
      lead.map((s) => s.label),
      ["〜な form", "て/で-form", "Particles", "ない-form", "た-form"],
      "the foundational forms and Particles lead in teaching order",
    );
    assert.deepEqual(
      lead.map((s) => s.entries[0].id),
      ["prenominal-form", "te-sequence", "wa", "nai-form", "ta-form"].map(patternEntry),
      "each form section is headed by its own form recipe, and Particles by wa",
    );
    const particlesIndex = sections.findIndex((s) => s.label === "Particles");
    assert.equal(particlesIndex, 2, "Particles leads, right after the foundational forms");
    // Every section but the trailing "Other patterns" appears in teaching order:
    // the rank of each section's first entry never decreases down the shelf.
    const ranked = sections.filter((s) => s.id !== "form-other");
    const firstRanks = ranked.map((s) => grammarRank(RECIPE_OF_ENTRY.get(s.entries[0].id)!.id));
    for (let i = 1; i < firstRanks.length; i++) {
      assert.ok(
        firstRanks[i] >= firstRanks[i - 1],
        `section "${ranked[i].label}" is out of teaching order`,
      );
    }
  });

  test("the Particles section holds exactly the case/binding particles", () => {
    const particles = grammarShelfSections().find((s) => s.label === "Particles")!;
    assert.ok(particles, "a Particles section exists");
    const ids = particles.entries.map((e) => RECIPE_OF_ENTRY.get(e.id)!.id).sort();
    // は/が/に/で plus the pre-existing を/へ/まで/までに/だけ/しか, and か. Order
    // within the section is teaching order (asserted rank-ascending elsewhere);
    // membership is the point here — these eleven and nothing else.
    assert.deepEqual(ids, [
      "dake",
      "de",
      "e",
      "ga",
      "ka",
      "made",
      "made-ni",
      "ni",
      "shika-nai",
      "wa",
      "wo",
    ]);
  });

  test("every form section holds only patterns built on that form", () => {
    for (const section of grammarShelfSections()) {
      if (section.id === "form-other" || section.id === "particles") continue;
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
    // A plain-form verb pattern and a bare noun pattern both belong here.
    assert.ok(ids.has("koto-ga-dekiru"), "〜ことができる (plain form) is in Other");
    assert.ok(ids.has("nara"), "〜なら (bare noun, no verb host) is in Other");
    // The case/binding particles are NOT here any more — they live in their own
    // Particles section (which falls in teaching order, not at the front).
    assert.ok(!ids.has("wo"), "を moved to the Particles section");
    assert.ok(!ids.has("wa"), "は is a Particles-section pattern, not Other");
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

    for (const recipe of RECIPES.filter(isPrimaryPatternRecipe)) {
      const entry = byId.get(patternEntry(recipe.id));
      assert.ok(entry, `${recipe.id} appears on the shelf`);
      // The sub is the CONCEPT-cluster titles ("must", "after") — a family cue —
      // and never the JLPT label. The particle-pair comparison clusters (は vs が,
      // に vs で) are excluded: their title just names the glyphs being contrasted,
      // redundant under a member whose glyph is the lead, so those rows show no sub.
      const titles = [
        ...new Set(
          patternGroup(recipe.id).flatMap((sense) => {
            if (!sense.cluster || COMPARISON_CLUSTER_IDS.has(sense.cluster)) return [];
            const title = cluster(sense.cluster)?.title;
            return title ? [title] : [];
          }),
        ),
      ];
      assert.equal(entry.sub, titles.join(" · "));
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
    // Exactly one entry per written pattern, each once. Independently quizzed
    // senses are consolidated under that entry.
    const primary = RECIPES.filter(isPrimaryPatternRecipe);
    assert.equal(seen.size, primary.length, "every written pattern is shown");
    for (const count of seen.values()) assert.equal(count, 1, "no duplicates");
    for (const r of primary) assert.ok(seen.has(patternEntry(r.id)), `${r.id} appears`);
    assert.ok(!seen.has(patternEntry("passive")), "〜られる is not duplicated");
    assert.ok(!seen.has(patternEntry("kara-source")), "〜から is not duplicated");
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
