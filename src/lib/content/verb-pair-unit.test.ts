// Run: node --import ./src/lib/conjugate/test-hooks.mjs --test src/lib/content/verb-pair-unit.test.ts

import assert from "node:assert/strict";
import test from "node:test";

import { transitivityItems, verbPairUnitsOf } from "./verb-pair-unit.ts";
import { buildItem } from "./build-item.ts";
import { pairEntry } from "@/data/transitivity-facts";
import { VERB_PAIRS } from "@/data/transitivity";
import { curriculumPosition } from "@/lib/curriculum-order";

test("transitivityItems — a non-empty list of pair items builds", () => {
  const items = transitivityItems();
  assert.ok(items.length > 0, "enumerates verb pairs");
  assert.ok(
    items.every((i) => i.kind === "transitivity"),
    "every item is a transitivity item",
  );
});

test("transitivityItems — a pair is BLOCKED BY its two member verbs, not taught with kanji", () => {
  const open = transitivityItems().find(
    (i) => String(i.entry) === "transitivity:開く/開ける",
  )!;
  assert.deepEqual(open.prereqs, [], "no teaching prereqs — the kanji are not pulled in");
  assert.deepEqual(
    open.blockedBy,
    ["word:開く", "word:開ける"],
    "the pair waits on knowing both verbs",
  );
  // 付ける/かかる/かける are JMdict-tagged "usually kana", so VOCAB carries them
  // under those kana spellings, not 付ける/掛かる/掛ける — blockedBy must match
  // VOCAB's real spelling or the gate can never clear (see transitivity.ts).
  const tsuku = transitivityItems().find(
    (i) => String(i.entry) === "transitivity:付く/つける",
  )!;
  assert.deepEqual(tsuku.blockedBy, ["word:付く", "word:つける"], "付ける's gate points at VOCAB's kana spelling");
  const kakaru = transitivityItems().find(
    (i) => String(i.entry) === "transitivity:かかる/かける",
  )!;
  assert.deepEqual(
    kakaru.blockedBy,
    ["word:かかる", "word:かける"],
    "both sides point at VOCAB's kana spellings",
  );
});

test("transitivityItems — excludes a pair whose verb can never be learned, rather than building it permanently blocked", () => {
  // 産む and 濡れる/濡らす aren't VOCAB words under any spelling this table uses
  // (see transitivity.ts), so CURRICULUM_PAIRS — what this function now builds
  // from — excludes them entirely. They used to be built anyway and rely on
  // blockedBy to hold them back forever; see interleaved-schedule.test.ts for
  // why a permanently-unmeetable blockedBy gate is worse than not scheduling
  // the pair at all.
  const entries = transitivityItems().map((i) => String(i.entry));
  assert.ok(!entries.includes("transitivity:生まれる/産む"), "the born/give-birth pair is excluded");
  assert.ok(!entries.includes("transitivity:濡れる/濡らす"), "the get-wet pair is excluded");
  assert.equal(entries.length, VERB_PAIRS.length - 2, "exactly the 2 unreachable pairs are dropped");
});

test("transitivityItems — the item's glyph is the happens-side word, matching every other view of it", () => {
  // Used to override this to the shared kanji (開), but nothing actually
  // rendered that value — the Library index and the live teach card both
  // already used the happens-side word, so this item now agrees with them
  // instead of carrying its own display rule that a kana-spelled pair (like
  // 付く/付ける, sharing no kanji at all) couldn't produce anyway.
  const open = transitivityItems().find(
    (i) => String(i.entry) === "transitivity:開く/開ける",
  )!;
  assert.equal(open.glyph, "開く");
});

test("transitivityItems — pairs are ordered by whichever of their two verbs is taught LAST", () => {
  const items = transitivityItems();
  // The order tracks the actual unlock moment (both verbs known), not the
  // shared kanji — see the module header on why that was the wrong proxy.
  const unlockAt = items
    .map((i) => i.blockedBy.map((e) => curriculumPosition(String(e).slice("word:".length))))
    .map((positions) => Math.max(...positions.map((p) => (p < 0 ? Infinity : p))));
  for (let k = 1; k < unlockAt.length; k++) {
    assert.ok(unlockAt[k - 1] <= unlockAt[k], "pairs follow their own slower-verb's vocab teaching order");
  }
});

test("verbPairUnitsOf — the 開く/開ける pair yields a populated unit, intransitive first", () => {
  const pair = transitivityItems().find(
    (i) => String(i.entry) === "transitivity:開く/開ける",
  );
  assert.ok(pair, "the 開く/開ける pair is present");
  const [unit] = verbPairUnitsOf(pair!);
  assert.equal(unit.kind, "verb-pair");
  assert.equal(unit.intransitive, "開く", "happens side is the intransitive");
  assert.equal(unit.transitive, "開ける", "doIt side is the transitive");
  assert.equal(unit.base, "開", "base is the leading run both verbs share");
  assert.equal(unit.facts.length, 2, "both sides of the pair");
  assert.equal(unit.cost, 2, "both verbs learned");
});

test("verbPairUnitsOf — 付く/つける's base is empty, since the pair no longer shares kanji", () => {
  // 付ける is spelled to match VOCAB's kana form (see transitivity.ts), so this
  // pair now shares no leading run with 付く at all — same shape as 生まれる/産む
  // below, just for a spelling reason instead of a different-sense one.
  const pair = transitivityItems().find(
    (i) => String(i.entry) === "transitivity:付く/つける",
  );
  assert.ok(pair, "the 付く/つける pair is present");
  const [unit] = verbPairUnitsOf(pair!);
  assert.equal(unit.base, "");
});

test("verbPairUnitsOf — 生まれる/産む shares no kanji, so base is empty", () => {
  // Built directly (not via transitivityItems(), which now excludes this pair
  // — see the "excludes a pair" test above) to confirm verbPairUnitsOf's OWN
  // base-computation still handles a no-shared-stem pair correctly, regardless
  // of whether that pair is ever actually schedulable.
  const born = VERB_PAIRS.find((p) => p.happens.word === "生まれる" && p.doIt.word === "産む")!;
  const item = buildItem(pairEntry(born), "transitivity")!;
  const [unit] = verbPairUnitsOf(item);
  assert.equal(unit.base, "", "the two verbs use different kanji — no shared base");
});
