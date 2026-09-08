// The entry model and the three page payloads, dumped to files, so a change
// that must not alter them is checked with cmp rather than trusted (SAK-400).
//
//   node --conditions=react-server --import ./src/lib/conjugate/test-hooks.mjs scripts/dump-entry-model.mjs /tmp/before
//   ...make the change...
//   node --conditions=react-server --import ./src/lib/conjugate/test-hooks.mjs scripts/dump-entry-model.mjs /tmp/after
//   for f in /tmp/before/*; do cmp -s $f /tmp/after/$(basename $f) && echo "same $f" || echo "DIFFERS $f"; done
//
// Writes, for entries.ts and for library-index.ts: every entry, the buckets by
// kind, libEntry for every id, entryForGlyph for every glyph on every kind,
// knownFactsOf for every entry, the kinds; and the home, Atlas and practice
// payloads for the sample learner and an empty one.
import { writeFileSync, mkdirSync } from "node:fs";
const out = process.argv[2]; mkdirSync(out, { recursive: true });
const stable = (v) => JSON.stringify(v, (_, x) => (x && typeof x === "object" && !Array.isArray(x) && !(x instanceof Map) && !(x instanceof Set)) ? Object.fromEntries(Object.entries(x).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))) : x instanceof Map ? Object.fromEntries([...x].map(([k, v]) => [String(k), v])) : x instanceof Set ? [...x] : x, 1);

const E = await import("@/lib/library/entries");
const I = await import("@/lib/library/library-index");
const { CHAR_INDEX } = await import("@/data/characters");
const { KANJI } = await import("@/data/kanji");
const { RADICALS } = await import("@/data/radicals");
const { PRIMITIVE_STROKES } = await import("@/data/components");
const { VOCAB } = await import("@/data/vocab");
const { COUNTER_KANJI_GLYPHS, COUNTER_VOCAB_DUPLICATE_KEBS } = await import("@/data/counters");
const { GRAMMAR_VOCAB_DUPLICATE_KEBS } = await import("@/data/grammar");

const glyphs = [...new Set([...Object.keys(CHAR_INDEX), ...KANJI.map((k) => k.c), ...RADICALS.map((r) => r.glyph), ...PRIMITIVE_STROKES.keys(), ...VOCAB.map((w) => w.keb), ...COUNTER_KANJI_GLYPHS, ...COUNTER_VOCAB_DUPLICATE_KEBS.keys(), ...GRAMMAR_VOCAB_DUPLICATE_KEBS.keys(), "x", "", "亻", "氵", "一つ", "二十歳", "だけ"])];

function model(M, name) {
  const entries = M.LIB_ENTRIES;
  const byKind = Object.fromEntries([...M.LIB_ENTRIES_BY_KIND].map(([k, v]) => [k, v.map((e) => e.id)]));
  const lib = entries.map((e) => M.libEntry(e.id) === e);
  const missing = M.libEntry("kanji:nope") === undefined && M.libEntry("word:nope") === undefined;
  const efg = {};
  for (const kind of M.KINDS.concat([M.NUMBER_CONSTRUCTION_KIND])) { const row = {}; for (const g of glyphs) { const r = M.entryForGlyph(kind, g); if (r !== null) row[g] = r; } efg[kind] = row; }
  const known = Object.fromEntries(entries.map((e) => [e.id, M.knownFactsOf(e)]));
  writeFileSync(`${out}/${name}-entries.json`, stable(entries));
  writeFileSync(`${out}/${name}-byKind.json`, stable(byKind));
  writeFileSync(`${out}/${name}-libEntry.json`, stable({ sameObject: lib.every(Boolean), count: lib.length, missing }));
  writeFileSync(`${out}/${name}-entryForGlyph.json`, stable(efg));
  writeFileSync(`${out}/${name}-knownFacts.json`, stable(known));
  writeFileSync(`${out}/${name}-kinds.json`, stable({ KINDS: M.KINDS, KIND_LABEL: M.KIND_LABEL }));
  console.log(`${name}: ${entries.length} entries, ${Object.keys(known).length} known, glyph probes ${glyphs.length}`);
}
model(E, "entries");
model(I, "index");

const { emptyHistory } = await import("@/lib/history-ops");
const { getStatsRows } = await import("@/lib/library/server-lookups");
const { skyPayloadFor } = await import("@/app/(sky)/catalogue");
const { beyondWords } = await import("@/app/(sky)/observatory");
const { atlasPayloadFor } = await import("@/app/(sky)/atlas-catalogue");
const { practicePreview } = await import("@/app/(sky)/practice");
const { sampleHistory } = await import("@/app/(sky)/sample-learner");
const { EMPTY_RECIPE } = await import("@/sky/lib/practice");
const NOW = Date.UTC(2026, 8, 6);
const rows = await getStatsRows();
const learners = { sample: sampleHistory(NOW), empty: emptyHistory() };
const payloads = {};
for (const [name, h] of Object.entries(learners)) {
  payloads[name] = {
    home: skyPayloadFor(h, NOW, rows, { everything: true, beyond: beyondWords }),
    atlas: atlasPayloadFor(h, NOW),
    practice: {
      all: practicePreview(h, { ...EMPTY_RECIPE, size: "all" }, {}, NOW),
      kanji: practicePreview(h, { ...EMPTY_RECIPE, collections: ["kanji"], size: "all" }, {}, NOW),
      five: practicePreview(h, { ...EMPTY_RECIPE, size: 5 }, {}, NOW),
    },
  };
}
writeFileSync(`${out}/payloads.json`, stable(JSON.parse(JSON.stringify(payloads))));
console.log("payloads written");
