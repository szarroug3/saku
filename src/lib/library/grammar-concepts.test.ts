import assert from "node:assert/strict";
import { describe, test } from "node:test";

import {
  GRAMMAR_CONCEPTS,
  GRAMMAR_CONCEPT_SUBJECT,
  grammarConceptEntry,
  grammarConceptFor,
} from "@/data/grammar-concepts";
import { TE_FORM_CONCEPT_PAGES } from "@/data/grammar/lessons";
import { RECIPES } from "@/data/grammar/recipes";
import { isTeFormRecipe, patternEntry } from "@/data/grammar";
import {
  KINDS,
  KIND_LABEL,
  LIB_ENTRIES,
  entryName,
  factRows,
  libEntry,
} from "@/lib/library/entries";
import { entryFromSlug, entryHref } from "@/lib/library/href";

// The grammar-concept shelf: reference pages for the IDEAS behind the grammar
// patterns. One today — the て-form, in depth. The load-bearing properties are
// the same a term has (it RESOLVES to a page, has no gradeable facts, and points
// at the lesson's own prose so the two cannot drift) PLUS the one thing this
// feature exists for: the 〜て family of grammar entries LINKS to it.

describe("the grammar concept is a real, resolvable reference entry", () => {
  test("Grammar concepts is a Library kind with a shelf label", () => {
    assert.ok(
      KINDS.includes(GRAMMAR_CONCEPT_SUBJECT),
      "Grammar concepts is not an offered shelf",
    );
    assert.equal(KIND_LABEL[GRAMMAR_CONCEPT_SUBJECT], "Grammar concepts");
  });

  test("every concept resolves to a Library entry on its own shelf", () => {
    for (const c of GRAMMAR_CONCEPTS) {
      const entry = libEntry(grammarConceptEntry(c.id));
      assert.ok(entry, `${c.id} resolves to no entry`);
      assert.equal(entry.kind, GRAMMAR_CONCEPT_SUBJECT);
      // No glyph — the name is the title, and entryName must never fall through
      // to the raw id.
      assert.equal(entry.glyph, "");
      assert.equal(entryName(entry), c.name);
      // The summary is the shelf note and the page sub-line.
      assert.equal(entry.sub, c.summary);
    }
  });

  test("the て-form concept exists, at the stable id the link points to", () => {
    const entry = libEntry(grammarConceptEntry("te-form"));
    assert.ok(entry, "the te-form concept resolves to no entry");
    assert.equal(entry.name, "The て-form, in depth");
  });

  test("a concept has no gradeable facts, like a mark or a term", () => {
    for (const c of GRAMMAR_CONCEPTS) {
      const entry = libEntry(grammarConceptEntry(c.id));
      assert.ok(entry);
      assert.deepEqual(factRows(entry), []);
    }
  });

  test("grammarConceptFor is the inverse of grammarConceptEntry", () => {
    for (const c of GRAMMAR_CONCEPTS) {
      assert.equal(grammarConceptFor(grammarConceptEntry(c.id))?.id, c.id);
    }
  });

  test("every concept has a readable URL that round-trips", () => {
    for (const c of GRAMMAR_CONCEPTS) {
      const id = grammarConceptEntry(c.id);
      const href = entryHref(id);
      assert.equal(href, `/library/${GRAMMAR_CONCEPT_SUBJECT}/${c.id}`);
      const [, , kind, slug] = href.split("/");
      assert.equal(entryFromSlug(kind, slug), id, `${c.id} does not round-trip`);
    }
  });

  test("the shelf holds every concept and nothing else", () => {
    const onShelf = LIB_ENTRIES.filter(
      (e) => e.kind === GRAMMAR_CONCEPT_SUBJECT,
    ).map((e) => e.id);
    assert.deepEqual(
      onShelf.sort(),
      GRAMMAR_CONCEPTS.map((c) => grammarConceptEntry(c.id)).sort(),
    );
  });

  test("no learner-facing copy uses an em dash (Sam's rule)", () => {
    for (const c of GRAMMAR_CONCEPTS) {
      const prose = [c.name, c.summary, ...c.body, ...(c.searchAlso ?? [])].join(" ");
      assert.ok(!prose.includes("—"), `${c.id} uses an em dash`);
    }
  });
});

describe("a concept points at the lesson's own prose, so the two cannot drift", () => {
  /** The lesson's own concept pages, by identity — a concept may point only at
   * these, never a hand-built copy. Today only the te-form lesson exports any. */
  const SHIPPED = new Set(TE_FORM_CONCEPT_PAGES);

  test("the te-form concept renders the lesson's own conceptual pages", () => {
    const te = GRAMMAR_CONCEPTS.find((c) => c.id === "te-form");
    assert.ok(te, "no te-form concept");
    // The exact pages the lesson exports — same objects, so a copy edit to the
    // lesson lands here too.
    assert.deepEqual(te.cards, TE_FORM_CONCEPT_PAGES);
    assert.ok(te.cards.length >= 2, "the concept teaches fewer than two pages");
  });

  test("every card a concept names is a card the app ships", () => {
    for (const c of GRAMMAR_CONCEPTS) {
      for (const card of c.cards) {
        assert.ok(
          SHIPPED.has(card),
          `${c.id} names ${card.id}, which is not a card the app ships`,
        );
        assert.ok(card.title.trim().length > 0, `${card.id} has no title`);
      }
    }
  });

  test("the concept covers what a form is, and the connector idea", () => {
    // A light content check that the two source pages are the conceptual ones,
    // not a build table: the intro teaches "form", the use page teaches
    // connecting and the last verb carrying the tense.
    const te = GRAMMAR_CONCEPTS.find((c) => c.id === "te-form");
    assert.ok(te);
    const prose = te.cards
      .flatMap((card) => card.body.map((p) => `${p.lead ?? ""} ${p.text}`))
      .join(" ");
    assert.match(prose, /form/i);
    assert.match(prose, /connect|link/i);
    assert.match(prose, /last verb/i);
  });
});

describe("the te-family grammar entries link to the concept", () => {
  // The page's Links card shows a "Read about it → The て-form, in depth" row for
  // exactly the verb-form-て patterns (isTeFormRecipe). This asserts the predicate
  // the page branches on: te-sequence is in, a non-て pattern is out.
  test("te-sequence is a te-form recipe, so it gets the link", () => {
    const te = RECIPES.find((r) => r.id === "te-sequence");
    assert.ok(te, "te-sequence recipe is missing");
    assert.ok(isTeFormRecipe(te), "te-sequence is not detected as a te-form recipe");
    // And its Library entry exists to carry the link.
    assert.ok(libEntry(patternEntry("te-sequence")), "te-sequence has no entry");
  });

  test("the whole 〜て family is detected, and only verb-form-て patterns", () => {
    const teFamily = RECIPES.filter((r) => isTeFormRecipe(r)).map((r) => r.id);
    // te-sequence, te-cause, te-request and the rest of the verb 〜て patterns.
    assert.ok(teFamily.includes("te-sequence"));
    assert.ok(teFamily.includes("te-cause"));
    assert.ok(teFamily.length >= 3, "the te family looks too small");
    // A pattern with no verb て attachment must not get the row: た-form /
    // conditional patterns share the 音便 but are not the て-form.
    const taForm = RECIPES.find((r) => r.id === "ta-form" || r.id === "ta-past");
    if (taForm) assert.ok(!isTeFormRecipe(taForm), "a た pattern was mistaken for て");
  });

  test("the link target is the concept's stable href", () => {
    // The exact href the page builds for the row — a broken target here is a
    // dead link that type-checks.
    assert.equal(
      entryHref(grammarConceptEntry("te-form")),
      "/library/grammar-concept/te-form",
    );
  });
});
