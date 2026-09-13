#!/usr/bin/env node
// SAK-228: bundle-size regression gate.
//
// Sums the client JS actually referenced by each route's React Server
// Components client-reference-manifest (i.e. what a real visit to that route
// has to ship to the browser), and fails the run if any route exceeds its
// budget. Run this AFTER `next build` (or `pnpm run build`, which is `next
// build`) — it reads straight out of `.next/server/app/**`.
//
// WHY THIS EXISTS (SAK-228): this script previously only printed sizes, for
// nine of the app's ~20 real routes, and was never invoked by anything —
// not `package.json`, not CI. A route could balloon to 27MB (the bug this
// ticket is named for) and nothing would notice until a human happened to
// run this file by hand. It is now wired into `pnpm run build:check-sizes`
// and the CI `check` job (see .github/workflows/ci.yml), and every route
// with its own top-level `page.tsx` is listed below — add a line here
// whenever a new one is.
//
// BUDGETS are calibrated to each route's own measured size plus headroom
// (roughly 20-30%), not one flat number: the app's routes are legitimately
// very different weights (a static marketing-ish page vs. a grading route
// that still carries the vocabulary dictionary — see
// docs/perf-library-list-bundle.md, "What's still deferred"). The point of a
// per-route budget is to catch a route DOUBLING or TRIPLING in size, not to
// pretend they should all weigh the same.
import fs from "fs";
import path from "path";

const NEXT_DIR = process.env.ROUTE_SIZES_NEXT_DIR || ".next";

// route -> [manifest path (relative to NEXT_DIR/server), budget in MB]
// The Sky's routes (2026-09-06). Budgets are the measured size plus a third,
// so a page that doubles fails and one that drifts a little does not.
const ROUTES = {
  "/": ["app/(sky)/page_client-reference-manifest.js", 1.5],
  "/observatory": ["app/(sky)/observatory/page_client-reference-manifest.js", 1.5],
  "/lesson": ["app/(sky)/lesson/page_client-reference-manifest.js", 2],
  // These three used to be budgeted at 16 MB, because grading on the client
  // meant importing the engine and the engine's index reaches every table the
  // app owns: 14.8 MB of JavaScript to answer one yes-or-no question. SAK-380
  // sent the answer with the card instead and they came back to 0.54 MB, in
  // line with every other page. Anything that puts a table back in the
  // browser fails here; `node scripts/import_path.mjs <file> src/data` says
  // which import did it.
  "/quiz": ["app/(sky)/quiz/page_client-reference-manifest.js", 1.5],
  "/practice": ["app/(sky)/practice/page_client-reference-manifest.js", 1.5],
  "/practice/run": ["app/(sky)/practice/run/page_client-reference-manifest.js", 1.5],
  "/atlas": ["app/(sky)/atlas/page_client-reference-manifest.js", 2],
  "/sessions": ["app/(sky)/sessions/page_client-reference-manifest.js", 1.5],
  "/settings": ["app/(sky)/settings/page_client-reference-manifest.js", 1.5],
  "/account": ["app/(sky)/account/page_client-reference-manifest.js", 1.5],
  "/how-it-works": ["app/(sky)/how-it-works/page_client-reference-manifest.js", 1.5],
  "/about": ["app/(sky)/about/page_client-reference-manifest.js", 1.5],
  "/login": ["app/(sky)/login/page_client-reference-manifest.js", 1.5],
};

// WHY THIS LIST IS CHECKED AGAINST THE TREE (SAK-433). The comment above has
// always asked for a line per route, and asking is all it did: this script ran
// for months naming `/dev/scheduling`, a page deleted with the old app a round
// earlier, and failed every time on a manifest that could not exist. It was
// noticed by hand and fixed by hand (SAK-398). The reverse went unnoticed for
// longer, which is the worse half: `/login` has had a page of its own and no
// budget at all, so the one route where a stray import would ship the most to a
// signed-out visitor was the one route nothing measured.
//
// So the list is now derived-checked rather than trusted. Every `page.tsx` under
// src/app maps to exactly one route here, and every route here maps back. A new
// page fails until it is budgeted; a deleted one fails until its line goes. The
// `(sky)` segment is a route group and contributes nothing to the URL, which is
// the one rule this needs to know.
const APP_DIR = "src/app";

/** Every route with its own page.tsx, as a URL path. */
function routesOnDisk(dir = APP_DIR, url = "") {
  const found = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      // A parenthesized segment is a route group: it organizes files, not URLs.
      const segment = /^\(.*\)$/.test(entry.name) ? url : `${url}/${entry.name}`;
      found.push(...routesOnDisk(path.join(dir, entry.name), segment));
    } else if (entry.name === "page.tsx") {
      found.push(url === "" ? "/" : url);
    }
  }
  return found;
}

function checkRouteList() {
  const onDisk = new Set(routesOnDisk());
  const listed = new Set(Object.keys(ROUTES));
  const unbudgeted = [...onDisk].filter((r) => !listed.has(r)).sort();
  const stale = [...listed].filter((r) => !onDisk.has(r)).sort();
  const problems = [];
  for (const r of unbudgeted) problems.push(`${r} has a page.tsx and no budget in ROUTES`);
  for (const r of stale) problems.push(`${r} is in ROUTES and has no page.tsx`);
  return problems;
}

function routeSizeBytes(manifestRelPath) {
  const file = path.join(NEXT_DIR, "server", manifestRelPath);
  if (!fs.existsSync(file)) return { error: `manifest not found: ${file}` };

  const src = fs.readFileSync(file, "utf8");
  const marker = '"] = ';
  const idx = src.indexOf(marker);
  if (idx === -1) return { error: `unrecognized manifest format: ${file}` };
  const jsonStr = src.slice(idx + marker.length).replace(/;\s*$/, "");
  const manifest = JSON.parse(jsonStr);

  const chunks = new Set();
  for (const mod of Object.values(manifest.clientModules)) {
    for (const c of mod.chunks || []) chunks.add(c);
  }

  let total = 0;
  const missing = [];
  for (const c of chunks) {
    // Manifest chunk paths look like "/_next/static/chunks/xxx.js"; the file
    // on disk lives at ".next/static/chunks/xxx.js".
    const localPath = path.join(NEXT_DIR, c.replace(/^\/_next/, ""));
    try {
      total += fs.statSync(localPath).size;
    } catch {
      missing.push(localPath);
    }
  }
  return { bytes: total, chunkCount: chunks.size, missing };
}

let failed = false;
const rows = [];

const listProblems = checkRouteList();
if (listProblems.length > 0) failed = true;

for (const [route, [manifestPath, budgetMb]] of Object.entries(ROUTES)) {
  const result = routeSizeBytes(manifestPath);

  if (result.error) {
    failed = true;
    rows.push({ route, status: "FAIL", detail: result.error });
    continue;
  }

  const mb = result.bytes / 1024 / 1024;
  const over = mb > budgetMb;
  if (over) failed = true;

  let detail = `${mb.toFixed(2)}MB / ${budgetMb}MB budget across ${result.chunkCount} chunks`;
  if (result.missing.length > 0) {
    detail += ` (${result.missing.length} chunk file(s) on the manifest but missing on disk)`;
  }

  rows.push({ route, status: over ? "FAIL" : "ok", detail });
}

const routeWidth = Math.max(...Object.keys(ROUTES).map((r) => r.length));
for (const { route, status, detail } of rows) {
  const marker = status === "FAIL" ? "✗ FAIL" : "✓ ok  ";
  console.log(`${marker}  ${route.padEnd(routeWidth)}  ${detail}`);
}

for (const problem of listProblems) console.log(`✗ FAIL  ${problem}`);

if (failed) {
  console.error(
    "\nroute_sizes: the route list does not match the tree, or a route exceeded its bundle-size budget,\n" +
      "or a manifest could not be read.\n" +
      "If the growth is expected, raise that route's budget in scripts/route_sizes.mjs deliberately, do not just re-run.\n" +
      'If a route above says "manifest not found", it was likely renamed or removed; update ROUTES in this file to match.',
  );
  process.exit(1);
} else {
  console.log("\nroute_sizes: all routes within budget.");
}
