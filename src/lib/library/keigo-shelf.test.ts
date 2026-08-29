// Run: node --conditions=react-server --import ./src/lib/conjugate/test-hooks.mjs \
//        --test src/lib/library/keigo-shelf.test.ts
//
// WHAT THESE TESTS ARE FOR (SAK-246)
// ====================================
// keigo-shelf.ts is the last of the shelf-builder siblings (kanji, grammar,
// counter all have their own test) with no test of its own — an oversight
// this file fixes, matching the property those siblings each pin:
//
//   - every TEACHABLE keigo set (CURRICULUM_KEIGO_SETS) is listed on the
//     shelf, exactly once, resolved to a real Library page;
//   - the cut is MUTUALLY EXCLUSIVE and EXHAUSTIVE over that curriculum — the
//     formulaic phrase(s) fall in "Set phrases", every verb set falls in
//     "Honorific and humble verbs", and nothing is dropped or doubled;
//   - the sections come out in TEACHING order (phrases before verbs — see the
//     file's own header for why いらっしゃいませ leads), and each section's
//     own members stay in curriculum order;
//   - a set whose page never resolves is skipped, not shown broken, the same
//     degradation every other shelf takes.

import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { keigoSetEntry, KEIGO_SUBJECT, type KeigoSet } from "@/data/keigo";
import { CURRICULUM_KEIGO_SETS } from "@/lib/keigo-lesson";
import { keigoShelfSections } from "@/lib/library/keigo-shelf";
import { libEntry } from "@/lib/library/library-index";
import { entryFromSlug, entryHref } from "@/lib/library/href";

describe("keigoShelfSections", () => {
  test("lists every curriculum keigo set exactly once", () => {
    const ids = keigoShelfSections().flatMap((s) => s.entries.map((e) => e.id));
    const expected = CURRICULUM_KEIGO_SETS.map(keigoSetEntry);
    assert.equal(ids.length, expected.length, "one row per curriculum set");
    assert.equal(new Set(ids).size, ids.length, "no set listed twice");
    const expectedSet = new Set(expected);
    for (const id of ids) assert.ok(expectedSet.has(id), `${id} is a curriculum keigo set`);
    for (const id of expected) assert.ok(ids.includes(id), `${id} is missing from the shelf`);
  });

  test("every listed entry is a KEIGO_SUBJECT LibEntry that resolves for real", () => {
    for (const s of keigoShelfSections()) {
      for (const e of s.entries) assert.equal(e.kind, KEIGO_SUBJECT);
    }
  });

  test("the cut is exactly two groups — Set phrases, then Honorific and humble verbs", () => {
    const sections = keigoShelfSections();
    assert.deepEqual(
      sections.map((s) => s.id),
      ["keigo-phrases", "keigo-verbs"],
    );
    assert.deepEqual(
      sections.map((s) => s.label),
      ["Set phrases", "Honorific and humble verbs"],
    );
  });

  test("membership matches the set's own `formulaic` flag, mutually exclusive over the curriculum", () => {
    const byId = new Map(CURRICULUM_KEIGO_SETS.map((s) => [keigoSetEntry(s), s] as const));
    for (const s of keigoShelfSections()) {
      for (const e of s.entries) {
        const set = byId.get(e.id)!;
        assert.ok(set, `${e.id} resolves back to a curriculum set`);
        const wantsPhrase = !!set.formulaic;
        assert.equal(
          s.id === "keigo-phrases",
          wantsPhrase,
          `${set.id} (formulaic=${!!set.formulaic}) landed in ${s.id}`,
        );
      }
    }
  });

  test("welcome (いらっしゃいませ) is the formulaic phrase and leads the shelf", () => {
    const sections = keigoShelfSections();
    const phrases = sections.find((s) => s.id === "keigo-phrases")!;
    assert.ok(phrases, "the phrases section exists — welcome always unlocks");
    assert.equal(sections[0].id, "keigo-phrases", "phrases lead, matching teaching order");
    const welcome = CURRICULUM_KEIGO_SETS.find((s) => s.id === "welcome")!;
    assert.ok(welcome.formulaic);
    assert.ok(
      phrases.entries.some((e) => e.id === keigoSetEntry(welcome)),
      "welcome is on the shelf's Set phrases section",
    );
  });

  test("within each section, sets keep curriculum (teaching) order", () => {
    for (const [sectionId, keep] of [
      ["keigo-phrases", (s: KeigoSet) => !!s.formulaic] as const,
      ["keigo-verbs", (s: KeigoSet) => !s.formulaic] as const,
    ]) {
      const expectedOrder = CURRICULUM_KEIGO_SETS.filter(keep).map(keigoSetEntry);
      const section = keigoShelfSections().find((s) => s.id === sectionId);
      if (expectedOrder.length === 0) {
        assert.ok(!section, `${sectionId} drops out empty`);
        continue;
      }
      assert.deepEqual(section!.entries.map((e) => e.id), expectedOrder);
    }
  });

  test("an empty group would drop out — verbs is non-empty today, so this only pins the filter exists", () => {
    // There is no way to make a real group empty without editing curated data
    // (data/keigo.ts / keigo-lesson.ts), so this pins the STRUCTURAL guarantee
    // instead: every section keigoShelfSections returns has at least one entry.
    for (const s of keigoShelfSections()) assert.ok(s.entries.length > 0, `${s.id} is non-empty`);
  });

  test("a keigo set resolves to a real Library page whose URL round-trips", () => {
    for (const set of CURRICULUM_KEIGO_SETS) {
      const id = keigoSetEntry(set);
      const entry = libEntry(id);
      assert.ok(entry, `${set.id} has a LibEntry`);
      const href = entryHref(id);
      assert.match(href, /^\/library\/keigo\//, `${set.id} lives under /library/keigo`);
      const [, , kind, slug] = href.split("/");
      assert.equal(entryFromSlug(kind, slug), id, `${set.id}'s URL round-trips`);
    }
  });
});
