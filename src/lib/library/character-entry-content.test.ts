// Run: node --test src/lib/library/character-entry-content.test.ts
//
// The payload the seed script writes for one character: its reading groups
// (including the KANJIDIC2 fallback for the kanji with no aligned reading),
// its radical tip, its contrast note, and its parts.
//
// derivePosition's own cases moved with it to app/(sky)/radical-position.test.ts
// (SAK-398).

import assert from "node:assert/strict";
import test from "node:test";

import { KANJI } from "@/data/kanji.ts";
import { builtPieces } from "@/data/kanji-etymology.ts";
import { wordEntry } from "@/data/vocab.ts";
import { buildGlyphItem, buildItem } from "@/lib/content/build-item.ts";
import { characterEntryPayload } from "./character-entry-content.ts";

// ---- reading groups: KANJIDIC2 fallback for the 114 kanji with zero aligned
// readings (SAK-265) ----
//
// readingsOf() only carries a (kanji, reading) pair a TAUGHT everyday word's
// kana actually aligns to; 114 of 2,136 jouyou kanji have no such word at all,
// so both groups silently vanished even though KANJIDIC2 documents real
// readings. 壱/藩/栃/陛 are the ticket's own spot-check set.

test("壱 (aligned readings: none) falls back to KANJIDIC2's raw on'yomi AND kun'yomi", () => {
  const item = buildGlyphItem("壱");
  assert.ok(item, "壱 should build a ContentItem");
  const payload = characterEntryPayload(item!);
  const on = payload.groups.find((g) => g.label === "On’yomi");
  const kun = payload.groups.find((g) => g.label === "Kun’yomi");
  assert.ok(on, "壱 should show an On’yomi group");
  assert.ok(kun, "壱 should show a Kun’yomi group");
  assert.ok(
    on!.readings.some((r) => r.base === "いち"),
    "壱's on'yomi should include いち",
  );
  assert.ok(
    kun!.readings.some((r) => r.base === "ひとつ"),
    "壱's kun'yomi should include ひとつ",
  );
  // No taught word anchors these — every fallback row must say so honestly,
  // never invent an example.
  for (const r of [...on!.readings, ...kun!.readings]) {
    assert.equal(r.example, null);
  }
});

test("藩 (on'yomi only in KANJIDIC2) shows the On’yomi group and no Kun’yomi group", () => {
  const item = buildGlyphItem("藩");
  assert.ok(item, "藩 should build a ContentItem");
  const payload = characterEntryPayload(item!);
  const on = payload.groups.find((g) => g.label === "On’yomi");
  assert.ok(on, "藩 should show an On’yomi group");
  assert.ok(on!.readings.some((r) => r.base === "はん" && r.example === null));
  assert.equal(
    payload.groups.find((g) => g.label === "Kun’yomi"),
    undefined,
    "藩 genuinely has no kun'yomi in KANJIDIC2 — no group should be invented",
  );
});

test("栃 (kokuji, kun'yomi only) shows Kun’yomi and no On’yomi group", () => {
  const item = buildGlyphItem("栃");
  assert.ok(item, "栃 should build a ContentItem");
  const payload = characterEntryPayload(item!);
  const kun = payload.groups.find((g) => g.label === "Kun’yomi");
  assert.ok(kun, "栃 should show a Kun’yomi group");
  assert.ok(kun!.readings.some((r) => r.base === "とち" && r.example === null));
  assert.equal(
    payload.groups.find((g) => g.label === "On’yomi"),
    undefined,
    "栃 is a kokuji with no on'yomi in KANJIDIC2 — no group should be invented",
  );
});

test("陛 (aligned readings: none) falls back to its On’yomi へい", () => {
  const item = buildGlyphItem("陛");
  assert.ok(item, "陛 should build a ContentItem");
  const payload = characterEntryPayload(item!);
  const on = payload.groups.find((g) => g.label === "On’yomi");
  assert.ok(on, "陛 should show an On’yomi group");
  assert.ok(on!.readings.some((r) => r.base === "へい" && r.example === null));
});

test("a kanji with real aligned evidence (人) never shows the raw fallback", () => {
  const item = buildGlyphItem("人");
  assert.ok(item, "人 should build a ContentItem");
  const payload = characterEntryPayload(item!);
  for (const g of payload.groups) {
    for (const r of g.readings) {
      assert.notEqual(r.example, null, `${r.base} should carry a real anchor word, not a fallback`);
    }
  }
});

// ---- radicalTip: 勹's single-radical recognition tip (SAK-155) ----
//
// Not a lookalike pair (that's ConfusionSection's `tip`, tested separately in
// entries.test.ts/confusion-section) — this is the "As a radical" block's own
// paragraph, for a radical with a recognisable role but no specific partner to
// contrast against.

test("勹's payload carries its own hand-authored recognition tip", () => {
  const item = buildGlyphItem("勹");
  assert.ok(item, "勹 should build a ContentItem");
  const payload = characterEntryPayload(item!);
  assert.ok(payload.radicalTip, "勹 should have a radicalTip");
  assert.match(payload.radicalTip!, /wrapped around/);
  assert.match(payload.radicalTip!, /包/);
});

test("a radical with no authored tip (口) carries radicalTip: null", () => {
  const item = buildGlyphItem("口");
  assert.ok(item, "口 should build a ContentItem");
  const payload = characterEntryPayload(item!);
  assert.equal(payload.radicalTip, null);
});

// ---- wordNote: いいえ/いや contrast note (SAK-229) ----
//
// Both words taught the single English gloss "no" with nothing anywhere
// explaining the difference (いいえ is neutral; いや leans "don't want to /
// reluctant", already hinted at by its own example sentence but never said in
// prose). One shared note, resolvable from either word's own payload.

test("いいえ's payload carries its own hand-authored contrast note, naming いや", () => {
  const item = buildItem(wordEntry("いいえ"), "word");
  assert.ok(item, "いいえ should build a ContentItem");
  const payload = characterEntryPayload(item!);
  assert.ok(payload.wordNote, "いいえ should have a wordNote");
  assert.match(payload.wordNote!, /いいえ/);
  assert.match(payload.wordNote!, /いや/);
});

test("いや's payload carries the SAME contrast note, naming いいえ", () => {
  const item = buildItem(wordEntry("いや"), "word");
  assert.ok(item, "いや should build a ContentItem");
  const payload = characterEntryPayload(item!);
  assert.ok(payload.wordNote, "いや should have a wordNote");
  assert.match(payload.wordNote!, /いいえ/);
  assert.match(payload.wordNote!, /いや/);
});

test("a word with no authored contrast partner (人) carries wordNote: null", () => {
  const item = buildItem(wordEntry("人"), "word");
  assert.ok(item, "人 should build a ContentItem");
  const payload = characterEntryPayload(item!);
  assert.equal(payload.wordNote, null);
});

// ---- parts: the Sub-components list IS builtPieces (SAK-224) ----
//
// The payload used to build this list from the raw etymology components, which
// are Wiktionary's CANONICAL characters (人, 水) rather than the shapes the
// kanji is DRAWN with (亻, 氵) — wrong for 882 of the 2,136 kanji, and showing
// pieces `builtPieces` deliberately drops (服's corrupted 月) while missing ones
// it adds (森's third 木, 二's two 一). The list is now that one join, so this
// page cannot drift from the lesson, the drill hints or the prereq graph, all
// of which already read it.

test("仁/仏/仕 show the drawn 亻, not the canonical 人", () => {
  for (const glyph of ["仁", "仏", "仕"]) {
    const item = buildGlyphItem(glyph);
    assert.ok(item, `${glyph} should build a ContentItem`);
    const first = characterEntryPayload(item!).parts[0];
    assert.equal(first?.glyph, "亻", `${glyph}'s first sub-component should be 亻`);
    // The link still resolves to the character the shape stands for.
    assert.equal(first?.entry, "kanji:人");
  }
});

test("every jōyō kanji's parts are exactly builtPieces, glyph and role", () => {
  const wrong: string[] = [];
  for (const row of KANJI) {
    const item = buildGlyphItem(row.c);
    if (!item) continue;
    const parts = characterEntryPayload(item).parts.map((p) => `${p.glyph}/${p.role}`);
    const pieces = builtPieces(row.c).map((p) => `${p.glyph}/${p.role}`);
    if (parts.join(" ") !== pieces.join(" ")) wrong.push(row.c);
  }
  assert.deepEqual(wrong, [], `parts disagree with builtPieces for: ${wrong.join(" ")}`);
});

test("a semantic piece with no contextual sense falls back to its own meaning", () => {
  // 河's 氵 carries no contextual sense in the source, so the row would read as a
  // bare "definition" tag; it shows the piece's own gloss from our tables instead.
  const item = buildGlyphItem("河");
  assert.ok(item, "河 should build a ContentItem");
  assert.deepEqual(
    characterEntryPayload(item!).parts.map((p) => [p.glyph, p.sense, p.role]),
    [
      ["氵", "water", "semantic"],
      ["可", "lends か", "phonetic"],
    ],
  );
});
