import assert from "node:assert/strict";
import test from "node:test";

import { kanaEntry } from "@/data/characters";
import { kanjiEntry } from "@/data/kanji";
import { entryFromParam, entryFromSlug, entryHref } from "@/lib/library/href";

test("kana entries use romaji slugs with script in the path", () => {
  const id = kanaEntry("る");
  assert.equal(entryHref(id), "/library/kana/hiragana-ru");
  assert.equal(entryFromSlug("kana", "hiragana-ru"), id);
});

test("non-kana entries keep a reversible encoded slug", () => {
  const id = kanjiEntry("生");
  const href = entryHref(id);
  assert.ok(href.startsWith("/library/kanji/"));
  const slug = href.slice("/library/kanji/".length);
  assert.equal(entryFromSlug("kanji", slug), id);
});

test("legacy one-segment params still decode to entry ids", () => {
  const id = kanjiEntry("生");
  assert.equal(entryFromParam(encodeURIComponent(id)), id);
});
