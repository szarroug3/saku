import assert from "node:assert/strict";
import { test } from "node:test";

import { kanaEntry } from "@/data/characters";
import {
  derivedKanaConfusables,
  kanaFamily,
  yoonConfusables,
  yoonParts,
} from "@/lib/library/kana-family";

function titles(glyph: string) {
  return kanaFamily(glyph).map((c) => c.title);
}

function members(glyph: string, title: string) {
  return kanaFamily(glyph).find((c) => c.title === title)?.members.map((m) => m.glyph) ?? [];
}

test("き has a twin, a voiced form and its combos", () => {
  assert.deepEqual(members("き", "Katakana"), ["キ"]);
  assert.deepEqual(members("き", "Voiced"), ["ぎ"]);
  assert.deepEqual(members("き", "Yōon").sort(), ["きゃ", "きゅ", "きょ"]);
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

test("a voiced form and katakana member own no map of their own", () => {
  // ぎ and キ are members in a base-kana family map; they do not own one.
  assert.deepEqual(kanaFamily("ぎ"), []);
  assert.deepEqual(kanaFamily("キ"), []);
});

test("a hiragana combo links to its pieces and katakana counterpart", () => {
  assert.deepEqual(members("きゃ", "Built from"), ["き", "ゃ"]);
  assert.deepEqual(members("きゃ", "Katakana"), ["キャ"]);

  assert.deepEqual(members("ぢゅ", "Built from"), ["ぢ", "ゅ"]);
  assert.deepEqual(members("ぢゅ", "Katakana"), ["ヂュ"]);
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

// SAK-72 Part A: a derived (dakuten/handakuten) kana's Library page needs a
// confusables list of its own — its base plus any other marked kana sharing
// that base — fed to the existing ConfusionSection. derivedKanaConfusables is
// the query that answers it, independent of both kanaFamily (which refuses to
// run FROM a marked glyph) and the hand-curated LOOKALIKES table.
test("derivedKanaConfusables: が's only relative is its base か (k row has no handakuten twin)", () => {
  assert.deepEqual(
    derivedKanaConfusables("が"),
    [kanaEntry("か")],
  );
});

test("derivedKanaConfusables: は takes both marks, so ば and ぱ name each other plus は", () => {
  assert.deepEqual(
    [...derivedKanaConfusables("ば")].sort(),
    [kanaEntry("は"), kanaEntry("ぱ")].sort(),
  );
  assert.deepEqual(
    [...derivedKanaConfusables("ぱ")].sort(),
    [kanaEntry("は"), kanaEntry("ば")].sort(),
  );
});

test("derivedKanaConfusables works the same way for katakana", () => {
  assert.deepEqual(derivedKanaConfusables("ガ"), [kanaEntry("カ")]);
  assert.deepEqual(
    [...derivedKanaConfusables("バ")].sort(),
    [kanaEntry("ハ"), kanaEntry("パ")].sort(),
  );
});

test("derivedKanaConfusables is empty for a base kana, a combo, and an untaught glyph", () => {
  assert.deepEqual(derivedKanaConfusables("か"), []);
  assert.deepEqual(derivedKanaConfusables("きゃ"), []);
  assert.deepEqual(derivedKanaConfusables("生"), []);
  assert.deepEqual(derivedKanaConfusables(""), []);
});

// SAK-72 Part B: a yōon kana's Library page needs (a) which two glyphs to
// compose a stroke diagram from (yoonParts) and (b) a confusables list of its
// own (yoonConfusables) — base + the full-size version of its small kana +
// its siblings sharing the same base. Both are gated on CHAR_INDEX, the same
// "derived, not listed" discipline derivedKanaConfusables follows above.

test("yoonParts splits a taught combo into [base, small]", () => {
  assert.deepEqual(yoonParts("きゃ"), ["き", "ゃ"]);
  assert.deepEqual(yoonParts("しゅ"), ["し", "ゅ"]);
  assert.deepEqual(yoonParts("キャ"), ["キ", "ャ"]);
  assert.deepEqual(yoonParts("ぎょ"), ["ぎ", "ょ"]);
});

test("yoonParts is null for a base kana, a dakuten kana, and an untaught string", () => {
  assert.equal(yoonParts("き"), null);
  assert.equal(yoonParts("が"), null);
  assert.equal(yoonParts("これ"), null); // taught individually, not as a combo
  assert.equal(yoonParts("がっこう"), null);
  assert.equal(yoonParts(""), null);
});

test("yoonConfusables: きゃ is き, full-size や (not small ゃ), and its siblings きゅ/きょ", () => {
  assert.deepEqual(
    [...yoonConfusables("きゃ")].sort(),
    [kanaEntry("き"), kanaEntry("や"), kanaEntry("きゅ"), kanaEntry("きょ")].sort(),
  );
});

test("yoonConfusables works the same way for katakana, off ヤ not small ャ", () => {
  assert.deepEqual(
    [...yoonConfusables("キャ")].sort(),
    [kanaEntry("キ"), kanaEntry("ヤ"), kanaEntry("キュ"), kanaEntry("キョ")].sort(),
  );
});

test("yoonConfusables covers a base whose small kana isn't ゃ too", () => {
  assert.deepEqual(
    [...yoonConfusables("しゅ")].sort(),
    [kanaEntry("し"), kanaEntry("ゆ"), kanaEntry("しゃ"), kanaEntry("しょ")].sort(),
  );
  assert.deepEqual(
    [...yoonConfusables("ひょ")].sort(),
    [kanaEntry("ひ"), kanaEntry("よ"), kanaEntry("ひゃ"), kanaEntry("ひゅ")].sort(),
  );
});

test("yoonConfusables is empty for a base kana, a dakuten kana, and an untaught glyph", () => {
  assert.deepEqual(yoonConfusables("き"), []);
  assert.deepEqual(yoonConfusables("が"), []);
  assert.deepEqual(yoonConfusables("生"), []);
  assert.deepEqual(yoonConfusables(""), []);
});
