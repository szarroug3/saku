import assert from "node:assert/strict";
import { test } from "node:test";

import { kanaFamily } from "@/lib/library/kana-family";

function titles(glyph: string) {
  return kanaFamily(glyph).map((c) => c.title);
}

function members(glyph: string, title: string) {
  return kanaFamily(glyph).find((c) => c.title === title)?.members.map((m) => m.glyph) ?? [];
}

test("き has a twin, a voiced form and its combos", () => {
  assert.deepEqual(members("き", "Katakana"), ["キ"]);
  assert.deepEqual(members("き", "Voiced"), ["ぎ"]);
  assert.deepEqual(members("き", "Combos").sort(), ["きゃ", "きゅ", "きょ"]);
});

test("は needs a fifth cell — it takes both marks", () => {
  // The layout case #65 calls out: は is the widest family in the set.
  assert.deepEqual(members("は", "Voiced"), ["ば"]);
  assert.deepEqual(members("は", "Half-voiced"), ["ぱ"]);
  assert.ok(titles("は").length >= 3, "は must have at least twin + voiced + half-voiced");
});

test("あ keeps its one cell rather than collapsing", () => {
  const fam = kanaFamily("あ");
  assert.deepEqual(fam.map((c) => c.title), ["Katakana"]);
  assert.equal(fam[0].members.length, 1);
});

test("a cell is never present but empty", () => {
  for (const g of ["あ", "き", "は", "た", "な", "ま", "や", "ら", "わ"]) {
    for (const c of kanaFamily(g)) {
      assert.ok(c.members.length > 0, `${g}: cell '${c.title}' is empty`);
    }
  }
});

test("な has no voiced form, so no voiced cell", () => {
  assert.ok(!titles("な").includes("Voiced"));
});

test("a family MEMBER owns no map of its own", () => {
  // ぎ, キ and きゃ are entries in their own right; the base kana's page is
  // where the group is laid out, so these return nothing rather than listing
  // their siblings from the middle.
  assert.deepEqual(kanaFamily("ぎ"), []);
  assert.deepEqual(kanaFamily("キ"), []);
  assert.deepEqual(kanaFamily("きゃ"), []);
});

test("every member resolves to a real entry", () => {
  for (const g of Object.keys({ あ: 1, き: 1, は: 1, し: 1, つ: 1 })) {
    for (const c of kanaFamily(g)) {
      for (const m of c.members) {
        assert.ok(m.entry, `${g}/${m.glyph} has no entry id`);
      }
    }
  }
});
