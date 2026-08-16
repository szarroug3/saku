// The hand-authored lane (authored.ts) has to obey the same shape the drill
// expects, but it comes from nowhere the ingest can check — so these are the
// checks. wake-da, which no signature can tag, is drillable from its rows here;
// the particle rows (か/wa/ga/…) are reference-only — see authored.ts.

import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { AUTHORED } from "./authored.ts";
import { CORPUS, examplesFor } from "./corpus.ts";
import { recipe } from "./recipes.ts";
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

  test("each span points at a real slice that ends in its tagged pattern", () => {
    for (const ex of AUTHORED) {
      for (const [pat, [start, end, host]] of Object.entries(ex.sp)) {
        const slice = ex.jp.slice(start, end);
        assert.ok(ex.p.includes(pat), `authored ${ex.id}: span for untagged ${pat}`);
        assert.ok(start >= 0 && end <= ex.jp.length && start < end, `authored ${ex.id}: bad span`);
        const bare = recipe(pat)?.pattern.replace(/[〜]/g, "") ?? "";
        // A wrap like しか〜ない highlights only its opening half (しか), shorter
        // than the full pattern text — so either direction of containment is a
        // real match, not just a suffix one.
        assert.ok(
          slice.endsWith(bare) || bare.startsWith(slice),
          `authored ${ex.id}: span "${slice}" does not match pattern ${bare}`,
        );
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
    const wakeDaRows = AUTHORED.filter((ex) => ex.p.includes("wake-da"));
    assert.deepEqual(examplesFor("wake-da"), wakeDaRows, "examplesFor(wake-da) is not its authored rows");
  });

  test("wake-da is now drillable — a selection MC can be built from it", () => {
    const built = examplesFor("wake-da").filter((ex) => selection(ex, "wake-da") !== null);
    assert.ok(built.length >= 4, `only ${built.length} wake-da sentences make a selection item`);
  });
});
