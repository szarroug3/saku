// Run: node --import ./src/lib/conjugate/test-hooks.mjs --test \
//        src/lib/library/sub-label.test.ts
//
// WHAT THIS TEST IS FOR
// =====================
// The Library grid printed "—" under 42 kana — し ち つ ふ を ん じ ぢ づ and
// every しゃ/ちゃ/じゃ combination — which is precisely the set whose
// romanisation is NOT mechanical, the set a beginner most needs told. It was
// not missing data: the entry page prints "shi · si" from the same rows. It was
// a `readings.length === 1` guard, written to stop a nine-reading kanji being
// summarised as one arbitrary reading, catching kana that carry two spellings
// of ONE sound and have no meanings to fall back on.
//
// So there are two properties here and they pull against each other, which is
// why both are pinned: nothing with a reading may print a dash, AND a kanji with
// many readings still must not name one of them.

import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { KANA_SUBJECT } from "../../data/characters.ts";
import { KANJI_SUBJECT } from "../../data/kanji.ts";
import { entryForGlyph, libEntry, LIB_ENTRIES, type LibEntry } from "./entries.ts";
import { READING_SEP, subLabel } from "./sub-label.ts";

/** The entry for a glyph of a given kind, or a loud failure — a fixture that
 * silently resolved to undefined would make every assertion below vacuous. */
function entryOf(kind: LibEntry["kind"], glyph: string): LibEntry {
  const id = entryForGlyph(kind, glyph);
  const e = id ? libEntry(id) : null;
  assert.ok(e, `no ${kind} entry for ${glyph} — the fixture is stale`);
  return e;
}

describe("no entry prints a dash while it has something to say", () => {
  test("not one library entry with a reading falls back to —", () => {
    const dashed = LIB_ENTRIES.filter(
      (e) => subLabel(e) === "—" && e.readings.length > 0,
    );
    assert.deepEqual(
      dashed.map((e) => `${e.kind}:${e.glyph}`),
      [],
      "these hold a reading and print a dash instead of it",
    );
  });

  test("every kana shows a reading, none shows a dash", () => {
    const kana = LIB_ENTRIES.filter((e) => e.kind === KANA_SUBJECT);
    assert.ok(kana.length > 0, "the fixture must find kana");
    for (const e of kana) {
      assert.notEqual(subLabel(e), "—", `${e.glyph} shows a dash`);
    }
  });

  test("the irregular kana show every romanisation, joined as the entry page joins it", () => {
    // These nine and the しゃ/ちゃ/じゃ combos were the whole of the bug. Their
    // extra readings are Kunrei spellings of the SAME sound as the Hepburn one,
    // so showing both is the whole truth, not a pick among alternatives.
    assert.equal(subLabel(entryOf(KANA_SUBJECT, "し")), `shi${READING_SEP}si`);
    assert.equal(subLabel(entryOf(KANA_SUBJECT, "ち")), `chi${READING_SEP}ti`);
    assert.equal(subLabel(entryOf(KANA_SUBJECT, "ん")), `n${READING_SEP}nn`);
    assert.equal(
      subLabel(entryOf(KANA_SUBJECT, "じゃ")),
      `ja${READING_SEP}jya${READING_SEP}zya`,
    );
    assert.equal(subLabel(entryOf(KANA_SUBJECT, "シ")), `shi${READING_SEP}si`);
  });

  test("a mechanical kana still shows its single romanisation, unchanged", () => {
    assert.equal(subLabel(entryOf(KANA_SUBJECT, "か")), "ka");
  });
});

describe("a many-reading kanji still refuses to name one reading", () => {
  test("生 shows its meaning, not one of its readings", () => {
    const sei = entryOf(KANJI_SUBJECT, "生");
    assert.ok(sei.readings.length > 1, "生 must have many readings, or this pins nothing");
    const label = subLabel(sei);
    assert.equal(label, sei.meanings[0]);
    for (const r of sei.readings) {
      assert.ok(
        !label.includes(r),
        `the tile named "${r}" — one of ${sei.readings.length} readings, presented as THE reading`,
      );
    }
  });

  test("no many-reading kanji anywhere shows a reading in its label", () => {
    const named = LIB_ENTRIES.filter(
      (e) =>
        e.kind === KANJI_SUBJECT &&
        e.readings.length > 1 &&
        e.readings.includes(subLabel(e)),
    );
    assert.deepEqual(named.map((e) => e.glyph), []);
  });

  test("a one-reading entry still shows that reading", () => {
    const one = LIB_ENTRIES.find((e) => e.readings.length === 1);
    assert.ok(one);
    assert.equal(subLabel(one), one.readings[0]);
  });
});

describe("the dash is kept for the entry that genuinely has neither", () => {
  test("no readings and no meanings still reads —", () => {
    const bare: LibEntry = {
      ...LIB_ENTRIES[0],
      kind: KANJI_SUBJECT,
      readings: [],
      meanings: [],
    };
    assert.equal(subLabel(bare), "—");
  });
});
