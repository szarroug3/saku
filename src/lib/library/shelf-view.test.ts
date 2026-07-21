// Run: node --import ./src/lib/conjugate/test-hooks.mjs --test \
//        src/lib/library/shelf-view.test.ts
//
// WHAT THIS TEST IS FOR
// =====================
// The shelf paints only the first few of its kanji sections, and it must take
// that cap AFTER the knowledge filter, never before. The bug this pins: cap
// first, and "Not known" runs against only the leading sections — so if the
// first ~300 kanji happen to be known, the shelf empties and claims "everything
// is already known" while thousands of unknown kanji wait in the sections it
// never looked at. Filter first, cap second, and the filter sees the whole
// shelf. These tests hold that ordering for the kanji shelf, and check that the
// caps still bound the other shelves the way they always did.

import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { KANJI_SUBJECT } from "../../data/kanji.ts";
import { VOCAB_SUBJECT, vocabRow } from "../../data/vocab.ts";
import { KANA_SUBJECT } from "../../data/characters.ts";
import { KANJI_SECTIONS_SHOWN } from "./kanji-shelf.ts";
import {
  filterSections,
  sectionCapFor,
  shownSectionsOf,
  shownWordsOf,
  visibleShelfIds,
  WORD_TILES,
  type ShelfSection,
} from "./shelf-view.ts";
import { LIB_ENTRIES, type LibEntry } from "./entries.ts";
import type { EntryId } from "../../types/index.ts";

/** A stand-in entry. The view math reads `.id` everywhere and `.glyph` on the
 * words shelf (to look up `beginnerRank`), so the rest is filler to satisfy the
 * type; the `known` flag is what the test's `keep` predicate looks at through
 * the id. A stand-in's glyph is its id, which is not a real word — that is
 * deliberate in the cap test below, where every entry ranks UNRANKED and the
 * input order therefore survives. */
function entry(id: string): LibEntry {
  return {
    id: id as EntryId,
    kind: KANJI_SUBJECT,
    glyph: id,
    readings: [],
    meanings: [],
    sub: "",
    weight: 0,
  };
}

/** `n` entries whose ids are `${prefix}-0 … ${prefix}-(n-1)`. */
function entries(prefix: string, n: number): LibEntry[] {
  return Array.from({ length: n }, (_, i) => entry(`${prefix}-${i}`));
}

/** A range-style kanji section (no per-section tile cap — that is what tells the
 * range modes apart from grade). */
function rangeSection(id: string, n: number): ShelfSection {
  return { id, label: id, entries: entries(id, n) };
}

const known = new Set<string>();
/** "Not known": keep the entries NOT in `known`. */
const notKnown = (e: LibEntry) => !known.has(e.id);

describe("the section cap is taken AFTER the knowledge filter", () => {
  test("first three sections all known still reveals unknown ones behind them", () => {
    // Five sections. Every kanji in the first four is marked known; only the
    // fifth has unknown kanji. Cap-before-filter would look at sections 1–3,
    // find them all-known, and call the shelf empty. Cap-after-filter drops the
    // emptied leading sections and paints the fifth.
    const sections = [
      rangeSection("s1", 3),
      rangeSection("s2", 3),
      rangeSection("s3", 3),
      rangeSection("s4", 3),
      rangeSection("s5", 3),
    ];
    known.clear();
    for (const s of sections.slice(0, 4)) for (const e of s.entries) known.add(e.id);

    const shown = shownSectionsOf(KANJI_SUBJECT, sections, notKnown);
    assert.deepEqual(
      shown.map((s) => s.id),
      ["s5"],
      "the one section with unknown kanji must be what the shelf paints",
    );
    assert.deepEqual(visibleShelfIds(KANJI_SUBJECT, sections, [], notKnown), [
      "s5-0",
      "s5-1",
      "s5-2",
    ]);
  });

  test("more surviving sections than the cap still stops at the cap", () => {
    // Ten sections, none known: the filter empties nothing, so the cap alone
    // decides and it is the first KANJI_SECTIONS_SHOWN.
    const sections = Array.from({ length: 10 }, (_, i) => rangeSection(`r${i}`, 4));
    known.clear();

    const shown = shownSectionsOf(KANJI_SUBJECT, sections, notKnown);
    assert.equal(shown.length, KANJI_SECTIONS_SHOWN);
    assert.deepEqual(
      shown.map((s) => s.id),
      ["r0", "r1", "r2"],
    );
  });

  test("the shelf empties only when NOTHING anywhere matches", () => {
    const sections = [rangeSection("s1", 2), rangeSection("s2", 2)];
    known.clear();
    for (const s of sections) for (const e of s.entries) known.add(e.id);

    assert.equal(shownSectionsOf(KANJI_SUBJECT, sections, notKnown).length, 0);
  });

  test('"All" (no filter) still caps at the first three sections', () => {
    const sections = Array.from({ length: 8 }, (_, i) => rangeSection(`r${i}`, 4));
    const shown = shownSectionsOf(KANJI_SUBJECT, sections);
    assert.deepEqual(
      shown.map((s) => s.id),
      ["r0", "r1", "r2"],
    );
  });
});

describe("sectionCapFor tells the modes apart", () => {
  test("kanji range sections (no per-section cap) cap at KANJI_SECTIONS_SHOWN", () => {
    const sections = [rangeSection("r0", 4), rangeSection("r1", 4)];
    assert.equal(sectionCapFor(KANJI_SUBJECT, sections), KANJI_SECTIONS_SHOWN);
  });

  test("kanji grade sections (per-section cap set) show all their sections", () => {
    const grade: ShelfSection[] = [
      { id: "grade-1", label: "School grade 1", entries: entries("g1", 5), cap: 60 },
      { id: "grade-2", label: "School grade 2", entries: entries("g2", 5), cap: 60 },
    ];
    assert.equal(sectionCapFor(KANJI_SUBJECT, grade), Infinity);
  });

  test("every non-kanji shelf shows all of its sections", () => {
    assert.equal(sectionCapFor(KANA_SUBJECT, [rangeSection("k", 1)]), Infinity);
  });
});

describe("grade mode is unchanged by the fix", () => {
  test("filtered grade sections all paint, in order, with their tile caps kept", () => {
    const grade: ShelfSection[] = [
      { id: "grade-1", label: "School grade 1", entries: entries("g1", 5), cap: 3 },
      { id: "grade-2", label: "School grade 2", entries: entries("g2", 5), cap: 3 },
      { id: "grade-3", label: "School grade 3", entries: entries("g3", 5), cap: 3 },
    ];
    known.clear();
    for (const e of grade[0].entries) known.add(e.id); // grade 1 all known

    const shown = shownSectionsOf(KANJI_SUBJECT, grade, notKnown);
    assert.deepEqual(
      shown.map((s) => s.id),
      ["grade-2", "grade-3"],
      "an emptied grade drops out, but no section cap is applied",
    );
    // The per-section tile cap still bounds the ids the range mirror exposes.
    const ids = visibleShelfIds(KANJI_SUBJECT, grade, [], notKnown);
    assert.equal(ids.length, 6, "3 tiles from each of the two surviving grades");
  });
});

describe("the words shelf keeps its flat WORD_TILES cap", () => {
  test("filter runs over the whole list, then the first WORD_TILES show", () => {
    const all = entries("w", WORD_TILES + 50);
    known.clear();
    // Mark the first 10 known, so "Not known" is the rest.
    for (const e of all.slice(0, 10)) known.add(e.id);

    const ids = visibleShelfIds(VOCAB_SUBJECT, [], all, notKnown);
    assert.equal(ids.length, WORD_TILES);
    assert.equal(ids[0], "w-10", "the known ones are filtered out before the cap");
  });
});

describe("filterSections drops emptied sections and copies when unfiltered", () => {
  test("no keep returns a copy of the sections, untouched", () => {
    const sections = [rangeSection("s1", 2)];
    const out = filterSections(sections);
    assert.deepEqual(
      out.map((s) => s.id),
      ["s1"],
    );
    assert.notEqual(out, sections, "a copy, so a later slice cannot mutate the input");
  });
});

// THE WORDS SHELF IS ORDERED BY `beginnerRank`
// ============================================
// The shelf is headed "Common everyday words" and used to paint the raw vocab
// order, which opened with あべこべ (topsy-turvy), あやふや (vague) and いざこざ
// (trouble) and reached うんこ / おっぱい inside the first 120 — on a grid that
// shows no English to warn you. These pin the ORDER, not just that a sort call
// exists: the first tile must be the lowest-ranked word in the data, and an
// unranked word must sort LAST. Rank 0 for the unranked is exactly how a word
// nobody ranked would land at the front of a beginner's first screen, which is
// the bug in its original form.
describe("the words shelf is painted in beginnerRank order", () => {
  /** Real words, deliberately handed over in the WRONG order, so a function
   * that merely passed its input through would fail. */
  function realWords(kebs: readonly string[]): LibEntry[] {
    return kebs.map((keb) => ({ ...entry(`w:${keb}`), glyph: keb }));
  }

  test("ascending by beginnerRank, whatever order they arrive in", () => {
    const kebs = ["電話", "何", "行く", "言う", "あなた"];
    const shuffled = realWords(kebs);
    const ranked = shuffled.map((e) => vocabRow(e.glyph)?.beginnerRank);
    assert.ok(
      ranked.every((r) => typeof r === "number"),
      "the fixture must be real vocab, or this pins nothing",
    );

    const out = shownWordsOf(shuffled);
    const outRanks = out.map((e) => vocabRow(e.glyph)!.beginnerRank);
    assert.deepEqual(
      outRanks,
      [...outRanks].sort((a, b) => a - b),
      "ascending",
    );
    assert.deepEqual([...ranked].sort((a, b) => a! - b!), outRanks, "same words, reordered");
  });

  test("the whole shelf leads with the lowest rank in the data", () => {
    const all = LIB_ENTRIES.filter((e) => e.kind === VOCAB_SUBJECT);
    const first = shownWordsOf(all)[0];
    const lowest = Math.min(...all.map((e) => vocabRow(e.glyph)!.beginnerRank));
    assert.equal(vocabRow(first.glyph)!.beginnerRank, lowest);
  });

  test("an unranked word sorts LAST, never first", () => {
    // 何 is rank 1 — the very front. The made-up glyph has no row at all, so if
    // "no rank" were read as 0 it would displace 何 and open the shelf.
    const mixed = [...realWords(["何"]), { ...entry("w:none"), glyph: "＊not-a-word＊" }];
    const out = shownWordsOf(mixed);
    assert.equal(out[0].glyph, "何");
    assert.equal(out[out.length - 1].glyph, "＊not-a-word＊");
  });

  test("the filter still runs over the whole list, before the order and the cap", () => {
    const all = LIB_ENTRIES.filter((e) => e.kind === VOCAB_SUBJECT);
    const top = shownWordsOf(all)[0];
    known.clear();
    known.add(top.id);
    const out = shownWordsOf(all, notKnown);
    assert.ok(
      !out.some((e) => e.id === top.id),
      "a filtered-out word does not come back through the sort",
    );
  });

  test("visibleShelfIds paints the same words in the same order as the grid", () => {
    const all = LIB_ENTRIES.filter((e) => e.kind === VOCAB_SUBJECT);
    known.clear();
    assert.deepEqual(
      visibleShelfIds(VOCAB_SUBJECT, [], all),
      shownWordsOf(all)
        .slice(0, WORD_TILES)
        .map((e) => e.id),
      "the Shift-range mirror and the render must agree, or a range sweeps a stretch nobody saw",
    );
  });

  test("shownWordsOf does not mutate its input", () => {
    const given = realWords(["電話", "何"]);
    const before = given.map((e) => e.glyph);
    shownWordsOf(given);
    assert.deepEqual(
      given.map((e) => e.glyph),
      before,
    );
  });
});
