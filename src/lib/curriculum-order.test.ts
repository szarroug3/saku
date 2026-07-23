// Run: node --import ./src/lib/conjugate/test-hooks.mjs --test \
//        src/lib/curriculum-order.test.ts
//
// WHAT THESE TESTS ARE FOR
// ========================
// CURRICULUM_SEQUENCE is 7,000-odd items long and every failure mode in it
// type-checks. A word handed over before the kanji it is written with, a kanji
// broken into a shape nobody has met, a character taught twice under two roles,
// a single-kanji word delivered once as a fold and again at its own rank: all of
// those are a well-typed array of well-typed items. So the invariants are pinned
// here, over the real 6,213 words and 2,136 kanji rather than a fixture, because
// a fixture cannot catch an ingest re-cut moving a prerequisite.
//
// The counts are asserted as EXACT numbers, not ranges. They are properties of
// the shipped tables, so a change to any of them is a change to the curriculum
// and should have to be looked at.

import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { KANJI, kanjiRow, kanjiTeachOrder } from "../data/kanji.ts";
import {
  RADICALS,
  isRadicalTaughtAsKanji,
  radicalByGlyph,
  radicalOfKanji,
} from "../data/radicals.ts";
import { CURRICULUM_WORDS, wordKanji } from "./word-lesson.ts";
import {
  CURRICULUM_SEQUENCE,
  curriculumPosition,
  type CurriculumRole,
} from "./curriculum-order.ts";

/** Position of every glyph, computed off the array so the tests never lean on
 * the module's own index to check the module's own order. */
const AT: ReadonlyMap<string, number> = new Map(
  CURRICULUM_SEQUENCE.map((it, i) => [it.glyph, i]),
);

const has = (glyph: string, role: CurriculumRole): boolean =>
  CURRICULUM_SEQUENCE[AT.get(glyph)!]?.roles.includes(role) ?? false;

/** A radical-only shape: a Kangxi radical that is no jōyō kanji. The 90 that are
 * the only radicals this sequence teaches as radicals of their own. */
const RADICAL_ONLY = RADICALS.filter((r) => kanjiRow(r.glyph) === undefined);

/** Every kanji the curriculum's words are written with, so "orphan" can be
 * recomputed here rather than trusted. */
const KANJI_IN_WORDS: ReadonlySet<string> = new Set(
  CURRICULUM_WORDS.flatMap((w) => wordKanji(w.keb)),
);

describe("CURRICULUM_SEQUENCE structure", () => {
  test("nothing is emitted twice", () => {
    const seen = new Set<string>();
    for (const it of CURRICULUM_SEQUENCE) {
      assert.ok(!seen.has(it.glyph), `${it.glyph} appears twice`);
      seen.add(it.glyph);
    }
    assert.equal(seen.size, CURRICULUM_SEQUENCE.length);
  });

  test("every item carries at least one role, and only known roles", () => {
    const known: CurriculumRole[] = ["radical", "kanji", "word"];
    for (const it of CURRICULUM_SEQUENCE) {
      assert.ok(it.roles.length > 0, `${it.glyph} has no role`);
      for (const r of it.roles) {
        assert.ok(known.includes(r), `${it.glyph} has role ${r}`);
      }
      // Fixed order, so two items with the same roles compare element by element.
      const sorted = [...it.roles].sort(
        (a, b) => known.indexOf(a) - known.indexOf(b),
      );
      assert.deepEqual([...it.roles], sorted, `${it.glyph} roles out of order`);
    }
  });

  test("every jōyō kanji and every radical-only shape is taught exactly once", () => {
    for (const k of KANJI) {
      assert.ok(AT.has(k.c), `kanji ${k.c} is never taught`);
      assert.ok(has(k.c, "kanji"), `${k.c} is taught without the kanji role`);
    }
    for (const r of RADICAL_ONLY) {
      assert.ok(AT.has(r.glyph), `radical ${r.glyph} is never taught`);
      assert.ok(has(r.glyph, "radical"), `${r.glyph} lacks the radical role`);
    }
  });

  test("a both-role character is never a separate radical item", () => {
    // 人, 大, 乙 merge already; 火 and 玉 are the ones the kanji track still
    // teaches twice, and here they are one item wearing both roles.
    for (const g of ["人", "大", "乙", "火", "玉", "八", "小", "己"]) {
      assert.ok(has(g, "radical"), `${g} should carry the radical role`);
      assert.ok(has(g, "kanji"), `${g} should carry the kanji role`);
      assert.equal(
        CURRICULUM_SEQUENCE.filter((it) => it.glyph === g).length,
        1,
        `${g} is taught more than once`,
      );
    }
  });

  test("curriculumPosition agrees with the array and is -1 off it", () => {
    assert.equal(curriculumPosition(CURRICULUM_SEQUENCE[0]!.glyph), 0);
    assert.equal(curriculumPosition("山"), AT.get("山"));
    assert.equal(curriculumPosition("ヲ"), -1);
  });
});

describe("prerequisite invariants", () => {
  test("a radical-only shape precedes every kanji filed under it", () => {
    for (const k of KANJI) {
      const rad = radicalOfKanji(k.c);
      if (!rad || isRadicalTaughtAsKanji(rad.num)) continue;
      if (kanjiRow(rad.glyph) !== undefined) continue;
      assert.ok(
        AT.get(rad.glyph)! < AT.get(k.c)!,
        `radical ${rad.glyph} must come before kanji ${k.c}`,
      );
    }
  });

  test("an unmerged both-role radical precedes the kanji filed under it", () => {
    // 火 is not its own first consumer (点 needs it earlier), so it is pulled
    // forward as a kanji. It must still land before every kanji filed under it.
    for (const k of KANJI) {
      const rad = radicalOfKanji(k.c);
      if (!rad || isRadicalTaughtAsKanji(rad.num)) continue;
      if (kanjiRow(rad.glyph) === undefined || rad.glyph === k.c) continue;
      assert.ok(
        AT.get(rad.glyph)! < AT.get(k.c)!,
        `${rad.glyph} must come before kanji ${k.c}`,
      );
    }
  });

  test("every kanji of a word precedes the word", () => {
    for (const w of CURRICULUM_WORDS) {
      const at = AT.get(w.keb);
      assert.ok(at !== undefined, `word ${w.keb} is never taught`);
      for (const c of wordKanji(w.keb)) {
        assert.ok(
          AT.get(c)! <= at!,
          `kanji ${c} must come before word ${w.keb}`,
        );
      }
    }
  });

  test("every curriculum word is delivered exactly once", () => {
    for (const w of CURRICULUM_WORDS) {
      const items = CURRICULUM_SEQUENCE.filter((it) => it.glyph === w.keb);
      assert.equal(items.length, 1, `${w.keb} delivered ${items.length} times`);
      assert.ok(items[0]!.roles.includes("word"), `${w.keb} lacks the word role`);
    }
    // And nothing wears the word role that is not a curriculum word.
    const kebs = new Set(CURRICULUM_WORDS.map((w) => w.keb));
    for (const it of CURRICULUM_SEQUENCE) {
      if (!it.roles.includes("word")) continue;
      assert.ok(kebs.has(it.glyph), `${it.glyph} claims the word role`);
    }
  });
});

describe("the single-kanji fold", () => {
  test("a single-kanji word is one item carrying word and kanji", () => {
    const single = CURRICULUM_WORDS.filter(
      (w) => w.keb.length === 1 && kanjiRow(w.keb) !== undefined,
    );
    assert.equal(single.length, 595);
    for (const w of single) {
      assert.ok(has(w.keb, "word"), `${w.keb} lacks the word role`);
      assert.ok(has(w.keb, "kanji"), `${w.keb} lacks the kanji role`);
      assert.equal(
        CURRICULUM_SEQUENCE.filter((it) => it.glyph === w.keb).length,
        1,
        `${w.keb} appears twice`,
      );
    }
  });

  test("a folded word is taught at first need, not at its own rank", () => {
    // 山 is a word in its own right AND the second half of 火山. Whichever of the
    // two the order reaches first is where 山 is taught, and the later one finds
    // it paid for. The fold is only interesting when the pull-forward is real,
    // so assert the sequence position is at or before the word's own rank.
    const rankOf = new Map(CURRICULUM_WORDS.map((w, i) => [w.keb, i]));
    // How far into the sequence the Nth word of the curriculum lands.
    const wordAt = CURRICULUM_WORDS.map((w) => AT.get(w.keb)!);
    let pulled = 0;
    for (const w of CURRICULUM_WORDS) {
      if (w.keb.length !== 1 || kanjiRow(w.keb) === undefined) continue;
      const rank = rankOf.get(w.keb)!;
      // Taught no later than the point its own rank would have put it.
      assert.ok(
        AT.get(w.keb)! <= wordAt[rank]!,
        `${w.keb} taught after its own rank`,
      );
      // Genuinely pulled forward when some earlier word needed it.
      if (rank > 0 && AT.get(w.keb)! < wordAt[rank - 1]!) pulled++;
    }
    assert.ok(pulled > 0, "no single-kanji word is ever pulled forward");
  });

  test("山 is one item with all three roles and no second entry", () => {
    assert.deepEqual(CURRICULUM_SEQUENCE[AT.get("山")!]!.roles, [
      "radical",
      "kanji",
      "word",
    ]);
    assert.equal(CURRICULUM_SEQUENCE.filter((it) => it.glyph === "山").length, 1);
    // And it is in place before the compound that needs it.
    assert.ok(AT.get("山")! < AT.get("火山")!);
  });
});

describe("the tail", () => {
  const orphanKanji = KANJI.filter((k) => !KANJI_IN_WORDS.has(k.c)).map((k) => k.c);
  const lastWord = Math.max(...CURRICULUM_WORDS.map((w) => AT.get(w.keb)!));

  /** A both-role character that is not its own first consumer (阜, of 院, 階 …).
   * No word contains it, so it counts as an orphan kanji, and it still rides in
   * early because a kanji it indexes needs it. Excluded wherever the test is
   * about the ORDER of the tail. */
  const pulledAsRadical = (c: string): boolean => {
    const rad = radicalOfKanji(c);
    return rad !== undefined && rad.glyph === c && !isRadicalTaughtAsKanji(rad.num);
  };

  test("the orphan kanji are the 388 the data says, and follow every word", () => {
    assert.equal(orphanKanji.length, 388);
    for (const c of orphanKanji) {
      if (pulledAsRadical(c)) continue;
      assert.ok(AT.get(c)! > lastWord, `orphan kanji ${c} lands among the words`);
    }
  });

  test("the orphan kanji keep the everyday teaching order", () => {
    const order = kanjiTeachOrder("everyday");
    const rank = new Map(order.map((c, i) => [c, i]));
    const tail = orphanKanji
      .filter((c) => !pulledAsRadical(c))
      .sort((a, b) => AT.get(a)! - AT.get(b)!);
    for (let i = 1; i < tail.length; i++) {
      assert.ok(
        rank.get(tail[i - 1]!)! < rank.get(tail[i]!)!,
        `${tail[i - 1]} and ${tail[i]} are out of everyday order`,
      );
    }
  });

  test("the orphan radicals follow the orphan kanji", () => {
    const lastKanji = Math.max(...KANJI.map((k) => AT.get(k.c)!));
    const orphanRadicals = RADICAL_ONLY.filter(
      (r) => AT.get(r.glyph)! > lastKanji,
    );
    // Radicals no jōyō kanji is filed under: nothing pulls them in, so they are
    // the tail of the tail.
    const filed = new Set(
      KANJI.map((k) => radicalOfKanji(k.c)?.num).filter((n) => n !== undefined),
    );
    const unused = RADICAL_ONLY.filter((r) => !filed.has(r.num));
    assert.equal(orphanRadicals.length, unused.length);
    assert.deepEqual(
      orphanRadicals.map((r) => r.num),
      unused.map((r) => r.num),
      "orphan radicals are not in Kangxi number order",
    );
    for (const r of orphanRadicals) {
      assert.deepEqual(CURRICULUM_SEQUENCE[AT.get(r.glyph)!]!.roles, ["radical"]);
    }
  });

  test("the sequence is words, then orphan kanji, then orphan radicals", () => {
    const lastKanji = Math.max(...KANJI.map((k) => AT.get(k.c)!));
    assert.ok(lastWord < lastKanji);
    assert.equal(
      CURRICULUM_SEQUENCE.length,
      KANJI.length + RADICAL_ONLY.length + CURRICULUM_WORDS.length - 595,
      "total is kanji + radical-only shapes + words, less the folds",
    );
  });
});

describe("roles", () => {
  test("the owner's four representatives", () => {
    assert.deepEqual(CURRICULUM_SEQUENCE[AT.get("山")!]!.roles, [
      "radical",
      "kanji",
      "word",
    ]);
    assert.deepEqual(CURRICULUM_SEQUENCE[AT.get("何")!]!.roles, ["kanji", "word"]);
    assert.deepEqual(CURRICULUM_SEQUENCE[AT.get("气")!]!.roles, ["radical"]);
    assert.deepEqual(CURRICULUM_SEQUENCE[AT.get("乞")!]!.roles, ["kanji"]);
  });

  test("a kana-only word is a word and nothing else", () => {
    assert.deepEqual(CURRICULUM_SEQUENCE[AT.get("あなた")!]!.roles, ["word"]);
  });

  test("roles are pure membership over the three tables", () => {
    for (const it of CURRICULUM_SEQUENCE) {
      assert.equal(
        it.roles.includes("radical"),
        radicalByGlyph(it.glyph) !== undefined,
        `${it.glyph} radical role`,
      );
      assert.equal(
        it.roles.includes("kanji"),
        kanjiRow(it.glyph) !== undefined,
        `${it.glyph} kanji role`,
      );
    }
  });
});
