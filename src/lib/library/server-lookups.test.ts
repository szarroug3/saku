// Run: node --conditions=react-server --import ./src/lib/conjugate/test-hooks.mjs \
//        --test src/lib/library/server-lookups.test.ts
//
// WHAT THIS FILE IS FOR (SAK-246)
// ================================
// server-lookups.ts is the "use server" boundary most of the redesigned
// Library/Learn/Stats screens call through instead of importing the guarded
// dictionary modules directly (see that file's own header). It had zero tests,
// and forces 19 EntryId/FactId values into plain strings with unsafe
// `as unknown as string` casts so they can key a plain Record across the
// Server Action boundary. The ticket's worry is specific: a bug in this file's
// OWN batching/lookup logic — a wrong key, a dropped id, an argument passed in
// the wrong order — would silently return wrong or missing entries to a
// screen, and nothing here would catch it.
//
// So these tests target exactly that: the file's OWN arithmetic (batching,
// keying, filtering, grouping), not the dictionary logic underneath it, which
// already has its own tests (ask-forms.test.ts, lesson-steps.test.ts,
// build-item.test.ts, character-entry-content.test.ts, standing.test.ts, …).
// For a thin pass-through (e.g. `getVocabRow` = `vocabRow`), the useful thing
// to pin is that the action forwards its argument and returns the SAME value
// the underlying function does — that is what an unsafe cast could silently
// break — so several tests below call both and assert they agree, rather than
// re-deriving what the underlying function should return.
//
// WHAT IS DELIBERATELY NOT COVERED HERE, AND WHY
// ================================================
// `getLibraryShelves` and `getLearnFrontier` both route through
// `unstable_cache` (next/cache). Outside a real Next.js request/build — which
// this repo's plain `node --test` harness does not provide, and cannot
// cheaply fake — calling the cached function throws
// "Invariant: incrementalCache missing", confirmed by hand while writing this
// file: it is not a test setup gap here, it is Next's own runtime refusing to
// run outside its own server. `getLearnFrontier`'s signed-in branch also
// crosses into `next/headers` (via `@/lib/auth`'s `currentUserId`), which
// throws its own "outside a request scope" error the same way. Exercising
// either for real needs a Next-test-mode harness (or a request-scope shim)
// this repo does not have yet — the genuine "needs investigation" half of this
// ticket, left for a follow-up rather than guessed at here.
//
// This file also does not re-verify `keigoShelfSections` — see the sibling
// keigo-shelf.test.ts (added alongside this file) for that shelf's own parity
// test, matching kanji-shelf.test.ts / counter-shelf.test.ts / grammar-shelf.test.ts.

import assert from "node:assert/strict";
import { describe, test } from "node:test";

import type { HistoryFile, QuizConfig } from "@/types";

import { kanaEntry, kanaFact } from "@/data/characters";
import { kanjiEntry, meaningFactId as kanjiMeaningFactId } from "@/data/kanji";
import { KEIGO_SETS } from "@/data/keigo";
import { RECIPES } from "@/data/grammar/recipes";
import {
  isWordReadingFact,
  legacyUnqualifiedReading,
  vocabRow,
  wordEntry,
  wordMeaningFactId,
  wordReadingFactId,
} from "@/data/vocab";
import { COUNTER_CURRICULUM, counterEntry } from "@/data/counters";

import {
  entryName as libEntryName,
  kanaConfusables,
  knownFactsOf,
  knownWordsUsing,
  libEntry,
  precomputedStrokeFallback,
  quizzableFacts,
  recipeOf,
  recipesOf,
  usedAsPartIn,
  patternEntry,
  LIB_ENTRIES,
} from "@/lib/library/library-index";
import { entryHref } from "@/lib/library/href";
import { termHref } from "@/lib/library/term-href";
import { subLabel } from "@/lib/library/sub-label";
import { trackLabel, quizTrackLabel } from "@/lib/library/entries";
import { speechForFact } from "@/lib/fact-speech";
import { entryOf, factInfo, factsOf as libFactsOf, glyphOf } from "@/lib/facts";
import { weakestFacts } from "@/lib/decks";
import { itemHeadline } from "@/lib/content/headline";
import { buildGlyphItem, buildItem } from "@/lib/content/build-item";
import { radicalConfusableTip } from "@/data/radical-tips";
import { realQuestionCount } from "@/lib/ask-forms";
import type { AskConfig } from "@/types";

import * as SL from "@/lib/library/server-lookups";

const NOBODY: HistoryFile = { sessions: [], facts: {} };
const UNKNOWN_ENTRY_ID = "word:this-word-does-not-exist-in-the-dictionary" as Parameters<
  typeof SL.getLibEntry
>[0];
const UNKNOWN_FACT_ID = "word:nope/meaning" as Parameters<typeof SL.getFactInfo>[0];

/* -------------------------------------------------------------------------
 * ENTRY / HREF / NAME RESOLUTION
 * ---------------------------------------------------------------------- */

describe("entry resolution", () => {
  const hito = wordEntry("人");

  test("getLibEntry mirrors libEntry, both for a real id and a missing one", async () => {
    assert.deepEqual(await SL.getLibEntry(hito), libEntry(hito));
    assert.equal(await SL.getLibEntry(UNKNOWN_ENTRY_ID), null);
  });

  test("getGlyphLink pairs the real href with the real glyph, or null", async () => {
    const link = await SL.getGlyphLink(hito);
    assert.ok(link);
    assert.equal(link!.href, entryHref(hito));
    assert.equal(link!.glyph, libEntry(hito)!.glyph);
    assert.equal(await SL.getGlyphLink(UNKNOWN_ENTRY_ID), null);
  });

  test("resolveEntries batches by id, keeps only what resolves, keys exactly by the id string", async () => {
    const ids = [hito, kanjiEntry("人"), UNKNOWN_ENTRY_ID];
    const out = await SL.resolveEntries(ids);
    assert.equal(Object.keys(out).length, 2, "the unknown id is dropped, not nulled");
    assert.deepEqual(out[hito as unknown as string], libEntry(hito));
    assert.deepEqual(out[kanjiEntry("人") as unknown as string], libEntry(kanjiEntry("人")));
  });

  test("getEntryHref / getTermHref forward to the real functions", async () => {
    assert.equal(await SL.getEntryHref(hito), entryHref(hito));
    assert.equal(await SL.getTermHref("kana"), termHref("kana"));
  });

  test("getEntryName mirrors entryName, or null with no entry", async () => {
    assert.equal(await SL.getEntryName(hito), libEntryName(libEntry(hito)!));
    assert.equal(await SL.getEntryName(UNKNOWN_ENTRY_ID), null);
  });

  test("resolveEntryLinks batches {href, name} by id, dropping the unresolved", async () => {
    const out = await SL.resolveEntryLinks([hito, UNKNOWN_ENTRY_ID]);
    assert.deepEqual(Object.keys(out), [hito as unknown as string]);
    assert.equal(out[hito as unknown as string].href, entryHref(hito));
    assert.equal(out[hito as unknown as string].name, libEntryName(libEntry(hito)!));
  });

  test("resolveHrefs de-duplicates ids via Set before keying the result", async () => {
    const out = await SL.resolveHrefs([hito, hito, kanjiEntry("人")]);
    assert.equal(Object.keys(out).length, 2);
    assert.equal(out[hito as unknown as string], entryHref(hito));
  });
});

/* -------------------------------------------------------------------------
 * FACT RESOLUTION
 * ---------------------------------------------------------------------- */

describe("fact resolution", () => {
  const reading = wordReadingFactId("人");
  const meaning = wordMeaningFactId("人");

  test("getFactInfo mirrors factInfo, or null when the fact is gone", async () => {
    assert.deepEqual(await SL.getFactInfo(meaning), factInfo(meaning));
    assert.equal(await SL.getFactInfo(UNKNOWN_FACT_ID), null);
  });

  test("getEntryOfFact / getFactsOf / getGlyphOfEntry forward exactly", async () => {
    assert.equal(await SL.getEntryOfFact(meaning), entryOf(meaning));
    assert.deepEqual(await SL.getFactsOf(wordEntry("人")), libFactsOf(wordEntry("人")));
    assert.equal(await SL.getGlyphOfEntry(wordEntry("人")), glyphOf(wordEntry("人")));
  });

  test("resolveFactInfos batches by fact id, dropping ids with no info", async () => {
    const out = await SL.resolveFactInfos([reading, meaning, UNKNOWN_FACT_ID]);
    assert.equal(Object.keys(out).length, 2);
    assert.deepEqual(out[reading as unknown as string], factInfo(reading));
    assert.deepEqual(out[meaning as unknown as string], factInfo(meaning));
  });

  test("resolveFactsOfEntries batches entry->facts, de-duplicating entries", async () => {
    const out = await SL.resolveFactsOfEntries([wordEntry("人"), wordEntry("人")]);
    assert.equal(Object.keys(out).length, 1);
    assert.deepEqual(out[wordEntry("人") as unknown as string], [...libFactsOf(wordEntry("人"))]);
  });
});

/* -------------------------------------------------------------------------
 * GLYPH / SEARCH-ADJACENT LOOKUPS
 * ---------------------------------------------------------------------- */

describe("glyph and fact-set lookups", () => {
  test("getEntryForGlyph resolves per kind and refuses a glyph the kind doesn't have", async () => {
    assert.equal(await SL.getEntryForGlyph("kanji", "人"), kanjiEntry("人"));
    assert.equal(await SL.getEntryForGlyph("kana", "あ"), kanaEntry("あ"));
    assert.equal(await SL.getEntryForGlyph("kanji", "あ"), null);
  });

  test("getKnownFactsOf mirrors knownFactsOf", async () => {
    assert.deepEqual(await SL.getKnownFactsOf(wordEntry("人")), knownFactsOf(wordEntry("人")));
  });

  test("getQuizzableFacts mirrors quizzableFacts for the same (facts, history)", async () => {
    const facts = [wordReadingFactId("人"), wordMeaningFactId("人")];
    assert.deepEqual(await SL.getQuizzableFacts(facts, NOBODY), quizzableFacts(facts, NOBODY));
  });
});

/* -------------------------------------------------------------------------
 * VOCAB
 * ---------------------------------------------------------------------- */

describe("vocab lookups", () => {
  test("getVocabRow mirrors vocabRow, or null for an unknown spelling", async () => {
    assert.deepEqual(await SL.getVocabRow("人"), vocabRow("人") ?? null);
    assert.equal(await SL.getVocabRow("見たことのない単語"), null);
  });

  test("getLegacyUnqualifiedReading / resolveLegacyUnqualifiedReadings agree", async () => {
    const direct = legacyUnqualifiedReading("人");
    assert.equal(await SL.getLegacyUnqualifiedReading("人"), direct);
    const out = await SL.resolveLegacyUnqualifiedReadings(["人", "人"]);
    assert.deepEqual(Object.keys(out), ["人"], "de-duplicated by keb");
    assert.equal(out["人"], direct);
  });

  test("resolveVocabRows batches by keb, de-duplicates, and skips a spelling with no row", async () => {
    const out = await SL.resolveVocabRows(["人", "人", "見たことのない単語"]);
    assert.deepEqual(Object.keys(out), ["人"]);
    assert.deepEqual(out["人"], vocabRow("人"));
  });

  test("getWordReadingFactSet keeps exactly the reading facts", async () => {
    const facts = [wordReadingFactId("人"), wordMeaningFactId("人")];
    const kept = await SL.getWordReadingFactSet(facts);
    assert.deepEqual(kept, facts.filter((f) => isWordReadingFact(f)));
    assert.ok(kept.includes(wordReadingFactId("人")));
    assert.ok(!kept.includes(wordMeaningFactId("人")));
  });

  test("resolveWordLinksByGlyph carries a real word's own reading/meanings/href, and drops a non-word glyph", async () => {
    const out = await SL.resolveWordLinksByGlyph(["人", "こんな単語はない"]);
    assert.deepEqual(Object.keys(out), ["人"]);
    const row = out["人"];
    const entry = libEntry(wordEntry("人"))!;
    assert.equal(row.id, wordEntry("人"));
    assert.equal(row.href, entryHref(wordEntry("人")));
    assert.equal(row.reading, entry.readings[0] ?? null);
    assert.deepEqual(row.meanings, entry.meanings);
  });
});

/* -------------------------------------------------------------------------
 * KANJI / KANA / COMPONENTS
 * ---------------------------------------------------------------------- */

describe("kanji, kana and component lookups", () => {
  test("getKanaConfusables mirrors kanaConfusables", async () => {
    assert.deepEqual(await SL.getKanaConfusables("あ"), kanaConfusables("あ"));
  });

  test("getStrokeFallback mirrors precomputedStrokeFallback, ?? null", async () => {
    for (const glyph of ["あ", "ソ", "ン"]) {
      assert.deepEqual(await SL.getStrokeFallback(glyph), precomputedStrokeFallback(glyph) ?? null);
    }
  });

  test("getUsedAsPartIn mirrors usedAsPartIn — 人 is used in more than a handful of kanji", async () => {
    const uses = await SL.getUsedAsPartIn("人");
    assert.deepEqual(uses, usedAsPartIn("人"));
    assert.ok(uses.length > 10, "人 is a common component");
  });

  test("getKnownWordsUsing mirrors knownWordsUsing for the same (component, history)", async () => {
    // 今 is a real word built from a KANJI THAT USES 人 as a graphical
    // component (usedAsPartIn("人") lists 会/内/今/… — kanji built FROM 人, not
    // words spelled with the literal glyph 人).
    const claimedAt = 1_000;
    const history: HistoryFile = {
      sessions: [],
      facts: {},
      claims: { [wordMeaningFactId("今")]: claimedAt },
    };
    const known = await SL.getKnownWordsUsing("人", history);
    assert.deepEqual(known, knownWordsUsing("人", history));
    assert.ok(known.includes("今"), "a claimed word built from a 人-component kanji counts as known");
  });

  test("getKanaAux batches confusables, stroke fallback and related-id links in one round trip", async () => {
    const related = [wordEntry("人"), UNKNOWN_ENTRY_ID];
    const aux = await SL.getKanaAux("あ", related);
    assert.deepEqual(aux.kanaConfusableIds, [...kanaConfusables("あ")]);
    assert.deepEqual(aux.strokeFallback, precomputedStrokeFallback("あ") ?? null);
    assert.deepEqual(Object.keys(aux.related), [wordEntry("人") as unknown as string]);
    assert.equal(aux.related[wordEntry("人") as unknown as string].glyph, libEntry(wordEntry("人"))!.glyph);
  });

  test("resolveKanjiPartLinks batches kanji->href, de-duplicating characters", async () => {
    const out = await SL.resolveKanjiPartLinks(["人", "人", "日"]);
    assert.equal(Object.keys(out).length, 2);
    assert.equal(out["人"], entryHref(kanjiEntry("人")));
    assert.equal(out["日"], entryHref(kanjiEntry("日")));
  });

  test("getComponentUses returns the same kanji list, hrefs and known words knownWordsUsing/usedAsPartIn would", async () => {
    const claimedAt = 1_000;
    const history: HistoryFile = {
      sessions: [],
      facts: {},
      claims: { [wordMeaningFactId("大人")]: claimedAt },
    };
    const uses = await SL.getComponentUses("人", history);
    assert.deepEqual(uses.kanji, [...usedAsPartIn("人")]);
    for (const c of uses.kanji) assert.equal(uses.hrefs[c], entryHref(kanjiEntry(c)));
    assert.deepEqual(uses.known, knownWordsUsing("人", history));
  });
});

/* -------------------------------------------------------------------------
 * GRAMMAR RECIPES
 * ---------------------------------------------------------------------- */

describe("grammar recipe lookups", () => {
  test("getRecipeOf / getRecipesOf mirror the index, and return empty/null off a pattern's own entry", async () => {
    const recipe = RECIPES[0];
    const entry = patternEntry(recipe.id);
    assert.deepEqual(await SL.getRecipeOf(entry), recipeOf(entry));
    assert.deepEqual(await SL.getRecipesOf(entry), recipesOf(entry));
    assert.equal(await SL.getRecipeOf(UNKNOWN_ENTRY_ID), null);
  });
});

/* -------------------------------------------------------------------------
 * STATS PAGE
 * ---------------------------------------------------------------------- */

describe("getStatsRows", () => {
  test("groups Vocabulary/Kana/Counting the way the page expects, and every fact lands in exactly one entry bucket", async () => {
    const data = await SL.getStatsRows();
    const groupLabels = data.rows.filter((r) => r.kind === "group").map((r) => r.label);
    assert.ok(groupLabels.includes("Vocabulary"));
    assert.ok(groupLabels.includes("Kana"));
    assert.ok(groupLabels.includes("Counting"));

    for (const row of data.rows) {
      const subjects = row.kind === "subject" ? [row.subject] : row.children;
      for (const s of subjects) {
        const bucketed = Object.values(s.entryFacts).flat();
        assert.equal(bucketed.length, s.facts.length, `${s.id}: entryFacts covers every fact once`);
        assert.equal(new Set(bucketed).size, s.facts.length, `${s.id}: no fact double-bucketed`);
        assert.equal(s.entries.length, Object.keys(s.entryFacts).length, `${s.id}: one entry per bucket`);
      }
    }
  });

  test("is computed once and cached (module-scope STATS_DATA_CACHE) — repeat calls return the identical object", async () => {
    const first = await SL.getStatsRows();
    const second = await SL.getStatsRows();
    assert.equal(first, second, "the same cached object, not a re-derived equal one");
  });
});

/* -------------------------------------------------------------------------
 * LIBRARY-PAGE SLICES
 * ---------------------------------------------------------------------- */

describe("getSelectionSlice / getEverythingSlice", () => {
  test("getSelectionSlice recovers canonical library order and a correct count label from a shuffled, duplicated id list", async () => {
    const [a, b, c] = LIB_ENTRIES.slice(0, 3).map((e) => e.id);
    const slice = await SL.getSelectionSlice([c, a, c, b]);
    assert.deepEqual(slice.entries, [a, b, c]);
    assert.equal(slice.label, "3 selected");
  });

  test("getSelectionSlice on an empty selection", async () => {
    assert.deepEqual(await SL.getSelectionSlice([]), { label: "0 selected", entries: [] });
  });

  test("getEverythingSlice(everyStateChecked=true) returns every LIB_ENTRIES id, ignoring the states array", async () => {
    const ids = await SL.getEverythingSlice(["known"], true, {}, {}, Date.now(), []);
    assert.deepEqual(ids, LIB_ENTRIES.map((e) => e.id));
  });

  test("getEverythingSlice('known') includes a claimed single-fact entry and excludes an untouched one", async () => {
    const claimedGlyph = "あ";
    const untouchedGlyph = "い";
    const claimedEntry = kanaEntry(claimedGlyph);
    const untouchedEntry = kanaEntry(untouchedGlyph);
    const now = Date.now();
    const claims = { [kanaFact(claimedGlyph)]: now - 1_000 };

    const known = await SL.getEverythingSlice(["known"], false, {}, claims, now, []);
    assert.ok(known.includes(claimedEntry), "a claimed kana counts as known");
    assert.ok(!known.includes(untouchedEntry), "an untouched kana is not known");

    const unknown = await SL.getEverythingSlice(["unknown"], false, {}, claims, now, []);
    assert.ok(!unknown.includes(claimedEntry));
    assert.ok(unknown.includes(untouchedEntry));
  });

  test("getEverythingSlice('mixup') is exactly the active-mixup-entries set", async () => {
    const [a] = LIB_ENTRIES.map((e) => e.id as unknown as string);
    const ids = await SL.getEverythingSlice(["mixup"], false, {}, {}, Date.now(), [a]);
    assert.deepEqual(ids, [a]);
  });
});

/* -------------------------------------------------------------------------
 * FIXED RUN LIST
 * ---------------------------------------------------------------------- */

describe("fixedRunList", () => {
  test("builds a list of the run's own (de-duplicated) entries, or null for an empty run", async () => {
    const facts = [wordReadingFactId("人"), wordMeaningFactId("人")];
    const list = await SL.fixedRunList("run-1", "My run", facts);
    assert.ok(list);
    assert.equal(list!.kind, "fixed");
    assert.equal(list!.id, "run-run-1");
    assert.equal(list!.name, "My run");
    assert.ok(list!.kind === "fixed");
    assert.deepEqual(list.entries, [...new Set(facts.map((f) => entryOf(f)))]);

    assert.equal(await SL.fixedRunList("run-2", "Empty", []), null);
  });
});

/* -------------------------------------------------------------------------
 * BREAKDOWN ROWS
 * ---------------------------------------------------------------------- */

describe("getEntryBreakdownRows", () => {
  test("a real entry: name/detail/href match entryName/subLabel/entryHref exactly", async () => {
    const id = wordEntry("人");
    const out = await SL.getEntryBreakdownRows([id]);
    const entry = libEntry(id)!;
    const label = subLabel(entry);
    assert.equal(out[id as unknown as string].name, libEntryName(entry));
    assert.equal(out[id as unknown as string].detail, label === "—" ? null : label);
    assert.equal(out[id as unknown as string].href, entryHref(id));
  });

  test("an id with no LibEntry falls back to the raw glyph and its first fact's meaning — SAK-172's folded-in 二十歳", async () => {
    // 二十歳 no longer has a LibEntry of its own (folded into 〜歳's construction
    // page — see counter-shelf.test.ts), but it still has facts, so this is a
    // real instance of the fallback branch, not a synthetic id.
    const twentyYears = COUNTER_CURRICULUM.find((f) => f.glyph === "二十歳")!;
    const id = counterEntry(twentyYears);
    assert.equal(libEntry(id), undefined, "sanity: this id really has no LibEntry");
    const facts = libFactsOf(id);
    assert.ok(facts.length > 0, "sanity: but it still has facts");

    const out = await SL.getEntryBreakdownRows([id]);
    const row = out[id as unknown as string];
    assert.equal(row.name, glyphOf(id));
    assert.equal(row.detail, factInfo(facts[0])?.meaning ?? null);
    assert.equal(row.href, entryHref(id));
  });
});

describe("getBucketBreakdownRows", () => {
  test("batches {glyph, meaning, href} by fact id, and drops a fact with no info", async () => {
    const meaning = wordMeaningFactId("人");
    const out = await SL.getBucketBreakdownRows([meaning, UNKNOWN_FACT_ID]);
    assert.deepEqual(Object.keys(out), [meaning as unknown as string]);
    const info = factInfo(meaning)!;
    assert.equal(out[meaning as unknown as string].glyph, info.glyph);
    assert.equal(out[meaning as unknown as string].meaning, info.meaning);
    assert.equal(out[meaning as unknown as string].href, entryHref(info.entry));
  });
});

/* -------------------------------------------------------------------------
 * CONFUSABLE ROWS
 * ---------------------------------------------------------------------- */

describe("resolveConfusableRows", () => {
  test("carries glyph/gloss/href for each id, with no tip when no sourceGlyph is given", async () => {
    const id = kanjiEntry("人");
    const out = await SL.resolveConfusableRows([id, UNKNOWN_ENTRY_ID]);
    assert.deepEqual(Object.keys(out), [id as unknown as string]);
    const entry = libEntry(id)!;
    assert.equal(out[id as unknown as string].glyph, entry.glyph);
    assert.equal(out[id as unknown as string].gloss, entry.meanings[0] ?? entry.readings[0] ?? "");
    assert.equal(out[id as unknown as string].href, entryHref(id));
    assert.equal(out[id as unknown as string].tip, undefined);
  });

  test("attaches the hand-authored tip only for the matching (sourceGlyph, row glyph) radical pair", async () => {
    const { radicalEntry } = await import("@/data/radicals");
    const out = await SL.resolveConfusableRows([radicalEntry("囗")], "口");
    const tip = radicalConfusableTip("口", "囗");
    assert.ok(tip, "sanity: 口/囗 is one of the hand-authored pairs");
    assert.equal(out[radicalEntry("囗") as unknown as string].tip, tip);
  });
});

/* -------------------------------------------------------------------------
 * TRACK LABELS
 * ---------------------------------------------------------------------- */

describe("track label lookups", () => {
  test("getTeachTrackLabel mirrors trackLabel(factInfo(fact))", async () => {
    const fact = wordMeaningFactId("人");
    assert.equal(await SL.getTeachTrackLabel(fact), trackLabel(factInfo(fact)));
  });

  test("getQuizTrackLabel mirrors quizTrackLabel over the same fact pool and mode", async () => {
    const facts = [wordReadingFactId("人"), wordMeaningFactId("人")];
    const direct = quizTrackLabel(facts.map((f) => factInfo(f)));
    assert.equal(await SL.getQuizTrackLabel(facts), direct);
  });
});

/* -------------------------------------------------------------------------
 * SPEECH / WEAKEST FACTS
 * ---------------------------------------------------------------------- */

describe("resolveSpeechForFacts", () => {
  test("batches speechForFact by fact id, dropping a fact whose info is gone", async () => {
    const meaning = wordMeaningFactId("人");
    const out = await SL.resolveSpeechForFacts([meaning, UNKNOWN_FACT_ID]);
    const info = factInfo(meaning)!;
    const text = speechForFact(info);
    if (text) {
      assert.equal(out[meaning as unknown as string], text);
    } else {
      assert.ok(!(meaning as unknown as string in out));
    }
    assert.ok(!(UNKNOWN_FACT_ID as unknown as string in out));
  });
});

describe("resolveWeakestFacts", () => {
  test("mirrors weakestFacts(history, now, n) exactly", async () => {
    const now = Date.now();
    assert.deepEqual(await SL.resolveWeakestFacts(NOBODY, now, 5), weakestFacts(NOBODY, now, 5));
  });
});

/* -------------------------------------------------------------------------
 * TEACH-WALK / LIVE-ITEM WIRING
 * ---------------------------------------------------------------------- */

describe("teach-walk pass-throughs", () => {
  test("resolveItemHeadline mirrors itemHeadline for the same built item", async () => {
    const item = buildGlyphItem("人")!;
    assert.deepEqual(await SL.resolveItemHeadline(item), itemHeadline(item));
  });

  test("resolveTeachItem routes each LessonKind to the same builder buildItem/buildGlyphItem would", async () => {
    const kanjiItem = await SL.resolveTeachItem({
      entry: kanjiEntry("人"),
      glyph: "人",
      kind: "kanji",
      facts: [kanjiMeaningFactId("人")],
    });
    assert.deepEqual(kanjiItem, buildGlyphItem("人") ?? null);

    const wordItem = await SL.resolveTeachItem({
      entry: wordEntry("人"),
      glyph: "人",
      kind: "word",
      facts: [wordMeaningFactId("人")],
    });
    assert.deepEqual(wordItem, buildItem(wordEntry("人"), "word") ?? null);

    const keigoSet = KEIGO_SETS[0];
    const { keigoSetEntry } = await import("@/data/keigo");
    const keigoItem = await SL.resolveTeachItem({
      entry: keigoSetEntry(keigoSet),
      glyph: keigoSet.words[0]!.word,
      kind: "keigo",
      facts: [],
    });
    assert.deepEqual(keigoItem, buildItem(keigoSetEntry(keigoSet), "keigo") ?? null);
  });
});

/* -------------------------------------------------------------------------
 * QUIZ-ME BUTTON COUNT
 * ---------------------------------------------------------------------- */

describe("getRealQuestionCount", () => {
  const ALL: AskConfig = {
    japanese: { prompts: ["text", "audio"], responses: ["definition", "romaji"], answers: ["typed", "mc"] },
    sentence: { prompts: [], responses: [], answers: [], englishResponses: [] },
    english: { answers: ["typed", "mc"] },
  };
  const cfg: Pick<QuizConfig, "length" | "limType" | "limCount" | "ask"> = {
    length: "endless",
    limType: "cov",
    limCount: 50,
    ask: ALL,
  };

  test("mirrors realQuestionCount for the same (facts, cfg, history)", async () => {
    const facts = [wordReadingFactId("人"), wordMeaningFactId("人")];
    assert.equal(await SL.getRealQuestionCount(facts, cfg, NOBODY), realQuestionCount(facts, cfg, NOBODY));
    assert.equal(await SL.getRealQuestionCount([], cfg, NOBODY), 0);
  });
});
