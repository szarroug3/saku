import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { meaningFactId } from "@/data/kanji";
import { knownLookalikes } from "@/lib/kanji-lookalikes";
import type { FactId, HistoryFile } from "@/types";

const AT = Date.UTC(2026, 0, 1);

function history(over: Partial<HistoryFile> = {}): HistoryFile {
  return { sessions: [], facts: {}, claims: {}, ...over };
}

function claiming(facts: readonly FactId[]): HistoryFile {
  const claims: Record<string, number> = {};
  for (const f of facts) claims[f] = AT;
  return history({ claims: claims as HistoryFile["claims"] });
}

describe("knownLookalikes", () => {
  test("filters confusables to the kanji the learner already knows", () => {
    assert.deepEqual(knownLookalikes("休", history()), []);

    const h = claiming([meaningFactId("体")]);
    const got = knownLookalikes("休", h).map((x) => x.c);
    assert.ok(got.includes("体"));
  });

  test("does not surface unknown confusables", () => {
    const h = claiming([meaningFactId("木")]);
    const got = knownLookalikes("休", h).map((x) => x.c);
    assert.ok(!got.includes("体"));
  });
});
