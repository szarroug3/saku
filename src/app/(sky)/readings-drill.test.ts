// The readings drill's pool from the app's own kanji table (SAK-495).

import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { READINGS } from "@/data/kanji";
import { ONYOMI_INTRO } from "@/data/phase-intros";
import { vocabRow } from "@/data/vocab";

import { readingsDrill } from "./readings-drill";
import { pageFromIntro } from "./teach";

describe("readingsDrill", () => {
  const { pool, skipped } = readingsDrill();
  const of = (kanji: string) => pool.find((k) => k.kanji === kanji);
  const said = (kanji: string) => of(kanji)?.readings.map((r) => `${r.reading} ${r.kind}`);

  it("asks these ten kanji first", () => {
    assert.deepEqual(pool.slice(0, 10).map((k) => k.kanji), ["大", "山", "手", "口", "中", "刀", "分", "干", "年", "入"]);
  });

  it("puts the clean splits in the first group and 人 and 日 in the second", () => {
    for (const k of ["木", "心", "水"]) assert.equal(of(k)?.tier, 1, k);
    for (const k of ["人", "日"]) assert.equal(of(k)?.tier, 2, k);
    const firstTwo = pool.findIndex((k) => k.tier === 2);
    assert.ok(pool.indexOf(of("水")!) < firstTwo);
  });

  it("folds a voiced twin into its base", () => {
    // the table has び beside ひ for 火, ごころ beside こころ for 心
    assert.deepEqual(said("火"), ["か on", "ひ kun"]);
    assert.deepEqual(said("心"), ["こころ kun", "しん on"]);
    assert.deepEqual(said("日"), ["じつ on", "にち on", "ひ kun"]);
  });

  it("skips a kanji with no kun'yomi or no on'yomi in the table, or only one reading, and nothing else", () => {
    const rows = new Map<string, typeof READINGS[number][]>();
    for (const r of READINGS) rows.set(r.k, [...(rows.get(r.k) ?? []), r]);
    assert.equal(pool.length + skipped.length, rows.size);
    assert.ok(skipped.includes("本"), "本 has only ほん in the table");
    assert.equal(skipped.length, 1011);
    for (const k of skipped) {
      const of = rows.get(k)!;
      const oneSide = !of.some((r) => r.type !== "kun") || !of.some((r) => r.type !== "on");
      assert.ok(oneSide || of.length === 1, k);
    }
  });
});

describe("the readings intro's closing note", () => {
  const page = pageFromIntro(ONYOMI_INTRO);

  it("links to the drill in Practice", () => {
    assert.deepEqual(page.link, { href: "/practice/readings", label: "Sort kanji readings in Practice" });
  });

  it("says it is optional and counts toward nothing", () => {
    const prose = ONYOMI_INTRO.body.map((p) => p.text).join(" ");
    assert.match(prose, /You don’t have to do it\./);
    assert.match(prose, /Nothing in it counts toward your progress\./);
  });

  it("names 火's readings the way the kanji table has them", () => {
    const kind = (base: string) => READINGS.find((r) => r.k === "火" && r.base === base)?.type;
    assert.equal(kind("ひ"), "kun");
    assert.equal(kind("か"), "on");
    assert.equal(vocabRow("火曜日")?.reb, "かようび");
  });
});
