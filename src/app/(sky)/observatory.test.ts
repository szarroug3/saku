// The Observatory's offerings: what a kana row builds on. Every plain row
// builds on its script's vowels, a marked row on its plain row, and the
// katakana vowels on all of hiragana (Sam's rule, 2026-09-05: you need all
// hiragana before any katakana).

import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { emptyHistory } from "@/lib/history-ops";
import { pickState } from "@/sky/lib/cart";
import { buildGraph } from "@/sky/lib/graph";

import { offerings } from "./observatory";

const NOW = Date.UTC(2026, 8, 5);

describe("the kana rows on offer", () => {
  const o = offerings(emptyHistory(), NOW);
  const graph = buildGraph([...o.items.values()]);
  const rows = (prefix: string) => [...o.items.keys()].filter((id) => id.startsWith(`kana-row:${prefix}`));

  it("puts every hiragana row before the katakana vowels", () => {
    const hiragana = rows("h-");
    assert.ok(hiragana.length > 5);
    const builtOn = graph.prerequisitesOf("kana-row:k-vowels").filter((p) => p.startsWith("kana-row:"));
    assert.deepEqual(new Set(builtOn), new Set(hiragana));
  });

  it("opens only the hiragana vowels to a new learner", () => {
    const open = [...rows("h-"), ...rows("k-")].filter((id) => pickState(graph, id, o.learned, []).needs.length === 0);
    assert.deepEqual(open, ["kana-row:h-vowels"]);
  });

  it("opens the katakana vowels once all of hiragana is learned, and the rest of katakana on those", () => {
    const learned = new Set([...o.learned, ...rows("h-")]);
    assert.equal(pickState(graph, "kana-row:k-vowels", learned, []).needs.length, 0);
    assert.ok(pickState(graph, "kana-row:k-k", learned, []).needs.includes("kana-row:k-vowels"));
  });
});
