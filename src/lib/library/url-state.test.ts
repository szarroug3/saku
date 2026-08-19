// Run: node --import ./src/lib/conjugate/test-hooks.mjs --test \
//        src/lib/library/url-state.test.ts
//
// WHAT THESE TESTS ARE FOR
// ========================
// The Library's checked kinds, checked statuses and search box all live in the
// URL, and a URL is the one input nobody validates: the entry page writes
// `?kind=kanji` into a breadcrumb, a user pastes a link from six months ago,
// someone edits the address bar by hand. Three properties have to hold, and
// none is visible from the page.
//
//   THE BREADCRUMB CASE. `/library?kind=kanji` must actually check Kanji alone
//   — it did not, once (the page held the kind in useState and the param was
//   generated and dropped), so `kindFromParams` guards the single-kind reading
//   that regression needed, and `kindsFromParams` guards the same link under
//   the multi-select widening (SAK-63's second round): a comma-free value is
//   exactly a checked set of one.
//
//   THE STRANGER CASE. An absent, empty, misspelled or hostile `kind`/`state`
//   must read as "everything checked" — the default — never throw, and never
//   be mistaken for the dropdown's own Clear button (`none`).
//
//   THE CLEAR CASE. Checking every box off in a dropdown is a real, distinct
//   state from never having touched it — `none` is the one token that means
//   "nothing checked", kept apart from a missing param ("everything checked").

import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { KANA_SUBJECT } from "@/data/characters";
import { GRAMMAR_SUBJECT } from "@/data/grammar";
import { KANJI_SUBJECT } from "@/data/kanji";
import { VOCAB_SUBJECT } from "@/data/vocab";
import { KINDS } from "@/lib/library/entries";
import {
  ALL_KINDS,
  ALL_STATES,
  DEFAULT_KIND,
  isEveryKind,
  isEveryState,
  kindFromParams,
  kindsFromParams,
  libraryUrl,
  queryFromParams,
  statesFromParams,
} from "@/lib/library/url-state";

/** A URL, as the page sees it. `useSearchParams()` hands back a read-only
 * URLSearchParams, so building a real one is the honest fixture. */
const params = (search: string) => new URLSearchParams(search);

describe("kindFromParams", () => {
  test("selects the shelf the breadcrumb asks for", () => {
    // The link the entry page has always generated, for each kind it can be on.
    assert.equal(kindFromParams(params("?kind=kanji")), KANJI_SUBJECT);
    assert.equal(kindFromParams(params("?kind=word")), VOCAB_SUBJECT);
    assert.equal(kindFromParams(params("?kind=grammar")), GRAMMAR_SUBJECT);
    assert.equal(kindFromParams(params("?kind=kana")), KANA_SUBJECT);
  });

  test("every kind the dropdown renders round-trips through a URL", () => {
    // Pinned as a loop over KINDS rather than a list, so a fifth subject cannot
    // be added to the dropdown and silently be unreachable by link.
    for (const k of KINDS) {
      assert.equal(
        kindFromParams(params(`?kind=${k}`)),
        k,
        `round-trip ${k}`,
      );
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
});

describe("kindsFromParams — the Kind dropdown's checked set", () => {
  test("a single, comma-free value is the breadcrumb case — checks that one kind alone", () => {
    for (const k of KINDS) {
      const got = kindsFromParams(params(`?kind=${k}`));
      assert.equal(got.size, 1, `?kind=${k} should check exactly one kind`);
      assert.ok(got.has(k));
    }
  });

  test("a comma list checks exactly those kinds", () => {
    const got = kindsFromParams(params("?kind=kanji,word"));
    assert.equal(got.size, 2);
    assert.ok(got.has(KANJI_SUBJECT));
    assert.ok(got.has(VOCAB_SUBJECT));
    assert.ok(!got.has(KANA_SUBJECT));
  });

  test("an unrecognised token in an otherwise-real list is dropped, not fatal", () => {
    const got = kindsFromParams(params("?kind=kanji,banana"));
    assert.equal(got.size, 1);
    assert.ok(got.has(KANJI_SUBJECT));
  });

  test("missing, empty, or the literal `all` token is every kind checked", () => {
    assert.ok(isEveryKind(kindsFromParams(params(""))));
    assert.ok(isEveryKind(kindsFromParams(params("?q=shi"))));
    assert.ok(isEveryKind(kindsFromParams(params("?kind="))));
    assert.ok(isEveryKind(kindsFromParams(params("?kind=all"))));
  });

  test("`none` is every kind UNCHECKED — the dropdown's Clear button, not a fallback", () => {
    const got = kindsFromParams(params("?kind=none"));
    assert.equal(got.size, 0);
  });

  test("garbage that leaves nothing real falls back to every kind, not to `none`", () => {
    // A `none` round-trip is a deliberate Clear; a query the page can't read at
    // all must not be mistaken for one — it shows the whole Library instead.
    assert.ok(isEveryKind(kindsFromParams(params("?kind=banana"))));
    assert.ok(isEveryKind(kindsFromParams(params("?kind=,,"))));
    assert.ok(isEveryKind(kindsFromParams(params("?kind=__proto__"))));
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
    assert.equal(libraryUrl({ kinds: ALL_KINDS, query: "" }), "/library");
    // Omitting kinds/states entirely means the same default.
    assert.equal(libraryUrl({ query: "" }), "/library");
  });

  test("carries whichever halves are not default", () => {
    assert.equal(
      libraryUrl({ kinds: new Set([KANJI_SUBJECT]), query: "" }),
      "/library?kind=kanji",
    );
    assert.equal(libraryUrl({ kinds: ALL_KINDS, query: "shi" }), "/library?q=shi");
  });

  test("a checked kind and a query survive together", () => {
    const url = libraryUrl({ kinds: new Set([VOCAB_SUBJECT]), query: "raw" });
    const search = url.slice(url.indexOf("?"));
    const got = kindsFromParams(params(search));
    assert.equal(got.size, 1);
    assert.ok(got.has(VOCAB_SUBJECT));
    assert.equal(queryFromParams(params(search)), "raw");
  });

  test("encodes a query rather than pasting it into the URL", () => {
    const url = libraryUrl({ kinds: new Set([KANA_SUBJECT]), query: "a&kind=kanji" });
    // A query that spells a param must not become one.
    const search = url.slice(url.indexOf("?"));
    const got = kindsFromParams(params(search));
    assert.equal(got.size, 1);
    assert.ok(got.has(KANA_SUBJECT));
    assert.equal(queryFromParams(params(search)), "a&kind=kanji");
  });

  test("every kind serialises in KINDS order, not selection order", () => {
    const url = libraryUrl({
      kinds: new Set([VOCAB_SUBJECT, KANA_SUBJECT]),
      query: "",
    });
    // URLSearchParams percent-encodes the comma (`,` → `%2C`); read it back
    // through the same parser rather than asserting the raw string, so this
    // test doesn't pin an encoding detail that isn't the property under test.
    const kanaIdx = KINDS.indexOf(KANA_SUBJECT);
    const wordIdx = KINDS.indexOf(VOCAB_SUBJECT);
    const expectedOrder =
      kanaIdx < wordIdx ? [KANA_SUBJECT, VOCAB_SUBJECT] : [VOCAB_SUBJECT, KANA_SUBJECT];
    const search = url.slice(url.indexOf("?"));
    assert.equal(
      new URLSearchParams(search).get("kind"),
      expectedOrder.join(","),
    );
  });

  test("every kind unchecked writes the `none` token, not an omitted param", () => {
    assert.equal(
      libraryUrl({ kinds: new Set(), query: "" }),
      "/library?kind=none",
    );
  });

  test("the all-status default is omitted, the two narrowings are carried", () => {
    assert.equal(
      libraryUrl({ kinds: ALL_KINDS, query: "", states: ALL_STATES }),
      "/library",
    );
    assert.equal(
      libraryUrl({ kinds: ALL_KINDS, query: "", states: new Set(["known"]) }),
      "/library?state=known",
    );
    assert.equal(
      libraryUrl({ kinds: ALL_KINDS, query: "", states: new Set(["unknown"]) }),
      "/library?state=unknown",
    );
  });

  test("every status unchecked writes the `none` token, not an omitted param", () => {
    assert.equal(
      libraryUrl({ kinds: ALL_KINDS, query: "", states: new Set() }),
      "/library?state=none",
    );
  });

  test("kind, query and status all survive together", () => {
    const url = libraryUrl({
      kinds: new Set([KANJI_SUBJECT]),
      query: "life",
      states: new Set(["unknown"]),
    });
    const search = url.slice(url.indexOf("?"));
    const gotKinds = kindsFromParams(params(search));
    assert.equal(gotKinds.size, 1);
    assert.ok(gotKinds.has(KANJI_SUBJECT));
    assert.equal(queryFromParams(params(search)), "life");
    const gotStates = statesFromParams(params(search));
    assert.equal(gotStates.size, 1);
    assert.ok(gotStates.has("unknown"));
  });
});

describe("statesFromParams — the Status dropdown's checked set", () => {
  test("reads every supported status value", () => {
    for (const v of [
      "known",
      "unknown",
      "solid",
      "shaky",
      "getting-there",
      "mixup",
      "slipping",
    ] as const) {
      const got = statesFromParams(params(`?state=${v}`));
      assert.equal(got.size, 1);
      assert.ok(got.has(v));
    }
  });

  test("a comma list checks exactly those statuses", () => {
    const got = statesFromParams(params("?state=known,solid"));
    assert.equal(got.size, 2);
    assert.ok(got.has("known"));
    assert.ok(got.has("solid"));
  });

  test("an absent, empty, or literal-all value is every status checked", () => {
    assert.ok(isEveryState(statesFromParams(params(""))));
    assert.ok(isEveryState(statesFromParams(params("?kind=kanji"))));
    assert.ok(isEveryState(statesFromParams(params("?state="))));
    assert.ok(isEveryState(statesFromParams(params("?state=all"))));
  });

  test("`none` is every status UNCHECKED, not a fallback", () => {
    const got = statesFromParams(params("?state=none"));
    assert.equal(got.size, 0);
  });

  test("a hostile or all-unrecognised value falls back to every status, not to `none`", () => {
    assert.ok(isEveryState(statesFromParams(params("?state=KNOWN"))));
    assert.ok(isEveryState(statesFromParams(params("?state=banana"))));
    assert.ok(isEveryState(statesFromParams(params("?state=__proto__"))));
  });

  test("a fallback is a fallback, not a throw", () => {
    assert.doesNotThrow(() => statesFromParams(params("?state=%%%")));
    assert.doesNotThrow(() => kindsFromParams(params("?kind=%%%")));
  });
});
