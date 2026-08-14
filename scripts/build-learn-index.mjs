// BUILD THE /learn SCHEDULING INDEX — src/data/generated/learn-index.json.
//
// WHY. /learn used to build its teaching units live from the content pipeline,
// which statically dragged the ~8.6 MB curriculum dictionary onto the route. The
// units' SCHEDULING data (glyph, typeLabel, fact-ids, prereqs, blockedBy) is tiny
// and stable; only its DERIVATION is heavy. So we run that derivation here, at
// build time, and serialize its OUTPUT. /learn then schedules over this index with
// no dictionary in its bundle.
//
// BYTE-CORRECTNESS IS NON-NEGOTIABLE. Progress is a set of stable fact-id strings
// and the lesson is derived from them; if this index's fact sets drifted from the
// live derivation, every user's history would silently corrupt. So this script
// NEVER re-derives with new logic — it calls the SAME functions the app calls
// (`track.units`, `contentResolvePrereq`, `factsOf`) and serializes what they
// return. The equivalence test (learn-index.equiv.test.ts) then asserts the
// precomputed /learn frontier equals the live one across a spread of histories,
// and gates the merge.
//
// Run with the test harness's loader so Node resolves the app's `@/` alias and
// `.ts` imports:
//   node --import ./src/lib/conjugate/test-hooks.mjs scripts/build-learn-index.mjs

import { createHash } from "node:crypto";
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { UNIT_TRACKS } from "@/lib/content/unit-tracks";
import { contentResolvePrereq } from "@/lib/content/unit-scheduler";
import { resolvableEntries } from "@/lib/content/resolve";
import { factsOf } from "@/lib/facts";
import { CURRICULUM_SEQUENCE } from "@/lib/curriculum-order";
import { emptyHistory } from "@/lib/history-ops";

/** Serialize a teaching unit down to the scheduling/preview fields. `reading` is
 * carried only when the unit has one (pronunciation units); `scheduling` only when
 * set — matching how the walk reads them. */
function serializeUnit(u) {
  const out = {
    kind: u.kind,
    cost: u.cost,
    facts: [...u.facts],
    item: serializeItem(u.item),
  };
  if (u.scheduling !== undefined) out.scheduling = u.scheduling;
  // reading lives only on pronunciation units; it can legitimately be null (a
  // meaning-only unit), so test for presence, not truthiness.
  if (Object.prototype.hasOwnProperty.call(u, "reading")) out.reading = u.reading;
  return out;
}

/** Serialize a content item down to what the walk (entry, prereqs, blockedBy) and
 * the preview (glyph, typeLabel, kind, roles) read. */
function serializeItem(item) {
  return {
    entry: item.entry,
    glyph: item.glyph,
    typeLabel: item.typeLabel,
    kind: item.kind,
    roles: [...item.roles],
    prereqs: [...item.prereqs],
    blockedBy: [...item.blockedBy],
  };
}

// ── Tracks: each track's units for EMPTY history. Units are history-independent
//    (every track orders statically; history only filters dueness in the walk),
//    so units(emptyHistory) is the unit set for ANY history. ──────────────────
const EMPTY = emptyHistory();
const tracks = UNIT_TRACKS.map((t) => ({
  id: t.id,
  title: t.title,
  units: t.units(EMPTY).map(serializeUnit),
}));

// ── Resolve map: every entry the scheduler can resolve → its primary unit + the
//    data prereqChain recurses on. This IS contentResolvePrereq's output, so the
//    precomputed resolve is byte-for-byte the content one's. Entries the corpus
//    resolves but that build no primary unit yield no node — the content path
//    skips them identically. ──────────────────────────────────────────────────
const resolve = {};
for (const entry of resolvableEntries()) {
  const r = contentResolvePrereq(entry);
  if (!r) continue;
  resolve[entry] = {
    glyph: r.glyph,
    prereqs: [...r.prereqs],
    unit: serializeUnit(r.unit),
  };
}

// ── Blocker facts: every BLOCKING-prerequisite entry (a transitivity pair's
//    verbs, …) → its facts, so isLearned runs without the dictionary. Collected
//    from the order units' blockedBy — the only place the walk checks it. ───────
const blockerFacts = {};
for (const track of tracks) {
  for (const u of track.units) {
    for (const entry of u.item.blockedBy) {
      if (!(entry in blockerFacts)) blockerFacts[entry] = factsOf(entry);
    }
  }
}

// ── Curriculum glyph spine: the vocab card counts positions in this order. ─────
const curriculumGlyphs = CURRICULUM_SEQUENCE.map((it) => it.glyph);

// ── Version stamp: a hash over the serialized index (Phase 3 puts it in the
//    frontier cache key so a content deploy invalidates cached frontiers). ──────
const payload = { tracks, resolve, blockerFacts, curriculumGlyphs };
const curriculumVersion = createHash("sha256")
  .update(JSON.stringify(payload))
  .digest("hex")
  .slice(0, 16);

const index = { curriculumVersion, ...payload };

const outPath = fileURLToPath(
  new URL("../src/data/generated/learn-index.json", import.meta.url),
);
writeFileSync(outPath, JSON.stringify(index) + "\n");

const unitCount = tracks.reduce((n, t) => n + t.units.length, 0);
console.log(
  `learn-index.json written: ${tracks.length} tracks, ${unitCount} units, ` +
    `${Object.keys(resolve).length} resolve nodes, ` +
    `${Object.keys(blockerFacts).length} blocker entries, ` +
    `${curriculumGlyphs.length} curriculum glyphs, version ${curriculumVersion}`,
);
