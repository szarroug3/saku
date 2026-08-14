// BUILD THE LIBRARY LIST/SEARCH INDEX — src/data/generated/library-index.json.
//
// WHY. `/library`'s list/search/shelf-grouping path pulls the ~9.5MB curriculum
// dictionary because `library/entries.ts`'s `LIB_ENTRIES = build()` is an EAGER
// top-level constant: importing anything from that file — even just `KINDS`,
// even just the `LibEntry` type's runtime sibling `libEntry()` — evaluates the
// whole build, which touches every content module (vocab, kanji, radicals,
// grammar, marks, terms, transitivity…). This script runs that SAME build once,
// at build time, and serializes its OUTPUT (plus two small derived lookups) —
// never re-deriving. `library/entries.ts` itself is NOT changed: entry DETAIL
// pages keep reading it live, exactly as before. Only the list/search/shelf path
// switches to this precomputed index.
//
// BYTE-CORRECTNESS. `knownFacts`/`factEntry` gate what a learner can claim as
// "already known" and how a claimed fact maps back to its entry — the same class
// of stable-id correctness Phase 1's learn-index protects. Serialize the real
// `knownFactsOf`/`entryOf`, never re-derive.
//
// Run with the test harness's loader so Node resolves `@/` and extensionless
// imports:
//   node --import ./src/lib/conjugate/test-hooks.mjs scripts/build-library-index.mjs

import { createHash } from "node:crypto";
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { LIB_ENTRIES, KINDS, KIND_LABEL, knownFactsOf } from "@/lib/library/entries";
import { ALL_FACTS, ALL_ENTRIES, entryOf, factsOf } from "@/lib/facts";
import { SENTENCE_ORDERING_TIERS } from "@/data/assembly";
import { GRAMMAR_CONCEPTS } from "@/data/grammar-concepts";
import { FORM_LABEL } from "@/lib/grammar/formula";
import { GRAMMAR_TEACHING_ORDER } from "@/lib/library/grammar-order";
import { KANJI, kanjiTeachOrder } from "@/data/kanji";

const entries = LIB_ENTRIES.map((e) => ({
  id: e.id,
  kind: e.kind,
  glyph: e.glyph,
  ...(e.name !== undefined ? { name: e.name } : {}),
  readings: [...e.readings],
  meanings: [...e.meanings],
  ...(e.searchAlso !== undefined ? { searchAlso: [...e.searchAlso] } : {}),
  sub: e.sub,
  weight: e.weight,
}));

const knownFacts = {};
for (const e of LIB_ENTRIES) {
  const facts = knownFactsOf(e);
  if (facts.length) knownFacts[e.id] = [...facts];
}

const factEntry = {};
for (const f of ALL_FACTS) factEntry[f] = entryOf(f);

const entryFacts = {};
for (const e of ALL_ENTRIES) {
  const fs = factsOf(e);
  if (fs.length) entryFacts[e] = [...fs];
}

const sentenceTiers = SENTENCE_ORDERING_TIERS.map((t) => ({
  id: t.id,
  label: t.label,
}));

// Grammar-concept slugs — data/grammar-concepts.ts pulls grammar/lessons.ts
// (auto-generated teach pages, needing vocab.ts) for its `cards` field; href.ts
// only needs the stable `id` slug, which is content-free.
const grammarConceptIds = GRAMMAR_CONCEPTS.map((c) => c.id);

const formLabel = { ...FORM_LABEL };

// The grammar teaching-order recipe ids — grammar-order.ts's own
// CURRICULUM_LESSONS dependency builds full lesson CONTENT (auto-generated
// teach pages via auto-page.ts, needing vocab.ts); grammar-shelf.ts's
// grammarRank only needs the resulting ORDER, so that (and only that) is
// serialized here. grammar-order.ts itself is untouched — read live where it's
// already reached without the dictionary.
const grammarTeachingOrderIds = GRAMMAR_TEACHING_ORDER.map((r) => r.id);

const kinds = [...KINDS];
const kindLabel = { ...KIND_LABEL };

// Every glyph with a KANJIDIC2 row — existence only, for entryForGlyph's
// KANJI_SUBJECT case (`kanjiRow(glyph) ? kanjiEntry(glyph) : null`).
// `kanjiEntry` is a pure id builder (entryId(KANJI_SUBJECT, c)), reproduced
// content-free in the loader; only the existence CHECK needs data.ts:kanji's own
// `KANJI` table, and importing kanji.ts's `kanjiRow` at all pulls its top-level
// vocab.ts import (used by its separate reading-attestation logic) in for free.
const kanjiGlyphs = KANJI.map((k) => k.c);

// Structural, per-kanji fields the Library's kanji shelf needs (grade, and the
// three fixed teach orders — "already sequenced, expensively; read it, never
// re-derive it" per kanji.ts's own kanjiTeachOrder doc) — never a gloss.
const kanjiGrade = {};
for (const k of KANJI) kanjiGrade[k.c] = k.grade;
const kanjiTeachOrders = {
  everyday: [...kanjiTeachOrder("everyday")],
  grade: [...kanjiTeachOrder("grade")],
  newspaper: [...kanjiTeachOrder("newspaper")],
};

const payload = {
  kinds,
  kindLabel,
  entries,
  knownFacts,
  factEntry,
  entryFacts,
  sentenceTiers,
  kanjiGlyphs,
  kanjiGrade,
  kanjiTeachOrders,
  grammarConceptIds,
  formLabel,
  grammarTeachingOrderIds,
};
const libraryIndexVersion = createHash("sha256")
  .update(JSON.stringify(payload))
  .digest("hex")
  .slice(0, 16);

const index = { libraryIndexVersion, ...payload };

const outPath = fileURLToPath(
  new URL("../src/data/generated/library-index.json", import.meta.url),
);
writeFileSync(outPath, JSON.stringify(index) + "\n");

console.log(
  `library-index.json written: ${entries.length} entries, ` +
    `${Object.keys(knownFacts).length} known-fact entries, ` +
    `${Object.keys(factEntry).length} fact-entry mappings, ` +
    `${Object.keys(entryFacts).length} entry-facts mappings, ` +
    `${sentenceTiers.length} sentence tiers, version ${libraryIndexVersion}`,
);
