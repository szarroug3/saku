// Run: node --import ./src/lib/conjugate/test-hooks.mjs --test \
//        src/lib/library/term-href.test.ts

import assert from "node:assert/strict";
import test from "node:test";

import { TERMS } from "@/data/terms";
import { isTermId, termHref } from "@/lib/library/term-href";

test("the terms the app links to are real glossary pages", () => {
  // The exact ids wired into the jargon surfaces. If a term id is ever renamed,
  // this fails at the id rather than as a dead link in the running app.
  for (const id of ["pitch-accent", "keigo", "counter", "okurigana"]) {
    assert.ok(isTermId(id), `${id} is a real term`);
    assert.equal(termHref(id), `/library/term/${id}`);
  }
});

test("every shipped term resolves to its /library/term/ page", () => {
  for (const t of TERMS) {
    assert.ok(isTermId(t.id));
    assert.equal(termHref(t.id), `/library/term/${t.id}`);
  }
});

test("an unknown term throws rather than resolving to a stranger", () => {
  assert.equal(isTermId("not-a-term"), false);
  assert.throws(() => termHref("not-a-term"), /no such term/);
});
