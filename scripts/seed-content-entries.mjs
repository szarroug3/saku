// SEED content_entries — Library entry DETAIL payloads, by id.
//
// PROOF OF CONCEPT: only the "term" kind is seeded so far (19 rows, no
// dictionary dependency — a good first slice to prove schema + seed + fetch +
// loading-state UX before tackling a harder kind like "character"). See
// docs/perf-library-list-bundle.md.
//
// BYTE-CORRECTNESS. The payload for each term is the real `Term` object itself
// (termFor/TERMS), never re-derived or hand-copied — same discipline as every
// other precompute in this app.
//
// REQUIRES the content_entries table to already exist (supabase/schema.sql,
// run once in the Supabase SQL editor — this script cannot create it: the
// service-role REST API has no DDL endpoint). Writes with the SERVICE ROLE key,
// which bypasses RLS (content_entries' own policy only allows public SELECT).
//
// Run with the test harness's loader so Node resolves `@/` and extensionless
// imports, and with .env.local's Supabase vars loaded:
//   node --env-file=.env.local --import ./src/lib/conjugate/test-hooks.mjs scripts/seed-content-entries.mjs

import { createHash } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

import { TERMS, TERM_SUBJECT, termEntry, termRow } from "@/data/terms";
import { entryHref } from "@/lib/library/href";

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

// The payload is the view-model TermEntryView actually renders: `related`
// resolved to {label, href} pairs at seed time (calling the real
// termRow/termEntry/entryHref — never re-derived), so the fetched row needs no
// further lookups and the reader makes exactly one request. Dropping any
// related id that no longer names a real term, same guard the live component
// made.
const rows = TERMS.map((term) => {
  const relatedLinks = (term.related ?? [])
    .map((id) => {
      const row = termRow(id);
      return row ? { label: row.name, href: entryHref(termEntry(id)) } : null;
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
  return {
    entry_id: termEntry(term.id),
    kind: TERM_SUBJECT,
    payload,
    content_version: versionOf(payload),
  };
});

const { error } = await supabase.from("content_entries").upsert(rows, { onConflict: "entry_id" });
if (error) {
  console.error("seed-content-entries failed:", error.message);
  process.exit(1);
}

console.log(`content_entries seeded: ${rows.length} term rows`);
