// The writing drill's pool from the grammar corpus (#BuildHybridAI).

import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { corpus } from "@/data/grammar/corpus";

import { MAX_TOKENS, POOL_SIZE, writeDrill } from "./write-drill";

describe("writeDrill", () => {
  const pool = writeDrill();
  const byId = new Map(corpus().map((ex) => [ex.id, ex]));

  it("fills the pool", () => {
    assert.equal(pool.length, POOL_SIZE);
  });

  it("takes only short corpus sentences, as the corpus has them", () => {
    for (const item of pool) {
      const ex = byId.get(item.id);
      assert.ok(ex, `${item.id} is in the corpus`);
      assert.ok(ex.n <= MAX_TOKENS, `${item.jp} is short`);
      assert.equal(item.jp, ex.jp);
      assert.equal(item.en, ex.en);
    }
  });

  it("asks each sentence once", () => {
    assert.equal(new Set(pool.map((i) => i.id)).size, pool.length);
  });

  it("spreads the pool across patterns", () => {
    const patterns = new Set(pool.map((i) => i.pattern));
    assert.ok(patterns.size >= 40, `${patterns.size} patterns`);
    const most = Math.max(...[...patterns].map((p) => pool.filter((i) => i.pattern === p).length));
    assert.ok(most <= 10, `no pattern has more than 10 sentences (${most})`);
  });

  it("gives every pattern its gloss", () => {
    for (const item of pool) assert.ok(item.gloss.trim(), item.pattern);
  });

  it("gives most answers a words line", () => {
    const withWords = pool.filter((i) => i.words.length > 0).length;
    assert.ok(withWords >= pool.length * 0.9, `${withWords} of ${pool.length}`);
  });
});
