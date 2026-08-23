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
//   must read as "nothing checked" — the SAK-167 default — never throw, and
//   never be mistaken for the dropdown's own "every box checked" state
//   (`all`).
//
//   THE ALL CASE. Checking every box in a dropdown is a real, distinct state
//   from never having touched it — `all` is the token that means "everything
//   explicitly checked", kept apart from a missing param ("nothing checked",
//   which shows the same entries but is not the same URL state). The old
//   `none` token ("everything explicitly unchecked") is still ACCEPTED for a
//   pre-SAK-167 link, but reads identically to a missing param now — there is
//   no longer a distinct "explicitly nothing checked" state to preserve.

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
  isNoKindFilter,
  isNoStateFilter,
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

  test("missing or empty is no kind checked — the SAK-167 default", () => {
    assert.ok(isNoKindFilter(kindsFromParams(params(""))));
    assert.ok(isNoKindFilter(kindsFromParams(params("?q=shi"))));
    assert.ok(isNoKindFilter(kindsFromParams(params("?kind="))));
  });

  test("the literal `all` token is every kind explicitly checked", () => {
    const got = kindsFromParams(params("?kind=all"));
    assert.equal(got.size, KINDS.length);
    assert.ok(!isNoKindFilter(got));
    for (const k of KINDS) assert.ok(got.has(k));
  });

  test("`none` (the old Clear token) reads the same as a missing param, for back-compat", () => {
    const got = kindsFromParams(params("?kind=none"));
    assert.ok(isNoKindFilter(got));
    assert.equal(got.size, 0);
  });

  test("garbage that leaves nothing real falls back to no kind checked, same as absent", () => {
    // Pre-SAK-167 this fell back to "every kind checked"; now the default
    // itself is the empty/no-filter state, so garbage lands on the same
    // fallback a missing or `none` param does — it still shows the whole
    // Library, just via the unchecked state rather than an all-checked one.
    assert.ok(isNoKindFilter(kindsFromParams(params("?kind=banana"))));
    assert.ok(isNoKindFilter(kindsFromParams(params("?kind=,,"))));
    assert.ok(isNoKindFilter(kindsFromParams(params("?kind=__proto__"))));
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
  test("the default (nothing checked) state stays a plain /library", () => {
    // So mounting the page cannot rewrite the address bar to something the user
    // never asked for, and Back is never spent undoing our own tidying.
    // SAK-167: nothing checked IS the default now, so an explicit empty set
    // and an omitted one write the same plain URL.
    assert.equal(libraryUrl({ kinds: new Set(), query: "" }), "/library");
    assert.equal(libraryUrl({ query: "" }), "/library");
  });

  test("every kind explicitly checked writes the `all` token, not the default", () => {
    // SAK-167 flipped which end is the default: fully checked used to be
    // omitted, now it is the state that has to be spelled out so a "select
    // all" link keeps reading as checked rather than collapsing into the
    // (now different) unchecked default.
    assert.equal(libraryUrl({ kinds: ALL_KINDS, query: "" }), "/library?kind=all");
  });

  test("carries whichever halves are not default", () => {
    assert.equal(
      libraryUrl({ kinds: new Set([KANJI_SUBJECT]), query: "" }),
      "/library?kind=kanji",
    );
    assert.equal(libraryUrl({ kinds: new Set(), query: "shi" }), "/library?q=shi");
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

  test("every kind unchecked (the default) is an omitted param, not the old `none` token", () => {
    // SAK-167: the empty set no longer needs its own token to round-trip —
    // it IS what an absent param already means now, so `libraryUrl` never
    // has a reason to write `none` any more.
    assert.equal(libraryUrl({ kinds: new Set(), query: "" }), "/library");
  });

  test("the no-status default is omitted, a real narrowing is carried", () => {
    assert.equal(
      libraryUrl({ kinds: new Set(), query: "", states: new Set() }),
      "/library",
    );
    assert.equal(
      libraryUrl({ kinds: new Set(), query: "", states: new Set(["known"]) }),
      "/library?state=known",
    );
    assert.equal(
      libraryUrl({ kinds: new Set(), query: "", states: new Set(["unknown"]) }),
      "/library?state=unknown",
    );
  });

  test("every status explicitly checked writes the `all` token, not the default", () => {
    assert.equal(
      libraryUrl({ kinds: new Set(), query: "", states: ALL_STATES }),
      "/library?state=all",
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

  test("an absent or empty value is no status checked — the SAK-167 default", () => {
    assert.ok(isNoStateFilter(statesFromParams(params(""))));
    assert.ok(isNoStateFilter(statesFromParams(params("?kind=kanji"))));
    assert.ok(isNoStateFilter(statesFromParams(params("?state="))));
  });

  test("the literal `all` value is every status explicitly checked", () => {
    const got = statesFromParams(params("?state=all"));
    assert.equal(got.size, ALL_STATES.size);
    assert.ok(!isNoStateFilter(got));
  });

  test("`none` (the old Clear token) reads the same as a missing param, for back-compat", () => {
    const got = statesFromParams(params("?state=none"));
    assert.ok(isNoStateFilter(got));
    assert.equal(got.size, 0);
  });

  test("a hostile or all-unrecognised value falls back to no status checked, same as absent", () => {
    assert.ok(isNoStateFilter(statesFromParams(params("?state=KNOWN"))));
    assert.ok(isNoStateFilter(statesFromParams(params("?state=banana"))));
    assert.ok(isNoStateFilter(statesFromParams(params("?state=__proto__"))));
  });

  test("a fallback is a fallback, not a throw", () => {
    assert.doesNotThrow(() => statesFromParams(params("?state=%%%")));
    assert.doesNotThrow(() => kindsFromParams(params("?kind=%%%")));
  });
});
