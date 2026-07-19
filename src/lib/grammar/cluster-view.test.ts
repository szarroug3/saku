// The cluster page's two display decisions, held to the data.
//
// Both of these are the kind of thing that renders plausibly while being wrong —
// a glyph slot showing one member's pattern as if it spoke for seven, a grouping
// that quietly drops a row — so both are asserted against every cluster in the
// file rather than against an example.

import assert from "node:assert/strict";
import test, { describe } from "node:test";

import { buildRows } from "./build.ts";
import { glyphLines, hostGroups } from "./cluster-view.ts";
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

describe("hostGroups — the table's headings", () => {
  test("every row lands in exactly one group, for every cluster", () => {
    for (const c of CLUSTERS) {
      const rows = buildRows(membersOf(c));
      const groups = hostGroups(rows);
      const flat = groups.flatMap((g) => [...g.rows]);
      // Same rows, same order, no duplicates, nothing dropped.
      assert.equal(flat.length, rows.length, `${c.id} lost or duplicated rows`);
      assert.deepEqual(new Set(flat).size, rows.length, `${c.id} repeated a row`);
      for (const row of rows) assert.ok(flat.includes(row), `${c.id} dropped a row`);
    }
  });

  test("a group holds only its own host, and each host appears once", () => {
    for (const c of CLUSTERS) {
      const groups = hostGroups(buildRows(membersOf(c)));
      const hosts = groups.map((g) => g.host);
      assert.equal(new Set(hosts).size, hosts.length, `${c.id} split a host in two`);
      for (const g of groups) {
        for (const row of g.rows) assert.equal(row.host, g.host);
        assert.ok(g.rows.length > 0, "an empty group would print a heading over nothing");
      }
    }
  });

  test("seems is thirteen rows in four groups", () => {
    const rows = buildRows(membersOf(must("seems")));
    assert.equal(rows.length, 13);
    const groups = hostGroups(rows);
    assert.deepEqual(
      groups.map((g) => `${g.label} · ${g.word}`),
      [
        "On a verb · 行く",
        "On an い-adjective · 高い",
        "On a な-adjective · 静か",
        "On a noun · 本",
      ],
    );
    assert.equal(
      groups.reduce((n, g) => n + g.rows.length, 0),
      13,
    );
  });

  test("nine of the twelve clusters are a single group, and that is intended", () => {
    const single = CLUSTERS.filter((c) => {
      const rows = buildRows(membersOf(c));
      return rows.length > 0 && hostGroups(rows).length === 1;
    });
    // obligation, after, just-happened, ability, hard-to-do, comparison — six
    // with a table and one heading; the three map-only clusters have no table at
    // all, so "nine of twelve" counts the clusters that are NOT multi-group.
    assert.deepEqual(
      single.map((c) => c.id),
      ["obligation", "after", "just-happened", "ability", "hard-to-do", "comparison"],
    );
    const multi = CLUSTERS.filter((c) => hostGroups(buildRows(membersOf(c))).length > 1);
    assert.deepEqual(
      multi.map((c) => c.id),
      ["seems", "conditionals", "because"],
    );
    assert.equal(single.length + multi.length + 3, CLUSTERS.length);
  });

  test("obligation is seven rows under one heading on 行く", () => {
    const groups = hostGroups(buildRows(membersOf(must("obligation"))));
    assert.equal(groups.length, 1);
    assert.equal(groups[0]?.rows.length, 7);
    assert.equal(groups[0]?.label, "On a verb");
    assert.equal(groups[0]?.word, "行く");
  });

  test("a wrap's heading names the OPENING word, not both slots", () => {
    // 〜は〜より builds on 本 and 車. The heading is about the host it opens on.
    const groups = hostGroups(buildRows(membersOf(must("comparison"))));
    assert.equal(groups.length, 1);
    assert.equal(groups[0]?.word, "本");
    assert.ok(groups[0]?.rows.every((r) => r.on.length === 2));
  });

  test("no rows, no groups — the map-only clusters print no table", () => {
    for (const id of ["wa-ga", "ni-de", "transitivity"]) {
      assert.deepEqual(hostGroups(buildRows(membersOf(must(id)))), []);
    }
  });
});
