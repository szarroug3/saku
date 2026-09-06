// The readings index, grouped in one pass (SAK-382).
//
// `READINGS_BY_ANCHOR` used to be built by collecting its keys and then
// filtering the whole of READINGS once per key: three thousand passes over
// three thousand rows, 655 ms, paid on every cold start before the app could
// answer anything. It is one grouping pass now, and this pins what that
// grouping has to be true of, so the shape cannot quietly change again.
//
// The map itself is private, so this goes through the two things that read
// it: `readingFactId`, which asks how many rows share an anchor in order to
// decide whether to qualify the id, and `READING_INDEX`, which maps the id
// back to the row.

import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { READING_INDEX, READINGS, readingFactId } from "@/data/kanji";

describe("a kanji's readings, grouped by the word they are learned in", () => {
  it("gives every reading an id that leads back to that reading", () => {
    const lost: string[] = [];
    for (const row of READINGS) {
      const found = READING_INDEX.get(readingFactId(row.k, row.anchor, row.base));
      if (found !== row && lost.length < 10) lost.push(`${row.k} ${row.base} in ${row.anchor}`);
    }
    assert.deepEqual(lost, []);
    assert.ok(READINGS.length > 3000, `only ${READINGS.length} readings`);
  });

  it("gives every reading its own id, so no two share one", () => {
    const ids = new Set(READINGS.map((r) => readingFactId(r.k, r.anchor, r.base)));
    assert.equal(ids.size, READINGS.length);
  });

  it("only qualifies an id where a word really has two readings of one kanji", () => {
    // The unqualified id is the one history already holds, so a kanji whose
    // anchor word has a single reading must keep it.
    const byKey = new Map<string, number>();
    for (const r of READINGS) byKey.set(`${r.k}|${r.anchor}`, (byKey.get(`${r.k}|${r.anchor}`) ?? 0) + 1);
    let alone = 0;
    for (const r of READINGS) {
      if (byKey.get(`${r.k}|${r.anchor}`) !== 1) continue;
      alone++;
      assert.ok(!String(readingFactId(r.k, r.anchor, r.base)).includes("#"), `${r.k} in ${r.anchor} was qualified`);
    }
    assert.ok(alone > 2000, `only ${alone} readings sit alone in their word`);
  });
});
