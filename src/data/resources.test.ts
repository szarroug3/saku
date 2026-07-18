// Run:
//   node --import ./src/lib/conjugate/test-hooks.mjs --test src/data/resources.test.ts
//
// The rules the header of resources.ts promises, actually held: every link is
// https, unique, dated, and the page is a reading list rather than a second
// copy of the licence page.

import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { RESOURCE_SECTIONS } from "./resources";

const ALL = RESOURCE_SECTIONS.flatMap((s) => s.items);

describe("resource links", () => {
  test("every link is https and dated", () => {
    for (const r of ALL) {
      assert.ok(r.url.startsWith("https://"), `${r.name} is not https`);
      assert.match(
        r.lastVerified,
        /^\d{4}-\d{2}-\d{2}$/,
        `${r.name} has no ISO lastVerified`,
      );
    }
  });

  test("no duplicate urls, no empty blurbs", () => {
    assert.equal(new Set(ALL.map((r) => r.url)).size, ALL.length);
    for (const r of ALL) assert.ok(r.blurb.length > 0, `${r.name} has no blurb`);
  });

  test("no section is empty and ids are unique", () => {
    for (const s of RESOURCE_SECTIONS) {
      assert.ok(s.items.length > 0, `section '${s.id}' is empty`);
    }
    const ids = RESOURCE_SECTIONS.map((s) => s.id);
    assert.equal(new Set(ids).size, ids.length);
  });

  test("the licence sources stay on /about/data, not here", () => {
    // Duplicating the attribution page was the bug this rewrite fixed.
    const banned = ["edrdg.org", "kanjivg", "tatoeba"];
    for (const r of ALL) {
      const hay = `${r.url} ${r.name}`.toLowerCase();
      for (const b of banned) {
        assert.ok(!hay.includes(b), `${r.name} belongs on /about/data`);
      }
    }
  });
});
