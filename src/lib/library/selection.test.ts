// Run: node --import ./src/lib/conjugate/test-hooks.mjs --test \
//        src/lib/library/selection.test.ts
//
// WHAT THESE TESTS ARE FOR
// ========================
// The Library's selection is a GLOBAL, CROSS-KIND set: you toggle a hiragana row
// and a kanji and a word, and the one bar drills the union. The two properties
// that make that true are not visible in any single function — they are that the
// set is not indexed by kind (so switching the kind filter cannot drop anything)
// and that the slice it produces is the union in a stable order (so the drill is
// everything you toggled, however you assembled it). These tests pin both against
// real entry ids drawn from all three kinds, plus the tri-state header logic that
// a section header renders from.

import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { KANA_SUBJECT } from "@/data/characters";
import { KANJI_SUBJECT } from "@/data/kanji";
import { VOCAB_SUBJECT } from "@/data/vocab";
import { LIB_ENTRIES } from "@/lib/library/entries";
import {
  addRange,
  EMPTY_SELECTION,
  rangeIds,
  sectionState,
  selectionSlice,
  toggleEntry,
  toggleSection,
} from "@/lib/library/selection";
import type { EntryId } from "@/types";

/** One real entry id of each kind, in browse order, so the union assertions run
 * against ids the app actually mints and orders. */
const kana = LIB_ENTRIES.find((e) => e.kind === KANA_SUBJECT)!;
const kanji = LIB_ENTRIES.find((e) => e.kind === KANJI_SUBJECT)!;
const word = LIB_ENTRIES.find((e) => e.kind === VOCAB_SUBJECT)!;

describe("toggleEntry", () => {
  test("adds when absent, removes when present, and is immutable", () => {
    const base = EMPTY_SELECTION;
    const on = toggleEntry(base, kana.id);
    assert.equal(on.has(kana.id), true);
    assert.equal(base.size, 0, "must not mutate the input set");

    const off = toggleEntry(on, kana.id);
    assert.equal(off.has(kana.id), false);
  });
});

describe("cross-kind persistence", () => {
  test("the set spans kinds and nothing about a kind can drop another's", () => {
    // Toggle one of each kind on, in turn — this is "select in hiragana, then
    // switch to kanji, then add a word". The set holds all three at once.
    let sel = EMPTY_SELECTION as ReadonlySet<EntryId>;
    sel = toggleEntry(sel, kana.id);
    sel = toggleEntry(sel, kanji.id);
    sel = toggleEntry(sel, word.id);

    assert.equal(sel.size, 3);
    for (const e of [kana, kanji, word]) assert.equal(sel.has(e.id), true);

    // Removing the kanji leaves the hiragana and the word untouched — a kind's
    // entries are not bucketed, so one cannot clear another.
    const afterRemoveKanji = toggleEntry(sel, kanji.id);
    assert.equal(afterRemoveKanji.has(kana.id), true);
    assert.equal(afterRemoveKanji.has(word.id), true);
    assert.equal(afterRemoveKanji.has(kanji.id), false);
  });
});

describe("selectionSlice — the union that feeds the drill", () => {
  test("is every selected entry, in browse order, regardless of toggle order", () => {
    // Assemble the selection kanji-first, word-second, kana-last — the OPPOSITE
    // of browse order — to prove the slice re-sorts to a stable order.
    let sel = EMPTY_SELECTION as ReadonlySet<EntryId>;
    sel = toggleEntry(sel, kanji.id);
    sel = toggleEntry(sel, word.id);
    sel = toggleEntry(sel, kana.id);

    const slice = selectionSlice(sel, LIB_ENTRIES);
    // Browse order is kana, then kanji, then words — see LIB_ENTRIES build().
    assert.deepEqual(slice.entries, [kana.id, kanji.id, word.id]);
    assert.equal(slice.label, "3 selected");
  });

  test("an empty selection is an empty, drillable-by-nothing slice", () => {
    const slice = selectionSlice(EMPTY_SELECTION, LIB_ENTRIES);
    assert.deepEqual(slice.entries, []);
    assert.equal(slice.label, "0 selected");
  });
});

describe("toggleSection — the header's all-or-nothing", () => {
  const ids = [kana.id, kanji.id, word.id] as const;

  test("fills an empty/partial section, then clears a full one", () => {
    // From empty: header selects all of them.
    const filled = toggleSection(EMPTY_SELECTION, ids);
    for (const id of ids) assert.equal(filled.has(id), true);

    // From full: header clears all of them.
    const cleared = toggleSection(filled, ids);
    for (const id of ids) assert.equal(cleared.has(id), false);

    // From partial (one on): header fills the rest rather than toggling each.
    const partial = toggleEntry(EMPTY_SELECTION, ids[0]);
    const completed = toggleSection(partial, ids);
    for (const id of ids) assert.equal(completed.has(id), true);
  });

  test("toggling a section leaves entries outside it alone", () => {
    const withOutsider = toggleEntry(EMPTY_SELECTION, kana.id);
    const outsiderIds = [kanji.id, word.id];
    const next = toggleSection(withOutsider, outsiderIds);
    assert.equal(next.has(kana.id), true, "the outsider survives");
    for (const id of outsiderIds) assert.equal(next.has(id), true);
  });
});

describe("sectionState — what the header renders", () => {
  const ids = [kana.id, kanji.id];

  test("none / some / all", () => {
    assert.equal(sectionState(EMPTY_SELECTION, ids), "none");
    assert.equal(sectionState(toggleEntry(EMPTY_SELECTION, ids[0]), ids), "some");
    assert.equal(sectionState(toggleSection(EMPTY_SELECTION, ids), ids), "all");
  });

  test("an empty section is never 'all'", () => {
    assert.equal(sectionState(EMPTY_SELECTION, []), "none");
  });
});

// A visible, in-DISPLAY-ORDER list drawn from real ids, deliberately MIXING two
// kinds so the "cross-shelf / cross-section" range is exercised against the same
// flat, cross-kind order the search view actually produces. v[0..2] are kana,
// v[3..5] are kanji: a range that starts in one and ends in the other crosses
// the boundary, which is the documented behaviour.
const kanas = LIB_ENTRIES.filter((e) => e.kind === KANA_SUBJECT).slice(0, 3).map((e) => e.id);
const kanjis = LIB_ENTRIES.filter((e) => e.kind === KANJI_SUBJECT).slice(0, 3).map((e) => e.id);
const visible: EntryId[] = [...kanas, ...kanjis];
// An id the app mints but that is NOT in `visible` — the anchor-scrolled-away /
// filtered-out case.
const offscreen = LIB_ENTRIES.filter((e) => e.kind === VOCAB_SUBJECT)[0].id;

describe("rangeIds — the contiguous visible run a Shift-click covers", () => {
  test("forward: anchor before target, inclusive of both ends", () => {
    assert.deepEqual(rangeIds(visible, visible[1], visible[4]), [
      visible[1],
      visible[2],
      visible[3],
      visible[4],
    ]);
  });

  test("backward: anchor after target gives the same run, still in display order", () => {
    assert.deepEqual(rangeIds(visible, visible[4], visible[1]), [
      visible[1],
      visible[2],
      visible[3],
      visible[4],
    ]);
  });

  test("anchor == target is the single item", () => {
    assert.deepEqual(rangeIds(visible, visible[2], visible[2]), [visible[2]]);
  });

  test("crosses the kind/section boundary — the whole visible run between the two", () => {
    // v[2] is the last kana, v[3] the first kanji: a range spanning them fills
    // both sides, proving the range follows the flattened display order across
    // the boundary rather than stopping at it.
    assert.deepEqual(rangeIds(visible, visible[2], visible[3]), [visible[2], visible[3]]);
  });

  test("target not in the visible list yields no range", () => {
    assert.deepEqual(rangeIds(visible, visible[0], offscreen), []);
  });

  test("anchor not in the visible list yields no range", () => {
    assert.deepEqual(rangeIds(visible, offscreen, visible[0]), []);
  });
});

describe("addRange — Shift-click applied to the selection", () => {
  test("unions the range onto what was already selected, without clobbering it", () => {
    // Start with an unrelated pick, then Shift-select a run: the earlier pick
    // survives and the whole run is added.
    const base = toggleEntry(EMPTY_SELECTION, offscreen);
    const next = addRange(base, visible, visible[1], visible[3]);
    assert.equal(next.has(offscreen), true, "the prior selection is kept");
    for (const id of [visible[1], visible[2], visible[3]]) {
      assert.equal(next.has(id), true);
    }
    assert.equal(next.has(visible[0]), false, "outside the range, untouched");
    assert.equal(next.has(visible[4]), false, "outside the range, untouched");
  });

  test("entries already on inside the range stay on (additive, never a toggle-off)", () => {
    const base = toggleEntry(EMPTY_SELECTION, visible[2]);
    const next = addRange(base, visible, visible[1], visible[3]);
    assert.equal(next.has(visible[2]), true, "already-on middle stays on");
  });

  test("no usable range (anchor offscreen) degrades to toggling the target", () => {
    const on = addRange(EMPTY_SELECTION, visible, offscreen, visible[0]);
    assert.equal(on.has(visible[0]), true, "target toggled on");
    const off = addRange(on, visible, offscreen, visible[0]);
    assert.equal(off.has(visible[0]), false, "and off again");
  });

  test("does not mutate the input set", () => {
    const base = EMPTY_SELECTION;
    addRange(base, visible, visible[0], visible[2]);
    assert.equal(base.size, 0);
  });
});
