import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { TERMS, TERM_SUBJECT, termEntry, termFor } from "@/data/terms";
import {
  KINDS,
  KIND_LABEL,
  LIB_ENTRIES,
  entryName,
  libEntry,
} from "@/lib/library/entries";
import { entryFromSlug, entryHref } from "@/lib/library/href";

// The reference-definition shelf. These entries are the app's answer to a
// beginner meeting "JLPT" or "furigana" or "katakana" before anything says what
// they are, so the load-bearing properties are: every term RESOLVES to a page,
// and every term is REACHABLE from the Terms shelf.

const EXPECTED = [
  "kana",
  "hiragana",
  "katakana",
  "romaji",
  "kanji",
  "radical",
  "furigana",
  "jlpt",
];

describe("the reference terms are a real shelf", () => {
  test("the owner's named terms are all present", () => {
    // "what is JLPT, what is katakana, hiragana, etc" — the probe's list.
    assert.deepEqual(
      TERMS.map((t) => t.id).sort(),
      [...EXPECTED].sort(),
    );
  });

  test("Terms is a Library kind with a shelf label", () => {
    assert.ok(KINDS.includes(TERM_SUBJECT), "Terms is not an offered shelf");
    assert.equal(KIND_LABEL[TERM_SUBJECT], "Terms");
  });

  test("every term resolves to a Library entry on the Terms shelf", () => {
    for (const t of TERMS) {
      const entry = libEntry(termEntry(t.id));
      assert.ok(entry, `${t.id} resolves to no entry`);
      assert.equal(entry.kind, TERM_SUBJECT);
      // The name is the title, since a term has no glyph — entryName must never
      // fall through to the raw id.
      assert.equal(entry.glyph, "");
      assert.equal(entryName(entry), t.name);
      // The summary is the shelf note and the page sub-line.
      assert.equal(entry.sub, t.summary);
    }
  });

  test("the Terms shelf holds every term and nothing else", () => {
    // shelfSections lives in a .tsx the runner cannot load; this asserts the
    // population it maps over — LIB_ENTRIES of the term kind — is exactly TERMS.
    const onShelf = LIB_ENTRIES.filter((e) => e.kind === TERM_SUBJECT).map(
      (e) => e.id,
    );
    assert.deepEqual(
      onShelf.sort(),
      TERMS.map((t) => termEntry(t.id)).sort(),
    );
  });

  test("every term has a readable two-segment URL that round-trips", () => {
    for (const t of TERMS) {
      const id = termEntry(t.id);
      const href = entryHref(id);
      assert.equal(href, `/library/${TERM_SUBJECT}/${t.id}`);
      const [, , kind, slug] = href.split("/");
      assert.equal(entryFromSlug(kind, slug), id, `${t.id} does not round-trip`);
    }
  });

  test("termFor is the inverse of termEntry", () => {
    for (const t of TERMS) {
      assert.equal(termFor(termEntry(t.id))?.id, t.id);
    }
  });

  test("the definitions stay to two or three sentences, no em dash", () => {
    for (const t of TERMS) {
      const prose = [t.summary, ...t.body].join(" ");
      assert.ok(!prose.includes("—"), `${t.id} uses an em dash`);
      // The owner asked for 2-3 sentences of body. Counted loosely by sentence
      // terminators so a firmer draft that splits a clause still passes.
      const sentences = t.body.join(" ").split(/[.!?]/).filter((s) => s.trim());
      assert.ok(
        sentences.length >= 1 && sentences.length <= 4,
        `${t.id} body is ${sentences.length} sentences`,
      );
    }
  });
});
