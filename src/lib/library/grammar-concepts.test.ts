import assert from "node:assert/strict";
import { describe, test } from "node:test";

import {
  GRAMMAR_CONCEPTS,
  GRAMMAR_CONCEPT_SUBJECT,
  grammarConceptEntry,
  grammarConceptFor,
  grammarConceptRow,
} from "@/data/grammar-concepts";
import { VERB_TYPES_CONCEPT_PAGES } from "@/data/grammar/lessons";
import { RECIPES } from "@/data/grammar/recipes";
import {
  conjugatesVerb,
  hostsAdjective,
  isTeFormRecipe,
  patternEntry,
} from "@/data/grammar";
import { KEIGO_SETS, keigoSetEntry } from "@/data/keigo";
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
// patterns. One today — the て-form. The load-bearing properties are
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

  test("there is no te-form concept — the form recipe carries its own teaching", () => {
    // The て-form's Library page is the te-sequence form recipe's own entry now, so
    // the standalone concept was removed. Its id must resolve to nothing.
    assert.equal(grammarConceptRow("te-form"), undefined);
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
      const cardProse = c.cards
        .flatMap((card) => [
          card.title,
          ...card.body.flatMap((p) => [p.lead ?? "", p.text]),
        ])
        .join(" ");
      const prose = [
        c.name,
        c.summary,
        ...c.body,
        ...(c.searchAlso ?? []),
        cardProse,
      ].join(" ");
      assert.ok(!prose.includes("—"), `${c.id} uses an em dash`);
    }
  });
});

describe("a concept points at the lesson's own prose, so the two cannot drift", () => {
  test("the verb-classes concept renders the lesson's own Verb Types page", () => {
    const vc = GRAMMAR_CONCEPTS.find((c) => c.id === "verb-classes");
    assert.ok(vc, "no verb-classes concept");
    // verb-classes REUSES the lesson's exported Verb Types page — same object, so a
    // copy edit to lesson 1 lands here too. That drift guarantee applies only to a
    // concept that points at a lesson; the authored concepts below own their prose
    // outright (one copy, in grammar-concepts.ts, nothing to drift from).
    assert.deepEqual(vc.cards, VERB_TYPES_CONCEPT_PAGES);
    assert.ok(vc.cards.length >= 1, "the concept teaches no pages");
    for (const card of vc.cards) {
      assert.ok(
        VERB_TYPES_CONCEPT_PAGES.includes(card),
        `verb-classes names ${card.id}, which is not a lesson page it may reuse`,
      );
    }
  });

  test("every concept has real, titled, non-empty teaching pages", () => {
    for (const c of GRAMMAR_CONCEPTS) {
      assert.ok(c.cards.length >= 1, `${c.id} teaches no pages`);
      const ids = new Set<string>();
      for (const card of c.cards) {
        assert.ok(card.title.trim().length > 0, `${card.id} has no title`);
        assert.ok(card.body.length > 0, `${card.id} has no body`);
        assert.ok(!ids.has(card.id), `${c.id} repeats card id ${card.id}`);
        ids.add(card.id);
      }
    }
  });

});

describe("the 〜て family is detected as te-form recipes", () => {
  // isTeFormRecipe drives which patterns hang off the て-form (their build card
  // links "Build the て-form" to the form's own entry). This asserts the predicate:
  // te-sequence is in, a non-て pattern is out.
  test("te-sequence is a te-form recipe", () => {
    const te = RECIPES.find((r) => r.id === "te-sequence");
    assert.ok(te, "te-sequence recipe is missing");
    assert.ok(isTeFormRecipe(te), "te-sequence is not detected as a te-form recipe");
    // And its Library entry exists to carry the teaching.
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
});

describe("the three new concepts resolve and carry a readable slug", () => {
  const NEW = ["verb-classes", "adjective-types", "keigo-registers"] as const;

  test("each resolves id -> entry -> content", () => {
    for (const id of NEW) {
      const entry = libEntry(grammarConceptEntry(id));
      assert.ok(entry, `${id} resolves to no entry`);
      assert.equal(entryName(entry), entry.name);
      assert.ok(GRAMMAR_CONCEPTS.some((c) => c.id === id), `${id} is not a concept`);
    }
  });

  test("each has a stable, round-tripping URL", () => {
    for (const id of NEW) {
      const href = entryHref(grammarConceptEntry(id));
      assert.equal(href, `/library/grammar-concept/${id}`);
      const [, , kind, slug] = href.split("/");
      assert.equal(entryFromSlug(kind, slug), grammarConceptEntry(id));
    }
  });
});

describe("the verb-conjugating grammar entries link to う-verbs and る-verbs", () => {
  // The page shows a "Read about it → う-verbs and る-verbs" row for every pattern
  // that CONJUGATES a verb (conjugatesVerb). This asserts the predicate the page
  // branches on: a te/nai/stem pattern is in, a bare-dictionary or noun pattern is
  // out.
  test("the concept exists at the id the link points to", () => {
    const entry = libEntry(grammarConceptEntry("verb-classes"));
    assert.ok(entry);
    assert.equal(entry.name, "う-verbs and る-verbs");
  });

  test("a verb-form pattern is detected, and a non-conjugating one is not", () => {
    const family = RECIPES.filter((r) => conjugatesVerb(r)).map((r) => r.id);
    assert.ok(family.includes("te-sequence"), "te-sequence should conjugate a verb");
    assert.ok(family.length >= 10, "the verb-form family looks too small");
    // Sanity: the whole te-form family conjugates a verb, so verb-classes reaches
    // at least everywhere the te-form concept does.
    for (const r of RECIPES.filter((x) => isTeFormRecipe(x))) {
      assert.ok(conjugatesVerb(r), `${r.id} is a te recipe but not verb-conjugating`);
    }
    // A pattern whose verb attachment is the bare dictionary form (no class
    // needed) must not get the row.
    const bare = RECIPES.find(
      (r) => r.attach.find((a) => a.host === "verb")?.form === "dictionary",
    );
    if (bare) assert.ok(!conjugatesVerb(bare), `${bare.id} needs no verb class`);
  });
});

describe("the adjective-hosting grammar entries link to い/な-adjectives", () => {
  test("the concept exists at the id the link points to", () => {
    const entry = libEntry(grammarConceptEntry("adjective-types"));
    assert.ok(entry);
    assert.equal(entry.name, "い-adjectives and な-adjectives");
  });

  test("adjective-hosting patterns are detected, and a verb-only one is not", () => {
    const family = RECIPES.filter((r) => hostsAdjective(r)).map((r) => r.id);
    // 〜すぎる, 〜ので, 〜そう all host an adjective.
    assert.ok(family.includes("sugiru"));
    assert.ok(family.includes("node"));
    assert.ok(family.some((id) => id.startsWith("sou")));
    assert.ok(family.length >= 3, "the adjective family looks too small");
    // te-sequence hosts only a verb, so it must not get the adjective row.
    const teSeq = RECIPES.find((r) => r.id === "te-sequence")!;
    assert.ok(!hostsAdjective(teSeq), "te-sequence should not host an adjective");
  });
});

describe("the keigo entries can reach the politeness-levels concept", () => {
  test("the concept exists at the id the keigo pages point to", () => {
    const entry = libEntry(grammarConceptEntry("keigo-registers"));
    assert.ok(entry);
    assert.equal(entry.name, "Keigo: the politeness levels");
  });

  test("every keigo set has an entry to carry the link", () => {
    assert.ok(KEIGO_SETS.length > 0, "no keigo sets");
    for (const set of KEIGO_SETS) {
      assert.ok(libEntry(keigoSetEntry(set)), `${set.id} has no entry`);
    }
  });
});

describe("concept cross-links resolve", () => {
  // The て-form concept was removed, so verb-classes no longer cross-links to it;
  // there are no concept-to-concept links today. This pins that whatever `related`
  // holds always names a real, resolvable concept.
  test("every related id names a real, resolvable concept", () => {
    for (const c of GRAMMAR_CONCEPTS) {
      for (const rel of c.related ?? []) {
        assert.ok(
          GRAMMAR_CONCEPTS.some((x) => x.id === rel),
          `${c.id} points at ${rel}, which is not a concept`,
        );
        assert.ok(libEntry(grammarConceptEntry(rel)), `${rel} resolves to no entry`);
      }
    }
  });
});
