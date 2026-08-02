import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { groupRowsByDisplayLabel } from "@/components/results/word-table-grouping";
import type { EntryId, FactId } from "@/types";

const entry = "grammar:te" as EntryId;
const factA = "grammar:te/production@v5u" as FactId;
const factB = "grammar:te/production@v5k" as FactId;
const factC = "grammar:te/production@v1" as FactId;

describe("groupRowsByDisplayLabel", () => {
  test("keeps a single row when no display formatter is provided", () => {
    const grouped = groupRowsByDisplayLabel(
      [{ entry, facts: [factA, factB] }],
      () => "~て",
    );

    assert.equal(grouped.length, 1);
    assert.equal(grouped[0].heading, "~て");
    assert.deepEqual(grouped[0].facts, [factA, factB]);
  });

  test("splits one entry into multiple rows by display label", () => {
    const grouped = groupRowsByDisplayLabel(
      [{ entry, facts: [factA, factB, factC] }],
      () => "~て",
      (_entry, fact) => {
        if (fact === factA) return "~て · godan · う";
        if (fact === factB) return "~て · godan · く";
        return "~て · ichidan";
      },
    );

    assert.equal(grouped.length, 3);
    assert.deepEqual(
      grouped.map((r) => r.heading),
      ["~て · godan · う", "~て · godan · く", "~て · ichidan"],
    );
    assert.deepEqual(grouped[0].facts, [factA]);
    assert.deepEqual(grouped[1].facts, [factB]);
    assert.deepEqual(grouped[2].facts, [factC]);
  });

  test("coalesces same-label facts into one row", () => {
    const grouped = groupRowsByDisplayLabel(
      [{ entry, facts: [factA, factB, factC] }],
      () => "~て",
      (_entry, fact) =>
        fact === factC ? "~て · ichidan" : "~て · godan · う",
    );

    assert.equal(grouped.length, 2);
    assert.equal(grouped[0].heading, "~て · godan · う");
    assert.deepEqual(grouped[0].facts, [factA, factB]);
    assert.equal(grouped[1].heading, "~て · ichidan");
    assert.deepEqual(grouped[1].facts, [factC]);
  });
});
