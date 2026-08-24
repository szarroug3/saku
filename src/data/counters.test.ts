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
  COUNTER_KANJI_GLYPHS,
  COUNTER_TAIL_FORM_ALIASES,
  COUNTER_VOCAB_DUPLICATE_KEBS,
  CONSTRUCTION_CATEGORY_IDS,
  CONSTRUCTION_CATEGORY_ENTRIES,
  DAYS,
  MONTHS,
  SYSTEM_COUNTERS,
  TAIL_COUNTERS,
  constructionCategoryOfMarker,
  constructionMarker,
  counterEntry,
  counterKanjiPrereqs,
  counterRoleNote,
  isBareNumber,
  isKanaForm,
  type CounterForm,
} from "./counters.ts";
import { numberConstructionEntry } from "./number-construction-id.ts";
import { numberReading } from "../lib/number-reading.ts";
import { VOCAB_SUBJECT } from "./vocab.ts";
import { TRACK_INTROS } from "./track-intros.ts";
import { ALL_FACTS, factsOf } from "../lib/facts.ts";
import { acceptableNumberReadings, counterReading } from "../lib/number-reading.ts";
import { NUMBERS_COMPOSE } from "./phase-intros.ts";

// byGlyph searches COUNTER_CURRICULUM (the scheduled/drilled forms) PLUS
// DAYS/MONTHS (SAK-163 round 4: reference-only data, no longer in
// COUNTER_CURRICULUM — see counters.ts's notes above DAYS/MONTHS) so the
// "memorised readings are pinned" block below can still pin day/month's real
// shipped readings even though they are no longer individually scheduled.
const byGlyph = (g: string): CounterForm =>
  [...COUNTER_CURRICULUM, ...DAYS, ...MONTHS].find((f) => f.glyph === g)!;

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
    // for 本/匹/枚 or the tail. SAK-163 round 4 extends this to day-of-month and
    // month-of-year too — they are generative categories now (see the notes
    // above DAYS and MONTHS in counters.ts), so their 43 forms are gone from
    // COUNTER_CURRICULUM the same way 一本…十本 already are. 二十歳 (はたち) is
    // the ONE reading left that no category can build.
    const counted = COUNTER_CURRICULUM.filter((f) => !isKanaForm(f));
    assert.deepEqual(
      counted.map((f) => f.glyph),
      ["二十歳"],
      "the only memorised counted form left is 二十歳",
    );
  });

  test("DAYS/MONTHS survive only as reference data — not in COUNTER_CURRICULUM, but COUNTER_KANJI_GLYPHS still excludes them", () => {
    // The precise split this round draws: gone from the scheduled/drilled
    // curriculum, but still real DATA (for the reference page's worked table)
    // and still excluded from the ordinary words track / Library Word shelf
    // (or vocab.json's own day/month duplicates would resurface — the SAK-147
    // bug COUNTER_KANJI_GLYPHS exists to prevent).
    assert.equal(DAYS.length, 31);
    assert.equal(MONTHS.length, 12);
    for (const f of [...DAYS, ...MONTHS]) {
      assert.ok(
        !COUNTER_CURRICULUM.some((c) => c.key === f.key),
        `${f.key} should not be individually scheduled any more`,
      );
      assert.ok(
        COUNTER_KANJI_GLYPHS.has(f.glyph),
        `${f.glyph} must still be excluded from the words track/Word shelf`,
      );
    }
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

describe("SAK-169: COUNTER_VOCAB_DUPLICATE_KEBS names the kanji VOCAB duplicates COUNTER_KANJI_GLYPHS cannot catch", () => {
  test("〜つ's nine kanji spellings each map to their own TSU entry", () => {
    for (const [n, keb] of [
      [1, "一つ"], [2, "二つ"], [3, "三つ"], [4, "四つ"], [5, "五つ"],
      [6, "六つ"], [7, "七つ"], [8, "八つ"], [9, "九つ"],
    ] as const) {
      const form = byGlyph(["", "ひとつ", "ふたつ", "みっつ", "よっつ", "いつつ", "むっつ", "ななつ", "やっつ", "ここのつ"][n]);
      assert.equal(
        COUNTER_VOCAB_DUPLICATE_KEBS.get(keb),
        counterEntry(form),
        `${keb} must map to its own kana TSU entry`,
      );
    }
  });

  test("一人/二人 have no individual CounterForm any more, so both map to the 〜人 construction entry", () => {
    const nin = numberConstructionEntry("nin");
    assert.equal(COUNTER_VOCAB_DUPLICATE_KEBS.get("一人"), nin);
    assert.equal(COUNTER_VOCAB_DUPLICATE_KEBS.get("二人"), nin);
  });

  test("none of these kebs are also in COUNTER_KANJI_GLYPHS — the two sets are disjoint by construction", () => {
    // COUNTER_KANJI_GLYPHS matches by a CounterForm's OWN glyph; none of these
    // fifteen kebs is any CounterForm's glyph (TSU's glyphs are kana, 一人/二人
    // have no CounterForm at all, and the SAK-176 big-number kebs are full-
    // width-digit VOCAB rows with no CounterForm either), so a keb never needs
    // to appear in both.
    for (const keb of COUNTER_VOCAB_DUPLICATE_KEBS.keys()) {
      assert.ok(!COUNTER_KANJI_GLYPHS.has(keb), `${keb} should not also be in COUNTER_KANJI_GLYPHS`);
    }
  });

  test("exactly the eleven original kebs, SAK-176's four big-number kebs, SAK-177's six 割/階/円 kebs, and SAK-171's three 〜時 kebs, no more, no fewer", () => {
    assert.deepEqual(
      [...COUNTER_VOCAB_DUPLICATE_KEBS.keys()].sort(),
      [
        "一つ", "一人", "七つ", "三つ", "九つ", "二つ", "二人", "五つ", "八つ", "六つ", "四つ",
        "１万", "１０万", "１００万", "１００億",
        "１割", "二割", "１階", "二階", "一円", "１０００円",
        "一時", "４時", "７時",
      ].sort(),
    );
  });
});

describe("SAK-171: COUNTER_VOCAB_DUPLICATE_KEBS extends to 〜時's real vocab.json duplicates", () => {
  const ji = numberConstructionEntry("ji");

  test("一時/４時/７時 map to the ji construction entry", () => {
    assert.equal(COUNTER_VOCAB_DUPLICATE_KEBS.get("一時"), ji);
    assert.equal(COUNTER_VOCAB_DUPLICATE_KEBS.get("４時"), ji);
    assert.equal(COUNTER_VOCAB_DUPLICATE_KEBS.get("７時"), ji);
  });

  test("their real vocab.json readings match the engine exactly", () => {
    // Hand-verified against src/data/generated/vocab.json directly (SAK-171):
    // 一時 いちじ, ４時 よじ, ７時 しちじ — the exact rows the app ships.
    assert.equal(counterReading(1, "ji"), "いちじ");
    assert.equal(counterReading(4, "ji"), "よじ");
    assert.equal(counterReading(7, "ji"), "しちじ");
  });

  test("何時 (the independent interrogative 'what time') is NOT in the dedup map", () => {
    assert.ok(!COUNTER_VOCAB_DUPLICATE_KEBS.has("何時"));
  });
});

describe("SAK-177: COUNTER_VOCAB_DUPLICATE_KEBS extends to 割/階/円's real vocab.json duplicates", () => {
  const wari = numberConstructionEntry("wari");
  const floor = numberConstructionEntry("floor");
  const en = numberConstructionEntry("en");

  test("１割/二割 map to the wari construction entry, １階/二階 to floor, 一円/１０００円 to en", () => {
    assert.equal(COUNTER_VOCAB_DUPLICATE_KEBS.get("１割"), wari);
    assert.equal(COUNTER_VOCAB_DUPLICATE_KEBS.get("二割"), wari);
    assert.equal(COUNTER_VOCAB_DUPLICATE_KEBS.get("１階"), floor);
    assert.equal(COUNTER_VOCAB_DUPLICATE_KEBS.get("二階"), floor);
    assert.equal(COUNTER_VOCAB_DUPLICATE_KEBS.get("一円"), en);
    assert.equal(COUNTER_VOCAB_DUPLICATE_KEBS.get("１０００円"), en);
  });

  test("their real vocab.json readings match the engine exactly", () => {
    // Hand-verified against src/data/generated/vocab.json directly (SAK-177):
    // １割 いちわり, 二割 にわり, １階 いっかい, 二階 にかい, 一円 いちえん,
    // １０００円 せんえん — the exact rows the app ships.
    assert.equal(counterReading(1, "wari"), "いちわり");
    assert.equal(counterReading(2, "wari"), "にわり");
    assert.equal(counterReading(1, "floor"), "いっかい");
    assert.equal(counterReading(2, "floor"), "にかい");
    assert.equal(counterReading(1, "en"), "いちえん");
    assert.equal(numberReading(1000) + "えん", "せんえん");
  });

  test("bare 円 and bare 階 (the ordinary nouns) are NOT in the dedup map", () => {
    // Only the COUNTED forms duplicate a generated reading; the bare nouns
    // "yen" and "floor/story" are real, separate vocabulary the words track
    // still teaches — see the doc comment on COUNTER_VOCAB_DUPLICATE_KEBS.
    assert.ok(!COUNTER_VOCAB_DUPLICATE_KEBS.has("円"));
    assert.ok(!COUNTER_VOCAB_DUPLICATE_KEBS.has("階"));
  });
});

describe("SAK-176: COUNTER_VOCAB_DUPLICATE_KEBS extends to the big-number VOCAB duplicates", () => {
  const big = numberConstructionEntry("big");

  test("１万/１０万/１００万/１００億 all map to the big-numbers construction entry", () => {
    assert.equal(COUNTER_VOCAB_DUPLICATE_KEBS.get("１万"), big);
    assert.equal(COUNTER_VOCAB_DUPLICATE_KEBS.get("１０万"), big);
    assert.equal(COUNTER_VOCAB_DUPLICATE_KEBS.get("１００万"), big);
    assert.equal(COUNTER_VOCAB_DUPLICATE_KEBS.get("１００億"), big);
  });

  test("their real vocab.json readings match numberReading() exactly, for the value each keb names", () => {
    // Hand-verified against src/data/generated/vocab.json directly (SAK-176):
    // 数値 → 読み pairs the app actually ships. This pins the Library-dedup
    // side of the ticket to the SAME values number-reading.test.ts's own
    // 億-scale fixtures prove the engine computes correctly.
    const cases: ReadonlyArray<readonly [number, string]> = [
      [10_000, "いちまん"],
      [100_000, "じゅうまん"],
      [1_000_000, "ひゃくまん"],
      [10_000_000_000, "ひゃくおく"],
    ];
    for (const [n, expected] of cases) {
      assert.equal(numberReading(n), expected, `numberReading(${n}) must equal the shipped vocab reading`);
    }
  });
});

describe("SAK-172: COUNTER_TAIL_FORM_ALIASES folds 二十歳's own standalone entry into 〜歳's page", () => {
  test("二十歳 maps to the 〜歳 construction entry, not a page of its own", () => {
    assert.equal(COUNTER_TAIL_FORM_ALIASES.get("二十歳"), numberConstructionEntry("sai"));
  });

  test("exactly one alias — the one CounterForm-minted entry this ticket folds in", () => {
    assert.deepEqual([...COUNTER_TAIL_FORM_ALIASES.keys()], ["二十歳"]);
  });

  test("二十歳 IS its own CounterForm's glyph — the opposite of COUNTER_VOCAB_DUPLICATE_KEBS's kebs", () => {
    // The reason this is a SEPARATE map: COUNTER_VOCAB_DUPLICATE_KEBS's kebs are
    // deliberately disjoint from COUNTER_KANJI_GLYPHS (see the test above), because
    // none of them is a CounterForm's own glyph. 二十歳 is exactly that case — it
    // IS TAIL's own CounterForm glyph — so it could never join that map without
    // breaking its disjointness invariant.
    assert.ok(COUNTER_KANJI_GLYPHS.has("二十歳"), "二十歳 is still a real CounterForm glyph");
    const tail = COUNTER_CURRICULUM.find((f) => f.key === "counter:sai:20")!;
    assert.equal(tail.glyph, "二十歳");
  });

  test("TAIL's CounterForm/facts are UNCHANGED — this map is a Library display concern only", () => {
    // The whole point: はたち must still be teachable/quizzable. Its entry, its
    // meaning fact and its reading fact all still exist exactly as before —
    // nothing about COUNTER_CURRICULUM, counterEntry, or COUNTER_FACTS reads
    // this map.
    const tail = COUNTER_CURRICULUM.find((f) => f.key === "counter:sai:20")!;
    const entry = counterEntry(tail);
    assert.ok(COUNTER_ENTRIES.has(entry), "はたち's entry is still a track entry");
    const facts = factsOf(entry);
    assert.ok(facts.some((id) => id.endsWith("/meaning")), "はたち still carries a meaning fact");
    assert.ok(facts.some((id) => id.endsWith("/reading")), "はたち still carries a reading fact");
    assert.ok(ALL_FACTS.includes(factsOf(entry)[0]), "its facts are registered in ALL_FACTS");
  });
});

describe("the generative categories", () => {
  test("there is one category per number range, per system/tail counter, SAK-177's 割/階/円, SAK-171's 〜時, and day/month", () => {
    assert.deepEqual(
      [...CONSTRUCTION_CATEGORY_IDS],
      [
        "tens", "big", "nin", "hon", "hiki", "mai", "ko", "dai", "satsu", "hai", "kai", "sai",
        "wari", "floor", "en", "ji", "day", "month",
      ],
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
    // Day-of-month (SAK-163) — irregular 1st-10th, irregular again at 14/20/24,
    // regular -にち everywhere else. Sourced verbatim from vocab.json (JMdict).
    "１日": "ついたち",
    "２日": "ふつか",
    "３日": "みっか",
    "４日": "よっか",
    "５日": "いつか",
    "６日": "むいか",
    "７日": "なのか",
    "８日": "ようか",
    "９日": "ここのか",
    "１０日": "とおか",
    "１１日": "じゅういちにち",
    "１２日": "じゅうににち",
    "１３日": "じゅうさんにち",
    "１４日": "じゅうよっか",
    "１５日": "じゅうごにち",
    "１６日": "じゅうろくにち",
    "１７日": "じゅうしちにち",
    "１８日": "じゅうはちにち",
    "１９日": "じゅうくにち",
    "２０日": "はつか",
    "２１日": "にじゅういちにち",
    "２２日": "にじゅうににち",
    "２３日": "にじゅうさんにち",
    "２４日": "にじゅうよっか",
    "２５日": "にじゅうごにち",
    "２６日": "にじゅうろくにち",
    "２７日": "にじゅうしちにち",
    "２８日": "にじゅうはちにち",
    "２９日": "にじゅうくにち",
    "３０日": "さんじゅうにち",
    "３１日": "さんじゅういちにち",
    // Month-of-year (SAK-163) — regular number+がつ, bar 4/7/9's own irregular
    // readings (しがつ/しちがつ/くがつ). Sourced verbatim from vocab.json.
    "１月": "いちがつ",
    "２月": "にがつ",
    "３月": "さんがつ",
    "４月": "しがつ",
    "５月": "ごがつ",
    "６月": "ろくがつ",
    "７月": "しちがつ",
    "８月": "はちがつ",
    "９月": "くがつ",
    "１０月": "じゅうがつ",
    "１１月": "じゅういちがつ",
    "１２月": "じゅうにがつ",
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
      assert.ok(COUNTER_ENTRIES.has(numberConstructionEntry(id)));
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
