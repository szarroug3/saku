import assert from "node:assert/strict";
import test from "node:test";

import { kanaEntry } from "@/data/characters";
import { kanjiEntry } from "@/data/kanji";
import { wordEntry } from "@/data/vocab";
import { radicalEntry } from "@/data/radicals";
import { markEntry } from "@/data/marks";
import { patternEntry } from "@/data/grammar";
import { VERB_PAIRS } from "@/data/transitivity";
import { pairEntry } from "@/data/transitivity-facts";
import { LIB_ENTRIES } from "@/lib/library/entries";
import { entryFromParam, entryFromSlug, entryHref } from "@/lib/library/href";

/** The two path segments of an entry's href — what the route receives. */
function segments(href: string): [string, string] {
  const parts = href.split("/");
  assert.equal(parts.length, 4, `not a two-segment library path: ${href}`);
  return [parts[2], parts[3]];
}

test("each kind gets the URL shape it was designed for", () => {
  assert.equal(entryHref(kanaEntry("あ")), "/library/hiragana/a");
  assert.equal(entryHref(kanaEntry("ア")), "/library/katakana/a");
  assert.equal(entryHref(kanaEntry("きゃ")), "/library/hiragana/kya");
  assert.equal(entryHref(kanjiEntry("生")), "/library/kanji/生");
  assert.equal(entryHref(wordEntry("明白")), "/library/word/明白");
  assert.equal(entryHref(radicalEntry("一")), "/library/radical/一");
  assert.equal(entryHref(patternEntry("te-request")), "/library/grammar/te-request");
  assert.equal(entryHref(markEntry("dakuten")), "/library/writing-rule/dakuten");
});

test("a verb pair is its two verbs, with the slash that cannot survive a path", () => {
  const pair = VERB_PAIRS.find((p) => p.happens.word === "開く");
  assert.ok(pair, "expected the 開く/開ける pair in the data");
  assert.equal(entryHref(pairEntry(pair)), "/library/transitivity/開く-開ける");
});

// The 10 kana whose first romaji is taken by another kana in the same script.
// ASSERTED AS AN OUTCOME, not as a rule: the resolution falls out of "first
// spelling not already claimed, in table order", which works only because the
// sa-row precedes the ta-row. If someone reorders the table, this breaks here
// rather than silently handing ぢ the slug ji and じ the slug ji-2.
test("the colliding kana pairs each fall through to their own alternate", () => {
  for (const [glyph, want] of [
    ["じ", "ji"],
    ["ぢ", "di"],
    ["ず", "zu"],
    ["づ", "du"],
    ["じゃ", "ja"],
    ["ぢゃ", "dya"],
    ["じゅ", "ju"],
    ["ぢゅ", "dyu"],
    ["じょ", "jo"],
    ["ぢょ", "dyo"],
  ] as const) {
    assert.equal(entryHref(kanaEntry(glyph)), `/library/hiragana/${want}`);
  }
});

test("every entry in the Library round-trips through its own URL", () => {
  assert.ok(LIB_ENTRIES.length > 15000, "expected the full Library");
  for (const entry of LIB_ENTRIES) {
    const [kind, slug] = segments(entryHref(entry.id));
    assert.equal(entryFromSlug(kind, slug), entry.id, `clicked: ${entry.id}`);
    // The same URL as a browser puts it on the wire — a pasted bookmark.
    assert.equal(
      entryFromSlug(encodeURIComponent(kind), encodeURIComponent(slug)),
      entry.id,
      `pasted: ${entry.id}`,
    );
  }
});

test("no entry's URL needs a numeric disambiguating suffix", () => {
  const suffixed = LIB_ENTRIES.filter((e) => /-\d+$/.test(segments(entryHref(e.id))[1]));
  assert.deepEqual(suffixed.map((e) => e.id), []);
});

test("every kind is indexed — no entry falls back to the legacy one-segment URL", () => {
  const kinds = new Set<string>();
  for (const entry of LIB_ENTRIES) {
    const href = entryHref(entry.id);
    assert.ok(!href.includes("%"), `not readable: ${href}`);
    kinds.add(segments(href)[0]);
  }
  assert.deepEqual(
    [...kinds].sort(),
    // "counter" is the numbers-and-counters shelf — its own kind segment even
    // though the facts under it are `word` (see COUNTER_KIND in entries.ts).
    // "keigo" is the politeness shelf, a real subject of its own. "term" is the
    // glossary shelf (JLPT, kana, romaji, ...) — see TERM_KIND.
    ["counter", "grammar", "hiragana", "kanji", "katakana", "keigo", "radical", "term", "transitivity", "word", "writing-rule"],
  );
});

test("legacy one-segment params still decode to entry ids", () => {
  const id = kanjiEntry("生");
  assert.equal(entryFromParam(encodeURIComponent(id)), id);
});

test("a slug that names nothing comes back null rather than throwing", () => {
  assert.equal(entryFromSlug("kanji", "nope"), null);
  assert.equal(entryFromSlug("nonsense", "生"), null);
  // A malformed escape is what a URL bar can produce; it must read as a miss.
  assert.equal(entryFromSlug("kanji", "%E0%A4%A"), null);
  // The old id-shaped slug is NOT a kind/slug URL — that route is [entry].
  assert.equal(entryFromSlug("kanji", "kanji:生"), null);
});
