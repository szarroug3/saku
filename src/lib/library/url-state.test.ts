// Run: node --import ./src/lib/conjugate/test-hooks.mjs --test \
//        src/lib/library/url-state.test.ts
//
// WHAT THESE TESTS ARE FOR
// ========================
// The Library's tab and search box live in the URL, and a URL is the one input
// nobody validates: the entry page writes `?kind=kanji` into a breadcrumb, a
// user pastes a link from six months ago, someone edits the address bar by
// hand. Two properties have to hold, and neither is visible from the page.
//
//   THE BREADCRUMB CASE. `/library?kind=kanji` must actually select Kanji. It
//   did not — the page held the kind in useState and the param was generated
//   and dropped — so this is the regression these tests exist for first.
//
//   THE STRANGER CASE. An absent, empty, misspelled or hostile `kind` must read
//   as Kana. The page does `shelvesByKind.get(kind)!` — a bare string that
//   type-checks as a Kind throws on the shelf lookup, which is a blank screen
//   on a reference page because someone typo'd a URL.

import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { KANA_SUBJECT } from "@/data/characters";
import { GRAMMAR_SUBJECT } from "@/data/grammar";
import { KANJI_SUBJECT } from "@/data/kanji";
import { VOCAB_SUBJECT } from "@/data/vocab";
import { KINDS } from "@/lib/library/entries";
import {
  DEFAULT_KIND,
  kindFromParams,
  libraryUrl,
  queryFromParams,
} from "@/lib/library/url-state";

/** A URL, as the page sees it. `useSearchParams()` hands back a read-only
 * URLSearchParams, so building a real one is the honest fixture. */
const params = (search: string) => new URLSearchParams(search);

describe("kindFromParams", () => {
  test("selects the tab the breadcrumb asks for", () => {
    // The link the entry page has always generated, for each kind it can be on.
    assert.equal(kindFromParams(params("?kind=kanji")), KANJI_SUBJECT);
    assert.equal(kindFromParams(params("?kind=word")), VOCAB_SUBJECT);
    assert.equal(kindFromParams(params("?kind=grammar")), GRAMMAR_SUBJECT);
    assert.equal(kindFromParams(params("?kind=kana")), KANA_SUBJECT);
  });

  test("every kind the chips render round-trips through a URL", () => {
    // Pinned as a loop over KINDS rather than a list, so a fifth subject cannot
    // be added to the shelf chips and silently be unreachable by link.
    for (const k of KINDS) {
      const url = libraryUrl({ kind: k, query: "" });
      const search = url.includes("?") ? url.slice(url.indexOf("?")) : "";
      assert.equal(kindFromParams(params(search)), k, `round-trip ${k}`);
    }
  });

  test("an absent, empty or unknown kind falls back to kana", () => {
    assert.equal(kindFromParams(params("")), DEFAULT_KIND);
    assert.equal(kindFromParams(params("?q=shi")), DEFAULT_KIND);
    assert.equal(kindFromParams(params("?kind=")), DEFAULT_KIND);
    assert.equal(kindFromParams(params("?kind=banana")), DEFAULT_KIND);
    assert.equal(kindFromParams(params("?kind=KANJI")), DEFAULT_KIND);
    assert.equal(kindFromParams(params("?kind=__proto__")), DEFAULT_KIND);
    assert.equal(kindFromParams(params("?kind=toString")), DEFAULT_KIND);
    assert.equal(DEFAULT_KIND, KANA_SUBJECT);
  });

  test("a fallback is a fallback, not a throw", () => {
    // The point of the default: a garbage URL renders a Library, not an error.
    assert.doesNotThrow(() => kindFromParams(params("?kind=%%%")));
    assert.ok(KINDS.includes(kindFromParams(params("?kind=nonsense"))));
  });
});

describe("queryFromParams", () => {
  test("reads the box out of the URL", () => {
    assert.equal(queryFromParams(params("?q=shi")), "shi");
    assert.equal(queryFromParams(params("?kind=kanji&q=telephone")), "telephone");
  });

  test("survives the characters this app is actually searched with", () => {
    const p = new URLSearchParams();
    p.set("q", "せんせい");
    assert.equal(queryFromParams(p), "せんせい");
  });

  test("an absent query is empty, never null", () => {
    assert.equal(queryFromParams(params("")), "");
    assert.equal(queryFromParams(params("?kind=kanji")), "");
  });
});

describe("libraryUrl", () => {
  test("the default state stays a plain /library", () => {
    // So mounting the page cannot rewrite the address bar to something the user
    // never asked for, and Back is never spent undoing our own tidying.
    assert.equal(libraryUrl({ kind: KANA_SUBJECT, query: "" }), "/library");
  });

  test("carries whichever halves are not default", () => {
    assert.equal(libraryUrl({ kind: KANJI_SUBJECT, query: "" }), "/library?kind=kanji");
    assert.equal(libraryUrl({ kind: KANA_SUBJECT, query: "shi" }), "/library?q=shi");
  });

  test("a kind and a query survive together", () => {
    const url = libraryUrl({ kind: VOCAB_SUBJECT, query: "raw" });
    const search = url.slice(url.indexOf("?"));
    assert.equal(kindFromParams(params(search)), VOCAB_SUBJECT);
    assert.equal(queryFromParams(params(search)), "raw");
  });

  test("encodes a query rather than pasting it into the URL", () => {
    const url = libraryUrl({ kind: KANA_SUBJECT, query: "a&kind=kanji" });
    // A query that spells a param must not become one.
    const search = url.slice(url.indexOf("?"));
    assert.equal(kindFromParams(params(search)), KANA_SUBJECT);
    assert.equal(queryFromParams(params(search)), "a&kind=kanji");
  });
});
