#!/usr/bin/env node
// What a Sky route's SERVER bundle actually carries, from the production
// build's source maps: the ground truth the import walkers approximate
// (import_path.mjs counts a type-only import as an edge; the bundler does not).
//
//   npx playwright test e2e/sky.spec.ts   # builds .next-e2e
//   node scripts/route_sources.mjs        # lists old-app and library sources per route
//   node scripts/route_sources.mjs lib/content components   # your own path filters
//
// Written for the SAK-398 leftovers: a module is gone from the cold path when
// it is gone from here, not when a walker stops listing it.
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
const root = ".next-e2e/server";
const routes = ["app/(sky)/page.js", "app/(sky)/lesson/page.js", "app/(sky)/atlas/page.js", "app/(sky)/practice/page.js", "app/(sky)/observatory/page.js", "app/(sky)/quiz/page.js", "app/(sky)/settings/page.js"];
const wanted = process.argv.slice(2);
const filt = wanted.length ? (s) => wanted.some((w) => s.includes("src/" + w)) : (s) => /src\/(components|lib\/content|lib\/library)\//.test(s);
const all = new Map();
for (const r of routes) {
  const nft = path.join(root, r + ".nft.json"); if (!existsSync(nft)) { console.log(r, "no nft"); continue; }
  const files = JSON.parse(readFileSync(nft, "utf8")).files.map((f) => path.resolve(path.dirname(nft), f));
  const sources = new Set();
  for (const f of [path.join(root, r), ...files]) { const m = f + ".map"; if (!existsSync(m) || !f.endsWith(".js")) continue; try { for (const s of JSON.parse(readFileSync(m, "utf8")).sources || []) { const i = s.indexOf("src/"); if (i >= 0) sources.add(s.slice(i)); } } catch {} }
  const hits = [...sources].filter(filt).sort();
  console.log(`-- ${r}: ${sources.size} sources, ${hits.length} old-app/library:\n   ` + hits.map((h) => h.replace("src/", "")).join("\n   "));
  for (const h of hits) all.set(h, (all.get(h) || 0) + 1);
}
