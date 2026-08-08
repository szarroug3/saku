// Run: node --import ./src/lib/conjugate/test-hooks.mjs --test src/data/counters.test.ts
//
// The counters track is FACTUAL DATA (the readings it still MEMORISES) plus one
// piece of STRUCTURE (the track label and the generative categories). These tests
// pin both: the memorised readings so a reorder cannot silently break a known
// irregular, and the structure so the "〜つ first, kana-gated phase 1, then
// generative categories" design holds. The regular counted readings (一本…, the
// tens, …) are the ENGINE's to pin now (number-reading.test.ts); they are no
// longer forms here.

import assert from "node:assert/strict";
import { describe, test } from "node:test";

import {
  COUNTERS_SUBJECT,
  COUNTER_CURRICULUM,
  COUNTER_ENTRIES,
  COUNTER_FACTS,
  CONSTRUCTION_CATEGORY_IDS,
  CONSTRUCTION_CATEGORY_ENTRIES,
  SYSTEM_COUNTERS,
  TAIL_COUNTERS,
  constructionCategoryEntry,
  constructionCategoryOfMarker,
  constructionMarker,
  counterEntry,
  counterKanjiPrereqs,
  counterRoleNote,
  isBareNumber,
  isKanaForm,
  type CounterForm,
} from "./counters.ts";
import { VOCAB_SUBJECT } from "./vocab.ts";
import { TRACK_INTROS } from "./track-intros.ts";
import { ALL_FACTS } from "../lib/facts.ts";
import { acceptableNumberReadings, counterReading } from "../lib/number-reading.ts";
import { NUMBERS_COMPOSE } from "./phase-intros.ts";

const byGlyph = (g: string): CounterForm =>
  COUNTER_CURRICULUM.find((f) => f.glyph === g)!;

describe("the Sino numbers 1-10 are no longer rote forms", () => {
  test("〜つ is the very first thing in the track", () => {
    assert.equal(COUNTER_CURRICULUM[0].counter, "つ");
    assert.equal(COUNTER_CURRICULUM[0].glyph, "ひとつ");
  });

  test("no bare Sino-number form remains — the number kanji carry them", () => {
    // いち…じゅう used to ship as counter:num:1..10 kana forms. They duplicated the
    // number kanji's word role (二 = に = two), so they are gone. There is no bare
    // number (counter === "") left in the curriculum.
    const bare = COUNTER_CURRICULUM.filter((f) => f.counter === "");
    assert.deepEqual(bare, [], "the counter:num:1..10 forms must be removed");
    const keys = new Set(COUNTER_CURRICULUM.map((f) => f.key));
    for (let n = 1; n <= 10; n++) {
      assert.ok(!keys.has(`counter:num:${n}`), `counter:num:${n} should be gone`);
    }
  });
});

describe("the branching readings (4, 7, 9) survive the removal", () => {
  // The rote forms carried a second reading each — よん/し, なな/しち, きゅう/く. The
  // kanji word role (from vocab.json) gives only し / しち / きゅう, so the OTHER
  // branch of each — よん, なな, く — is kept in the tens construction rule card and
  // stays accepted by the reading engine when grading a generated round. Nothing
  // is lost.
  test("the tens rule card names both readings of 4, 7 and 9", () => {
    const prose = NUMBERS_COMPOSE.body.map((p) => p.text).join(" ");
    for (const reading of ["よん", "し", "なな", "しち", "きゅう", "く"]) {
      assert.ok(prose.includes(reading), `NUMBERS_COMPOSE must teach ${reading}`);
    }
  });

  test("the engine still accepts BOTH branches on the ones digit", () => {
    assert.ok(acceptableNumberReadings(4).includes("よん"));
    assert.ok(acceptableNumberReadings(4).includes("し"));
    assert.ok(acceptableNumberReadings(7).includes("なな"));
    assert.ok(acceptableNumberReadings(7).includes("しち"));
    assert.ok(acceptableNumberReadings(9).includes("きゅう"));
    assert.ok(acceptableNumberReadings(9).includes("く"));
  });
});

describe("the role note distinguishes a bare number from a counter", () => {
  test("a bare number gets NO role description", () => {
    for (const f of COUNTER_CURRICULUM.filter((f) => f.counter === "")) {
      assert.ok(isBareNumber(f), `${f.glyph} should read as a bare number`);
      assert.equal(
        counterRoleNote(f),
        null,
        `${f.glyph} is a number and must have no role note`,
      );
    }
  });

  test("a counter gets the counting-word note", () => {
    const tsu = byGlyph("ひとつ");
    assert.equal(isBareNumber(tsu), false);
    assert.equal(
      counterRoleNote(tsu),
      "This is a counting word. It joins a number to the thing you count.",
    );
  });
});

describe("the memorised forms are kana phase-1, bar the one irregular tail reading", () => {
  test("every phase-1 form is kana and needs no kanji", () => {
    for (const f of COUNTER_CURRICULUM.filter((f) => f.phase === 1)) {
      assert.ok(isKanaForm(f), `${f.glyph} is phase 1 but not kana`);
      assert.deepEqual(
        counterKanjiPrereqs(f),
        [],
        `${f.glyph} is phase 1 but carries a kanji prerequisite`,
      );
    }
  });

  test("the object counters are no longer taught as rote forms", () => {
    // The whole point of the conversion: no 一本…十本 rows, no per-counter form
    // for 本/匹/枚 or the tail. The only counted (kanji) form left is the one
    // special reading a category cannot build.
    const counted = COUNTER_CURRICULUM.filter((f) => !isKanaForm(f));
    assert.deepEqual(
      counted.map((f) => f.glyph),
      ["二十歳"],
      "the only memorised counted form is 二十歳 はたち",
    );
  });

  test("〜人 ships NO rote forms — its irregulars are taught by the category", () => {
    // ひとり/ふたり/よにん used to ship as rote kana forms. They are now taught by
    // the 〜人 construction category (its Irregular table and irregular-first
    // round), so the curriculum carries none of them.
    const nin = COUNTER_CURRICULUM.filter((f) => f.counter === "人").map((f) => f.glyph);
    assert.deepEqual(nin, []);
  });

  test("removing the 〜人 rote forms did not lose their readings — the engine keeps them", () => {
    // The safety check on the removal: the three irregulars the category must
    // still surface are exactly the engine's readings for counts 1, 2 and 4.
    assert.equal(counterReading(1, "nin"), "ひとり");
    assert.equal(counterReading(2, "nin"), "ふたり");
    assert.equal(counterReading(4, "nin"), "よにん");
  });
});

describe("the generative categories", () => {
  test("there is one category per number range and per system/tail counter", () => {
    assert.deepEqual(
      [...CONSTRUCTION_CATEGORY_IDS],
      ["tens", "big", "nin", "hon", "hiki", "mai", "ko", "dai", "satsu", "hai", "kai", "sai"],
    );
  });

  test("every system counter bar 〜つ, and every tail counter, has a category", () => {
    // 〜つ is native memorisation, not a generative construction, so it has no
    // category; every other system counter (人 本 匹 枚) and every tail counter does.
    const kindByGlyph: Record<string, string> = {
      人: "nin", 本: "hon", 匹: "hiki", 枚: "mai",
      個: "ko", 台: "dai", 冊: "satsu", 杯: "hai", 回: "kai", 歳: "sai",
    };
    for (const c of [...SYSTEM_COUNTERS, ...TAIL_COUNTERS]) {
      if (c === "つ") continue;
      const id = kindByGlyph[c];
      assert.ok(id, `no category id mapped for counter ${c}`);
      assert.ok(
        (CONSTRUCTION_CATEGORY_IDS as readonly string[]).includes(id),
        `no category for counter ${c}`,
      );
    }
  });

  test("a marker round-trips to its category id, and non-markers do not", () => {
    for (const id of CONSTRUCTION_CATEGORY_IDS) {
      assert.equal(constructionCategoryOfMarker(constructionMarker(id)), id);
    }
    assert.equal(
      constructionCategoryOfMarker("word:先生/meaning" as never),
      null,
    );
  });
});

// FACTUAL DATA — the readings this track still MEMORISES, pinned so a reorder
// cannot silently break a known irregular. The regular counted readings live in
// the engine and are pinned in number-reading.test.ts.
describe("the memorised readings are pinned", () => {
  // The only rote reading left as a curriculum FORM is 二十歳 はたち — the one a
  // category cannot build. (〜人's ひとり/ふたり/よにん are pinned against the engine
  // above, since the category, not a rote form, now teaches them.)
  const PINNED: Readonly<Record<string, string>> = {
    二十歳: "はたち", // the special "twenty years old" reading
  };

  for (const [glyph, reading] of Object.entries(PINNED)) {
    test(`${glyph} reads ${reading}`, () => {
      assert.equal(byGlyph(glyph).reading, reading);
    });
  }
});

describe("the track label is a clean, collision-free set of word facts", () => {
  test("the subject is the words subject — no new FactId subject kind", () => {
    assert.equal(COUNTERS_SUBJECT, VOCAB_SUBJECT);
    for (const f of COUNTER_FACTS) assert.equal(f.subject, VOCAB_SUBJECT);
  });

  test("every curriculum entry, AND every category entry, is a counters-track entry", () => {
    for (const f of COUNTER_CURRICULUM) {
      assert.ok(COUNTER_ENTRIES.has(counterEntry(f)));
    }
    for (const id of CONSTRUCTION_CATEGORY_IDS) {
      assert.ok(COUNTER_ENTRIES.has(constructionCategoryEntry(id)));
    }
    // The label is exactly the forms plus the categories, no more.
    assert.equal(
      COUNTER_ENTRIES.size,
      COUNTER_CURRICULUM.length + CONSTRUCTION_CATEGORY_ENTRIES.size,
    );
  });

  test("counter fact ids are unique and do not collide with any existing fact", () => {
    const counterIds = COUNTER_FACTS.map((f) => f.id);
    assert.equal(new Set(counterIds).size, counterIds.length, "duplicate counter fact id");
    const all = ALL_FACTS.filter((id) => counterIds.includes(id));
    assert.equal(all.length, counterIds.length);
    assert.equal(new Set(ALL_FACTS).size, ALL_FACTS.length, "the registry has a duplicate id");
  });

  test("the counters track has exactly one intro", () => {
    assert.ok(TRACK_INTROS.counters);
    assert.equal(TRACK_INTROS.counters.id, "track-counters");
  });
});
