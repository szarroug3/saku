// Run: node --import ./src/lib/conjugate/test-hooks.mjs --test src/data/counters.test.ts
//
// The counters track is FACTUAL DATA (readings) plus one piece of STRUCTURE (the
// track label). These tests pin both: the readings so a future regeneration or
// reorder cannot silently break a known irregular, and the structure so the
// "〜つ first, kana-gated phase 1, number-kanji-gated phase 2" design holds.

import assert from "node:assert/strict";
import { describe, test } from "node:test";

import {
  COUNTERS_SUBJECT,
  COUNTER_CURRICULUM,
  COUNTER_ENTRIES,
  COUNTER_FACTS,
  SYSTEM_COUNTERS,
  TAIL_COUNTERS,
  counterEntry,
  counterKanjiPrereqs,
  isKanaForm,
  isSoundChangeEntry,
  type CounterForm,
} from "./counters.ts";
import { VOCAB_SUBJECT } from "./vocab.ts";
import { COUNTER_SOUND_CHANGE } from "./phase-intros.ts";
import { TRACK_INTROS } from "./track-intros.ts";
import { ALL_FACTS } from "../lib/facts.ts";
import { lessonSteps } from "../lib/lesson-steps.ts";
import type { FactId, HistoryFile } from "../types/index.ts";

const BLANK: HistoryFile = { sessions: [], facts: {} };
const byGlyph = (g: string): CounterForm =>
  COUNTER_CURRICULUM.find((f) => f.glyph === g)!;

describe("the track order teaches 〜つ before the numbers", () => {
  test("the first 〜つ form comes before the first bare number", () => {
    const firstTsu = COUNTER_CURRICULUM.findIndex((f) => f.counter === "つ");
    const firstNumber = COUNTER_CURRICULUM.findIndex(
      (f) => f.counter === "" && f.phase === 1,
    );
    assert.ok(firstTsu >= 0 && firstNumber >= 0);
    assert.ok(firstTsu < firstNumber, "〜つ must precede the Sino numbers");
  });

  test("〜つ is the very first thing in the track", () => {
    assert.equal(COUNTER_CURRICULUM[0].counter, "つ");
    assert.equal(COUNTER_CURRICULUM[0].glyph, "ひとつ");
  });
});

describe("the gating: kana-only phase 1, number-kanji phase 2", () => {
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

  test("every phase-2 form gates on its number kanji, and it is in the word", () => {
    for (const f of COUNTER_CURRICULUM.filter((f) => f.phase === 2)) {
      assert.ok(f.numberKanji, `${f.glyph} is phase 2 with no number kanji`);
      assert.deepEqual(counterKanjiPrereqs(f), [f.numberKanji]);
      assert.ok(
        f.glyph.includes(f.numberKanji!),
        `${f.glyph} does not contain its gating kanji ${f.numberKanji}`,
      );
    }
  });
});

describe("the counters that exist", () => {
  test("the five system counters are all present", () => {
    assert.deepEqual([...SYSTEM_COUNTERS].sort(), ["つ", "人", "匹", "枚", "本"].sort());
    for (const c of SYSTEM_COUNTERS) {
      assert.ok(
        COUNTER_CURRICULUM.some((f) => f.counter === c),
        `no forms for system counter ${c}`,
      );
    }
  });

  test("the tail counters are all present as plain vocab", () => {
    assert.equal(TAIL_COUNTERS.length, 6);
    for (const c of TAIL_COUNTERS) {
      assert.ok(
        COUNTER_CURRICULUM.some((f) => f.counter === c && f.phase === 3),
        `no tail form for counter ${c}`,
      );
    }
  });
});

// FACTUAL DATA — pinned so a regeneration cannot silently break a reading. Every
// value verified against a reference; these are the irregulars that matter (the
// task names ひとり, ふたり, いっぽん, さんぼん, ろっぽん) plus the full h→p/b sets.
describe("the readings are pinned", () => {
  const PINNED: Readonly<Record<string, string>> = {
    // 〜人 irregulars
    ひとり: "ひとり", // 一人
    ふたり: "ふたり", // 二人
    // 〜本, the h→p/b teacher
    一本: "いっぽん", 二本: "にほん", 三本: "さんぼん", 四本: "よんほん", 五本: "ごほん",
    六本: "ろっぽん", 七本: "ななほん", 八本: "はっぽん", 九本: "きゅうほん", 十本: "じゅっぽん",
    // 〜匹
    一匹: "いっぴき", 三匹: "さんびき", 六匹: "ろっぴき", 八匹: "はっぴき", 十匹: "じゅっぴき",
    // 〜枚, the regular contrast
    一枚: "いちまい", 三枚: "さんまい",
    // 四人 is よにん, never よんにん
    よにん: "よにん",
    // the tail irregular
    二十歳: "はたち",
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

  test("every curriculum entry is labelled as a counters-track entry", () => {
    for (const f of COUNTER_CURRICULUM) {
      assert.ok(COUNTER_ENTRIES.has(counterEntry(f)));
    }
    assert.equal(COUNTER_ENTRIES.size, COUNTER_CURRICULUM.length);
  });

  test("counter fact ids are unique and do not collide with any existing fact", () => {
    const counterIds = COUNTER_FACTS.map((f) => f.id);
    assert.equal(new Set(counterIds).size, counterIds.length, "duplicate counter fact id");
    const others = new Set<FactId>(ALL_FACTS);
    // ALL_FACTS includes the counter facts, so each must appear exactly once.
    const all = ALL_FACTS.filter((id) => counterIds.includes(id));
    assert.equal(all.length, counterIds.length);
    assert.ok(others.size === ALL_FACTS.length, "the registry has a duplicate id");
  });

  test("the counters track has exactly one intro", () => {
    assert.ok(TRACK_INTROS.counters);
    assert.equal(TRACK_INTROS.counters.id, "track-counters");
  });
});

describe("the sound-change rule card is gated on the first shifting form", () => {
  test("本 and 匹 shift; 枚 and the kana forms do not", () => {
    assert.ok(isSoundChangeEntry(counterEntry(byGlyph("三本"))));
    assert.ok(isSoundChangeEntry(counterEntry(byGlyph("三匹"))));
    assert.ok(!isSoundChangeEntry(counterEntry(byGlyph("三枚"))));
    assert.ok(!isSoundChangeEntry(counterEntry(byGlyph("ひとつ"))));
  });

  test("teaching 三本 fires the sound-change card ahead of it", () => {
    const fact = COUNTER_FACTS.find((f) => f.glyph === "三本" && String(f.id).endsWith("/meaning"))!.id;
    const steps = lessonSteps([fact], BLANK);
    const soundIdx = steps.findIndex(
      (s) => s.type === "intro" && s.intro.id === COUNTER_SOUND_CHANGE.id,
    );
    const itemIdx = steps.findIndex((s) => s.type === "item" && s.item.glyph === "三本");
    assert.ok(soundIdx >= 0, "sound-change card did not fire");
    assert.ok(soundIdx < itemIdx, "sound-change card must come before the form");
  });

  test("a phase-1 counter lesson fires no sound-change card", () => {
    const fact = COUNTER_FACTS.find((f) => f.glyph === "ひとつ")!.id;
    const steps = lessonSteps([fact], BLANK);
    assert.ok(
      steps.every((s) => s.type !== "intro" || s.intro.id !== COUNTER_SOUND_CHANGE.id),
    );
  });
});
