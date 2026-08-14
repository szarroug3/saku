// SEED content_entries — Library entry DETAIL payloads, by id.
//
// Kinds seeded so far: term, mark, grammar-concept (id-only entries, no
// `item: ContentItem` prop — payload is simply the source object's own fields),
// and kana (has a glyph/ContentItem, but only its headline {text, speak} is
// heavy enough to need seeding — see the kana section below). See
// docs/perf-library-list-bundle.md.
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
import { buildItem } from "@/lib/content/build-item";
import { itemHeadline } from "@/lib/content/headline";
import { VERB_PAIRS } from "@/data/transitivity";
import { TRANSITIVITY_SUBJECT, pairEntry } from "@/data/transitivity-facts";

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

const rows = [...termRows, ...markRows, ...grammarConceptRows, ...kanaRows, ...verbPairRows];

const { error } = await supabase.from("content_entries").upsert(rows, { onConflict: "entry_id" });
if (error) {
  console.error("seed-content-entries failed:", error.message);
  process.exit(1);
}

console.log(
  `content_entries seeded: ${termRows.length} term, ${markRows.length} mark, ` +
    `${grammarConceptRows.length} grammar-concept, ${kanaRows.length} kana, ` +
    `${verbPairRows.length} transitivity rows (${rows.length} total)`,
);
