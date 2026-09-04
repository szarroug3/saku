// The adapter turns a real history into a sky: met entries are roots unless
// they sit under another met entry, every part is present so constellations
// draw whole, and a claim colours only the thing claimed.

import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { emptyHistory } from "@/lib/history-ops";
import { entryForGlyph, knownFactsOf, libEntry } from "@/lib/library/entries";
import { KANJI_SUBJECT } from "@/data/kanji";
import { KANA_SUBJECT } from "@/data/characters";
import { VOCAB_SUBJECT } from "@/data/vocab";

import { skyFromHistory } from "./learner";

const NOW = Date.UTC(2026, 8, 4);
const idOf = (kind: typeof KANJI_SUBJECT | typeof KANA_SUBJECT | typeof VOCAB_SUBJECT, glyph: string) => {
  const id = entryForGlyph(kind, glyph);
  assert.ok(id, `${kind} ${glyph} exists`);
  return id;
};

describe("the learner's sky", () => {
  it("is empty for a brand-new learner", () => {
    const sky = skyFromHistory(emptyHistory(), NOW);
    assert.deepEqual(sky.roots, []);
    assert.deepEqual(sky.items, []);
    assert.deepEqual(sky.mixUps, []);
  });

  it("claimed 日本, 日 and 本 make one constellation with the word's parts inside, and あ its own star", () => {
    const history = emptyHistory();
    const claims: Record<string, number> = {};
    for (const glyph of ["日本"]) for (const f of knownFactsOf(libEntry(idOf(VOCAB_SUBJECT, glyph))!)) claims[f] = NOW - 1000;
    for (const glyph of ["日", "本"]) for (const f of knownFactsOf(libEntry(idOf(KANJI_SUBJECT, glyph))!)) claims[f] = NOW - 1000;
    for (const f of knownFactsOf(libEntry(idOf(KANA_SUBJECT, "あ"))!)) claims[f] = NOW - 1000;
    history.claims = claims;

    const sky = skyFromHistory(history, NOW);
    const word = idOf(VOCAB_SUBJECT, "日本"), hi = idOf(KANJI_SUBJECT, "日"), hon = idOf(KANJI_SUBJECT, "本"), a = idOf(KANA_SUBJECT, "あ");
    assert.deepEqual([...sky.roots].sort(), [word, a].sort(), "the kanji sit inside the word; the kana stands alone");
    const byId = new Map(sky.items.map((i) => [i.id, i]));
    assert.deepEqual(byId.get(word)?.components, [hi, hon]);
    assert.equal(byId.get(word)?.standing, "claimed");
    assert.equal(byId.get(hon)?.standing, "claimed");
    const ki = byId.get(hon)?.components?.[0];
    assert.ok(ki && byId.has(ki), "本's part 木 is an item too, so the constellation draws whole");
    assert.equal(byId.get(ki!)?.standing, "not-seen", "claiming 本 says nothing about 木");
    assert.equal(byId.get(word)?.english.length && byId.get(word)?.english !== "日本", true, "a word has an English name");
  });
});
