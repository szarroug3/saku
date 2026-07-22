// The hand-authored lane (authored.ts) has to obey the same shape the drill
// expects, but it comes from nowhere the ingest can check — so these are the
// checks. The payoff assertion is the last one: wake-da, which no signature can
// tag, is now a pattern the app can DRILL.

import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { AUTHORED } from "./authored.ts";
import { CORPUS, examplesFor } from "./corpus.ts";
import { selection } from "../../lib/grammar/questions.ts";

describe("the hand-authored example lane", () => {
  test("every id is negative and unique — never a Tatoeba permalink", () => {
    const seen = new Set<number>();
    for (const ex of AUTHORED) {
      assert.ok(ex.id < 0, `authored ${ex.id} (${ex.jp}) is not a negative id`);
      assert.ok(!seen.has(ex.id), `authored id ${ex.id} is reused`);
      seen.add(ex.id);
    }
  });

  test("each row is tagged exactly one pattern, so it can be blanked", () => {
    // selection() refuses a sentence tagged for more than one pattern — it cannot
    // blank one without risking covering another. An authored row exists to drill,
    // so a single tag is not optional.
    for (const ex of AUTHORED) {
      assert.equal(ex.p.length, 1, `authored ${ex.id} claims ${ex.p.length} patterns`);
    }
  });

  test("each span points at a real slice that ends in the pattern", () => {
    for (const ex of AUTHORED) {
      for (const [pat, [start, end, host]] of Object.entries(ex.sp)) {
        const slice = ex.jp.slice(start, end);
        assert.ok(ex.p.includes(pat), `authored ${ex.id}: span for untagged ${pat}`);
        assert.ok(start >= 0 && end <= ex.jp.length && start < end, `authored ${ex.id}: bad span`);
        assert.ok(slice.endsWith("わけだ"), `authored ${ex.id}: span "${slice}" is not わけだ`);
        // host is the DICTIONARY form shown as the prompt, not a substring — 知る
        // stands in for 知らなかった — so it need only be a real base word.
        assert.ok(typeof host === "string" && host.length > 0, `authored ${ex.id}: no host`);
      }
    }
  });

  test("wake-da lives only in the authored lane, never in the corpus", () => {
    // The clean split the whole design rests on: the CORPUS array stays pure, so
    // perPattern / the confound audit / the token filter measure the ingest alone.
    assert.ok(!CORPUS.some((ex) => ex.p.includes("wake-da")), "wake-da leaked into CORPUS");
    assert.deepEqual(examplesFor("wake-da"), AUTHORED, "examplesFor(wake-da) is not the authored set");
  });

  test("wake-da is now drillable — a selection MC can be built from it", () => {
    const built = examplesFor("wake-da").filter((ex) => selection(ex, "wake-da") !== null);
    assert.ok(built.length >= 4, `only ${built.length} wake-da sentences make a selection item`);
  });
});
