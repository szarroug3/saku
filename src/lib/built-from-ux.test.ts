// Run: node --import ./src/lib/conjugate/test-hooks.mjs --test src/lib/built-from-ux.test.ts
//
// The Built-from UX guard rail. It pins the values the KanjiBuiltFrom box shows
// against the real etymology join, so a re-cut of the data (or a regression in
// the variant-form normalisation) fails loudly instead of quietly emptying the
// feature or mislabelling a piece. These are DATA TABLES, not fragile ifs: every
// expectation was read off builtPieces' actual output and pinned.

import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { builtPieces } from "@/data/kanji-etymology";
import { isNumberKanji } from "@/data/number-kanji";
import { KANJI } from "@/data/kanji";
import { teachablePieceMeaning } from "@/lib/kanji-parts";
import { hasOnyomi, onReadingsOf, phoneticExample } from "@/lib/kanji-onyomi";

/** builtPieces as [glyph, role, label] triples — what a tile renders from. */
function pieces(k: string): Array<[string, string, string | null]> {
  return builtPieces(k).map((p) => [p.glyph, p.role, p.label]);
}

describe("representative kanji → the pieces, roles and labels the box shows", () => {
  test("河 — 氵 meaning (water) + 可 phonetic か", () => {
    assert.deepEqual(pieces("河"), [
      ["氵", "semantic", null], // no contextual sense; the tile falls back to…
      ["可", "phonetic", "か"],
    ]);
    // …the piece's own meaning, so the tile still reads "water".
    assert.equal(teachablePieceMeaning("氵"), "water");
  });

  test("明 — 日 meaning (sun) + 月 meaning (moon)", () => {
    assert.deepEqual(pieces("明"), [
      ["日", "semantic", "sun"],
      ["月", "semantic", "moon"],
    ]);
  });

  test("林 — 木 meaning + 木 meaning", () => {
    assert.deepEqual(pieces("林"), [
      ["木", "semantic", "tree"],
      ["木", "semantic", "tree"],
    ]);
  });

  test("好 — 女 meaning + 子 meaning", () => {
    assert.deepEqual(pieces("好"), [
      ["女", "semantic", "woman"],
      ["子", "semantic", "child"],
    ]);
  });

  test("語 — 言 meaning + 吾 phonetic (no reading derived)", () => {
    assert.deepEqual(pieces("語"), [
      ["言", "semantic", null],
      ["吾", "phonetic", null],
    ]);
    assert.equal(teachablePieceMeaning("言"), "say");
  });

  test("校 — 木 meaning + 交 phonetic こう", () => {
    assert.deepEqual(pieces("校"), [
      ["木", "semantic", "tree"],
      ["交", "phonetic", "こう"],
    ]);
  });

  test("肝 — 月/⺼ meaning (flesh; body part) + 干 phonetic かん", () => {
    assert.deepEqual(pieces("肝"), [
      ["月", "semantic", "flesh; body part"],
      ["干", "phonetic", "かん"],
    ]);
  });
});

describe("no section where there is nothing honest to show", () => {
  test("a kanji with no etymology pieces renders no Built from", () => {
    // 生 is a pictograph — builtPieces is empty, so KanjiBuiltFrom returns null.
    assert.equal(builtPieces("生").length, 0);
    assert.equal(builtPieces("人").length, 0);
  });

  test("the number kanji 一…十 render no Built from — even 三, which DOES split", () => {
    for (const g of ["一", "二", "三", "四", "五", "六", "七", "八", "九", "十"]) {
      assert.ok(isNumberKanji(g), `${g} is a number kanji`);
    }
    // 三 is the trap: Wiktionary decomposes it into three 一, so builtPieces is
    // NON-empty — but isNumberKanji suppresses the box, so KanjiBuiltFrom and the
    // lesson gate both show nothing. This pins that the suppression is load-bearing.
    assert.ok(builtPieces("三").length > 0, "三 does decompose in the data");
  });
});

describe("the on'yomi invariant Sam asked for", () => {
  // A phonetic piece's reading is the on-reading it lends its host, so a labelled
  // phonetic piece can ONLY sit on a kanji that HAS an on'yomi. If this ever fails,
  // the phonetic-reading join has started inventing readings on kanji that take
  // none — the exact dishonesty the etymology layer refuses.
  test("no phonetic label on an on-reading-less kanji, across the whole set", () => {
    for (const row of KANJI) {
      for (const p of builtPieces(row.c)) {
        if (p.role === "phonetic" && p.label) {
          assert.ok(
            hasOnyomi(row.c),
            `${row.c} shows phonetic ${p.glyph} (${p.label}) but has no on'yomi`,
          );
        }
      }
    }
  });
});

describe("a phonetic piece's example compound attests the host reading", () => {
  test("河's か shows 運河, 校's こう shows 学校", () => {
    // The example is the anchor word the readings ingest lists for that exact
    // on-reading, so the reading genuinely surfaces there (voiced or not).
    assert.deepEqual(phoneticExample("河", "か"), { word: "運河", reading: "うんが" });
    assert.deepEqual(phoneticExample("校", "こう"), { word: "学校", reading: "がっこう" });
    // 学校's reading contains こう outright; the general guarantee is that the word
    // is a real attesting anchor, checked below.
    assert.ok(phoneticExample("校", "こう")!.reading!.includes("こう"));
  });

  test("every example word shown is a real on-reading anchor of its host", () => {
    for (const row of KANJI) {
      for (const p of builtPieces(row.c)) {
        if (p.role !== "phonetic" || !p.label) continue;
        const ex = phoneticExample(row.c, p.label);
        if (!ex) continue; // no everyday word — the box shows no example, fine.
        const anchored = onReadingsOf(row.c).some(
          (r) => r.reading === p.label && r.word === ex.word,
        );
        assert.ok(anchored, `${row.c}/${p.label} example ${ex.word} is not an anchor`);
      }
    }
  });
});

describe("on'yomi hint data", () => {
  test("校 leads with こう / 学校 (がっこう); 人 has じん and にん", () => {
    assert.deepEqual(onReadingsOf("校")[0], {
      reading: "こう",
      word: "学校",
      wordReading: "がっこう",
    });
    assert.deepEqual(
      onReadingsOf("人").map((r) => r.reading),
      ["じん", "にん"],
    );
  });

  test("a kun-only kanji has no on'yomi hint", () => {
    // Whichever kanji it is, hasOnyomi and onReadingsOf must agree.
    for (const row of KANJI.slice(0, 200)) {
      assert.equal(hasOnyomi(row.c), onReadingsOf(row.c).length > 0);
    }
  });
});
