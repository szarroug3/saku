// Run: node --import ./src/lib/conjugate/test-hooks.mjs --test src/lib/content/fact-completeness.test.ts
//
// THE invariant the cohesive-item model rests on: a character's fact-set is
// EXACTLY the UNION of factsOf over every role entry it plays (radical, kanji,
// word). No fact dropped, none invented. This is why a number can't lose its
// reading — 三's item takes the word entry's さん fact by construction — and why a
// both-role glyph teaches its radical meaning too. A multi-char word's facts are
// exactly factsOf(its entry).

import assert from "node:assert/strict";
import test from "node:test";

import { buildGlyphItem, buildItem } from "./build-item.ts";
import { factsOf } from "@/lib/facts";
import { characterRoles } from "@/lib/character-role";
import { kanjiEntry } from "@/data/kanji";
import { radicalEntry, radicalByGlyph } from "@/data/radicals";
import { wordEntry } from "@/data/vocab";
import { kanjiRow } from "@/data/kanji";

function roleEntries(glyph: string) {
  const roles = characterRoles(glyph);
  const entries = [];
  if (roles.includes("radical")) entries.push(radicalEntry(glyph));
  if (roles.includes("kanji")) entries.push(kanjiEntry(glyph));
  if (roles.includes("word")) entries.push(wordEntry(glyph));
  return entries;
}

for (const glyph of ["三", "日", "十", "山"]) {
  test(`fact completeness — ${glyph}: character facts == union of its role entries' facts`, () => {
    const item = buildGlyphItem(glyph);
    assert.ok(item, `${glyph} builds`);
    const got = item!.facts.map((f) => f.id);
    const want = roleEntries(glyph).flatMap((e) => factsOf(e));
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
