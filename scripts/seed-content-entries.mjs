// SEED content_entries — Library entry DETAIL payloads, by id.
//
// Kinds seeded so far: term, mark, grammar-concept (id-only entries, no
// `item: ContentItem` prop — payload is simply the source object's own fields),
// and kana, transitivity, counter, generative-rule (each has a glyph/
// ContentItem, but only itemHeadline's {text, speak} is heavy enough to need
// seeding — see each section below; transitivity also seeds its glyph, since
// library-index.ts's `libEntry` doesn't carry the right one for that kind).
// See docs/perf-library-list-bundle.md.
//
// BYTE-CORRECTNESS. Every payload is the real object the live component would
// have used (TERMS/MARKS/GRAMMAR_CONCEPTS), never re-derived or hand-copied —
// same discipline as every other precompute in this app. Any resolved cross-
// reference (a term's `related`) is resolved by calling the real
// resolver functions, not reimplemented.
//
// REQUIRES the content_entries table to already exist (supabase/schema.sql,
// run once via psql/the SQL editor — the service-role REST API has no DDL
// endpoint). Writes with the SERVICE ROLE key, which bypasses RLS
// (content_entries' own policy only allows public SELECT).
//
// Run with the test harness's loader so Node resolves `@/` and extensionless
// imports, and with .env.local's Supabase vars loaded:
//   node --env-file=.env.local --import ./src/lib/conjugate/test-hooks.mjs scripts/seed-content-entries.mjs

import { createHash } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

import { TERMS, TERM_SUBJECT, termEntry, termRow } from "@/data/terms";
import { MARKS, MARK_SUBJECT, markEntry } from "@/data/marks";
import { GRAMMAR_CONCEPTS, GRAMMAR_CONCEPT_SUBJECT, grammarConceptEntry } from "@/data/grammar-concepts";
import { entryHref } from "@/lib/library/href";
import { CHAR_INDEX, KANA_SUBJECT, kanaEntry } from "@/data/characters";
import { buildGlyphItem, buildItem } from "@/lib/content/build-item";
import { itemHeadline } from "@/lib/content/headline";
import { VERB_PAIRS } from "@/data/transitivity";
import { TRANSITIVITY_SUBJECT, pairEntry } from "@/data/transitivity-facts";
import { COUNTER_CURRICULUM, counterEntry } from "@/data/counters";
import { NUMBER_CONSTRUCTIONS, numberConstructionEntry } from "@/data/number-construction";
import { COUNTER_KIND, NUMBER_CONSTRUCTION_KIND } from "@/lib/library/library-index";
import { KEIGO_SETS, KEIGO_SUBJECT, keigoSetEntry } from "@/data/keigo";
import { RECIPES, isPrimaryPatternRecipe } from "@/data/grammar/recipes";
import { GRAMMAR_SUBJECT, patternEntry } from "@/lib/library/library-index";
import { KANJI, KANJI_SUBJECT, kanjiEntry } from "@/data/kanji";
import { RADICALS, RADICAL_SUBJECT, radicalEntry } from "@/data/radicals";
import { VOCAB, VOCAB_SUBJECT, wordEntry } from "@/data/vocab";
import { characterEntryPayload } from "@/lib/library/character-entry-content";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  throw new Error(
    "seed-content-entries: NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY not set — run with --env-file=.env.local",
  );
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

function versionOf(payload) {
  return createHash("sha256").update(JSON.stringify(payload)).digest("hex").slice(0, 16);
}

function row(entryId, kind, payload) {
  return { entry_id: entryId, kind, payload, content_version: versionOf(payload) };
}

// ---- term ------------------------------------------------------------------
// The payload is the view-model TermEntryView renders: `related` resolved to
// {label, href} pairs at seed time (the real termRow/termEntry/entryHref), so
// the reader makes exactly one request. Drops any related id that no longer
// names a real term, same guard the live component made.
const termRows = TERMS.map((term) => {
  const relatedLinks = (term.related ?? [])
    .map((id) => {
      const r = termRow(id);
      return r ? { label: r.name, href: entryHref(termEntry(id)) } : null;
    })
    .filter((l) => l != null);
  const payload = {
    name: term.name,
    summary: term.summary,
    body: term.body,
    ...(term.cards !== undefined ? { cards: term.cards } : {}),
    ...(term.cardMark !== undefined ? { cardMark: term.cardMark } : {}),
    relatedLinks,
  };
  return row(termEntry(term.id), TERM_SUBJECT, payload);
});

// ---- mark --------------------------------------------------------------
// The payload is the full Mark object as-is: MarkView/DakutenConversionView
// read it directly and are UNCHANGED (same as TermView) — the only thing that
// moves is where MarkEntryView gets the object from. Sentence-shelf marks
// (mark.shelf === "sentence") are seeded too, even though the live dispatcher
// currently routes those to SentenceEntryView instead of MarkEntryView — the
// row does no harm unseeded to, and keeps this script kind-complete for
// data/marks.ts.
const markRows = MARKS.map((mark) => row(markEntry(mark.id), MARK_SUBJECT, mark));

// ---- grammar-concept ---------------------------------------------------
// Same shape as term, minus `related` (GrammarConceptEntryView never renders
// it — no RelatedSection on that page today, so it is dropped rather than
// resolved for nothing).
const grammarConceptRows = GRAMMAR_CONCEPTS.map((concept) => {
  const payload = {
    name: concept.name,
    summary: concept.summary,
    body: concept.body,
    cards: concept.cards,
  };
  return row(grammarConceptEntry(concept.id), GRAMMAR_CONCEPT_SUBJECT, payload);
});

// ---- kana ----------------------------------------------------------------
// The payload is just the ONE genuinely heavy thing KanaEntryView reads off the
// item: itemHeadline's {text, speak} (calls teachUnitsOf → facts/kanji data).
// Everything else the page needs (mnemonic, following-sound context, shape
// lookalikes, stroke fallback) is already content-free or precomputed in
// library-index.ts, and typeLabel is the constant "kana" (contentTypeLabel's
// default branch), so none of that needs seeding here.
const kanaRows = Object.keys(CHAR_INDEX)
  .map((glyph) => {
    const entry = kanaEntry(glyph);
    const item = buildItem(entry, "kana");
    if (!item) return null;
    const { text, speak } = itemHeadline(item);
    return row(entry, KANA_SUBJECT, { text, speak });
  })
  .filter((r) => r != null);

// ---- transitivity (verb pair) ---------------------------------------------
// Same shape as kana: the actual pair data (VERB_PAIRS/pairForEntry) is a
// small, self-contained ~27KB file, not entangled with the big dictionary —
// VerbPairEntryView keeps reading it live. itemHeadline's {text, speak}
// (kanjiMeaning → kanji.ts) is the heavy thing seeded; typeLabel is the
// constant "verb pair" (contentTypeLabel's transitivity branch). `glyph` is
// ALSO seeded here (buildItem's, the pair's shared kanji) rather than read off
// library-index.ts's `libEntry` — a "transitivity" LIB_ENTRIES row's `glyph`
// field is empty (that list/search index displays this kind by name, not
// glyph), so it is not the same value the live ContentItem carried.
const verbPairRows = VERB_PAIRS.map((pair) => {
  const entry = pairEntry(pair);
  const item = buildItem(entry, "transitivity");
  if (!item) return null;
  const { text, speak } = itemHeadline(item);
  return row(entry, TRANSITIVITY_SUBJECT, { text, speak, glyph: item.glyph });
}).filter((r) => r != null);

// ---- counter / generative-rule (Numbers & counters shelf) -----------------
// Same shape as kana/transitivity: counterForm/numberConstructionFor (both
// small, self-contained data files, no dictionary dependency) stay live reads
// in CounterEntryView. Only itemHeadline's {text, speak} is heavy enough to
// seed. Unlike transitivity, `libEntry`'s glyph IS the same value buildItem
// produces for both these kinds (checked directly, not assumed — see the
// commit message), so no glyph needs seeding here.
const counterRows = COUNTER_CURRICULUM.map((form) => {
  const entry = counterEntry(form);
  const item = buildItem(entry, "counter");
  if (!item) return null;
  return row(entry, COUNTER_KIND, itemHeadline(item));
}).filter((r) => r != null);

const constructionRows = NUMBER_CONSTRUCTIONS.map((c) => {
  const entry = numberConstructionEntry(c.id);
  const item = buildItem(entry, "generative-rule");
  if (!item) return null;
  return row(entry, NUMBER_CONSTRUCTION_KIND, itemHeadline(item));
}).filter((r) => r != null);

// ---- keigo -----------------------------------------------------------------
// Same shape as transitivity: keigoSetForEntry (data/keigo.ts, self-contained,
// no dictionary dependency) stays a live read. library-index.ts's `libEntry`
// carries an EMPTY glyph for this kind too (checked directly — same as
// transitivity, this shelf displays a set by name, not glyph), so `glyph`
// (buildItem's, the plain verb) is seeded alongside the headline.
const keigoRows = KEIGO_SETS.map((set) => {
  const entry = keigoSetEntry(set);
  const item = buildItem(entry, "keigo");
  if (!item) return null;
  const { text, speak } = itemHeadline(item);
  return row(entry, KEIGO_SUBJECT, { text, speak, glyph: item.glyph });
}).filter((r) => r != null);

// ---- grammar (patterns) -----------------------------------------------------
// recipeOf/recipesOf/clusterById/membersOf all stay live reads —
// data/grammar/recipes.ts and data/grammar/clusters.ts are self-contained, no
// dictionary dependency (GrammarEntryView now reads library-index.ts's
// content-free recipeOf/recipesOf twins instead of library/entries.ts's,
// which drag in the whole heavy file just for this lookup). Only itemHeadline
// is seeded, along with `glyph` — checked directly against buildItem's own
// glyph and found to differ for 2 of 103 patterns (a parenthetical Japanese
// disambiguator library-index.ts's glyph field doesn't carry), so it isn't a
// safe substitute here either.
const grammarRows = RECIPES.filter(isPrimaryPatternRecipe)
  .map((r) => {
    const entry = patternEntry(r.id);
    const item = buildItem(entry, "grammar");
    if (!item) return null;
    const { text, speak } = itemHeadline(item);
    return row(entry, GRAMMAR_SUBJECT, { text, speak, glyph: item.glyph });
  })
  .filter((r) => r != null);

// ---- character (radical / kanji / word) -----------------------------------
// This is the full-payload case. CharacterEntryView historically joined seven
// live sources to render role aggregation, etymology, variants, readings,
// components, word senses/examples, component uses, and writing fallback. The
// exact live characterEntryPayload output carries all of it, including the real
// buildGlyphItem result for every single Han glyph. That preserves the cohesive
// radical + kanji + word item (人) whichever of its entry ids opened the page.
// Multi-character/kana words use buildItem's real word output as before.
const SINGLE_HAN = /^\p{Script=Han}$/u;

const radicalRows = RADICALS.map((radical) => {
  const item = buildGlyphItem(radical.glyph);
  return item
    ? row(radicalEntry(radical.glyph), RADICAL_SUBJECT, characterEntryPayload(item))
    : null;
}).filter((r) => r != null);

const kanjiRows = KANJI.map((kanji) => {
  const item = buildGlyphItem(kanji.c);
  return item ? row(kanjiEntry(kanji.c), KANJI_SUBJECT, characterEntryPayload(item)) : null;
}).filter((r) => r != null);

const wordRows = VOCAB.map((word) => {
  const entry = wordEntry(word.keb);
  const item = SINGLE_HAN.test(word.keb)
    ? buildGlyphItem(word.keb)
    : buildItem(entry, "word");
  return item ? row(entry, VOCAB_SUBJECT, characterEntryPayload(item)) : null;
}).filter((r) => r != null);

const rows = [
  ...termRows,
  ...markRows,
  ...grammarConceptRows,
  ...kanaRows,
  ...verbPairRows,
  ...counterRows,
  ...constructionRows,
  ...keigoRows,
  ...grammarRows,
  ...radicalRows,
  ...kanjiRows,
  ...wordRows,
];

// Keep each REST request comfortably below proxy/body-size limits now that the
// character payload adds every vocabulary entry. Upsert semantics are unchanged.
const BATCH_SIZE = 500;
for (let i = 0; i < rows.length; i += BATCH_SIZE) {
  const batch = rows.slice(i, i + BATCH_SIZE);
  const { error } = await supabase
    .from("content_entries")
    .upsert(batch, { onConflict: "entry_id" });
  if (error) {
    console.error(`seed-content-entries failed at rows ${i}-${i + batch.length - 1}:`, error.message);
    process.exit(1);
  }
}

console.log(
  `content_entries seeded: ${termRows.length} term, ${markRows.length} mark, ` +
    `${grammarConceptRows.length} grammar-concept, ${kanaRows.length} kana, ` +
    `${verbPairRows.length} transitivity, ${counterRows.length} counter, ` +
    `${constructionRows.length} generative-rule, ${keigoRows.length} keigo, ` +
    `${grammarRows.length} grammar, ${radicalRows.length} radical, ` +
    `${kanjiRows.length} kanji, ${wordRows.length} word rows (${rows.length} total)`,
);
