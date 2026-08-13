// The cluster page's two display decisions, held to the data.
//
// Both of these are the kind of thing that renders plausibly while being wrong —
// a glyph slot showing one member's pattern as if it spoke for seven, a grouping
// that quietly drops a row — so both are asserted against every cluster in the
// file rather than against an example.

import assert from "node:assert/strict";
import test, { describe } from "node:test";

import { glyphLines } from "./cluster-view.ts";
import { CLUSTERS, cluster, membersOf } from "../../data/grammar/clusters.ts";

function must(id: string) {
  const c = cluster(id);
  assert.ok(c, `no cluster ${id}`);
  return c;
}

describe("glyphLines — the header's big slot", () => {
  test("a two-member cluster shows BOTH patterns, from the data", () => {
    const c = must("after");
    const m = membersOf(c);
    assert.equal(m.length, 2);
    // Not "てから and たあとで" split out of the gloss — the recipes' own strings.
    assert.deepEqual(
      glyphLines(c, m),
      m.map((r) => r.pattern),
    );
    assert.deepEqual(glyphLines(c, m), ["〜てから", "〜たあとで"]);
  });

  test("all six two-member clusters land in that branch", () => {
    const two = CLUSTERS.filter((c) => membersOf(c).length === 2).map((c) => c.id);
    assert.deepEqual(two, [
      "because",
      "after",
      "just-happened",
      "ability",
      "hard-to-do",
      "comparison",
    ]);
    for (const id of two) {
      const c = must(id);
      assert.equal(glyphLines(c, membersOf(c)).length, 2);
    }
  });

  test("a member-less cluster with a Japanese title shows the title", () => {
    for (const id of ["wa-ga", "ni-de", "transitivity"]) {
      const c = must(id);
      assert.equal(membersOf(c).length, 0);
      assert.deepEqual(glyphLines(c, []), [c.title]);
    }
  });

  test("transitivity is retitled, so it reaches that branch at all", () => {
    const c = must("transitivity");
    assert.equal(c.title, "開ける vs 開く");
    assert.deepEqual(glyphLines(c, []), ["開ける vs 開く"]);
    // The title used to be English jargon, which this branch would have refused
    // — and rightly, since "transitive vs intransitive" is not a glyph.
    assert.ok(!/transitive/i.test(c.title));
    assert.ok(!/transitive/i.test(c.gloss));
    // And the Japanese is no longer said twice.
    assert.ok(!c.gloss.includes("開"));
  });

  test("four or more members gets NO glyph — there is no shared form to show", () => {
    for (const id of ["obligation", "seems", "conditionals"]) {
      const c = must(id);
      assert.ok(membersOf(c).length >= 4);
      assert.deepEqual(glyphLines(c, membersOf(c)), []);
    }
  });

  test("every cluster in the file resolves to 0, 1 or 2 lines and never invents one", () => {
    for (const c of CLUSTERS) {
      const m = membersOf(c);
      const lines = glyphLines(c, m);
      assert.ok(lines.length <= 2, `${c.id} produced ${lines.length} lines`);
      for (const line of lines) {
        assert.ok(
          line === c.title || m.some((r) => r.pattern === line),
          `${c.id} showed "${line}", which is neither its title nor a member's pattern`,
        );
      }
    }
  });
});
