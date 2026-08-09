// Run: node --import ./src/lib/conjugate/test-hooks.mjs --test src/lib/built-from-ux.test.ts
//
// The Built-from UX guard rail. It pins the values the KanjiBuiltFrom box shows
// against the real etymology join, so a re-cut of the data (or a regression in
// the variant-form normalisation) fails loudly instead of quietly emptying the
// feature or mislabelling a piece. These are DATA TABLES, not fragile ifs: every
// expectation was read off builtPieces' actual output and pinned.

import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { builtPieces, etymologyOf } from "@/data/kanji-etymology";
import { KANJI } from "@/data/kanji";
import { NUMBER_WORD_ALTERNATES, vocabRow } from "@/data/vocab";
import { teachablePieceMeaning } from "@/lib/kanji-parts";
import {
  hasOnyomi,
  kunReadingsOf,
  onReadingsOf,
  phoneticExample,
} from "@/lib/kanji-onyomi";

/** builtPieces as [glyph, role, label] triples — what a tile renders from. */
function pieces(k: string): Array<[string, string, string | null]> {
  return builtPieces(k).map((p) => [p.glyph, p.role, p.label]);
}

/** The glyph-origin story a no-tiles section shows as its body, or null. */
function originOf(k: string): string | null {
  const o = etymologyOf(k)?.originText ?? null;
  return typeof o === "string" && o.trim().length > 0 ? o : null;
}

/** Mirrors KanjiBuiltFrom's render gate: the section shows when there are tiles
 * OR a glyph-origin story. Numbers render like any kanji now. */
function rendersSection(k: string): boolean {
  return builtPieces(k).length > 0 || originOf(k) !== null;
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

describe("no-tiles pictographs now show their glyph-origin story", () => {
  test("中 — no tiles, but the flagpole story renders as the section body", () => {
    // 中 is a pictograph: builtPieces is empty, so there are NO tiles…
    assert.equal(builtPieces("中").length, 0);
    // …but it carries a glyph-origin story, so the section still renders, now
    // showing that prose directly as its body rather than nothing.
    const story = originOf("中");
    assert.ok(story && story.includes("flagpole"), "中 has its flagpole origin");
    assert.equal(rendersSection("中"), true);
  });

  test("生, 人 — pictographs with a story now render (they used to show nothing)", () => {
    // These have no mappable pieces but DO have originText, so under the new gate
    // the section renders their story instead of being suppressed.
    for (const g of ["生", "人"]) {
      assert.equal(builtPieces(g).length, 0, `${g} has no tiles`);
      assert.ok(originOf(g), `${g} has a glyph-origin story`);
      assert.equal(rendersSection(g), true);
    }
  });
});

describe("every jōyō kanji renders a Built-from section", () => {
  test("no jōyō kanji renders an empty Built-from — numbers included", () => {
    // After numbers were un-suppressed and the research pass filled every gap,
    // every jōyō kanji has tiles or a glyph-origin story; none is blank.
    const blank = KANJI.map((r) => r.c).filter(
      (k) => builtPieces(k).length === 0 && originOf(k) === null,
    );
    assert.deepEqual(blank, [], `these render no section: ${blank.join(" ")}`);
  });

  test("tiles kanji are unchanged — section renders with its tiles", () => {
    // 森 (three 木) and 河 (氵 + 可) still decompose into tiles exactly as before.
    assert.equal(builtPieces("森").length, 3);
    assert.equal(builtPieces("河").length, 2);
    assert.equal(rendersSection("森"), true);
    assert.equal(rendersSection("河"), true);
  });

  test("number kanji render like any kanji: 三/二 show stacked-一, the rest their story", () => {
    // 三 = 一+一+一 and 二 = 一+一 are genuine stacked strokes, so they tile; the
    // other numbers show their story alone with NO false pieces (六 never shows 八).
    assert.deepEqual(builtPieces("三").map((p) => p.glyph), ["一", "一", "一"]);
    assert.deepEqual(builtPieces("二").map((p) => p.glyph), ["一", "一"]);
    assert.equal(builtPieces("六").length, 0, "六 shows no false pieces");
    assert.ok(originOf("六"), "六 shows its story");
    for (const g of ["一", "二", "三", "四", "五", "六", "七", "八", "九", "十"]) {
      assert.equal(rendersSection(g), true, `${g} renders a section`);
    }
    assert.match(originOf("四")!, /よん.*し.*死 \(death\)/);
    assert.match(originOf("七")!, /なな.*しち.*いち \(one\)/);
    assert.match(originOf("九")!, /きゅう.*く.*苦 \(suffering\)/);
  });

  test("every bare number with alternate pronunciations explains them", () => {
    for (const [glyph, alternates] of Object.entries(NUMBER_WORD_ALTERNATES)) {
      const text = originOf(glyph) ?? "";
      const primary = vocabRow(glyph)?.reb;
      assert.ok(primary && text.includes(primary), `${glyph} omits primary ${primary}`);
      for (const reading of alternates) {
        assert.ok(text.includes(reading), `${glyph} omits alternate ${reading}`);
      }
      assert.match(text, /preferred/, `${glyph} does not explain everyday preference`);
    }
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

describe("kun'yomi hint data", () => {
  test("車 and 人 expose native readings with real word anchors", () => {
    assert.deepEqual(kunReadingsOf("車"), [
      { reading: "くるま", word: "車", wordReading: "くるま" },
    ]);
    assert.deepEqual(kunReadingsOf("人")[0], {
      reading: "ひと",
      word: "人",
      wordReading: "ひと",
    });
  });

  test("an on-only kanji has no fabricated kun'yomi", () => {
    assert.deepEqual(kunReadingsOf("校"), []);
  });
});
