// Run: node --import ./src/lib/conjugate/test-hooks.mjs --test src/lib/content/fact-completeness.test.ts
//
// THE invariant the cohesive-item model rests on: a character's fact-set is
// EXACTLY the curriculum facts for every role it plays: radical meaning, kanji
// meaning (readings belong to their attesting words), and every word reading
// unit. This is why a number can't lose its pronunciation while a character
// item never inherits the kanji dictionary's contextual reading catalogue.

import assert from "node:assert/strict";
import test from "node:test";

import { buildGlyphItem, buildItem } from "./build-item.ts";
import { factsOf } from "@/lib/facts";
import { characterRoles } from "@/lib/character-role";
import { kanjiRow, meaningFactId } from "@/data/kanji";
import { radicalByGlyph, radicalMeaningFactId } from "@/data/radicals";
import { wordEntry, wordFactIds } from "@/data/vocab";

function roleFacts(glyph: string) {
  const roles = characterRoles(glyph);
  const facts = [];
  if (roles.includes("radical")) facts.push(radicalMeaningFactId(glyph));
  if (roles.includes("kanji")) facts.push(meaningFactId(glyph));
  if (roles.includes("word")) facts.push(...wordFactIds(glyph));
  return facts;
}

for (const glyph of ["三", "日", "十", "山"]) {
  test(`fact completeness — ${glyph}: character facts match its curriculum roles`, () => {
    const item = buildGlyphItem(glyph);
    assert.ok(item, `${glyph} builds`);
    const got = item!.facts.map((f) => f.id);
    const want = roleFacts(glyph);
    assert.equal(got.length, want.length, "same count — nothing dropped or duplicated");
    assert.deepEqual(new Set(got), new Set(want), "same set of fact ids");
  });
}

test("fact completeness — a many-role glyph really does span radical + kanji + word", () => {
  // 山 is a Kangxi radical, a jōyō kanji, and a word on its own.
  assert.ok(radicalByGlyph("山") !== undefined && kanjiRow("山") !== undefined);
  const roles = buildGlyphItem("山")!.roles;
  assert.ok(roles.includes("radical") && roles.includes("kanji") && roles.includes("word"));
});

test("fact completeness — 三 as a number spans both meaning and reading", () => {
  const kinds = new Set(buildGlyphItem("三")!.facts.map((f) => f.kind));
  assert.ok(kinds.has("definition"), "carries a meaning fact");
  assert.ok(kinds.has("romaji"), "carries a reading fact — the one that used to vanish");
});

test("fact completeness — a multi-char word's facts == factsOf(entry)", () => {
  const item = buildItem(wordEntry("先生"), "word")!;
  assert.deepEqual(new Set(item.facts.map((f) => f.id)), new Set(factsOf(wordEntry("先生"))));
});
