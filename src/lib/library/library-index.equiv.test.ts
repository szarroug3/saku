// THE SAFETY NET for the Library list/search precompute (docs — Phase 2a).
//
// The precomputed index must be byte-identical to what the LIVE derivation in
// library/entries.ts (and facts.ts's entryOf, and assembly's tier list) would
// produce — the list/search page, "known" filtering, and the mix-up resolver all
// read through it, so a drift here would misfile entries or silently change what
// counts as "known". This test asserts equality directly, not by re-deriving.

import { test } from "node:test";
import assert from "node:assert/strict";

import { LIB_ENTRIES as LIVE_ENTRIES, KINDS as LIVE_KINDS, KIND_LABEL as LIVE_KIND_LABEL, knownFactsOf, entryForGlyph as liveEntryForGlyph, recipeOf as liveRecipeOf, recipesOf as liveRecipesOf, shelfKindOf as liveShelfKindOf, entryName as liveEntryName } from "@/lib/library/entries";
import { ALL_FACTS, ALL_ENTRIES, entryOf, factsOf as liveFactsOf } from "@/lib/facts";
import {
  claimableFacts as liveClaimableFacts,
  quizzableFacts as liveQuizzableFacts,
} from "@/lib/word-unlock";
import { wordMeaningFactId } from "@/lib/vocab-ids";
import { VOCAB, legacyUnqualifiedReading } from "@/data/vocab";
import { SENTENCE_ORDERING_TIERS } from "@/data/assembly";
import { COUNTER_KIND as LIVE_COUNTER_KIND, NUMBER_CONSTRUCTION_KIND as LIVE_NUMBER_CONSTRUCTION_KIND } from "@/lib/library/entries";
import { KANJI, KANJI_SUBJECT as LIVE_KANJI_SUBJECT, kanjiEntry as liveKanjiEntry, kanjiTeachOrder as liveKanjiTeachOrder } from "@/data/kanji";
import { CHAR_INDEX, LOOK_GROUP, kanaEntry } from "@/data/characters";
import { strokeFallbackOf as liveStrokeFallbackOf } from "@/lib/lesson-roles";
import { buildItem } from "@/lib/content/build-item";
import {
  allComponents,
  knownWordsUsing as liveKnownWordsUsing,
  usedAsPartIn as liveUsedAsPartIn,
} from "@/lib/library/components";
import { GRAMMAR_SUBJECT as LIVE_GRAMMAR_SUBJECT } from "@/data/grammar";
import { MARKS, MARK_SUBJECT as LIVE_MARK_SUBJECT, markEntry as liveMarkEntry } from "@/data/marks";
import { GRAMMAR_CONCEPTS, GRAMMAR_CONCEPT_SUBJECT as LIVE_GRAMMAR_CONCEPT_SUBJECT, grammarConceptEntry as liveGrammarConceptEntry } from "@/data/grammar-concepts";
import { FORM_LABEL as LIVE_FORM_LABEL } from "@/lib/grammar/formula";
import { GRAMMAR_TEACHING_ORDER, grammarRank as liveGrammarRank } from "@/lib/library/grammar-order";
import {
  LIB_ENTRIES,
  LIB_ENTRIES_BY_KIND,
  KINDS,
  KIND_LABEL,
  libEntry,
  knownFactsOf as precomputedKnownFactsOf,
  factEntryOf,
  factsOf,
  SENTENCE_TIERS,
  entryForGlyph,
  KANJI_SUBJECT,
  kanjiGrade,
  kanjiTeachOrder,
  GRAMMAR_CONCEPT_SUBJECT,
  grammarConceptEntry,
  GRAMMAR_CONCEPT_IDS,
  FORM_LABEL,
  grammarRank,
  kanjiEntry,
  kanaConfusables,
  precomputedStrokeFallback,
  COUNTER_KIND,
  NUMBER_CONSTRUCTION_KIND,
  GRAMMAR_SUBJECT,
  MARK_SUBJECT,
  markEntry,
  recipeOf,
  recipesOf,
  shelfKindOf,
  claimableFacts,
  quizzableFacts,
  knownWordsUsing,
  usedAsPartIn,
  entryName,
  pitchReadingCompatible,
} from "@/lib/library/library-index";
import type { HistoryFile } from "@/types";

test("KINDS matches live KINDS, in order", () => {
  assert.deepEqual(KINDS, LIVE_KINDS);
});

test("KIND_LABEL matches live KIND_LABEL", () => {
  assert.deepEqual(KIND_LABEL, LIVE_KIND_LABEL);
});

test("shelfKindOf matches live routing for every kind and number constructions", () => {
  const kinds = [...LIVE_KINDS, LIVE_NUMBER_CONSTRUCTION_KIND] as Parameters<
    typeof shelfKindOf
  >[0][];
  for (const kind of kinds) {
    assert.equal(shelfKindOf(kind), liveShelfKindOf(kind), `kind ${kind}`);
  }
});

test("LIB_ENTRIES matches live LIB_ENTRIES — same entries, same order, same fields", () => {
  assert.equal(LIB_ENTRIES.length, LIVE_ENTRIES.length);
  for (let i = 0; i < LIVE_ENTRIES.length; i++) {
    const live = LIVE_ENTRIES[i];
    const pre = LIB_ENTRIES[i];
    assert.deepEqual(
      { ...pre },
      {
        id: live.id,
        kind: live.kind,
        glyph: live.glyph,
        ...(live.name !== undefined ? { name: live.name } : {}),
        readings: [...live.readings],
        meanings: [...live.meanings],
        ...(live.searchAlso !== undefined ? { searchAlso: [...live.searchAlso] } : {}),
        sub: live.sub,
        weight: live.weight,
      },
      `entry ${i} (${live.id}) mismatch`,
    );
  }
});

test("entryName matches live labels for every entry", () => {
  for (const entry of LIB_ENTRIES) {
    assert.equal(entryName(entry), liveEntryName(entry), entry.id);
  }
});

test("pitch-reading compatibility matches the live legacy-reading guard", () => {
  for (const word of VOCAB) {
    assert.equal(
      pitchReadingCompatible(word.keb),
      word.reb === legacyUnqualifiedReading(word.keb),
      word.keb,
    );
  }
});

test("glyph-bearing aggregate entries match their live ContentItem glyph", () => {
  const kinds = new Set(["grammar", "transitivity", "keigo"]);
  for (const entry of LIB_ENTRIES.filter((candidate) => kinds.has(candidate.kind))) {
    const item = buildItem(entry.id, entry.kind as "grammar" | "transitivity" | "keigo");
    assert.ok(item, `missing ContentItem for ${entry.id}`);
    assert.equal(entry.glyph, item.glyph, `glyph mismatch for ${entry.id}`);
  }
});

test("component uses and known-word filtering match the live dictionary path", () => {
  const empty: HistoryFile = { sessions: [], facts: {}, claims: {} };
  const claimed: HistoryFile = {
    ...empty,
    claims: Object.fromEntries(
      ["先生", "学生", "学校", "単語"].map((word) => [
        wordMeaningFactId(word),
        1_700_000_000_000,
      ]),
    ) as HistoryFile["claims"],
  };
  for (const component of allComponents()) {
    assert.deepEqual(usedAsPartIn(component), liveUsedAsPartIn(component), component);
    assert.deepEqual(
      knownWordsUsing(component, claimed),
      liveKnownWordsUsing(component, claimed),
      `known words for ${component}`,
    );
  }
});

test("LIB_ENTRIES_BY_KIND buckets match live LIB_ENTRIES_BY_KIND per kind, in order", () => {
  for (const kind of LIVE_KINDS) {
    const live = LIVE_ENTRIES.filter((e) => e.kind === kind).map((e) => e.id);
    const pre = (LIB_ENTRIES_BY_KIND.get(kind) ?? []).map((e) => e.id);
    assert.deepEqual(pre, live, `kind ${kind} bucket mismatch`);
  }
});

test("libEntry(id) matches live libEntry-equivalent lookup for a sample of entries", () => {
  // Sample spread across the list rather than every entry (15k+), since the
  // whole-array test above already proves full equivalence; this exercises the
  // by-id lookup path specifically.
  const sample = [0, 1, 100, 5000, LIVE_ENTRIES.length - 1].filter(
    (i) => i < LIVE_ENTRIES.length,
  );
  for (const i of sample) {
    const live = LIVE_ENTRIES[i];
    const pre = libEntry(live.id);
    assert.ok(pre, `libEntry(${live.id}) missing from precomputed index`);
    assert.equal(pre!.glyph, live.glyph);
    assert.deepEqual([...pre!.meanings], [...live.meanings]);
  }
});

test("knownFactsOf matches live knownFactsOf for every entry", () => {
  for (const live of LIVE_ENTRIES) {
    const liveFacts = knownFactsOf(live);
    const preFacts = precomputedKnownFactsOf(live.id);
    assert.deepEqual([...preFacts], [...liveFacts], `entry ${live.id} known-facts mismatch`);
  }
});

test("factEntryOf matches live entryOf for every fact in the app", () => {
  for (const fact of ALL_FACTS) {
    assert.equal(factEntryOf(fact), entryOf(fact), `fact ${fact} entry mismatch`);
  }
});

test("factEntryOf falls back like entryOf for an id the data doesn't have", () => {
  const bogus = "kanji:not-a-real-fact" as Parameters<typeof entryOf>[0];
  assert.equal(factEntryOf(bogus), entryOf(bogus));
});

test("SENTENCE_TIERS ids/labels match live SENTENCE_ORDERING_TIERS, in order", () => {
  assert.deepEqual(
    SENTENCE_TIERS,
    SENTENCE_ORDERING_TIERS.map((t) => ({ id: t.id, label: t.label })),
  );
});

test("entryForGlyph matches live entryForGlyph for every kind, sampled across entries", () => {
  // Every kind that resolves by glyph, plus one kind that never does (control).
  const kindsToCheck = [...new Set(LIVE_ENTRIES.map((e) => e.kind))];
  for (const kind of kindsToCheck) {
    const sample = LIVE_ENTRIES.filter((e) => e.kind === kind).slice(0, 25);
    for (const e of sample) {
      assert.equal(
        entryForGlyph(kind, e.glyph),
        liveEntryForGlyph(kind, e.glyph),
        `kind ${kind} glyph ${e.glyph}`,
      );
    }
  }
});

test("entryForGlyph returns null for a glyph no kind resolves", () => {
  assert.equal(entryForGlyph("kana", "not-a-glyph"), liveEntryForGlyph("kana", "not-a-glyph"));
});

test("KANJI_SUBJECT matches live KANJI_SUBJECT", () => {
  assert.equal(KANJI_SUBJECT, LIVE_KANJI_SUBJECT);
});

test("COUNTER_KIND / NUMBER_CONSTRUCTION_KIND match live values", () => {
  assert.equal(COUNTER_KIND, LIVE_COUNTER_KIND);
  assert.equal(NUMBER_CONSTRUCTION_KIND, LIVE_NUMBER_CONSTRUCTION_KIND);
});

test("GRAMMAR_SUBJECT matches live GRAMMAR_SUBJECT", () => {
  assert.equal(GRAMMAR_SUBJECT, LIVE_GRAMMAR_SUBJECT);
});

test("factsOf matches live factsOf for every entry in the app", () => {
  for (const entry of ALL_ENTRIES) {
    assert.deepEqual(factsOf(entry), liveFactsOf(entry), `entry ${entry}`);
  }
});

test("factsOf is empty for an unknown entry", () => {
  const bogus = "kanji:not-a-real-entry" as Parameters<typeof liveFactsOf>[0];
  assert.deepEqual(factsOf(bogus), liveFactsOf(bogus));
});

test("claimableFacts matches the live reading-fact gate for every fact", () => {
  assert.deepEqual(claimableFacts(ALL_FACTS), liveClaimableFacts(ALL_FACTS));
});

test("quizzableFacts matches the live learned-word gate", () => {
  const empty: HistoryFile = { sessions: [], facts: {}, claims: {} };
  const claimedWords: HistoryFile = {
    ...empty,
    claims: Object.fromEntries(
      ["先生", "登山", "食べる"].map((word) => [wordMeaningFactId(word), 1_700_000_000_000]),
    ) as HistoryFile["claims"],
  };
  for (const history of [empty, claimedWords]) {
    assert.deepEqual(
      quizzableFacts(ALL_FACTS, history),
      liveQuizzableFacts(ALL_FACTS, history),
    );
  }
});

test("kanjiGrade matches live KANJI grade for every kanji", () => {
  for (const k of KANJI) {
    assert.equal(kanjiGrade(k.c), k.grade, `kanji ${k.c}`);
  }
});

test("kanjiTeachOrder matches live kanjiTeachOrder for every mode", () => {
  const modes = ["everyday", "grade", "newspaper"] as const;
  for (const mode of modes) {
    assert.deepEqual(
      kanjiTeachOrder(mode),
      liveKanjiTeachOrder(mode),
      `mode ${mode}`,
    );
  }
});

test("GRAMMAR_CONCEPT_SUBJECT / grammarConceptEntry / GRAMMAR_CONCEPT_IDS match live values", () => {
  assert.equal(GRAMMAR_CONCEPT_SUBJECT, LIVE_GRAMMAR_CONCEPT_SUBJECT);
  for (const c of GRAMMAR_CONCEPTS) {
    assert.equal(grammarConceptEntry(c.id), liveGrammarConceptEntry(c.id), `id ${c.id}`);
  }
  assert.deepEqual(GRAMMAR_CONCEPT_IDS, GRAMMAR_CONCEPTS.map((c) => c.id));
});

test("FORM_LABEL matches live FORM_LABEL", () => {
  assert.deepEqual(FORM_LABEL, LIVE_FORM_LABEL);
});

test("grammarRank matches live grammarRank for every taught recipe, plus an unranked one", () => {
  for (const r of GRAMMAR_TEACHING_ORDER) {
    assert.equal(grammarRank(r.id), liveGrammarRank(r.id), `recipe ${r.id}`);
  }
  assert.equal(grammarRank("not-a-real-recipe"), liveGrammarRank("not-a-real-recipe"));
});

test("kanjiEntry matches live kanjiEntry for every kanji", () => {
  for (const k of KANJI) {
    assert.equal(kanjiEntry(k.c), liveKanjiEntry(k.c), `kanji ${k.c}`);
  }
});

test("kanaConfusables matches live confusableWith's kana branch for every kana glyph", () => {
  for (const glyph of Object.keys(CHAR_INDEX)) {
    const live = (LOOK_GROUP[glyph] ?? []).filter((c) => CHAR_INDEX[c]).map((c) => kanaEntry(c));
    assert.deepEqual(kanaConfusables(glyph), live, `glyph ${glyph}`);
  }
});

test("recipeOf / recipesOf match live values for every grammar entry", () => {
  const grammarEntries = LIVE_ENTRIES.filter((e) => e.kind === "grammar");
  assert.ok(grammarEntries.length > 0);
  for (const e of grammarEntries) {
    assert.deepEqual(recipeOf(e.id), liveRecipeOf(e), `recipeOf ${e.id}`);
    assert.deepEqual(recipesOf(e.id), liveRecipesOf(e), `recipesOf ${e.id}`);
  }
  const bogus = "grammar:not-a-real-recipe" as Parameters<typeof recipeOf>[0];
  assert.equal(recipeOf(bogus), null);
  assert.deepEqual(recipesOf(bogus), []);
});

test("MARK_SUBJECT / markEntry match live values for every mark", () => {
  assert.equal(MARK_SUBJECT, LIVE_MARK_SUBJECT);
  for (const mark of MARKS) {
    assert.equal(markEntry(mark.id), liveMarkEntry(mark.id), `mark ${mark.id}`);
  }
});

test("precomputed mark kinds preserve sentence-vs-writing-rule dispatcher routing", () => {
  for (const mark of MARKS) {
    const entry = libEntry(markEntry(mark.id));
    assert.ok(entry, `mark ${mark.id} missing`);
    assert.equal(
      entry.kind,
      mark.shelf === "sentence" ? "sentence-rule" : LIVE_MARK_SUBJECT,
      `mark ${mark.id}`,
    );
  }
});

test("precomputedStrokeFallback matches live strokeFallbackOf for every kana glyph", () => {
  for (const glyph of Object.keys(CHAR_INDEX)) {
    const item = { entry: "kana:_", glyph, kind: "kana", facts: [] } as unknown as Parameters<
      typeof liveStrokeFallbackOf
    >[0];
    const pre = precomputedStrokeFallback(glyph);
    assert.ok(pre, `glyph ${glyph} missing from precomputed strokeFallback`);
    assert.deepEqual(pre.normal, liveStrokeFallbackOf(item, false), `glyph ${glyph} normal`);
    assert.deepEqual(pre.reference, liveStrokeFallbackOf(item, true), `glyph ${glyph} reference`);
  }
});
