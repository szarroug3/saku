// Run:
//   node --import ./src/lib/conjugate/test-hooks.mjs --test src/data/grammar/clusters.test.ts
//
// These tests are mostly about keeping two hand-maintained lists honest with
// each other (a cluster names its members; a recipe names its cluster), and
// about the rules this file promises in its header actually holding — no
// unexplained empty link slot, no link without a verification date, no
// bundled Tae Kim.

import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { CLUSTERS, UNLINKED, cluster, membersOf } from "./clusters";
import { RECIPES, isVacuous, recipe } from "./recipes";

describe("clusters and recipes agree in both directions", () => {
  test("every member id resolves to a real recipe", () => {
    for (const c of CLUSTERS) {
      for (const id of c.members) {
        assert.ok(recipe(id), `cluster '${c.id}' names unknown recipe '${id}'`);
      }
      assert.equal(membersOf(c).length, c.members.length);
    }
  });

  test("every recipe naming a cluster is listed by that cluster", () => {
    // The direction that actually rots: adding `cluster: "seems"` to a recipe
    // and forgetting the members array.
    for (const r of RECIPES) {
      if (!r.cluster) continue;
      const c = cluster(r.cluster);
      assert.ok(c, `${r.id} names unknown cluster '${r.cluster}'`);
      assert.ok(
        c.members.includes(r.id),
        `${r.id} claims cluster '${r.cluster}' but that cluster doesn't list it`,
      );
    }
  });

  test("every listed member claims the cluster back", () => {
    for (const c of CLUSTERS) {
      for (const id of c.members) {
        assert.equal(recipe(id)?.cluster, c.id, `${id} is listed by '${c.id}' but doesn't claim it`);
      }
    }
  });

  test("cluster ids are unique", () => {
    const ids = CLUSTERS.map((c) => c.id);
    assert.equal(new Set(ids).size, ids.length);
  });
});

describe("the obligation cluster is the headline case", () => {
  test("seven ways to say must, all glossed identically", () => {
    const c = cluster("obligation");
    assert.ok(c);
    assert.equal(c.members.length, 7);
    const glosses = new Set(membersOf(c).map((r) => r.gloss));
    // The whole point: they mean the same thing, and the data says so rather
    // than pretending to distinguish them.
    assert.equal(glosses.size, 1, `expected one shared gloss, got ${[...glosses].join(" / ")}`);
    assert.equal([...glosses][0], "must do X");
  });

  test("it ships a visibly empty link slot, with a reason", () => {
    const c = cluster("obligation");
    assert.equal(c?.link, null);
    assert.ok(c?.noLinkReason, "an empty link slot must say why");
  });

  test("all seven are real, distinct strings", () => {
    const c = cluster("obligation")!;
    const built = membersOf(c).map((r) => r.pattern);
    assert.equal(new Set(built).size, 7);
  });
});

describe("links are bets, and each is written down", () => {
  test("every link carries an https url and a verification date", () => {
    for (const c of CLUSTERS) {
      if (!c.link) continue;
      assert.match(c.link.url, /^https:\/\//, `${c.id}: link must be https`);
      assert.match(c.link.lastVerified, /^\d{4}-\d{2}-\d{2}$/, `${c.id}: lastVerified must be ISO`);
      assert.ok(c.link.label.length > 0, `${c.id}: link needs a label`);
    }
  });

  test("every UNLINKED cluster explains itself", () => {
    for (const c of UNLINKED) {
      assert.ok(c.noLinkReason, `cluster '${c.id}' has no link and no reason`);
    }
    assert.ok(UNLINKED.some((c) => c.id === "obligation"));
  });

  test("only verified hosts appear", () => {
    // Not a licence check — a scope check. A URL that isn't on this list has
    // not been verified by anyone, and an unverified link is a guess.
    const allowed = ["www.tofugu.com", "guidetojapanese.org"];
    for (const c of CLUSTERS) {
      if (!c.link) continue;
      const host = new URL(c.link.url).hostname;
      assert.ok(allowed.includes(host), `${c.id}: unverified host ${host}`);
    }
  });
});

describe("map-only clusters carry no members", () => {
  test("は/が is a map and never a quiz", () => {
    const c = cluster("wa-ga");
    assert.ok(c);
    // If this ever gains members, something is generating は/が questions.
    // It must not. See selection.ts and this file's header.
    assert.equal(c.members.length, 0);
    assert.ok(c.link, "は/が is the one cluster that MUST link out — we can't teach it");
  });

  test("no recipe exists for は or が at all", () => {
    for (const r of RECIPES) {
      assert.ok(r.pattern !== "は" && r.pattern !== "が", `${r.id} would be quizzable`);
    }
  });
});

describe("cluster members and vacuity", () => {
  test("the comparison cluster is entirely vacuous, and that's known", () => {
    // Both members attach a particle to a noun. Recorded here so that a future
    // change making them drillable is a deliberate one.
    const c = cluster("comparison")!;
    assert.ok(membersOf(c).every((r) => isVacuous(r)));
  });

  test("the obligation cluster is entirely drillable", () => {
    const c = cluster("obligation")!;
    assert.ok(membersOf(c).every((r) => !isVacuous(r)));
  });
});
